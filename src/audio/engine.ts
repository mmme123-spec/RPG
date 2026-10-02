/**
 * WebAudio engine: built-in synthesized BGM/ME/BGS/SE plus playback of
 * user-imported audio files. Audio starts after the first user gesture.
 */

import type { Asset, AudioRef } from '../core/types';
import { getSong, type Song, type Wave } from './songs';

type Ctx = AudioContext;

function parseAudioRef(name: string): { kind: 'builtin' | 'asset'; key: string } {
  const i = name.indexOf(':');
  if (i >= 0 && name.slice(0, i) === 'asset') return { kind: 'asset', key: name.slice(i + 1) };
  return { kind: 'builtin', key: i >= 0 ? name.slice(i + 1) : name };
}

function midiToFreq(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}

const waveCache = new WeakMap<Ctx, Map<string, PeriodicWave>>();

function pulseWave(ctx: Ctx, duty: number): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) {
    m = new Map();
    waveCache.set(ctx, m);
  }
  const k = `p${duty}`;
  let w = m.get(k);
  if (!w) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let i = 1; i < n; i++) {
      real[i] = (2 / (i * Math.PI)) * Math.sin(2 * Math.PI * i * duty);
      imag[i] = (2 / (i * Math.PI)) * (1 - Math.cos(2 * Math.PI * i * duty));
    }
    w = ctx.createPeriodicWave(real, imag);
    m.set(k, w);
  }
  return w;
}

const noiseCache = new WeakMap<Ctx, AudioBuffer>();

function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

function makeOsc(ctx: Ctx, wave: Wave | OscillatorType, freq: number): OscillatorNode {
  const o = ctx.createOscillator();
  if (wave === 'pulse12') o.setPeriodicWave(pulseWave(ctx, 0.125));
  else if (wave === 'pulse25') o.setPeriodicWave(pulseWave(ctx, 0.25));
  else if (wave === 'pulse50') o.type = 'square';
  else o.type = wave as OscillatorType;
  o.frequency.value = freq;
  return o;
}

/** Play one synth note through an ADSR-ish envelope. */
function playTone(ctx: Ctx, dest: AudioNode, wave: Wave | OscillatorType, freq: number, start: number, dur: number, vol: number, opts: { attack?: number; release?: number; slideTo?: number; vibrato?: number } = {}): void {
  const o = makeOsc(ctx, wave, freq);
  const g = ctx.createGain();
  const a = opts.attack ?? 0.005;
  const r = opts.release ?? Math.min(0.08, dur * 0.4);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + a);
  g.gain.setValueAtTime(vol, Math.max(start + a, start + dur - r));
  g.gain.linearRampToValueAtTime(0, start + dur);
  if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), start + dur);
  if (opts.vibrato) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = opts.vibrato;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(start);
    lfo.stop(start + dur + 0.05);
  }
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function playNoise(ctx: Ctx, dest: AudioNode, start: number, dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, freqEnd?: number): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, start);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(f).connect(g).connect(dest);
  src.start(start, Math.random());
  src.stop(start + dur + 0.05);
}

function playDrum(ctx: Ctx, dest: AudioNode, kind: string, start: number, vol: number): void {
  if (kind === 'k') {
    playTone(ctx, dest, 'sine', 150, start, 0.16, vol * 1.6, { slideTo: 40, release: 0.1 });
  } else if (kind === 's') {
    playNoise(ctx, dest, start, 0.14, vol * 0.9, 'bandpass', 1800, 0.8);
    playTone(ctx, dest, 'triangle', 220, start, 0.08, vol * 0.5, { slideTo: 120 });
  } else {
    playNoise(ctx, dest, start, 0.04, vol * 0.5, 'highpass', 7000);
  }
}

/** Sequencer for built-in songs. */
class SongPlayer {
  private ctx: Ctx;
  private out: GainNode;
  private song: Song;
  private startTime: number;
  private beatSec: number;
  private cursors: number[];
  private loopIndex = 0;
  private timer: number;
  private stopped = false;
  onEnd: (() => void) | null = null;
  readonly endTime: number;

  constructor(ctx: Ctx, dest: AudioNode, song: Song, volume: number, pitch: number) {
    this.ctx = ctx;
    this.song = song;
    this.out = ctx.createGain();
    this.out.gain.value = volume;
    this.out.connect(dest);
    this.beatSec = 60 / (song.tempo * pitch);
    this.startTime = ctx.currentTime + 0.06;
    this.cursors = song.channels.map(() => 0);
    this.endTime = this.startTime + song.length * this.beatSec;
    this.timer = window.setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  /** Schedule every note that starts within the look-ahead window. */
  private schedule(): void {
    if (this.stopped) return;
    const ahead = this.ctx.currentTime + 0.2;
    const loopLen = this.song.length * this.beatSec;
    for (;;) {
      const base = this.startTime + this.loopIndex * loopLen;
      if (base > ahead) return;
      let allScheduled = true;
      this.song.channels.forEach((ch, ci) => {
        while (this.cursors[ci] < ch.events.length) {
          const ev = ch.events[this.cursors[ci]];
          const t = base + ev.t * this.beatSec;
          if (t > ahead) {
            allScheduled = false;
            return;
          }
          if (t >= this.ctx.currentTime - 0.05) {
            if (ch.wave === 'drums') playDrum(this.ctx, this.out, String(ev.note), t, ch.volume * ev.vol);
            else
              playTone(this.ctx, this.out, ch.wave, midiToFreq(Number(ev.note)), t, ev.d * this.beatSec, ch.volume * ev.vol, {
                attack: ch.wave === 'sine' || ch.wave === 'triangle' ? 0.02 : 0.004,
              });
          }
          this.cursors[ci]++;
        }
      });
      if (!allScheduled) return;
      if (!this.song.loop) {
        window.clearInterval(this.timer);
        const remaining = this.endTime - this.ctx.currentTime;
        window.setTimeout(() => {
          if (!this.stopped) this.onEnd?.();
        }, Math.max(0, remaining * 1000));
        return;
      }
      this.loopIndex++;
      this.cursors = this.song.channels.map(() => 0);
    }
  }

  setVolume(v: number): void {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  fadeOut(seconds: number): void {
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + Math.max(0.05, seconds));
    window.setTimeout(() => this.stop(), seconds * 1000 + 100);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    window.clearInterval(this.timer);
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + 0.05);
    window.setTimeout(() => this.out.disconnect(), 400);
  }
}

/** Looping player for an imported audio buffer. */
class BufferPlayer {
  private src: AudioBufferSourceNode;
  private out: GainNode;
  private ctx: Ctx;
  private stopped = false;
  onEnd: (() => void) | null = null;

  constructor(ctx: Ctx, dest: AudioNode, buffer: AudioBuffer, volume: number, pitch: number, loop: boolean) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = volume;
    this.out.connect(dest);
    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = loop;
    this.src.playbackRate.value = pitch;
    this.src.connect(this.out);
    this.src.onended = () => {
      if (!this.stopped) this.onEnd?.();
    };
    this.src.start();
  }

  setVolume(v: number): void {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  fadeOut(seconds: number): void {
    const now = this.ctx.currentTime;
    this.out.gain.setValueAtTime(this.out.gain.value, now);
    this.out.gain.linearRampToValueAtTime(0, now + Math.max(0.05, seconds));
    window.setTimeout(() => this.stop(), seconds * 1000 + 100);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    try {
      this.src.stop();
    } catch {
      // already stopped
    }
    window.setTimeout(() => this.out.disconnect(), 100);
  }
}

/** Ambient noise loops for the built-in BGS. */
class AmbientPlayer {
  private nodes: AudioNode[] = [];
  private sources: (AudioBufferSourceNode | OscillatorNode)[] = [];
  private out: GainNode;
  private ctx: Ctx;

  constructor(ctx: Ctx, dest: AudioNode, kind: string, volume: number) {
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1);
    this.out.connect(dest);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    if (kind === 'rain') {
      f.type = 'highpass';
      f.frequency.value = 1200;
    } else if (kind === 'wind') {
      f.type = 'bandpass';
      f.frequency.value = 500;
      f.Q.value = 1.5;
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 0.15;
      lg.gain.value = 300;
      lfo.connect(lg).connect(f.frequency);
      lfo.start();
      this.sources.push(lfo);
    } else {
      f.type = 'lowpass';
      f.frequency.value = 900;
    }
    const g = ctx.createGain();
    g.gain.value = kind === 'rain' ? 0.25 : 0.5;
    src.connect(f).connect(g).connect(this.out);
    src.start();
    this.sources.push(src);
    this.nodes.push(f, g);
  }

  setVolume(v: number): void {
    this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  fadeOut(seconds: number): void {
    this.out.gain.setTargetAtTime(0, this.ctx.currentTime, seconds / 3);
    window.setTimeout(() => this.stop(), seconds * 1000 + 100);
  }

  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    this.out.disconnect();
  }
}

type Player = SongPlayer | BufferPlayer | AmbientPlayer;

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

type SfxFn = (ctx: Ctx, out: AudioNode, t: number, v: number, p: number) => void;

const SFX: Record<string, SfxFn> = {
  cursor: (c, o, t, v, p) => playTone(c, o, 'pulse25', 1100 * p, t, 0.035, 0.25 * v),
  ok: (c, o, t, v, p) => {
    playTone(c, o, 'pulse25', 880 * p, t, 0.05, 0.25 * v);
    playTone(c, o, 'pulse25', 1320 * p, t + 0.05, 0.07, 0.25 * v);
  },
  cancel: (c, o, t, v, p) => playTone(c, o, 'pulse25', 700 * p, t, 0.1, 0.25 * v, { slideTo: 380 * p }),
  buzzer: (c, o, t, v, p) => {
    playTone(c, o, 'square', 140 * p, t, 0.08, 0.2 * v);
    playTone(c, o, 'square', 120 * p, t + 0.1, 0.12, 0.2 * v);
  },
  equip: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.06, 0.3 * v, 'highpass', 3000);
    playTone(c, o, 'triangle', 660 * p, t, 0.12, 0.3 * v);
    playTone(c, o, 'triangle', 990 * p, t + 0.04, 0.14, 0.2 * v);
  },
  save: (c, o, t, v, p) => [523, 659, 784, 1047].forEach((f, i) => playTone(c, o, 'triangle', f * p, t + i * 0.08, 0.18, 0.3 * v)),
  load: (c, o, t, v, p) => [1047, 784, 659, 784].forEach((f, i) => playTone(c, o, 'triangle', f * p, t + i * 0.08, 0.18, 0.3 * v)),
  battleStart: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.6, 0.35 * v, 'bandpass', 300, 1, 4000);
    playTone(c, o, 'sawtooth', 110 * p, t, 0.6, 0.12 * v, { slideTo: 880 * p });
  },
  escape: (c, o, t, v, p) => [0, 0.09, 0.18, 0.27].forEach((d) => playNoise(c, o, t + d, 0.06, 0.25 * v, 'bandpass', 900 * p, 2)),
  slash: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.18, 0.5 * v, 'bandpass', 2500 * p, 1.5, 6000 * p);
    playNoise(c, o, t + 0.02, 0.1, 0.3 * v, 'highpass', 5000);
  },
  hit: (c, o, t, v, p) => {
    playTone(c, o, 'sine', 160 * p, t, 0.14, 0.6 * v, { slideTo: 50 });
    playNoise(c, o, t, 0.1, 0.4 * v, 'lowpass', 1500);
  },
  enemyDie: (c, o, t, v, p) => {
    playTone(c, o, 'sawtooth', 600 * p, t, 0.5, 0.15 * v, { slideTo: 60 });
    playNoise(c, o, t, 0.5, 0.25 * v, 'lowpass', 2000, 1, 200);
  },
  damage: (c, o, t, v, p) => {
    playTone(c, o, 'square', 220 * p, t, 0.12, 0.2 * v, { slideTo: 110 * p });
    playNoise(c, o, t, 0.12, 0.35 * v, 'lowpass', 1200);
  },
  collapse: (c, o, t, v, p) => playTone(c, o, 'triangle', 440 * p, t, 0.5, 0.3 * v, { slideTo: 80 }),
  heal: (c, o, t, v, p) => [784, 988, 1175, 1568].forEach((f, i) => playTone(c, o, 'sine', f * p, t + i * 0.06, 0.25, 0.22 * v, { attack: 0.02 })),
  miss: (c, o, t, v, p) => playNoise(c, o, t, 0.2, 0.25 * v, 'bandpass', 4000 * p, 3, 1500 * p),
  evade: (c, o, t, v, p) => playNoise(c, o, t, 0.15, 0.25 * v, 'bandpass', 1500 * p, 3, 5000 * p),
  item: (c, o, t, v, p) => [660, 880, 1100].forEach((f, i) => playTone(c, o, 'sine', f * p, t + i * 0.05, 0.12, 0.25 * v)),
  magic: (c, o, t, v, p) => {
    playTone(c, o, 'sine', 400 * p, t, 0.5, 0.2 * v, { slideTo: 1600 * p, vibrato: 30, attack: 0.05 });
    playTone(c, o, 'triangle', 800 * p, t + 0.1, 0.4, 0.12 * v, { slideTo: 2400 * p, vibrato: 50 });
  },
  fire: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.6, 0.45 * v, 'lowpass', 400 * p, 1, 3000 * p);
    playTone(c, o, 'sawtooth', 90 * p, t, 0.5, 0.1 * v, { slideTo: 200 * p });
  },
  ice: (c, o, t, v, p) => [2093, 2637, 3136, 2349].forEach((f, i) => playTone(c, o, 'sine', f * p, t + i * 0.05, 0.3, 0.15 * v)),
  thunder: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.08, 0.7 * v, 'highpass', 2000);
    playNoise(c, o, t + 0.05, 0.9, 0.6 * v, 'lowpass', 600 * p, 1, 80);
  },
  door: (c, o, t, v, p) => {
    playTone(c, o, 'sawtooth', 180 * p, t, 0.25, 0.08 * v, { slideTo: 260 * p });
    playTone(c, o, 'sine', 90 * p, t + 0.22, 0.12, 0.5 * v, { slideTo: 50 });
  },
  chest: (c, o, t, v, p) => {
    playTone(c, o, 'sawtooth', 220 * p, t, 0.2, 0.08 * v, { slideTo: 330 * p });
    [1047, 1319, 1568].forEach((f, i) => playTone(c, o, 'triangle', f * p, t + 0.2 + i * 0.07, 0.2, 0.2 * v));
  },
  coin: (c, o, t, v, p) => {
    playTone(c, o, 'pulse25', 988 * p, t, 0.07, 0.22 * v);
    playTone(c, o, 'pulse25', 1319 * p, t + 0.07, 0.25, 0.22 * v);
  },
  jump: (c, o, t, v, p) => playTone(c, o, 'pulse25', 300 * p, t, 0.18, 0.2 * v, { slideTo: 900 * p }),
  bell: (c, o, t, v, p) => {
    playTone(c, o, 'sine', 880 * p, t, 1.2, 0.25 * v, { release: 1 });
    playTone(c, o, 'sine', 1760 * p, t, 0.8, 0.1 * v, { release: 0.7 });
  },
  explosion: (c, o, t, v, p) => {
    playNoise(c, o, t, 1, 0.8 * v, 'lowpass', 1200 * p, 1, 60);
    playTone(c, o, 'sine', 90 * p, t, 0.6, 0.6 * v, { slideTo: 30 });
  },
  powerUp: (c, o, t, v, p) => [523, 659, 784, 1047, 1319].forEach((f, i) => playTone(c, o, 'pulse25', f * p, t + i * 0.05, 0.1, 0.18 * v)),
  stairs: (c, o, t, v, p) => [0, 0.12, 0.24].forEach((d, i) => playNoise(c, o, t + d, 0.08, 0.3 * v, 'lowpass', (900 - i * 200) * p)),
  switch: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.03, 0.4 * v, 'highpass', 3000);
    playTone(c, o, 'square', 1200 * p, t, 0.03, 0.15 * v);
  },
  bite: (c, o, t, v, p) => {
    playNoise(c, o, t, 0.12, 0.5 * v, 'bandpass', 1200 * p, 2);
    playNoise(c, o, t + 0.08, 0.1, 0.4 * v, 'bandpass', 900 * p, 2);
  },
};

export const SFX_KEYS = Object.keys(SFX);

export interface AudioSettings {
  bgm: number;
  se: number;
}

export class AudioEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private assets = new Map<string, Asset>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private bgmRef: AudioRef | null = null;
  private bgsRef: AudioRef | null = null;
  private bgmPlayer: Player | null = null;
  private bgsPlayer: Player | null = null;
  private mePlayer: Player | null = null;
  private meResumeBgm: AudioRef | null = null;
  settings: AudioSettings = { bgm: 0.8, se: 0.9 };
  muted = false;

  constructor(assets: Asset[] = []) {
    this.setAssets(assets);
  }

  setAssets(assets: Asset[]): void {
    this.assets = new Map(assets.filter((a) => a.kind === 'audio').map((a) => [a.id, a]));
  }

  /** Create/resume the AudioContext; call from a user gesture. */
  unlock(): void {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
      // start anything requested before the context existed
      const bgm = this.bgmRef;
      const bgs = this.bgsRef;
      this.bgmRef = null;
      this.bgsRef = null;
      if (bgm) this.playBgm(bgm);
      if (bgs) this.playBgs(bgs);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  isUnlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
  }

  private loadBuffer(id: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(id);
    if (!p) {
      const asset = this.assets.get(id);
      const ctx = this.ctx;
      if (!asset || !ctx) return Promise.resolve(null);
      p = fetch(asset.dataUrl)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(id, p);
    }
    return p;
  }

  private vol(ref: AudioRef, kind: 'bgm' | 'se'): number {
    return (Math.max(0, Math.min(100, ref.volume)) / 100) * this.settings[kind];
  }

  private pitch(ref: AudioRef): number {
    return Math.max(0.5, Math.min(1.5, (ref.pitch || 100) / 100));
  }

  playSe(ref: AudioRef | null | undefined): void {
    if (!ref || !ref.name || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const { kind, key } = parseAudioRef(ref.name);
    const v = this.vol(ref, 'se');
    if (kind === 'builtin') {
      const fn = SFX[key];
      if (fn) fn(this.ctx, this.master, this.ctx.currentTime + 0.005, v, this.pitch(ref));
      return;
    }
    const ctx = this.ctx;
    const master = this.master;
    void this.loadBuffer(key).then((buf) => {
      if (buf) new BufferPlayer(ctx, master, buf, v, this.pitch(ref), false);
    });
  }

  private startMusic(ref: AudioRef, loop: boolean, onEnd?: () => void): Player | null {
    if (!this.ctx || !this.master) return null;
    const { kind, key } = parseAudioRef(ref.name);
    const v = this.vol(ref, 'bgm');
    if (kind === 'builtin') {
      const song = getSong(key);
      if (!song) return null;
      const s = loop || !song.loop ? song : { ...song, loop: false };
      const player = new SongPlayer(this.ctx, this.master, s, v, this.pitch(ref));
      if (onEnd) player.onEnd = onEnd;
      return player;
    }
    // imported audio: decode asynchronously, then start
    const holder: { p: BufferPlayer | null; stopped: boolean } = { p: null, stopped: false };
    const ctx = this.ctx;
    const master = this.master;
    void this.loadBuffer(key).then((buf) => {
      if (!buf || holder.stopped) return;
      holder.p = new BufferPlayer(ctx, master, buf, v, this.pitch(ref), loop);
      if (onEnd) holder.p.onEnd = onEnd;
    });
    const proxy = {
      setVolume: (x: number) => holder.p?.setVolume(x),
      fadeOut: (s: number) => {
        holder.stopped = true;
        holder.p?.fadeOut(s);
      },
      stop: () => {
        holder.stopped = true;
        holder.p?.stop();
      },
    };
    return proxy as unknown as Player;
  }

  playBgm(ref: AudioRef | null): void {
    if (!ref || !ref.name) {
      this.bgmPlayer?.stop();
      this.bgmPlayer = null;
      this.bgmRef = null;
      return;
    }
    if (this.mePlayer) {
      this.meResumeBgm = ref;
      return;
    }
    if (this.bgmRef && this.bgmRef.name === ref.name && this.bgmPlayer) {
      if (this.bgmRef.volume !== ref.volume) this.bgmPlayer.setVolume(this.vol(ref, 'bgm'));
      this.bgmRef = { ...ref };
      return;
    }
    this.bgmPlayer?.stop();
    this.bgmRef = { ...ref };
    this.bgmPlayer = this.startMusic(ref, true);
  }

  playBgs(ref: AudioRef | null): void {
    this.bgsPlayer?.fadeOut(0.5);
    this.bgsPlayer = null;
    this.bgsRef = ref && ref.name ? { ...ref } : null;
    if (!this.bgsRef || !this.ctx || !this.master) return;
    const { kind, key } = parseAudioRef(this.bgsRef.name);
    if (kind === 'builtin') this.bgsPlayer = new AmbientPlayer(this.ctx, this.master, key, this.vol(this.bgsRef, 'bgm'));
    else this.bgsPlayer = this.startMusic(this.bgsRef, true);
  }

  /** Play a music effect; the BGM pauses and resumes afterwards. */
  playMe(ref: AudioRef | null): void {
    if (!ref || !ref.name || !this.ctx) return;
    this.mePlayer?.stop();
    if (!this.mePlayer) this.meResumeBgm = this.bgmRef;
    this.bgmPlayer?.stop();
    this.bgmPlayer = null;
    this.bgmRef = null;
    const player = this.startMusic(ref, false, () => {
      if (this.mePlayer !== player) return;
      this.mePlayer = null;
      const resume = this.meResumeBgm;
      this.meResumeBgm = null;
      if (resume) this.playBgm(resume);
    });
    this.mePlayer = player;
    if (!player) {
      const resume = this.meResumeBgm;
      this.meResumeBgm = null;
      if (resume) this.playBgm(resume);
    }
  }

  isMePlaying(): boolean {
    return this.mePlayer !== null;
  }

  fadeOutBgm(seconds: number): void {
    this.bgmPlayer?.fadeOut(seconds);
    this.bgmPlayer = null;
    this.bgmRef = null;
  }

  stopAll(): void {
    this.bgmPlayer?.stop();
    this.bgsPlayer?.stop();
    this.mePlayer?.stop();
    this.bgmPlayer = null;
    this.bgsPlayer = null;
    this.mePlayer = null;
    this.bgmRef = null;
    this.bgsRef = null;
    this.meResumeBgm = null;
  }

  currentBgm(): AudioRef | null {
    return this.bgmRef ?? this.meResumeBgm;
  }

  currentBgs(): AudioRef | null {
    return this.bgsRef;
  }

  /** Close the AudioContext (when the game is destroyed). */
  dispose(): void {
    this.stopAll();
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
