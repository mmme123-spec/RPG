/**
 * A small Music Macro Language parser and chord-based accompaniment helpers
 * used to compose the built-in chiptune soundtrack.
 *
 * MML: t<bpm> l<len> o<oct> v<0-15> > < (octave up/down)
 *      notes c d e f g a b with + # - accidentals, optional length and dot,
 *      r rest, & tie, [ ... ]n repeat, drums k s h, '|' and spaces ignored.
 */

export interface NoteEvent {
  /** Start time in beats */
  t: number;
  /** Duration in beats */
  d: number;
  /** MIDI note number, or a drum name ('k', 's', 'h') */
  note: number | string;
  /** 0..1 */
  vol: number;
}

const NOTE_BASE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function parseMML(src: string): { events: NoteEvent[]; length: number } {
  // expand repeats first
  const expand = (s: string): string => {
    let out = s;
    for (let guard = 0; guard < 50; guard++) {
      const m = /\[([^[\]]*)\](\d*)/.exec(out);
      if (!m) break;
      const n = m[2] ? parseInt(m[2], 10) : 2;
      out = out.slice(0, m.index) + m[1].repeat(n) + out.slice(m.index + m[0].length);
    }
    return out;
  };
  const s = expand(src.toLowerCase());
  const events: NoteEvent[] = [];
  let i = 0;
  let t = 0;
  let octave = 4;
  let defLen = 4;
  let vol = 12;
  let tie = false;
  const readNum = (): number | null => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseInt(m[0], 10);
  };
  const readLen = (): number => {
    const n = readNum();
    let beats = 4 / (n ?? defLen);
    let dotVal = beats / 2;
    while (s[i] === '.') {
      beats += dotVal;
      dotVal /= 2;
      i++;
    }
    return beats;
  };
  while (i < s.length) {
    const ch = s[i++];
    if (ch === 't') {
      readNum();
    } else if (ch === 'l') {
      defLen = readNum() ?? defLen;
    } else if (ch === 'o') {
      octave = readNum() ?? octave;
    } else if (ch === 'v') {
      vol = readNum() ?? vol;
    } else if (ch === '>') {
      octave++;
    } else if (ch === '<') {
      octave--;
    } else if (ch === '&') {
      tie = true;
    } else if (ch === 'r') {
      t += readLen();
      tie = false;
    } else if (ch === 'k' || ch === 's' || ch === 'h') {
      const d = readLen();
      events.push({ t, d, note: ch, vol: vol / 15 });
      t += d;
    } else if (ch in NOTE_BASE) {
      let n = NOTE_BASE[ch];
      if (s[i] === '+' || s[i] === '#') {
        n++;
        i++;
      } else if (s[i] === '-') {
        n--;
        i++;
      }
      const d = readLen();
      const midi = 12 * (octave + 1) + n;
      const last = events[events.length - 1];
      if (tie && last && last.note === midi && Math.abs(last.t + last.d - t) < 1e-6) last.d += d;
      else events.push({ t, d, note: midi, vol: vol / 15 });
      t += d;
      tie = false;
    }
  }
  return { events, length: t };
}

const CHORDS: Record<string, number[]> = {
  C: [0, 4, 7],
  Cm: [0, 3, 7],
  D: [2, 6, 9],
  Dm: [2, 5, 9],
  E: [4, 8, 11],
  Em: [4, 7, 11],
  F: [5, 9, 12],
  Fm: [5, 8, 12],
  G: [7, 11, 14],
  Gm: [7, 10, 14],
  A: [9, 13, 16],
  Am: [9, 12, 16],
  Ab: [8, 12, 15],
  Bb: [10, 14, 17],
  B: [11, 15, 18],
  Bm: [11, 14, 18],
  Eb: [3, 7, 10],
  'C#m': [1, 4, 8],
  'F#m': [6, 9, 13],
};

/** Chord progression entry: chord name and length in beats. */
export type ChordSpan = [string, number];

/** Broken-chord accompaniment. */
export function arpeggio(chords: ChordSpan[], octave: number, step: number, pattern: number[], vol: number): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let t = 0;
  for (const [name, beats] of chords) {
    const tones = CHORDS[name] ?? CHORDS.C;
    const n = Math.round(beats / step);
    for (let i = 0; i < n; i++) {
      const idx = pattern[i % pattern.length];
      const up = Math.floor(idx / tones.length);
      const note = 12 * (octave + 1) + tones[idx % tones.length] + up * 12;
      events.push({ t: t + i * step, d: step * 0.9, note, vol });
    }
    t += beats;
  }
  return { events, length: t };
}

/** Bass line playing chord roots (and fifths) with a rhythmic pattern. */
export function bass(chords: ChordSpan[], octave: number, step: number, pattern: ('r' | 'f' | 'o' | '-')[], vol: number): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let t = 0;
  for (const [name, beats] of chords) {
    const tones = CHORDS[name] ?? CHORDS.C;
    const root = 12 * (octave + 1) + (tones[0] % 12);
    const n = Math.round(beats / step);
    for (let i = 0; i < n; i++) {
      const p = pattern[i % pattern.length];
      if (p === '-') continue;
      const note = p === 'r' ? root : p === 'f' ? root + 7 : root + 12;
      events.push({ t: t + i * step, d: step * 0.85, note, vol });
    }
    t += beats;
  }
  return { events, length: t };
}

/** Sustained chord pads. */
export function pads(chords: ChordSpan[], octave: number, vol: number): { events: NoteEvent[]; length: number } {
  const events: NoteEvent[] = [];
  let t = 0;
  for (const [name, beats] of chords) {
    for (const tone of CHORDS[name] ?? CHORDS.C) events.push({ t, d: beats * 0.95, note: 12 * (octave + 1) + tone, vol });
    t += beats;
  }
  return { events, length: t };
}
