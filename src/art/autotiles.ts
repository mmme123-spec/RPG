/**
 * Procedural autotile art. Each terrain is drawn as an A2 (floor) or A3
 * (wall) style block. Borders are computed from a per-pixel distance to the
 * edge of the terrain region inside the block, so the same style produces
 * consistent outer edges, rounded outer corners and inner corners.
 */

import { BUILTIN_AUTOTILES, builtinAutotileLayout, autotileSheetRows, AUTOTILE_SHEET_COLUMNS } from '../core/builtins';
import type { AutotileType } from '../core/types';
import { P, mix } from './color';
import { Pix, hash2, tileNoise } from './pixel';

/** Art resolution of one tile (scaled 2x to 32px). */
const T = 16;

type FillFn = (x: number, y: number, frame: number) => string | null;

interface EdgeInfo {
  /** Combined distance to the region edge (negative = outside rounded corner). */
  d: number;
  dT: number;
  dB: number;
  dL: number;
  dR: number;
  x: number;
  y: number;
  frame: number;
  fill: string | null;
}

interface TerrainStyle {
  fill: FillFn;
  /** Return a colour, null (transparent) or undefined (use the fill). */
  edge?: (e: EdgeInfo) => string | null | undefined;
  radius: number;
  noise?: number;
}

const m16 = (v: number) => ((v % 16) + 16) % 16;

// ---------------------------------------------------------------------------
// Fill textures (all periodic with a 16 pixel period)
// ---------------------------------------------------------------------------

const grassFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 11);
  let c = n > 0.66 ? mix(P.g3, P.g4, 0.35) : P.g3;
  // little grass tufts: a light blade with darker sides
  const tufts: [number, number][] = [
    [3, 2],
    [11, 4],
    [6, 9],
    [14, 11],
    [2, 13],
    [9, 14],
  ];
  for (const [tx, ty] of tufts) {
    if (y === ty && x === tx) c = P.g4;
    else if (y === ty + 1 && (x === tx - 1 || x === tx + 1)) c = P.g2;
    else if (y === ty + 1 && x === tx) c = P.g4;
  }
  const h = hash2(x, y, 5);
  if (h > 0.97) c = P.g5;
  else if (h < 0.03) c = P.g2;
  return c;
};

const darkGrassFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 21);
  let c = n > 0.6 ? P.g2 : mix(P.g1, P.g2, 0.5);
  const h = hash2(x, y, 23);
  if (h > 0.95) c = P.g3;
  else if (h < 0.04) c = P.g1;
  else if (h > 0.93) c = P.b3; // leaf litter
  return c;
};

const dirtFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 31);
  let c = n > 0.62 ? mix(P.b4, P.b5, 0.25) : P.b4;
  const h = hash2(x, y, 33);
  if (h < 0.05) c = P.b3;
  else if (h > 0.96) c = P.b5;
  // pebbles
  if ((x === 4 && y === 5) || (x === 12 && y === 11) || (x === 9 && y === 2)) c = P.k3;
  if ((x === 5 && y === 5) || (x === 13 && y === 11) || (x === 10 && y === 2)) c = P.b2;
  return c;
};

const sandFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 41);
  let c = n > 0.6 ? mix(P.s3, P.s4, 0.4) : P.s3;
  const h = hash2(x, y, 43);
  if (h < 0.06) c = P.s2;
  else if (h > 0.96) c = P.s4;
  return c;
};

const snowFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 51);
  let c = n > 0.55 ? '#f4f8fc' : P.k6;
  const h = hash2(x, y, 53);
  if (h < 0.05) c = '#cfdbea';
  else if (h > 0.97) c = P.white;
  return c;
};

/** Periodic voronoi cobblestones. */
const cobbleSeeds: [number, number][] = [
  [3, 3],
  [11, 2],
  [7, 8],
  [14, 9],
  [2, 12],
  [10, 14],
];
const cobbleShades = [P.k3, P.k4, mix(P.k3, P.k4, 0.5), P.k4, P.k3, mix(P.k3, P.b4, 0.25)];
const cobbleFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  let best = Infinity;
  let second = Infinity;
  let idx = 0;
  cobbleSeeds.forEach(([sx, sy], i) => {
    let dx = Math.abs(x + 0.5 - sx);
    let dy = Math.abs(y + 0.5 - sy);
    dx = Math.min(dx, 16 - dx);
    dy = Math.min(dy, 16 - dy);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < best) {
      second = best;
      best = d;
      idx = i;
    } else if (d < second) second = d;
  });
  if (second - best < 1.1) return P.k1;
  if (second - best < 2 && hash2(x, y, 61) < 0.5) return P.k2;
  const base = cobbleShades[idx];
  return best < 1.6 ? mix(base, P.k5, 0.35) : base;
};

function waterFill(base: string, mid: string, light: string, foam: string): FillFn {
  const dashes: [number, number, number][] = [
    [2, 3, 4],
    [10, 5, 3],
    [5, 10, 3],
    [13, 13, 4],
    [8, 0, 2],
  ];
  return (x, y, frame) => {
    x = m16(x);
    y = m16(y);
    const n = tileNoise(x, y + frame * 2, 16, 8, 71);
    let c = n > 0.62 ? mid : base;
    const shift = [0, 1, 2][frame] ?? 0;
    for (const [dx, dy, len] of dashes) {
      if (y !== dy) continue;
      const rel = m16(x - dx - shift);
      if (rel < len) c = rel === 0 || rel === len - 1 ? light : foam;
    }
    return c;
  };
}

const waterBase = waterFill(P.w2, mix(P.w2, P.w3, 0.4), P.w3, P.w4);
const deepWaterBase = waterFill(P.w0, mix(P.w0, P.w1, 0.6), P.w1, P.w2);
const shallowBase: FillFn = (x, y, frame) => {
  const c = waterFill(mix(P.w3, P.s3, 0.25), mix(P.w3, P.w4, 0.5), P.w4, P.w5)(x, y, frame);
  if (hash2(m16(x), m16(y), 81) < 0.05) return mix(P.s3, P.w3, 0.4);
  return c;
};

const lavaFill: FillFn = (x, y, frame) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x + frame * 3, y, 16, 8, 91);
  let c = n > 0.65 ? P.o3 : n < 0.3 ? P.o1 : P.o2;
  const blobs: [number, number][] = [
    [4, 4],
    [12, 9],
    [6, 13],
  ];
  const r = [1.2, 1.8, 2.4][frame] ?? 1.5;
  for (const [bx, by] of blobs) {
    const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
    if (d < r) c = d < r - 0.8 ? P.y4 : P.o4;
  }
  return c;
};

const swampFill: FillFn = (x, y, frame) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y + frame, 16, 8, 101);
  let c = n > 0.6 ? P.p2 : P.p1;
  const bubbles: [number, number][] = [
    [5, 4],
    [12, 11],
  ];
  const r = [0.9, 1.5, 0.5][frame] ?? 1;
  for (const [bx, by] of bubbles) {
    const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
    if (d < r) c = P.p4;
    else if (d < r + 0.8) c = P.p3;
  }
  return c;
};

const tallGrassFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const col = hash2(x, 0, 111);
  const top = Math.floor(col * 4);
  const phase = m16(y + top) % 5;
  if (phase === 0) return P.g4;
  if (phase === 4) return P.g1;
  return x % 2 === 0 ? P.g2 : mix(P.g2, P.g3, 0.5);
};

const woodFloorFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const row = y >> 2;
  if (y % 4 === 3) return P.b2;
  const joint = (row * 5 + 3) % 16;
  if (x === joint) return P.b2;
  const shadeRow = row % 2 === 0 ? P.b4 : mix(P.b4, P.b3, 0.35);
  if (y % 4 === 0) return mix(shadeRow, P.b5, 0.35);
  if (hash2(x, y, 121) < 0.08) return P.b3;
  return shadeRow;
};

const stoneFloorFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  if (x % 8 === 7 || y % 8 === 7) return P.k2;
  if (x % 8 === 0 || y % 8 === 0) return P.k5;
  const h = hash2(x, y, 131);
  if (h < 0.06) return P.k3;
  return P.k4;
};

const caveFloorFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 8, 141);
  let c = n > 0.6 ? '#7d6c5a' : '#6d5d4c';
  const h = hash2(x, y, 143);
  if (h < 0.05) c = '#4e4236';
  else if (h > 0.96) c = '#958470';
  return c;
};

const marbleFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const checker = ((x >> 3) + (y >> 3)) & 1;
  let c = checker ? '#e9e9f1' : '#c9c9da';
  if (x % 8 === 0 || y % 8 === 0) c = checker ? '#f6f6fb' : '#d6d6e4';
  if (Math.abs(((x * 3 + y * 2) % 16) - 8) < 0.5 && hash2(x, y, 151) < 0.5) c = checker ? '#d4d4e0' : '#b4b4c8';
  return c;
};

const farmFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const r = y % 4;
  if (r === 3) return P.b1;
  if (r === 0) return P.b3;
  if (hash2(x, y, 161) < 0.05) return P.g3;
  return P.b2;
};

const iceFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const streak = m16(x - y);
  if (streak === 0 || streak === 9) return P.white;
  if (streak === 1 || streak === 10) return P.w5;
  return hash2(x, y, 171) < 0.08 ? P.w5 : '#bfe4f4';
};

const hedgeFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 4, 181);
  if (n > 0.7) return P.g3;
  if (n > 0.45) return P.g2;
  if (n > 0.25) return P.g1;
  return P.g0;
};

function carpetFill(base: string, dark: string): FillFn {
  return (x, y) => {
    x = m16(x);
    y = m16(y);
    const dx = Math.abs(m16(x) - 7.5);
    const dy = Math.abs(m16(y) - 7.5);
    if (Math.abs(dx + dy - 5) < 0.6) return dark;
    if (dx < 1 && dy < 1) return mix(base, P.y2, 0.6);
    return base;
  };
}

const wallTopFill: FillFn = (x, y) => (hash2(m16(x), m16(y), 191) < 0.05 ? '#35304a' : '#2b2639');
const caveTopFill: FillFn = (x, y) => {
  const n = tileNoise(m16(x), m16(y), 16, 4, 201);
  return n > 0.6 ? '#4a3c32' : n < 0.3 ? '#2e241e' : '#3b3028';
};

// Wall faces -----------------------------------------------------------------

function brickFill(base: string, light: string, mortar: string, brickW = 8, brickH = 4): FillFn {
  return (x, y) => {
    x = m16(x);
    y = m16(y);
    const row = Math.floor(y / brickH);
    if (y % brickH === brickH - 1) return mortar;
    const off = row % 2 === 0 ? 0 : brickW / 2;
    if (m16(x + off) % brickW === brickW - 1) return mortar;
    if (y % brickH === 0) return light;
    return hash2(x, y, 211 + row) < 0.07 ? mix(base, mortar, 0.3) : base;
  };
}

const stoneWallFill = brickFill(P.k3, P.k4, P.k1);
const brickWallFill = brickFill(P.r2, P.r3, '#5e2a26');
const woodWallFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  if (x % 4 === 3) return P.b1;
  if (x % 4 === 0) return P.b4;
  return hash2(x, y, 221) < 0.06 ? P.b2 : P.b3;
};
const caveWallFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 4, 231);
  let c = n > 0.62 ? '#8a7360' : n < 0.32 ? '#5a4838' : '#725e4c';
  if (m16(x * 2 + y) === 0 && y % 8 < 5) c = '#3e3228';
  return c;
};
const houseWallFill: FillFn = (x, y) => (hash2(m16(x), m16(y), 241) < 0.06 ? P.s3 : P.s4);

function roofFill(base: string, light: string, dark: string): FillFn {
  return (x, y) => {
    x = m16(x);
    y = m16(y);
    const r = y % 4;
    if (r === 3) return dark;
    const off = (y >> 2) % 2 === 0 ? 0 : 2;
    if ((x + off) % 4 === 0) return mix(base, dark, 0.5);
    if (r === 0) return light;
    return base;
  };
}

const cliffFill: FillFn = (x, y) => {
  x = m16(x);
  y = m16(y);
  const n = tileNoise(x, y, 16, 4, 251);
  let c = n > 0.62 ? '#9a8266' : n < 0.3 ? '#62513f' : '#7f6a53';
  if ((x === 4 || x === 11) && y % 16 > 2 && y % 16 < 12) c = '#4c3e30';
  if ((x === 5 || x === 12) && y % 16 > 2 && y % 16 < 12) c = '#a89070';
  return c;
};

// ---------------------------------------------------------------------------
// Edge styles
// ---------------------------------------------------------------------------

function groundEdge(line: string, inner: string, outside: FillFn, tufts: boolean) {
  return (e: EdgeInfo): string | null | undefined => {
    if (e.d < 0) return outside(e.x, e.y, e.frame);
    if (tufts && e.d < 1.7 && hash2(e.x, e.y, 99) < 0.32) return outside(e.x, e.y, e.frame);
    if (e.d < 1) return line;
    if (e.d < 2.2) return inner;
    return undefined;
  };
}

const STYLES: Record<string, TerrainStyle> = {
  grass: { fill: grassFill, radius: 0 },
  darkGrass: { fill: darkGrassFill, radius: 0 },
  dirt: { fill: dirtFill, radius: 4, noise: 1, edge: groundEdge(P.b2, P.b3, grassFill, true) },
  sand: { fill: sandFill, radius: 4, noise: 1, edge: groundEdge(P.s1, P.s2, grassFill, true) },
  snow: { fill: snowFill, radius: 0 },
  cobble: { fill: cobbleFill, radius: 3, noise: 0.5, edge: groundEdge(P.k1, P.k2, grassFill, false) },
  water: {
    fill: waterBase,
    radius: 4,
    noise: 0.7,
    edge: (e) => {
      if (e.d < 0) return grassFill(e.x, e.y, 0);
      if (e.d < 1) return '#24402e';
      if (e.d < 2) return (e.x + e.frame) % 3 === 0 ? P.w4 : P.w5;
      if (e.d < 3.5) return P.w3;
      return undefined;
    },
  },
  deepWater: {
    fill: deepWaterBase,
    radius: 4,
    noise: 0.8,
    edge: (e) => {
      if (e.d < 0) return waterBase(e.x, e.y, e.frame);
      if (e.d < 2) return P.w2;
      if (e.d < 4) return P.w1;
      return undefined;
    },
  },
  lava: {
    fill: lavaFill,
    radius: 4,
    noise: 1,
    edge: (e) => {
      if (e.d < 0) return '#3a2a26';
      if (e.d < 1.3) return '#4a2414';
      if (e.d < 2.6) return P.o1;
      return undefined;
    },
  },
  swamp: {
    fill: swampFill,
    radius: 4,
    noise: 1,
    edge: (e) => {
      if (e.d < 0) return darkGrassFill(e.x, e.y, 0);
      if (e.d < 1) return P.p0;
      if (e.d < 2) return mix(P.p0, P.p1, 0.5);
      return undefined;
    },
  },
  tallGrass: {
    fill: tallGrassFill,
    radius: 4,
    noise: 1.2,
    edge: (e) => {
      if (e.d < 0) return null;
      if (e.d < 1.5 && hash2(e.x, e.y, 113) < 0.45) return null;
      if (e.d < 1) return P.g1;
      return undefined;
    },
  },
  woodFloor: { fill: woodFloorFill, radius: 0 },
  stoneFloor: { fill: stoneFloorFill, radius: 0 },
  carpetRed: {
    fill: carpetFill(P.r2, P.r1),
    radius: 0,
    edge: (e) => (e.d < 1 ? P.r0 : e.d < 2 ? P.y2 : e.d < 3 ? P.r1 : undefined),
  },
  carpetBlue: {
    fill: carpetFill(P.u2, P.u1),
    radius: 0,
    edge: (e) => (e.d < 1 ? P.u0 : e.d < 2 ? P.y2 : e.d < 3 ? P.u1 : undefined),
  },
  caveFloor: { fill: caveFloorFill, radius: 0 },
  wallTop: {
    fill: wallTopFill,
    radius: 0,
    edge: (e) => (e.d < 1 ? '#8a82a8' : e.d < 2 ? '#5a5476' : undefined),
  },
  caveTop: {
    fill: caveTopFill,
    radius: 2,
    noise: 0.6,
    edge: (e) => (e.d < 0 ? '#2e241e' : e.d < 1 ? '#8a7860' : e.d < 2 ? '#5e4e40' : undefined),
  },
  stoneWall: {
    fill: stoneWallFill,
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.k5;
      if (e.dB < 1) return P.k0;
      if (e.dB < 2) return P.k1;
      if (e.dL < 1 || e.dR < 1) return P.k1;
      return undefined;
    },
  },
  brickWall: {
    fill: brickWallFill,
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.r3;
      if (e.dB < 1) return P.r0;
      if (e.dB < 2) return '#5e2a26';
      if (e.dL < 1 || e.dR < 1) return P.r1;
      return undefined;
    },
  },
  woodWall: {
    fill: woodWallFill,
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.b1;
      if (e.dB < 2) return P.b1;
      if (e.dL < 1 || e.dR < 1) return P.b0;
      return undefined;
    },
  },
  caveWall: {
    fill: caveWallFill,
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return '#a08a72';
      if (e.dB < 1.5) return '#2e241e';
      if (e.dL < 1 || e.dR < 1) return '#4a3c30';
      return undefined;
    },
  },
  houseWall: {
    fill: houseWallFill,
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.b1;
      if (e.dB < 1) return P.b1;
      if (e.dB < 3) return P.b2;
      if (e.dL < 1 || e.dR < 1) return P.b1;
      if (e.dL < 3 || e.dR < 3) return P.b2;
      return undefined;
    },
  },
  roofRed: {
    fill: roofFill(P.r2, P.r3, P.r1),
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.r4;
      if (e.dT < 2) return P.r1;
      if (e.dB < 1) return P.r0;
      if (e.dB < 2) return P.r1;
      if (e.dL < 1 || e.dR < 1) return P.r0;
      return undefined;
    },
  },
  roofBlue: {
    fill: roofFill(P.u2, P.u3, P.u1),
    radius: 0,
    edge: (e) => {
      if (e.dT < 1) return P.u4;
      if (e.dT < 2) return P.u1;
      if (e.dB < 1) return P.u0;
      if (e.dB < 2) return P.u1;
      if (e.dL < 1 || e.dR < 1) return P.u0;
      return undefined;
    },
  },
  cliff: {
    fill: cliffFill,
    radius: 0,
    edge: (e) => {
      const lip = 2.5 + hash2(e.x, 3, 261) * 1.5;
      if (e.dT < lip - 1) return grassFill(e.x, e.y, 0);
      if (e.dT < lip) return P.g1;
      if (e.dB < 1) return '#2e2418';
      if (e.dB < 2) return '#4c3e30';
      if (e.dL < 1 || e.dR < 1) return '#4c3e30';
      return undefined;
    },
  },
  hedge: {
    fill: hedgeFill,
    radius: 4,
    noise: 0.8,
    edge: (e) => (e.d < 0 ? grassFill(e.x, e.y, 0) : e.d < 1 ? P.g0 : undefined),
  },
  farmland: {
    fill: farmFill,
    radius: 1,
    edge: (e) => (e.d < 0 ? grassFill(e.x, e.y, 0) : e.d < 1 ? P.b1 : undefined),
  },
  ice: {
    fill: iceFill,
    radius: 3,
    noise: 0.5,
    edge: (e) => (e.d < 0 ? snowFill(e.x, e.y, 0) : e.d < 1 ? P.w3 : e.d < 2 ? P.w4 : undefined),
  },
  marble: { fill: marbleFill, radius: 0 },
  shallowWater: {
    fill: shallowBase,
    radius: 4,
    noise: 0.8,
    edge: (e) => {
      if (e.d < 0) return grassFill(e.x, e.y, 0);
      if (e.d < 1.2) return P.s2;
      if (e.d < 2.2) return (e.x + e.frame) % 3 === 0 ? P.w4 : P.w5;
      return undefined;
    },
  },
};

// ---------------------------------------------------------------------------
// Block rendering
// ---------------------------------------------------------------------------

function combine(dT: number, dB: number, dL: number, dR: number, dI: number, R: number): number {
  let d = Math.min(dT, dB, dL, dR, dI);
  if (R > 0) {
    const corners: [number, number][] = [
      [dT, dL],
      [dT, dR],
      [dB, dL],
      [dB, dR],
    ];
    for (const [a, b] of corners) {
      if (a < R && b < R) d = Math.min(d, R - Math.hypot(R - a, R - b));
    }
  }
  return d;
}

function paint(
  p: Pix,
  px: number,
  py: number,
  x: number,
  y: number,
  frame: number,
  dT: number,
  dB: number,
  dL: number,
  dR: number,
  dI: number,
  style: TerrainStyle,
): void {
  let d = combine(dT, dB, dL, dR, dI, style.radius);
  if (style.noise && Number.isFinite(d)) d += (tileNoise(m16(x), m16(y), 16, 4, 7) - 0.5) * 2 * style.noise;
  const fill = style.fill(x, y, frame);
  let c: string | null | undefined = style.edge ? style.edge({ d, dT, dB, dL, dR, x: m16(x), y: m16(y), frame, fill }) : undefined;
  if (c === undefined) c = fill;
  if (c) p.set(px, py, c);
}

export function drawAutotileBlock(p: Pix, ox: number, oy: number, type: AutotileType, style: TerrainStyle, frames: number): void {
  const INF = Infinity;
  for (let f = 0; f < frames; f++) {
    const bx = ox + f * 2 * T;
    if (type === 'floor') {
      for (let y = 0; y < 3 * T; y++) {
        for (let x = 0; x < 2 * T; x++) {
          let dT = INF;
          let dB = INF;
          let dL = INF;
          let dR = INF;
          let dI = INF;
          if (y < T && x < T) {
            dT = y + 0.5;
            dB = T - (y + 0.5);
            dL = x + 0.5;
            dR = T - (x + 0.5);
          } else if (y < T) {
            const lx = x - T + 0.5;
            const ly = y + 0.5;
            dI = Math.min(Math.hypot(lx, ly), Math.hypot(T - lx, ly), Math.hypot(lx, T - ly), Math.hypot(T - lx, T - ly));
          } else {
            const ly = y - T;
            dT = ly + 0.5;
            dB = 2 * T - (ly + 0.5);
            dL = x + 0.5;
            dR = 2 * T - (x + 0.5);
          }
          paint(p, bx + x, oy + y, x, y, f, dT, dB, dL, dR, dI, style);
        }
      }
    } else {
      for (let y = 0; y < 2 * T; y++) {
        for (let x = 0; x < 2 * T; x++) {
          paint(p, bx + x, oy + y, x, y, f, y + 0.5, 2 * T - (y + 0.5), x + 0.5, 2 * T - (x + 0.5), INF, style);
        }
      }
    }
  }
}

/** Generate the built-in autotile sheet (32px tiles). */
export function generateAutotileSheet(): HTMLCanvasElement {
  const layout = builtinAutotileLayout();
  const rows = autotileSheetRows();
  const p = new Pix(AUTOTILE_SHEET_COLUMNS * T, rows * T);
  BUILTIN_AUTOTILES.forEach((a, i) => {
    const style = STYLES[a.key];
    if (!style) throw new Error(`No autotile style for ${a.key}`);
    drawAutotileBlock(p, layout[i].x * T, layout[i].y * T, a.type, style, a.frames);
  });
  return p.toCanvas(2);
}

/** Keys of terrain styles defined here (used by tests). */
export const AUTOTILE_STYLE_KEYS = Object.keys(STYLES);
