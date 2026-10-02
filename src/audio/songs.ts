/** The built-in soundtrack, composed with MML melodies over chord-based accompaniment. */

import { arpeggio, bass, pads, parseMML, type ChordSpan, type NoteEvent } from './mml';

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'sine' | 'sawtooth' | 'drums';

export interface Channel {
  wave: Wave;
  volume: number;
  events: NoteEvent[];
}

export interface Song {
  tempo: number;
  loop: boolean;
  length: number;
  channels: Channel[];
}

function ch(wave: Wave, volume: number, src: { events: NoteEvent[]; length: number }): Channel & { length: number } {
  return { wave, volume, events: src.events, length: src.length };
}

function song(tempo: number, loop: boolean, channels: (Channel & { length: number })[]): Song {
  return { tempo, loop, length: Math.max(...channels.map((c) => c.length)), channels };
}

const bars = (list: string[], beats = 4): ChordSpan[] => list.map((c): ChordSpan => {
  const [name, len] = c.split(':');
  return [name, len ? Number(len) : beats];
});

const SONGS: Record<string, () => Song> = {
  title: () => {
    const prog = bars(['C', 'Am', 'F', 'G', 'C', 'Am', 'F:2', 'G:2', 'C']);
    return song(96, true, [
      ch('pulse25', 0.16, parseMML('o5 l8 e4 g4 >c4.< b8 | a4 e4 a2 | f4 a4 >c4. d8< | b2. r4 | >c4 <g4 >c4. d8 | e4 d4 c4 <a4 | f4 a4 g4 b4 | >c2.< r4')),
      ch('pulse12', 0.07, arpeggio(prog, 4, 0.5, [0, 1, 2, 1], 1)),
      ch('triangle', 0.26, bass(prog, 2, 1, ['r', 'r', 'f', 'f'], 1)),
    ]);
  },
  town: () => {
    const prog = bars(['F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb:2', 'C:2', 'F']);
    return song(112, true, [
      ch('pulse50', 0.11, parseMML('o5 l8 a4 a8 g8 f4 c4 | e4 g8 f8 e4 c4 | d4 f8 e8 d4 a4 | b-2 a4 g4 | a4 a8 g8 f4 a4 | g4 e8 f8 g4 >c4< | b-4 a8 g8 a4 g4 | f2. r4')),
      ch('pulse12', 0.06, arpeggio(prog, 4, 0.5, [0, 1, 2, 1], 1)),
      ch('triangle', 0.24, bass(prog, 2, 1, ['r', 'f', 'o', 'f'], 1)),
      ch('drums', 0.12, parseMML('[k4 h4 h4 h4]8')),
    ]);
  },
  field: () => {
    const prog = bars(['G', 'D', 'Em', 'C', 'G', 'D', 'C:2', 'D:2', 'G']);
    return song(132, true, [
      ch('pulse25', 0.15, parseMML('o5 l8 d4 g8 a8 b4 a8 g8 | f+4 a8 g8 f+4 d4 | e4 g8 f+8 e4 b4 | c2 e4 g4 | d4 g8 a8 b4 >d4< | a4 f+8 g8 a4 >d4< | >c4< b8 a8 b4 a4 | g2. r4')),
      ch('pulse12', 0.06, arpeggio(prog, 4, 0.5, [0, 2, 1, 2], 1)),
      ch('triangle', 0.26, bass(prog, 2, 0.5, ['r', 'r', 'f', 'r', 'o', 'r', 'f', 'r'], 1)),
      ch('drums', 0.16, parseMML('[k8 h8 s8 h8 k8 k8 s8 h8]8')),
    ]);
  },
  dungeon: () => {
    const prog = bars(['Am', 'Am', 'F', 'E', 'Am', 'Dm', 'E', 'E']);
    return song(84, true, [
      ch('pulse12', 0.13, parseMML('o5 a2 >c4< b4 | a2 e2 | f2 e4 d4 | e1 | a2 >c4 d4< | >e2 d4 c4< | b2 >c4< b4 | g+1')),
      ch('triangle', 0.1, arpeggio(prog, 3, 1, [0, 1, 2, 1], 1)),
      ch('triangle', 0.24, bass(prog, 2, 2, ['r'], 1)),
      ch('drums', 0.1, parseMML('[k4 r4 k8 k8 r4]8')),
    ]);
  },
  castle: () => {
    const prog = bars(['D', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D']);
    return song(100, true, [
      ch('pulse50', 0.12, parseMML('o5 l8 d4. d8 f+4 a4 | b4 a4 g4 b4 | a4. g8 f+4 e4 | f+2 d4 r4 | d4. d8 f+4 a4 | b4 >d4 c+4< b4 | a4 f+4 e4 a4 | d2. r4')),
      ch('pulse25', 0.06, arpeggio(prog, 4, 1, [0, 1, 2, 1], 1)),
      ch('triangle', 0.25, bass(prog, 2, 1, ['r', 'o', 'f', 'o'], 1)),
      ch('drums', 0.14, parseMML('[k4 s8 s8 k4 s4]8')),
    ]);
  },
  battle: () => {
    const prog = bars(['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B']);
    return song(152, true, [
      ch('pulse25', 0.15, parseMML('o5 e8 e8 g8 a8 b4 a8 g8 | f+8 f+8 a8 b8 o6 c4 o5 b8 a8 | g8 g8 e8 g8 o6 c4 d4 | o5 b4 a4 g4 f+4 | e8 e8 g8 a8 b4 o6 e4 | d8 d8 c8 o5 b8 o6 c4 o5 a4 | g8 f+8 e8 d+8 e4 g4 | f+2 d+2')),
      ch('pulse12', 0.06, arpeggio(prog, 4, 0.25, [0, 1, 2, 1], 1)),
      ch('triangle', 0.27, bass(prog, 2, 0.5, ['r', 'o'], 1)),
      ch('drums', 0.18, parseMML('[k8 h8 s8 h8 k8 k8 s8 h8]8')),
    ]);
  },
  boss: () => {
    const prog = bars(['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Ab', 'G']);
    return song(144, true, [
      ch('pulse25', 0.15, parseMML('o5 c8 c8 r8 c8 e-8 d8 c8 o4 b-8 | o5 c4 g4 f8 e-8 d8 e-8 | c8 c8 r8 c8 a-8 g8 f8 e-8 | d2 o4 b-4 o5 d4 | c8 c8 r8 c8 e-8 d8 c8 o4 b-8 | o5 c4 g4 a-8 g8 f8 e-8 | f4 e-4 d4 c4 | o4 b2 o5 d2')),
      ch('sawtooth', 0.04, arpeggio(prog, 3, 0.5, [0, 1, 2, 1], 1)),
      ch('triangle', 0.28, bass(prog, 1, 0.5, ['r', 'r', 'o', 'r'], 1)),
      ch('drums', 0.2, parseMML('[k8 k8 s8 h8 k8 h8 s8 s16 s16]8')),
    ]);
  },
  sad: () => {
    const prog = bars(['Am', 'F', 'C', 'G', 'Am', 'F', 'E', 'Am']);
    return song(72, true, [
      ch('sine', 0.2, parseMML('o5 e2 a4 g4 | f2 e4 d4 | e2 c4 d4 | d2 o4 b2 | o5 c2 e4 d4 | c2 o4 a4 o5 c4 | o4 b2 g+4 b4 | a1')),
      ch('triangle', 0.1, arpeggio(prog, 3, 1, [0, 1, 2, 3], 1)),
      ch('triangle', 0.2, bass(prog, 2, 4, ['r'], 1)),
    ]);
  },
  // --- music effects (non looping) -----------------------------------------
  victory: () => {
    const prog = bars(['C:3', 'Ab:1', 'Bb:1', 'C:3']);
    return song(140, false, [
      ch('pulse25', 0.16, parseMML('o5 l8 c8 c8 c8 c4. o4 a-4 b-4 o5 c8 r8 o4 b-8 o5 c2.')),
      ch('pulse12', 0.08, pads(prog, 4, 1)),
      ch('triangle', 0.25, bass(prog, 2, 1, ['r'], 1)),
    ]);
  },
  gameover: () => {
    const prog = bars(['Am', 'F', 'Dm', 'E', 'Am']);
    return song(70, false, [
      ch('sine', 0.2, parseMML('o5 e2 d2 | c2 o4 a2 | f2 a2 | g+1 | a1')),
      ch('triangle', 0.2, pads(prog, 3, 1)),
    ]);
  },
  inn: () => {
    const prog = bars(['C:2', 'F:2', 'G:2', 'C:3']);
    return song(100, false, [
      ch('sine', 0.2, parseMML('o5 c4 e4 f4 a4 g4 b4 o6 c2.')),
      ch('triangle', 0.15, arpeggio(prog, 4, 0.5, [0, 1, 2, 1], 1)),
    ]);
  },
  itemGet: () => {
    const prog = bars(['C:1.5', 'F:0.5', 'G:0.5', 'C:1.5']);
    return song(150, false, [
      ch('pulse25', 0.16, parseMML('o5 c8 e8 g8 o6 c4 o5 a8 b8 o6 c4.')),
      ch('triangle', 0.22, bass(prog, 3, 0.5, ['r'], 1)),
    ]);
  },
  levelUp: () =>
    song(170, false, [
      ch('pulse25', 0.16, parseMML('o5 c16 e16 g16 o6 c8 o5 g16 o6 c4')),
      ch('pulse12', 0.1, parseMML('o4 g16 o5 c16 e16 g8 e16 g4')),
    ]),
};

const cache = new Map<string, Song>();

export function getSong(key: string): Song | null {
  if (!SONGS[key]) return null;
  let s = cache.get(key);
  if (!s) {
    s = SONGS[key]();
    cache.set(key, s);
  }
  return s;
}

export const SONG_KEYS = Object.keys(SONGS);
