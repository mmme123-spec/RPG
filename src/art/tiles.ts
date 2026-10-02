/**
 * Procedural art for the built-in normal tile sheets (outdoor and indoor).
 * Everything is drawn at 16x16 per tile and scaled 2x.
 */

import { BUILTIN_SHEET_COLUMNS, INDOOR_TILES, OUTDOOR_TILES, type BuiltinTile } from '../core/builtins';
import { P, mix, shade } from './color';
import { Pix, hash2 } from './pixel';

const T = 16;
const OL = P.outline;
const SHADOW = '#00000038';

interface Drawer {
  /** Size in cells */
  w?: number;
  h?: number;
  draw: (p: Pix, ox: number, oy: number) => void;
  /** Skip the automatic outline pass (for seamless tiles). */
  noOutline?: boolean;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function shadow(p: Pix, cx: number, cy: number, rx: number, ry: number): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1 && !p.opaque(x, y)) p.blend(x, y, SHADOW);
    }
  }
}

function flower(p: Pix, cx: number, cy: number, petal: string, center: string): void {
  p.set(cx, cy + 2, P.g2);
  p.set(cx - 1, cy + 2, P.g3);
  p.set(cx + 1, cy + 1, P.g2);
  p.set(cx - 1, cy, petal);
  p.set(cx + 1, cy, petal);
  p.set(cx, cy - 1, petal);
  p.set(cx, cy + 1, shade(petal, -0.25));
  p.set(cx, cy, center);
}

function flowers(petal: string, center: string) {
  return (p: Pix, ox: number, oy: number) => {
    const spots: [number, number][] = [
      [3, 4],
      [10, 3],
      [6, 10],
      [13, 9],
      [2, 13],
      [11, 13],
    ];
    for (const [x, y] of spots) flower(p, ox + x, oy + y, petal, center);
  };
}

/** Leafy canopy made of overlapping clumps, lit from the top-left. */
function canopy(p: Pix, cx: number, cy: number, r: number, dark: string, mid: string, light: string, seed: number): void {
  p.circle(cx, cy, r, dark);
  p.circle(cx - r * 0.15, cy - r * 0.15, r * 0.85, mid);
  const clumps = 7;
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + seed;
    const rr = r * 0.55;
    const x = cx + Math.cos(a) * rr - r * 0.12;
    const y = cy + Math.sin(a) * rr - r * 0.12;
    p.circle(x, y, r * 0.32, i % 3 === 0 ? light : mid);
  }
  p.circle(cx - r * 0.35, cy - r * 0.4, r * 0.28, light);
  for (let i = 0; i < r * 3; i++) {
    const x = Math.floor(cx - r + hash2(i, seed, 3) * r * 2);
    const y = Math.floor(cy - r + hash2(seed, i, 5) * r * 2);
    if (p.opaque(x, y) && hash2(x, y, seed) < 0.5) p.set(x, y, mix(light, P.g5, 0.4));
  }
}

function trunk(p: Pix, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, P.b3);
  p.rect(x, y, 1, h, P.b4);
  p.rect(x + w - 1, y, 1, h, P.b2);
  p.set(x - 1, y + h - 1, P.b3);
  p.set(x + w, y + h - 1, P.b2);
}

function tinyText(p: Pix, x: number, y: number, text: string, c: string): void {
  const glyphs: Record<string, string[]> = {
    I: ['111', '010', '010', '010', '111'],
    N: ['101', '111', '111', '111', '101'],
  };
  let cx = x;
  for (const ch of text) {
    const g = glyphs[ch];
    if (!g) {
      cx += 4;
      continue;
    }
    g.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx++) if (row[xx] === '1') p.set(cx + xx, y + yy, c);
    });
    cx += 4;
  }
}

function hangingSign(p: Pix, ox: number, oy: number, icon: (p: Pix, x: number, y: number) => void): void {
  p.hline(ox + 2, ox + 13, oy + 2, P.k1);
  p.set(ox + 4, oy + 3, P.k1);
  p.set(ox + 11, oy + 3, P.k1);
  p.rect(ox + 2, oy + 4, 12, 9, P.b4);
  p.hline(ox + 2, ox + 13, oy + 4, P.b5);
  p.hline(ox + 2, ox + 13, oy + 12, P.b2);
  icon(p, ox + 2, oy + 4);
}

// ---------------------------------------------------------------------------
// outdoor drawers
// ---------------------------------------------------------------------------

const OUTDOOR: Record<string, Drawer> = {
  flowersRed: { draw: flowers(P.r3, P.y3), noOutline: true },
  flowersYellow: { draw: flowers(P.y3, P.o2), noOutline: true },
  flowersBlue: { draw: flowers(P.u3, P.white), noOutline: true },
  grassTuft: {
    noOutline: true,
    draw: (p, ox, oy) => {
      const blades: [number, number, number][] = [
        [5, 6, -1],
        [7, 4, 0],
        [9, 5, 1],
        [11, 7, 1],
        [4, 8, -1],
        [8, 6, 0],
      ];
      for (const [x, top, lean] of blades) {
        for (let y = top; y <= 13; y++) {
          const xx = x + (y < top + 3 ? lean : 0);
          p.set(ox + xx, oy + y, y === top ? P.g5 : y < top + 3 ? P.g4 : P.g2);
        }
      }
      p.hline(ox + 4, ox + 11, oy + 14, P.g1);
    },
  },
  pebbles: {
    noOutline: true,
    draw: (p, ox, oy) => {
      const stones: [number, number, number][] = [
        [3, 4, 2],
        [9, 3, 1],
        [6, 9, 2],
        [12, 10, 1],
        [3, 12, 1],
        [10, 13, 2],
      ];
      for (const [x, y, s] of stones) {
        p.rect(ox + x, oy + y, s + 1, s, P.k4);
        p.hline(ox + x, ox + x + s, oy + y + s, P.k2);
        p.set(ox + x, oy + y, P.k5);
      }
    },
  },
  smallRock: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 12, 6, 2);
      p.ellipse(ox + 8, oy + 9.5, 5, 3.5, P.k3);
      p.ellipse(ox + 7, oy + 8.5, 3.5, 2.2, P.k4);
      p.set(ox + 6, oy + 7, P.k5);
    },
  },
  mushrooms: {
    draw: (p, ox, oy) => {
      const shroom = (x: number, y: number, r: number) => {
        p.rect(x - 1, y, 2, r + 1, P.s4);
        p.ellipse(x, y - 0.5, r, r * 0.7, P.r2);
        p.set(x - 1, y - 1, P.white);
        p.set(x + 1, y - 2, P.white);
      };
      shroom(ox + 5, oy + 8, 3);
      shroom(ox + 11, oy + 11, 2.5);
    },
  },
  lilyPad: {
    draw: (p, ox, oy) => {
      p.circle(ox + 8, oy + 8, 5, P.g3);
      p.poly(
        [
          [ox + 8, oy + 8],
          [ox + 14, oy + 5],
          [ox + 14, oy + 9],
        ],
        '#00000000',
      );
      for (let i = 0; i < 4; i++) p.clear(ox + 10 + i, oy + 7);
      p.set(ox + 6, oy + 6, P.g4);
      p.set(ox + 7, oy + 10, P.g2);
      p.set(ox + 5, oy + 8, P.r4);
      p.set(ox + 6, oy + 8, P.white);
    },
  },
  treeTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 29, 6, 2);
      trunk(p, ox + 6, oy + 18, 4, 11);
      canopy(p, ox + 8, oy + 11, 7.2, P.g1, P.g2, P.g3, 1);
    },
  },
  pineTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 29, 5, 2);
      trunk(p, ox + 7, oy + 22, 3, 7);
      const tiers: [number, number, number][] = [
        [3, 9, 3.5],
        [8, 15, 5.5],
        [13, 22, 7],
      ];
      for (const [top, bottom, half] of tiers) {
        p.poly(
          [
            [ox + 8, oy + top],
            [ox + 8 + half, oy + bottom],
            [ox + 8 - half, oy + bottom],
          ],
          P.g1,
        );
        p.poly(
          [
            [ox + 8, oy + top + 1],
            [ox + 8 + half - 2, oy + bottom - 1],
            [ox + 8 - half + 1, oy + bottom - 1],
          ],
          mix(P.g1, P.g2, 0.6),
        );
        p.line(ox + 7, oy + top + 2, ox + 9 - half + 1, oy + bottom - 2, P.g3);
      }
    },
  },
  deadTreeTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 29, 5, 2);
      trunk(p, ox + 6, oy + 12, 4, 17);
      p.thickLine(ox + 8, oy + 14, ox + 3, oy + 6, 0.8, P.b2);
      p.thickLine(ox + 8, oy + 12, ox + 12, oy + 4, 0.8, P.b2);
      p.thickLine(ox + 5, oy + 9, ox + 2, oy + 9, 0.5, P.b2);
      p.thickLine(ox + 10, oy + 8, ox + 14, oy + 7, 0.5, P.b2);
      p.thickLine(ox + 8, oy + 12, ox + 8, oy + 3, 0.6, P.b3);
    },
  },
  palmTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 29, 5, 2);
      for (let y = 10; y < 29; y++) {
        const x = ox + 7 + Math.round(Math.sin((y - 10) / 8) * 1.5);
        p.rect(x, oy + y, 3, 1, (y % 3 === 0 ? P.b2 : P.b4));
      }
      const frond = (dx: number, dy: number) => {
        for (let i = 0; i < 8; i++) {
          const x = ox + 8 + (dx * i) / 7;
          const y = oy + 9 + (dy * i) / 7 + Math.sin((i / 7) * Math.PI) * -1.5 + (i * i) / 18;
          p.circle(x, y, 1.3, i < 6 ? P.g3 : P.g2);
        }
      };
      frond(-7, 2);
      frond(7, 2);
      frond(-5, -5);
      frond(5, -5);
      frond(0, -7);
      p.circle(ox + 7, oy + 11, 1.2, P.b2);
      p.circle(ox + 9, oy + 11, 1.2, P.b2);
    },
  },
  bigTreeTL: {
    w: 2,
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 16, oy + 29, 10, 2.5);
      trunk(p, ox + 13, oy + 20, 6, 9);
      p.set(ox + 11, oy + 28, P.b3);
      p.set(ox + 20, oy + 28, P.b2);
      canopy(p, ox + 16, oy + 12, 11.5, P.g1, P.g2, P.g3, 2);
    },
  },
  boulderTL: {
    w: 2,
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 16, oy + 27, 13, 3);
      p.poly(
        [
          [ox + 3, oy + 26],
          [ox + 2, oy + 16],
          [ox + 7, oy + 7],
          [ox + 15, oy + 3],
          [ox + 24, oy + 5],
          [ox + 29, oy + 13],
          [ox + 30, oy + 24],
          [ox + 26, oy + 28],
          [ox + 8, oy + 28],
        ],
        P.k3,
      );
      p.poly(
        [
          [ox + 6, oy + 15],
          [ox + 9, oy + 8],
          [ox + 16, oy + 5],
          [ox + 22, oy + 7],
          [ox + 18, oy + 13],
          [ox + 10, oy + 17],
        ],
        P.k4,
      );
      p.poly(
        [
          [ox + 20, oy + 26],
          [ox + 28, oy + 22],
          [ox + 29, oy + 25],
          [ox + 25, oy + 27],
        ],
        P.k2,
      );
      p.line(ox + 16, oy + 12, ox + 20, oy + 20, P.k1);
      p.line(ox + 20, oy + 20, ox + 18, oy + 25, P.k1);
      p.set(ox + 11, oy + 9, P.k5);
      p.set(ox + 12, oy + 8, P.k5);
    },
  },
  bush: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 7, 2);
      p.ellipse(ox + 8, oy + 9, 6.5, 5, P.g1);
      p.ellipse(ox + 7.5, oy + 8.5, 5.5, 4, P.g2);
      p.circle(ox + 5, oy + 7, 2, P.g3);
      p.circle(ox + 10, oy + 6.5, 2, P.g3);
      p.circle(ox + 8, oy + 9, 1.5, P.g3);
      p.set(ox + 4, oy + 6, P.g4);
      p.set(ox + 9, oy + 5, P.g4);
    },
  },
  stump: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 6, 2);
      p.rect(ox + 3, oy + 7, 10, 5, P.b2);
      p.rect(ox + 3, oy + 7, 2, 5, P.b3);
      p.ellipse(ox + 8, oy + 7, 5, 2.5, P.b4);
      p.ellipse(ox + 8, oy + 7, 3, 1.4, P.b5);
      p.set(ox + 8, oy + 7, P.b3);
      p.set(ox + 2, oy + 12, P.b2);
      p.set(ox + 13, oy + 12, P.b2);
    },
  },
  log: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 12, 7, 2);
      p.rect(ox + 2, oy + 6, 12, 5, P.b3);
      p.hline(ox + 2, ox + 13, oy + 6, P.b4);
      p.hline(ox + 2, ox + 13, oy + 10, P.b2);
      p.set(ox + 6, oy + 8, P.b2);
      p.set(ox + 10, oy + 7, P.b2);
      p.ellipse(ox + 13, oy + 8.5, 1.8, 2.6, P.b5);
      p.set(ox + 13, oy + 8, P.b3);
    },
  },
  cactus: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 5, 1.5);
      p.rect(ox + 6, oy + 2, 4, 12, P.g2);
      p.rect(ox + 7, oy + 2, 1, 12, P.g4);
      p.rect(ox + 2, oy + 6, 2, 4, P.g2);
      p.rect(ox + 2, oy + 9, 4, 2, P.g2);
      p.rect(ox + 12, oy + 4, 2, 4, P.g2);
      p.rect(ox + 10, oy + 7, 4, 2, P.g2);
      for (const [x, y] of [
        [8, 4],
        [6, 7],
        [9, 10],
        [3, 7],
        [13, 5],
      ]) p.set(ox + x, oy + y, P.g5);
    },
  },
  rock: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 7, 2);
      p.poly(
        [
          [ox + 2, oy + 13],
          [ox + 3, oy + 7],
          [ox + 7, oy + 3],
          [ox + 12, oy + 4],
          [ox + 14, oy + 9],
          [ox + 13, oy + 13],
        ],
        P.k3,
      );
      p.poly(
        [
          [ox + 4, oy + 8],
          [ox + 7, oy + 4],
          [ox + 11, oy + 5],
          [ox + 8, oy + 8],
        ],
        P.k4,
      );
      p.line(ox + 9, oy + 8, ox + 11, oy + 12, P.k2);
    },
  },
  sunflower: {
    draw: (p, ox, oy) => {
      p.vline(ox + 8, oy + 7, oy + 14, P.g2);
      p.rect(ox + 9, oy + 10, 3, 2, P.g3);
      p.rect(ox + 5, oy + 12, 3, 1, P.g3);
      p.circle(ox + 8, oy + 5, 4, P.y2);
      p.circle(ox + 8, oy + 5, 2.2, P.b2);
      p.set(ox + 7, oy + 4, P.b3);
      for (const [x, y] of [
        [4, 5],
        [12, 5],
        [8, 1],
        [8, 9],
      ]) p.set(ox + x, oy + y, P.y3);
    },
  },
  signpost: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 4, 1.2);
      p.rect(ox + 7, oy + 8, 2, 6, P.b2);
      p.rect(ox + 2, oy + 2, 12, 7, P.b4);
      p.hline(ox + 2, ox + 13, oy + 2, P.b5);
      p.hline(ox + 2, ox + 13, oy + 8, P.b2);
      p.hline(ox + 4, ox + 11, oy + 4, P.b2);
      p.hline(ox + 4, ox + 9, oy + 6, P.b2);
    },
  },
  haystack: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 7, 2);
      p.ellipse(ox + 8, oy + 9, 6.5, 5, P.y1);
      p.ellipse(ox + 7.5, oy + 8, 5.5, 4, P.y2);
      for (let i = 0; i < 9; i++) p.set(ox + 3 + i, oy + 6 + ((i * 3) % 6), P.y3);
      p.hline(ox + 3, ox + 12, oy + 12, P.y0);
    },
  },
  fenceH: {
    noOutline: true,
    draw: (p, ox, oy) => {
      for (const y of [6, 10]) {
        p.hline(ox, ox + 15, oy + y, P.b4);
        p.hline(ox, ox + 15, oy + y + 1, P.b2);
      }
      for (const x of [2, 11]) {
        p.rect(ox + x, oy + 3, 3, 11, P.b3);
        p.vline(ox + x, oy + 3, oy + 13, P.b4);
        p.hline(ox + x, ox + x + 2, oy + 3, P.b5);
        p.vline(ox + x + 3, oy + 4, oy + 13, P.b1);
        p.hline(ox + x, ox + x + 2, oy + 14, P.b1);
      }
    },
  },
  fenceV: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 7, oy, 2, 16, P.b4);
      p.vline(ox + 9, oy, oy + 15, P.b2);
      for (const y of [1, 9]) {
        p.rect(ox + 6, oy + y, 4, 5, P.b3);
        p.hline(ox + 6, ox + 9, oy + y, P.b5);
        p.hline(ox + 6, ox + 9, oy + y + 5, P.b1);
        p.vline(ox + 10, oy + y + 1, oy + y + 4, P.b1);
      }
    },
  },
  fenceTL: { noOutline: true, draw: (p, ox, oy) => fenceCorner(p, ox, oy, true, false, false, true) },
  fenceTR: { noOutline: true, draw: (p, ox, oy) => fenceCorner(p, ox, oy, false, true, false, true) },
  fenceBL: { noOutline: true, draw: (p, ox, oy) => fenceCorner(p, ox, oy, true, false, true, false) },
  fenceBR: { noOutline: true, draw: (p, ox, oy) => fenceCorner(p, ox, oy, false, true, true, false) },
  fencePost: { noOutline: true, draw: (p, ox, oy) => fenceCorner(p, ox, oy, false, false, false, false) },
  woodPile: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      const logEnd = (x: number, y: number) => {
        p.circle(x, y, 2, P.b4);
        p.set(Math.floor(x), Math.floor(y), P.b3);
      };
      logEnd(ox + 4.5, oy + 12);
      logEnd(ox + 8.5, oy + 12);
      logEnd(ox + 12.5, oy + 12);
      logEnd(ox + 6.5, oy + 8.5);
      logEnd(ox + 10.5, oy + 8.5);
      logEnd(ox + 8.5, oy + 5);
    },
  },
  lampTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 30, 4, 1.2);
      p.rect(ox + 7, oy + 9, 2, 20, P.k1);
      p.vline(ox + 7, oy + 9, oy + 28, P.k2);
      p.rect(ox + 5, oy + 27, 6, 3, P.k1);
      p.rect(ox + 4, oy + 2, 8, 2, P.k1);
      p.rect(ox + 5, oy + 4, 6, 5, P.y3);
      p.rect(ox + 6, oy + 5, 4, 3, P.y4);
      p.vline(ox + 5, oy + 4, oy + 8, P.k1);
      p.vline(ox + 10, oy + 4, oy + 8, P.k1);
      p.hline(ox + 5, ox + 10, oy + 9, P.k1);
      p.set(ox + 8, oy + 1, P.k1);
    },
  },
  wellTL: {
    w: 2,
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 16, oy + 29, 12, 2.5);
      // stone ring
      p.ellipse(ox + 16, oy + 22, 12, 7, P.k3);
      p.ellipse(ox + 16, oy + 21, 9, 4.5, P.k1);
      p.ellipse(ox + 16, oy + 21.5, 8, 3.5, P.w1);
      p.set(ox + 13, oy + 21, P.w3);
      p.rect(ox + 4, oy + 22, 24, 6, P.k3);
      for (let x = 4; x < 28; x += 4) p.vline(ox + x, oy + 23, oy + 27, P.k2);
      p.hline(ox + 4, ox + 27, oy + 25, P.k2);
      p.ellipse(ox + 16, oy + 28, 12, 1.5, P.k2);
      // posts and roof
      p.rect(ox + 5, oy + 7, 2, 15, P.b2);
      p.rect(ox + 25, oy + 7, 2, 15, P.b2);
      p.hline(ox + 6, ox + 25, oy + 10, P.b3);
      p.poly(
        [
          [ox + 2, oy + 9],
          [ox + 16, oy + 1],
          [ox + 30, oy + 9],
          [ox + 28, oy + 10],
          [ox + 4, oy + 10],
        ],
        P.r2,
      );
      p.line(ox + 3, oy + 9, ox + 16, oy + 2, P.r3);
      p.vline(ox + 16, oy + 10, oy + 17, P.k4);
      p.rect(ox + 15, oy + 17, 3, 3, P.b3);
    },
  },
  statueTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 30, 6, 1.5);
      p.rect(ox + 3, oy + 24, 10, 6, P.k2);
      p.hline(ox + 3, ox + 12, oy + 24, P.k4);
      p.rect(ox + 4, oy + 22, 8, 2, P.k3);
      // figure
      p.circle(ox + 8, oy + 5, 2.6, P.k4);
      p.rect(ox + 6, oy + 8, 5, 8, P.k4);
      p.rect(ox + 5, oy + 16, 7, 6, P.k3);
      p.vline(ox + 12, oy + 3, oy + 17, P.k3);
      p.set(ox + 12, oy + 2, P.k5);
      p.rect(ox + 6, oy + 8, 1, 8, P.k5);
    },
  },
  barrel: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      p.rect(ox + 3, oy + 4, 10, 10, P.b3);
      p.rect(ox + 2, oy + 6, 12, 6, P.b3);
      p.vline(ox + 4, oy + 4, oy + 13, P.b4);
      p.vline(ox + 11, oy + 4, oy + 13, P.b2);
      p.hline(ox + 2, ox + 13, oy + 6, P.k2);
      p.hline(ox + 2, ox + 13, oy + 11, P.k2);
      p.ellipse(ox + 8, oy + 4, 5, 1.6, P.b4);
      p.hline(ox + 6, ox + 10, oy + 4, P.b2);
    },
  },
  crate: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      p.rect(ox + 2, oy + 3, 12, 11, P.b4);
      p.strokeRect(ox + 2, oy + 3, 12, 11, P.b2);
      p.line(ox + 3, oy + 4, ox + 12, oy + 12, P.b2);
      p.line(ox + 12, oy + 4, ox + 3, oy + 12, P.b2);
      p.hline(ox + 3, ox + 12, oy + 4, P.b5);
    },
  },
  pot: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 5, 1.5);
      p.ellipse(ox + 8, oy + 10, 5, 4, P.o1);
      p.rect(ox + 6, oy + 4, 4, 3, P.o1);
      p.hline(ox + 5, ox + 10, oy + 4, P.o2);
      p.set(ox + 5, oy + 8, P.o2);
      p.set(ox + 5, oy + 9, P.o2);
      p.hline(ox + 4, ox + 11, oy + 11, shade(P.o1, -0.3));
    },
  },
  flowerPot: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 5, 1.5);
      p.poly(
        [
          [ox + 4, oy + 9],
          [ox + 12, oy + 9],
          [ox + 11, oy + 14],
          [ox + 5, oy + 14],
        ],
        P.o1,
      );
      p.hline(ox + 4, ox + 11, oy + 9, P.o2);
      p.circle(ox + 8, oy + 6, 3.5, P.g2);
      flower(p, ox + 6, oy + 4, P.r3, P.y3);
      flower(p, ox + 10, oy + 6, P.r4, P.y3);
    },
  },
  bench: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 7, 1.5);
      p.rect(ox + 1, oy + 4, 14, 3, P.b4);
      p.hline(ox + 1, ox + 14, oy + 4, P.b5);
      p.rect(ox + 1, oy + 8, 14, 3, P.b3);
      p.hline(ox + 1, ox + 14, oy + 10, P.b2);
      p.rect(ox + 2, oy + 11, 2, 2, P.b1);
      p.rect(ox + 12, oy + 11, 2, 2, P.b1);
    },
  },
  campfire: {
    draw: (p, ox, oy) => {
      const ring: [number, number][] = [
        [3, 11],
        [5, 13],
        [8, 14],
        [11, 13],
        [13, 11],
        [8, 9],
      ];
      for (const [x, y] of ring) p.rect(ox + x - 1, oy + y - 1, 2, 2, P.k3);
      p.thickLine(ox + 4, oy + 12, ox + 12, oy + 10, 0.8, P.b2);
      p.thickLine(ox + 4, oy + 10, ox + 12, oy + 12, 0.8, P.b3);
      p.poly(
        [
          [ox + 5, oy + 11],
          [ox + 8, oy + 2],
          [ox + 11, oy + 11],
        ],
        P.o2,
      );
      p.poly(
        [
          [ox + 6, oy + 11],
          [ox + 8, oy + 5],
          [ox + 10, oy + 11],
        ],
        P.o3,
      );
      p.poly(
        [
          [ox + 7, oy + 11],
          [ox + 8, oy + 7],
          [ox + 9, oy + 11],
        ],
        P.y4,
      );
    },
  },
  grave: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      p.rect(ox + 4, oy + 5, 8, 9, P.k3);
      p.ellipse(ox + 8, oy + 5, 4, 3, P.k3);
      p.vline(ox + 4, oy + 5, oy + 13, P.k4);
      p.vline(ox + 8, oy + 4, oy + 9, P.k1);
      p.hline(ox + 6, ox + 10, oy + 6, P.k1);
      p.rect(ox + 3, oy + 13, 10, 1, P.b2);
    },
  },
  mailbox: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 4, 1.2);
      p.rect(ox + 7, oy + 8, 2, 6, P.b2);
      p.rect(ox + 4, oy + 3, 8, 6, P.u2);
      p.ellipse(ox + 8, oy + 3.5, 4, 1.5, P.u3);
      p.rect(ox + 11, oy + 2, 1, 4, P.r3);
      p.hline(ox + 5, ox + 10, oy + 8, P.u1);
    },
  },
  door: {
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy + 2, 12, 14, P.b1);
      p.ellipse(ox + 8, oy + 3, 6, 2.5, P.b1);
      p.rect(ox + 3, oy + 3, 10, 13, P.b3);
      p.ellipse(ox + 8, oy + 3.5, 5, 1.8, P.b3);
      for (const x of [5, 8, 11]) p.vline(ox + x, oy + 3, oy + 15, P.b2);
      p.hline(ox + 3, ox + 12, oy + 6, P.b2);
      p.hline(ox + 3, ox + 12, oy + 12, P.b2);
      p.set(ox + 11, oy + 9, P.y2);
      p.set(ox + 11, oy + 10, P.y1);
    },
  },
  doubleDoorL: {
    w: 2,
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy + 1, 28, 15, P.b1);
      p.rect(ox + 3, oy + 2, 26, 14, P.b3);
      p.vline(ox + 16, oy + 2, oy + 15, P.b1);
      for (const x of [6, 10, 22, 26]) p.vline(ox + x, oy + 2, oy + 15, P.b2);
      p.hline(ox + 3, ox + 28, oy + 5, P.k3);
      p.hline(ox + 3, ox + 28, oy + 12, P.k3);
      p.set(ox + 14, oy + 9, P.y2);
      p.set(ox + 18, oy + 9, P.y2);
    },
  },
  window: {
    draw: (p, ox, oy) => {
      p.rect(ox + 3, oy + 3, 10, 9, P.b2);
      p.rect(ox + 4, oy + 4, 8, 7, P.w4);
      p.rect(ox + 4, oy + 4, 3, 3, P.w5);
      p.vline(ox + 8, oy + 4, oy + 10, P.b2);
      p.hline(ox + 4, ox + 11, oy + 7, P.b2);
      p.rect(ox + 2, oy + 12, 12, 2, P.b4);
    },
  },
  signInn: {
    draw: (p, ox, oy) =>
      hangingSign(p, ox, oy, (q, x, y) => {
        tinyText(q, x + 1, y + 2, 'INN', P.b1);
      }),
  },
  signItem: {
    draw: (p, ox, oy) =>
      hangingSign(p, ox, oy, (q, x, y) => {
        q.rect(x + 5, y + 1, 2, 2, P.k4);
        q.ellipse(x + 6, y + 5, 2.6, 2.4, P.r3);
        q.set(x + 5, y + 4, P.r4);
      }),
  },
  signWeapon: {
    draw: (p, ox, oy) =>
      hangingSign(p, ox, oy, (q, x, y) => {
        q.line(x + 3, y + 7, x + 9, y + 1, P.k4);
        q.line(x + 3, y + 6, x + 8, y + 1, P.k5);
        q.line(x + 2, y + 5, x + 5, y + 8, P.y1);
      }),
  },
  signArmor: {
    draw: (p, ox, oy) =>
      hangingSign(p, ox, oy, (q, x, y) => {
        q.rect(x + 3, y + 1, 6, 4, P.u2);
        q.poly(
          [
            [x + 3, y + 5],
            [x + 9, y + 5],
            [x + 6, y + 8],
          ],
          P.u2,
        );
        q.vline(x + 6, y + 1, y + 6, P.y2);
      }),
  },
  bridgeH: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox, oy + 2, 16, 12, P.b4);
      for (let x = 0; x < 16; x += 4) {
        p.vline(ox + x + 3, oy + 2, oy + 13, P.b2);
        p.vline(ox + x, oy + 2, oy + 13, P.b5);
      }
      p.hline(ox, ox + 15, oy + 1, P.b1);
      p.hline(ox, ox + 15, oy + 2, P.b3);
      p.hline(ox, ox + 15, oy + 13, P.b2);
      p.hline(ox, ox + 15, oy + 14, P.b1);
      p.blend(ox, oy + 15, SHADOW);
      for (let x = 0; x < 16; x++) p.blend(ox + x, oy + 15, SHADOW);
    },
  },
  bridgeV: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy, 12, 16, P.b4);
      for (let y = 0; y < 16; y += 4) {
        p.hline(ox + 2, ox + 13, oy + y + 3, P.b2);
        p.hline(ox + 2, ox + 13, oy + y, P.b5);
      }
      p.vline(ox + 1, oy, oy + 15, P.b1);
      p.vline(ox + 2, oy, oy + 15, P.b3);
      p.vline(ox + 13, oy, oy + 15, P.b2);
      p.vline(ox + 14, oy, oy + 15, P.b1);
    },
  },
  stairs: {
    noOutline: true,
    draw: (p, ox, oy) => {
      for (let i = 0; i < 4; i++) {
        const y = oy + i * 4;
        p.rect(ox + 1, y, 14, 4, mix(P.k3, P.k4, i / 4));
        p.hline(ox + 1, ox + 14, y, P.k5);
        p.hline(ox + 1, ox + 14, y + 3, P.k1);
      }
      p.vline(ox, oy, oy + 15, P.k1);
      p.vline(ox + 15, oy, oy + 15, P.k1);
    },
  },
  ladder: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 3, oy, 2, 16, P.b3);
      p.rect(ox + 11, oy, 2, 16, P.b3);
      p.vline(ox + 3, oy, oy + 15, P.b4);
      p.vline(ox + 11, oy, oy + 15, P.b4);
      for (let y = 2; y < 16; y += 4) {
        p.hline(ox + 5, ox + 10, oy + y, P.b4);
        p.hline(ox + 5, ox + 10, oy + y + 1, P.b2);
      }
    },
  },
  caveEntrance: {
    draw: (p, ox, oy) => {
      p.ellipse(ox + 8, oy + 8, 6.5, 6, '#3a2e24');
      p.rect(ox + 1.5, oy + 8, 13, 8, '#3a2e24');
      p.ellipse(ox + 8, oy + 9, 5, 5, P.black);
      p.rect(ox + 3, oy + 9, 10, 7, P.black);
      p.set(ox + 3, oy + 5, '#6a5a48');
      p.set(ox + 12, oy + 4, '#6a5a48');
    },
  },
  steppingStones: {
    noOutline: true,
    draw: (p, ox, oy) => {
      const stone = (x: number, y: number) => {
        p.ellipse(ox + x, oy + y, 3, 2, P.k2);
        p.ellipse(ox + x, oy + y - 0.5, 2.6, 1.6, P.k4);
        p.set(ox + x - 1, oy + y - 1, P.k5);
      };
      stone(4, 4);
      stone(11, 7);
      stone(5, 12);
    },
  },
  chimney: {
    draw: (p, ox, oy) => {
      p.rect(ox + 4, oy + 4, 8, 11, P.r1);
      for (let y = 5; y < 15; y += 3) p.hline(ox + 4, ox + 11, oy + y, '#5e2a26');
      p.rect(ox + 3, oy + 3, 10, 2, P.k2);
      p.rect(ox + 5, oy + 4, 6, 1, P.k0);
    },
  },
  woodSign: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.2);
      p.rect(ox + 3, oy + 9, 2, 5, P.b2);
      p.rect(ox + 11, oy + 9, 2, 5, P.b2);
      p.rect(ox + 1, oy + 2, 14, 8, P.b4);
      p.hline(ox + 1, ox + 14, oy + 2, P.b5);
      p.hline(ox + 1, ox + 14, oy + 9, P.b2);
      p.rect(ox + 3, oy + 4, 4, 3, P.s4);
      p.rect(ox + 9, oy + 4, 4, 4, P.s4);
      p.set(ox + 5, oy + 4, P.r2);
      p.set(ox + 11, oy + 4, P.r2);
    },
  },
};

function fenceCorner(p: Pix, ox: number, oy: number, right: boolean, left: boolean, up: boolean, down: boolean): void {
  if (right || left) {
    const x0 = left ? 0 : 8;
    const x1 = right ? 15 : 8;
    for (const y of [6, 10]) {
      p.hline(ox + x0, ox + x1, oy + y, P.b4);
      p.hline(ox + x0, ox + x1, oy + y + 1, P.b2);
    }
  }
  if (up || down) {
    const y0 = up ? 0 : 8;
    const y1 = down ? 15 : 8;
    p.rect(ox + 7, oy + y0, 2, y1 - y0 + 1, P.b4);
    p.vline(ox + 9, oy + y0, oy + y1, P.b2);
  }
  p.rect(ox + 6, oy + 3, 4, 11, P.b3);
  p.vline(ox + 6, oy + 3, oy + 13, P.b4);
  p.hline(ox + 6, ox + 9, oy + 3, P.b5);
  p.vline(ox + 10, oy + 4, oy + 13, P.b1);
  p.hline(ox + 6, ox + 9, oy + 14, P.b1);
}

// ---------------------------------------------------------------------------
// indoor drawers
// ---------------------------------------------------------------------------

function chair(p: Pix, ox: number, oy: number, dir: 'down' | 'up' | 'left' | 'right'): void {
  shadow(p, ox + 8, oy + 14, 5, 1.2);
  const seat = () => {
    p.rect(ox + 4, oy + 7, 8, 5, P.b4);
    p.hline(ox + 4, ox + 11, oy + 7, P.b5);
    p.hline(ox + 4, ox + 11, oy + 11, P.b2);
    p.rect(ox + 4, oy + 12, 1, 2, P.b2);
    p.rect(ox + 11, oy + 12, 1, 2, P.b2);
  };
  if (dir === 'down') {
    p.rect(ox + 4, oy + 1, 8, 6, P.b3);
    p.rect(ox + 5, oy + 2, 6, 3, P.r2);
    seat();
  } else if (dir === 'up') {
    seat();
    p.rect(ox + 4, oy + 9, 8, 5, P.b3);
    p.rect(ox + 5, oy + 10, 6, 3, P.r2);
  } else {
    seat();
    const bx = dir === 'left' ? 11 : 3;
    p.rect(ox + bx, oy + 2, 2, 11, P.b3);
    p.vline(ox + bx, oy + 2, oy + 12, P.b4);
  }
}

function tallFurniture(p: Pix, ox: number, oy: number, body: string, fn: (p: Pix) => void): void {
  shadow(p, ox + 8, oy + 31, 7, 1);
  p.rect(ox + 1, oy + 2, 14, 29, body);
  p.hline(ox + 1, ox + 14, oy + 2, shade(body, 0.3));
  p.rect(ox, oy + 1, 16, 2, shade(body, -0.2));
  fn(p);
}

const INDOOR: Record<string, Drawer> = {
  table: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      p.rect(ox + 1, oy + 3, 14, 8, P.b4);
      p.hline(ox + 1, ox + 14, oy + 3, P.b5);
      p.rect(ox + 1, oy + 11, 14, 2, P.b2);
      p.rect(ox + 2, oy + 13, 2, 2, P.b1);
      p.rect(ox + 12, oy + 13, 2, 2, P.b1);
      p.set(ox + 5, oy + 6, P.b3);
      p.set(ox + 10, oy + 8, P.b3);
    },
  },
  chairDown: { draw: (p, ox, oy) => chair(p, ox, oy, 'down') },
  chairUp: { draw: (p, ox, oy) => chair(p, ox, oy, 'up') },
  chairLeft: { draw: (p, ox, oy) => chair(p, ox, oy, 'left') },
  chairRight: { draw: (p, ox, oy) => chair(p, ox, oy, 'right') },
  stool: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 5, 1.2);
      p.rect(ox + 5, oy + 9, 1, 4, P.b2);
      p.rect(ox + 10, oy + 9, 1, 4, P.b2);
      p.ellipse(ox + 8, oy + 8, 4.5, 2.5, P.b4);
      p.hline(ox + 5, ox + 10, oy + 7, P.b5);
    },
  },
  counter: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox, oy + 2, 16, 8, P.b4);
      p.hline(ox, ox + 15, oy + 2, P.b5);
      p.hline(ox, ox + 15, oy + 1, P.b1);
      p.rect(ox, oy + 10, 16, 6, P.b2);
      p.hline(ox, ox + 15, oy + 10, P.b1);
      for (let x = 2; x < 16; x += 8) p.strokeRect(ox + x, oy + 11, 5, 4, P.b1);
      p.hline(ox, ox + 15, oy + 15, P.b0);
    },
  },
  counterV: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy, 10, 16, P.b4);
      p.vline(ox + 2, oy, oy + 15, P.b5);
      p.vline(ox + 1, oy, oy + 15, P.b1);
      p.rect(ox + 12, oy, 3, 16, P.b2);
      p.vline(ox + 15, oy, oy + 15, P.b0);
    },
  },
  bedTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 31, 7, 1);
      p.rect(ox + 1, oy + 1, 14, 4, P.b2);
      p.hline(ox + 1, ox + 14, oy + 1, P.b4);
      p.rect(ox + 2, oy + 5, 12, 24, P.white);
      p.rect(ox + 3, oy + 5, 10, 5, '#f0f0f8');
      p.hline(ox + 3, ox + 12, oy + 9, '#c8c8d8');
      p.rect(ox + 2, oy + 11, 12, 18, P.u2);
      p.hline(ox + 2, ox + 13, oy + 11, P.u3);
      p.rect(ox + 2, oy + 11, 2, 18, P.u1);
      p.rect(ox + 12, oy + 11, 2, 18, P.u1);
      p.rect(ox + 1, oy + 28, 14, 3, P.b2);
    },
  },
  bookshelfTop: {
    h: 2,
    draw: (p, ox, oy) =>
      tallFurniture(p, ox, oy, P.b2, (q) => {
        const colors = [P.r2, P.u2, P.g2, P.y1, P.p2, P.o1, P.k3];
        for (const shelfY of [4, 11, 18, 25]) {
          let x = 2;
          let i = shelfY;
          while (x < 14) {
            const w = 1 + Math.floor(hash2(x, shelfY, 9) * 2);
            const h = 5 + Math.floor(hash2(shelfY, x, 4) * 2);
            q.rect(ox + x, oy + shelfY + (6 - h), w, h, colors[i++ % colors.length]);
            x += w;
          }
          q.hline(ox + 1, ox + 14, oy + shelfY + 6, P.b1);
        }
      }),
  },
  wardrobeTop: {
    h: 2,
    draw: (p, ox, oy) =>
      tallFurniture(p, ox, oy, P.b3, (q) => {
        q.strokeRect(ox + 2, oy + 4, 6, 24, P.b2);
        q.strokeRect(ox + 8, oy + 4, 6, 24, P.b2);
        q.set(ox + 7, oy + 16, P.y2);
        q.set(ox + 9, oy + 16, P.y2);
      }),
  },
  clockTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 31, 5, 1);
      p.rect(ox + 3, oy + 3, 10, 28, P.b2);
      p.rect(ox + 2, oy + 2, 12, 3, P.b3);
      p.circle(ox + 8, oy + 9, 3.6, P.s4);
      p.vline(ox + 8, oy + 7, oy + 9, P.k0);
      p.hline(ox + 8, ox + 9, oy + 9, P.k0);
      p.rect(ox + 5, oy + 15, 6, 11, P.b1);
      p.vline(ox + 8, oy + 15, oy + 22, P.y2);
      p.circle(ox + 8, oy + 23, 1.5, P.y2);
      p.rect(ox + 2, oy + 29, 12, 2, P.b3);
    },
  },
  fireplaceTL: {
    w: 2,
    h: 2,
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy + 2, 28, 29, P.k3);
      for (let y = 4; y < 31; y += 4) {
        p.hline(ox + 2, ox + 29, oy + y, P.k2);
        for (let x = (y % 8 === 0 ? 2 : 6); x < 30; x += 8) p.vline(ox + x, oy + y - 3, oy + y - 1, P.k2);
      }
      p.rect(ox + 1, oy + 12, 30, 3, P.b3);
      p.hline(ox + 1, ox + 30, oy + 12, P.b4);
      p.rect(ox + 7, oy + 17, 18, 14, P.k0);
      p.ellipse(ox + 16, oy + 17, 9, 3, P.k0);
      p.thickLine(ox + 10, oy + 29, ox + 22, oy + 27, 1, P.b2);
      p.poly(
        [
          [ox + 10, oy + 28],
          [ox + 13, oy + 19],
          [ox + 16, oy + 23],
          [ox + 19, oy + 18],
          [ox + 22, oy + 28],
        ],
        P.o2,
      );
      p.poly(
        [
          [ox + 12, oy + 28],
          [ox + 15, oy + 22],
          [ox + 18, oy + 21],
          [ox + 20, oy + 28],
        ],
        P.o3,
      );
      p.rect(ox + 14, oy + 25, 4, 3, P.y4);
    },
  },
  throneTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 31, 7, 1);
      p.rect(ox + 2, oy + 3, 12, 20, P.y1);
      p.rect(ox + 4, oy + 5, 8, 16, P.r2);
      p.rect(ox + 5, oy + 6, 2, 14, P.r3);
      p.poly(
        [
          [ox + 2, oy + 3],
          [ox + 5, oy],
          [ox + 8, oy + 2],
          [ox + 11, oy],
          [ox + 14, oy + 3],
        ],
        P.y2,
      );
      p.set(ox + 8, oy + 1, P.r3);
      p.rect(ox + 1, oy + 20, 14, 6, P.y1);
      p.rect(ox + 3, oy + 21, 10, 4, P.r2);
      p.rect(ox + 2, oy + 26, 2, 4, P.y0);
      p.rect(ox + 12, oy + 26, 2, 4, P.y0);
      p.hline(ox + 1, ox + 14, oy + 20, P.y3);
    },
  },
  pillarTop: {
    h: 2,
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 31, 6, 1);
      p.rect(ox + 4, oy + 3, 8, 26, P.k4);
      p.vline(ox + 5, oy + 3, oy + 28, P.k5);
      p.vline(ox + 10, oy + 3, oy + 28, P.k3);
      p.vline(ox + 11, oy + 3, oy + 28, P.k2);
      p.rect(ox + 2, oy + 1, 12, 3, P.k3);
      p.hline(ox + 2, ox + 13, oy + 1, P.k5);
      p.rect(ox + 2, oy + 28, 12, 3, P.k3);
      p.hline(ox + 2, ox + 13, oy + 28, P.k5);
    },
  },
  shelfPotions: {
    draw: (p, ox, oy) => {
      p.rect(ox + 1, oy + 1, 14, 14, P.b2);
      for (const sy of [6, 13]) p.rect(ox + 1, oy + sy, 14, 2, P.b3);
      const colors = [P.r3, P.u3, P.g3, P.y2, P.p3];
      for (let i = 0; i < 4; i++) {
        p.rect(ox + 2 + i * 3, oy + 3, 2, 3, colors[i]);
        p.set(ox + 2 + i * 3, oy + 2, P.k4);
        p.rect(ox + 2 + i * 3, oy + 10, 2, 3, colors[(i + 2) % 5]);
        p.set(ox + 2 + i * 3, oy + 9, P.k4);
      }
    },
  },
  shelfWeapons: {
    draw: (p, ox, oy) => {
      p.rect(ox + 1, oy + 12, 14, 3, P.b2);
      p.hline(ox + 1, ox + 14, oy + 3, P.b2);
      for (const x of [3, 7, 11]) {
        p.vline(ox + x, oy + 1, oy + 12, P.k4);
        p.vline(ox + x + 1, oy + 2, oy + 12, P.k5);
        p.hline(ox + x - 1, ox + x + 2, oy + 9, P.y1);
      }
    },
  },
  shelfArmor: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 5, 1.2);
      p.vline(ox + 8, oy + 10, oy + 14, P.b2);
      p.hline(ox + 5, ox + 11, oy + 14, P.b2);
      p.rect(ox + 4, oy + 3, 8, 8, P.k4);
      p.rect(ox + 3, oy + 3, 2, 3, P.k3);
      p.rect(ox + 11, oy + 3, 2, 3, P.k3);
      p.vline(ox + 8, oy + 4, oy + 9, P.k5);
      p.circle(ox + 8, oy + 1.5, 1.8, P.k3);
    },
  },
  drawer: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 15, 7, 1);
      p.rect(ox + 1, oy + 3, 14, 12, P.b3);
      p.hline(ox + 1, ox + 14, oy + 3, P.b4);
      for (const y of [6, 10]) {
        p.hline(ox + 2, ox + 13, oy + y, P.b2);
        p.set(ox + 8, oy + y + 2, P.y2);
      }
      p.set(ox + 8, oy + 5, P.y2);
    },
  },
  plant: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 15, 5, 1);
      p.poly(
        [
          [ox + 5, oy + 10],
          [ox + 11, oy + 10],
          [ox + 10, oy + 15],
          [ox + 6, oy + 15],
        ],
        P.o1,
      );
      p.hline(ox + 5, ox + 10, oy + 10, P.o2);
      for (const [dx, dy] of [
        [-5, -6],
        [5, -6],
        [-3, -9],
        [3, -9],
        [0, -10],
      ]) {
        p.thickLine(ox + 8, oy + 10, ox + 8 + dx, oy + 10 + dy, 1, P.g2);
        p.set(ox + 8 + dx, oy + 10 + dy, P.g4);
      }
    },
  },
  vase: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 15, 4, 1);
      p.ellipse(ox + 8, oy + 10, 4.5, 4.5, P.u3);
      p.rect(ox + 6, oy + 2, 4, 5, P.u3);
      p.hline(ox + 5, ox + 10, oy + 2, P.u4);
      p.hline(ox + 4, ox + 11, oy + 10, P.white);
      p.set(ox + 5, oy + 8, P.u4);
    },
  },
  candle: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 15, 4, 1);
      p.vline(ox + 8, oy + 6, oy + 14, P.y1);
      p.hline(ox + 5, ox + 10, oy + 14, P.y1);
      p.hline(ox + 5, ox + 10, oy + 6, P.y1);
      for (const x of [5, 8, 11]) {
        p.rect(ox + x - 1, oy + 3, 2, 3, P.s4);
        p.set(ox + x - 1, oy + 1, P.o3);
        p.set(ox + x - 1, oy + 2, P.y4);
      }
    },
  },
  sacks: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      p.ellipse(ox + 5, oy + 10, 4, 4, P.s2);
      p.ellipse(ox + 11, oy + 10, 4, 4, P.s2);
      p.ellipse(ox + 8, oy + 6, 3.5, 3.5, P.s3);
      p.set(ox + 7, oy + 3, P.b2);
      p.set(ox + 9, oy + 3, P.b2);
      p.set(ox + 4, oy + 8, P.s4);
    },
  },
  stairsUp: {
    noOutline: true,
    draw: (p, ox, oy) => {
      for (let i = 0; i < 4; i++) {
        const y = oy + i * 4;
        p.rect(ox + 1, y, 14, 4, mix(P.b4, P.b2, (3 - i) / 4));
        p.hline(ox + 1, ox + 14, y, P.b5);
        p.hline(ox + 1, ox + 14, y + 3, P.b1);
      }
      p.vline(ox, oy, oy + 15, P.b1);
      p.vline(ox + 15, oy, oy + 15, P.b1);
    },
  },
  stairsDown: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 1, oy, 14, 16, P.k0);
      for (let i = 0; i < 4; i++) {
        const y = oy + i * 4;
        const c = mix(P.k3, P.k0, i / 3.5);
        p.rect(ox + 2 + i, y, 12 - i * 2, 3, c);
        p.hline(ox + 2 + i, ox + 13 - i, y, mix(P.k4, P.k1, i / 3.5));
      }
      p.vline(ox, oy, oy + 15, P.k1);
      p.vline(ox + 15, oy, oy + 15, P.k1);
    },
  },
  painting: {
    draw: (p, ox, oy) => {
      p.rect(ox + 2, oy + 3, 12, 9, P.y1);
      p.rect(ox + 3, oy + 4, 10, 7, P.w4);
      p.rect(ox + 3, oy + 8, 10, 3, P.g3);
      p.poly(
        [
          [ox + 4, oy + 9],
          [ox + 7, oy + 5],
          [ox + 10, oy + 9],
        ],
        P.k3,
      );
      p.set(ox + 11, oy + 5, P.y3);
      p.hline(ox + 2, ox + 13, oy + 3, P.y3);
    },
  },
  windowIn: {
    draw: (p, ox, oy) => {
      p.rect(ox + 3, oy + 2, 10, 10, P.b2);
      p.rect(ox + 4, oy + 3, 8, 8, P.w4);
      p.rect(ox + 4, oy + 3, 3, 4, P.w5);
      p.vline(ox + 8, oy + 3, oy + 10, P.b2);
      p.hline(ox + 4, ox + 11, oy + 7, P.b2);
      p.rect(ox + 1, oy + 2, 2, 11, P.r2);
      p.rect(ox + 13, oy + 2, 2, 11, P.r2);
      p.rect(ox + 2, oy + 12, 12, 2, P.b4);
    },
  },
  bannerRed: { draw: (p, ox, oy) => banner(p, ox, oy, P.r2, P.y2) },
  bannerBlue: { draw: (p, ox, oy) => banner(p, ox, oy, P.u2, P.y2) },
  torch: {
    draw: (p, ox, oy) => {
      p.rect(ox + 7, oy + 7, 2, 6, P.b2);
      p.rect(ox + 6, oy + 12, 4, 1, P.k2);
      p.rect(ox + 6, oy + 6, 4, 2, P.k2);
      p.poly(
        [
          [ox + 5, oy + 6],
          [ox + 8, oy + 0],
          [ox + 11, oy + 6],
        ],
        P.o2,
      );
      p.poly(
        [
          [ox + 6, oy + 6],
          [ox + 8, oy + 2],
          [ox + 10, oy + 6],
        ],
        P.y3,
      );
    },
  },
  wallShield: {
    draw: (p, ox, oy) => {
      p.line(ox + 2, oy + 2, ox + 13, oy + 13, P.k4);
      p.line(ox + 13, oy + 2, ox + 2, oy + 13, P.k4);
      p.rect(ox + 4, oy + 3, 8, 6, P.r2);
      p.poly(
        [
          [ox + 4, oy + 9],
          [ox + 12, oy + 9],
          [ox + 8, oy + 13],
        ],
        P.r2,
      );
      p.vline(ox + 8, oy + 3, oy + 11, P.y2);
      p.hline(ox + 5, ox + 10, oy + 6, P.y2);
    },
  },
  stalagmite: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      p.poly(
        [
          [ox + 3, oy + 14],
          [ox + 7, oy + 1],
          [ox + 9, oy + 2],
          [ox + 13, oy + 14],
        ],
        '#7a6a58',
      );
      p.line(ox + 7, oy + 2, ox + 5, oy + 13, '#9a8a74');
      p.line(ox + 10, oy + 6, ox + 12, oy + 13, '#5a4a3a');
    },
  },
  crystal: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      const shard = (x: number, top: number, w: number, c: string, l: string) => {
        p.poly(
          [
            [ox + x - w, oy + 14],
            [ox + x - w, oy + top + 3],
            [ox + x, oy + top],
            [ox + x + w, oy + top + 3],
            [ox + x + w, oy + 14],
          ],
          c,
        );
        p.vline(ox + x - 1, oy + top + 2, oy + 13, l);
      };
      shard(5, 6, 2, P.p2, P.p4);
      shard(11, 5, 2, P.p2, P.p4);
      shard(8, 1, 2.5, '#4ac8e8', '#c8f4ff');
    },
  },
  bones: {
    noOutline: true,
    draw: (p, ox, oy) => {
      const bone = (x0: number, y0: number, x1: number, y1: number) => {
        p.line(ox + x0, oy + y0, ox + x1, oy + y1, P.k6);
        p.rect(ox + x0 - 1, oy + y0 - 1, 2, 2, P.k6);
        p.rect(ox + x1 - 1, oy + y1 - 1, 2, 2, P.k6);
      };
      bone(3, 4, 9, 7);
      bone(7, 12, 13, 10);
      bone(4, 11, 5, 14);
    },
  },
  skull: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 13, 5, 1.2);
      p.ellipse(ox + 8, oy + 7, 4.5, 4, P.k6);
      p.rect(ox + 6, oy + 10, 5, 3, P.k6);
      p.rect(ox + 5, oy + 6, 2, 2, P.k0);
      p.rect(ox + 9, oy + 6, 2, 2, P.k0);
      p.set(ox + 8, oy + 9, P.k1);
      p.vline(ox + 7, oy + 11, oy + 12, P.k3);
      p.vline(ox + 9, oy + 11, oy + 12, P.k3);
    },
  },
  cobweb: {
    noOutline: true,
    draw: (p, ox, oy) => {
      const c = '#e8ecf4c0';
      for (const [x1, y1] of [
        [15, 0],
        [14, 6],
        [10, 10],
        [6, 14],
        [0, 15],
      ]) p.line(ox, oy, ox + x1, oy + y1, c);
      for (const r of [5, 9, 13]) {
        for (let a = 0; a <= 90; a += 6) {
          const rad = (a * Math.PI) / 180;
          p.set(ox + Math.round(Math.cos(rad) * r), oy + Math.round(Math.sin(rad) * r), c);
        }
      }
    },
  },
  spikes: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.rect(ox + 1, oy + 1, 14, 14, '#3a3a44');
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          const cx = ox + 3 + x * 5;
          const cy = oy + 3 + y * 5;
          p.poly(
            [
              [cx - 1.5, cy + 2],
              [cx + 0.5, cy - 2],
              [cx + 2.5, cy + 2],
            ],
            P.k5,
          );
          p.set(cx, cy + 1, P.k3);
        }
      }
    },
  },
  magicCircle: {
    noOutline: true,
    draw: (p, ox, oy) => {
      for (let a = 0; a < 360; a += 4) {
        const rad = (a * Math.PI) / 180;
        p.set(ox + 7.5 + Math.cos(rad) * 7, oy + 7.5 + Math.sin(rad) * 7, '#6ae0ff');
        p.set(ox + 7.5 + Math.cos(rad) * 4.5, oy + 7.5 + Math.sin(rad) * 4.5, P.p3);
      }
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        p.set(ox + 7.5 + Math.cos(a) * 5.8, oy + 7.5 + Math.sin(a) * 5.8, P.white);
      }
      p.poly(
        [
          [ox + 8, oy + 4],
          [ox + 11, oy + 10],
          [ox + 5, oy + 10],
        ],
        '#6ae0ff60',
      );
    },
  },
  lever: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 5, 1.2);
      p.rect(ox + 4, oy + 10, 8, 4, P.k2);
      p.hline(ox + 4, ox + 11, oy + 10, P.k4);
      p.line(ox + 8, oy + 10, ox + 4, oy + 3, P.b3);
      p.circle(ox + 4, oy + 3, 1.6, P.r3);
    },
  },
  altar: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 15, 7, 1);
      p.rect(ox + 1, oy + 5, 14, 10, P.k4);
      p.hline(ox + 1, ox + 14, oy + 5, P.k5);
      p.rect(ox + 5, oy + 5, 6, 10, P.r2);
      p.vline(ox + 8, oy + 7, oy + 12, P.y2);
      p.hline(ox + 6, ox + 10, oy + 9, P.y2);
      p.rect(ox + 2, oy + 2, 1, 3, P.s4);
      p.rect(ox + 13, oy + 2, 1, 3, P.s4);
      p.set(ox + 2, oy + 1, P.o3);
      p.set(ox + 13, oy + 1, P.o3);
    },
  },
  cauldron: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      p.ellipse(ox + 8, oy + 9, 6, 5, P.k1);
      p.ellipse(ox + 8, oy + 6, 5, 1.8, P.g3);
      p.set(ox + 6, oy + 6, P.g5);
      p.set(ox + 10, oy + 5, P.g5);
      p.circle(ox + 6, oy + 3, 1, P.g4);
      p.circle(ox + 10, oy + 2, 0.8, P.g4);
      p.rect(ox + 4, oy + 13, 2, 2, P.k1);
      p.rect(ox + 10, oy + 13, 2, 2, P.k1);
      p.set(ox + 4, oy + 8, P.k3);
    },
  },
  anvil: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 6, 1.5);
      p.rect(ox + 5, oy + 9, 6, 5, P.b3);
      p.rect(ox + 2, oy + 5, 12, 3, P.k2);
      p.hline(ox + 2, ox + 13, oy + 5, P.k4);
      p.poly(
        [
          [ox + 14, oy + 5],
          [ox + 16, oy + 6],
          [ox + 14, oy + 7],
        ],
        P.k2,
      );
      p.rect(ox + 6, oy + 8, 4, 1, P.k1);
    },
  },
  potsCluster: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      const pot = (x: number, y: number, r: number, c: string) => {
        p.ellipse(ox + x, oy + y, r, r, c);
        p.rect(ox + x - 1, oy + y - r - 1, 3, 2, c);
        p.set(ox + x - r + 1, oy + y - 1, shade(c, 0.3));
      };
      pot(5, 10, 3.5, P.o1);
      pot(11, 11, 3, P.b3);
      pot(9, 6, 2.5, P.s1);
    },
  },
  rubble: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      const rocks: [number, number, number][] = [
        [4, 11, 3],
        [10, 11, 3.5],
        [7, 7, 3],
        [12, 6, 2],
      ];
      for (const [x, y, r] of rocks) {
        p.ellipse(ox + x, oy + y, r, r * 0.8, P.k3);
        p.set(ox + x - 1, oy + y - 1, P.k4);
      }
    },
  },
  hole: {
    draw: (p, ox, oy) => {
      p.ellipse(ox + 8, oy + 8, 6.5, 5.5, '#4a3a2e');
      p.ellipse(ox + 8, oy + 8.5, 5.5, 4.5, P.black);
    },
  },
  basin: {
    draw: (p, ox, oy) => {
      shadow(p, ox + 8, oy + 14, 7, 1.5);
      p.ellipse(ox + 8, oy + 8, 7, 5, P.k4);
      p.ellipse(ox + 8, oy + 7.5, 5.5, 3.5, P.w2);
      p.set(ox + 6, oy + 6, P.w4);
      p.set(ox + 7, oy + 6, P.w5);
      p.rect(ox + 6, oy + 12, 4, 2, P.k3);
    },
  },
  rug: {
    noOutline: true,
    draw: (p, ox, oy) => {
      p.ellipse(ox + 8, oy + 8, 7, 5.5, P.r1);
      p.ellipse(ox + 8, oy + 8, 6, 4.5, P.r2);
      p.ellipse(ox + 8, oy + 8, 3.5, 2.5, P.y2);
      p.ellipse(ox + 8, oy + 8, 2, 1.2, P.r1);
    },
  },
};

function banner(p: Pix, ox: number, oy: number, c: string, emblem: string): void {
  p.hline(ox + 3, ox + 12, oy + 1, P.y1);
  p.rect(ox + 4, oy + 2, 8, 11, c);
  p.poly(
    [
      [ox + 4, oy + 13],
      [ox + 8, oy + 10],
      [ox + 12, oy + 13],
      [ox + 12, oy + 15],
      [ox + 8, oy + 12],
      [ox + 4, oy + 15],
    ],
    c,
  );
  p.vline(ox + 4, oy + 2, oy + 14, shade(c, 0.25));
  p.circle(ox + 8, oy + 6, 2, emblem);
  p.set(ox + 8, oy + 6, c);
}

// ---------------------------------------------------------------------------
// sheet generation
// ---------------------------------------------------------------------------

function buildSheet(tiles: BuiltinTile[], drawers: Record<string, Drawer>): HTMLCanvasElement {
  const cols = BUILTIN_SHEET_COLUMNS;
  const rows = Math.ceil(tiles.length / cols);
  const p = new Pix(cols * T, rows * T);
  tiles.forEach((tile, i) => {
    const d = drawers[tile.key];
    if (!d) return;
    const ox = (i % cols) * T;
    const oy = Math.floor(i / cols) * T;
    const w = (d.w ?? 1) * T;
    const h = (d.h ?? 1) * T;
    // draw onto a scratch layer so the outline pass only sees this object
    const layer = new Pix(w + 2, h + 2);
    d.draw(layer, 1, 1);
    if (!d.noOutline) outlineSolid(layer);
    p.blit(layer.crop(1, 1, w, h), ox, oy);
  });
  return p.toCanvas(2);
}

/** Outline only around fully opaque pixels (soft shadows are ignored). */
function outlineSolid(p: Pix): void {
  const src = p.data.slice();
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < p.w && y < p.h && src[y * p.w + x] >>> 24 > 200;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) p.set(x, y, OL);
    }
  }
}

export function generateOutdoorSheet(): HTMLCanvasElement {
  return buildSheet(OUTDOOR_TILES, OUTDOOR);
}

export function generateIndoorSheet(): HTMLCanvasElement {
  return buildSheet(INDOOR_TILES, INDOOR);
}

/** Keys covered by drawers (top-left cells of multi-cell drawers cover the rest). */
export function coveredTileKeys(): { outdoor: Set<string>; indoor: Set<string> } {
  const cover = (tiles: BuiltinTile[], drawers: Record<string, Drawer>) => {
    const out = new Set<string>();
    tiles.forEach((tile, i) => {
      const d = drawers[tile.key];
      if (!d) return;
      const cx = i % BUILTIN_SHEET_COLUMNS;
      const cy = Math.floor(i / BUILTIN_SHEET_COLUMNS);
      for (let y = 0; y < (d.h ?? 1); y++) {
        for (let x = 0; x < (d.w ?? 1); x++) {
          const t = tiles[(cy + y) * BUILTIN_SHEET_COLUMNS + cx + x];
          if (t) out.add(t.key);
        }
      }
    });
    return out;
  };
  return { outdoor: cover(OUTDOOR_TILES, OUTDOOR), indoor: cover(INDOOR_TILES, INDOOR) };
}
