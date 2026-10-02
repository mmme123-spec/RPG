/**
 * Built-in enemy battler graphics, drawn with shaded primitive shapes and
 * outlined, at half resolution (scaled 2x).
 */

import { mix, shade } from './color';
import { Pix } from './pixel';

const OL = '#1c1626';
type Ramp = [string, string, string, string];

function ramp(base: string): Ramp {
  return [shade(base, -0.38), base, mix(base, '#ffffff', 0.22), mix(base, '#ffffff', 0.55)];
}

const LX = -0.45;
const LY = -0.62;
const LZ = 0.64;

/** Filled ellipse with banded sphere lighting from the upper left. */
function sphere(p: Pix, cx: number, cy: number, rx: number, ry: number, base: string | Ramp, alpha = 255): void {
  const r = typeof base === 'string' ? ramp(base) : base;
  for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
    for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const lam = nx * LX + ny * LY + nz * LZ;
      const c = lam < 0.18 ? r[0] : lam < 0.55 ? r[1] : lam < 0.86 ? r[2] : r[3];
      if (alpha >= 255) p.set(x, y, c);
      else p.blend(x, y, c, alpha / 255);
    }
  }
}

function limb(p: Pix, x0: number, y0: number, x1: number, y1: number, r: number, base: string): void {
  p.thickLine(x0, y0, x1, y1, r, base);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  // highlight on the upper-left side of the limb
  const ox = (-dy / len) * r * 0.45;
  const oy = (dx / len) * r * 0.45;
  const s = ox + oy < 0 ? 1 : -1;
  p.line(x0 + ox * s, y0 + oy * s, x1 + ox * s, y1 + oy * s, mix(base, '#ffffff', 0.25));
}

function poly(p: Pix, pts: [number, number][], c: string): void {
  p.poly(pts, c);
}

function mirrorPts(pts: [number, number][], axis: number): [number, number][] {
  return pts.map(([x, y]) => [2 * axis - x, y]);
}

function eye(p: Pix, x: number, y: number, rx: number, ry: number, white: string, pupil: string): void {
  p.ellipse(x, y, rx, ry, white);
  p.ellipse(x + rx * 0.25, y + ry * 0.2, Math.max(0.8, rx * 0.5), Math.max(1, ry * 0.65), pupil);
  p.set(Math.floor(x - rx * 0.3), Math.floor(y - ry * 0.4), '#ffffff');
}

type EnemyFn = () => Pix;

const ENEMIES: Record<string, EnemyFn> = {
  slime: () => {
    const p = new Pix(48, 40);
    const body = '#3a9ae8';
    poly(
      p,
      [
        [17, 18],
        [24, 4],
        [31, 18],
      ],
      body,
    );
    p.line(23, 6, 19, 16, mix(body, '#ffffff', 0.3));
    sphere(p, 24, 26, 18, 12.5, body);
    eye(p, 18, 24, 3, 4, '#ffffff', OL);
    eye(p, 30, 24, 3, 4, '#ffffff', OL);
    p.line(21, 31, 24, 33, OL);
    p.line(24, 33, 27, 31, OL);
    p.ellipse(13, 19, 2.5, 1.6, '#e8f6ff');
    p.outline(OL);
    return p;
  },
  bat: () => {
    const p = new Pix(64, 44);
    const body = '#6a4a8a';
    const wing = '#4a2a66';
    const wingL: [number, number][] = [
      [27, 20],
      [3, 6],
      [7, 15],
      [1, 22],
      [11, 22],
      [14, 30],
      [27, 27],
    ];
    poly(p, wingL, wing);
    poly(p, mirrorPts(wingL, 32), wing);
    for (const [x, y] of [
      [3, 6],
      [1, 22],
      [14, 30],
    ]) {
      p.line(27, 21, x, y, mix(wing, '#ffffff', 0.25));
      p.line(37, 21, 64 - x, y, mix(wing, '#ffffff', 0.25));
    }
    poly(
      p,
      [
        [26, 17],
        [27, 7],
        [31, 15],
      ],
      body,
    );
    poly(
      p,
      [
        [38, 17],
        [37, 7],
        [33, 15],
      ],
      body,
    );
    sphere(p, 32, 22, 8, 8, body);
    p.rect(28, 20, 2, 2, '#ff3838');
    p.rect(34, 20, 2, 2, '#ff3838');
    p.set(30, 27, '#ffffff');
    p.set(30, 28, '#ffffff');
    p.set(34, 27, '#ffffff');
    p.set(34, 28, '#ffffff');
    p.outline(OL);
    return p;
  },
  goblin: () => {
    const p = new Pix(48, 64);
    const skin = '#6aa84a';
    limb(p, 20, 46, 18, 59, 2.5, skin);
    limb(p, 28, 46, 30, 59, 2.5, skin);
    p.ellipse(17, 61, 4, 2, '#4a3020');
    p.ellipse(31, 61, 4, 2, '#4a3020');
    limb(p, 16, 34, 10, 45, 2.4, skin);
    sphere(p, 24, 38, 9, 8, skin);
    poly(
      p,
      [
        [15, 41],
        [33, 41],
        [31, 50],
        [17, 50],
      ],
      '#7a5030',
    );
    p.hline(15, 33, 41, '#5a3820');
    limb(p, 32, 34, 38, 29, 2.4, skin);
    limb(p, 38, 30, 44, 9, 1.8, '#8a5a30');
    sphere(p, 44, 8, 4.5, 4.5, '#8a5a30');
    for (const [x, y] of [
      [44, 2],
      [49, 7],
      [40, 4],
    ]) p.set(x, y, '#c8c8d0');
    poly(
      p,
      [
        [15, 17],
        [3, 11],
        [16, 23],
      ],
      skin,
    );
    poly(
      p,
      [
        [33, 17],
        [45, 11],
        [32, 23],
      ],
      skin,
    );
    sphere(p, 24, 20, 10, 9, skin);
    eye(p, 20, 19, 2.6, 2, '#f8e040', OL);
    eye(p, 28, 19, 2.6, 2, '#f8e040', OL);
    p.line(17, 15, 22, 17, OL);
    p.line(31, 15, 26, 17, OL);
    p.hline(19, 29, 25, '#2a1a18');
    for (const x of [20, 23, 26, 28]) p.set(x, 25, '#ffffff');
    p.set(24, 22, shade(skin, -0.4));
    p.outline(OL);
    return p;
  },
  wolf: () => {
    const p = new Pix(80, 52);
    const fur = '#7a8094';
    limb(p, 66, 22, 77, 11, 3, fur);
    p.set(77, 10, '#d8dce8');
    limb(p, 53, 30, 51, 47, 2.6, shade(fur, -0.2));
    limb(p, 31, 30, 27, 47, 2.6, shade(fur, -0.2));
    sphere(p, 48, 27, 18, 10, fur);
    p.ellipse(46, 33, 12, 3, mix(fur, '#ffffff', 0.35));
    limb(p, 59, 30, 61, 47, 3, fur);
    limb(p, 37, 31, 35, 47, 2.8, fur);
    for (const x of [27, 35, 51, 61]) p.hline(x - 2, x + 2, 48, '#3a3a44');
    limb(p, 36, 26, 26, 18, 6, fur);
    sphere(p, 24, 18, 9, 8, fur);
    poly(
      p,
      [
        [19, 15],
        [3, 20],
        [5, 25],
        [21, 25],
      ],
      fur,
    );
    p.line(5, 23, 18, 23, '#2a1a1e');
    p.set(8, 24, '#ffffff');
    p.set(12, 24, '#ffffff');
    p.rect(3, 19, 2, 2, OL);
    poly(
      p,
      [
        [21, 11],
        [23, 1],
        [28, 10],
      ],
      fur,
    );
    poly(
      p,
      [
        [27, 11],
        [31, 3],
        [33, 12],
      ],
      shade(fur, -0.2),
    );
    p.rect(17, 15, 3, 2, '#f0d040');
    p.set(18, 15, OL);
    p.outline(OL);
    return p;
  },
  snake: () => {
    const p = new Pix(56, 56);
    const c = '#4a9a3a';
    sphere(p, 28, 46, 18, 7, c);
    sphere(p, 26, 38, 14, 6, c);
    sphere(p, 29, 31, 10, 5, c);
    for (const [x, y] of [
      [18, 46],
      [30, 47],
      [40, 45],
      [22, 38],
      [32, 38],
      [27, 31],
    ]) {
      poly(
        p,
        [
          [x, y - 2],
          [x + 2, y],
          [x, y + 2],
          [x - 2, y],
        ],
        shade(c, -0.4),
      );
    }
    limb(p, 31, 29, 34, 15, 4, c);
    sphere(p, 35, 12, 8, 6, c);
    poly(
      p,
      [
        [40, 13],
        [49, 11],
        [49, 17],
        [40, 16],
      ],
      '#5a1a20',
    );
    p.line(48, 14, 54, 13, '#e03040');
    p.line(54, 13, 55, 11, '#e03040');
    p.line(54, 13, 55, 15, '#e03040');
    p.set(41, 12, '#ffffff');
    p.set(41, 17, '#ffffff');
    p.rect(35, 9, 3, 2, '#f0d040');
    p.set(36, 9, OL);
    p.outline(OL);
    return p;
  },
  mushroom: () => {
    const p = new Pix(48, 56);
    const stem = '#f0e0c0';
    p.ellipse(18, 52, 5, 3, shade(stem, -0.2));
    p.ellipse(30, 52, 5, 3, shade(stem, -0.2));
    sphere(p, 24, 40, 10, 12, stem);
    sphere(p, 24, 22, 21, 13, '#d03a3a');
    p.ellipse(24, 30, 17, 3.5, shade(stem, -0.25));
    for (const [x, y, r] of [
      [15, 18, 3],
      [26, 13, 3.5],
      [35, 20, 2.5],
      [21, 24, 2],
      [8, 24, 1.5],
    ]) p.circle(x, y, r, '#fff4e8');
    p.rect(19, 38, 2, 4, OL);
    p.rect(27, 38, 2, 4, OL);
    p.line(22, 46, 26, 46, OL);
    p.set(18, 44, '#f0a0a0');
    p.set(30, 44, '#f0a0a0');
    p.outline(OL);
    return p;
  },
  skeleton: () => {
    const p = new Pix(48, 76);
    const bone = '#e8e2d0';
    limb(p, 38, 38, 45, 7, 1.6, '#b8c0d0');
    p.thickLine(34, 38, 42, 36, 0.8, '#8a6a3a');
    limb(p, 20, 52, 18, 71, 1.6, bone);
    limb(p, 28, 52, 30, 71, 1.6, bone);
    p.ellipse(17, 72, 3, 1.5, bone);
    p.ellipse(31, 72, 3, 1.5, bone);
    p.ellipse(24, 50, 7, 3, bone);
    for (let y = 29; y < 50; y += 3) p.rect(23, y, 3, 2, bone);
    for (let i = 0; i < 4; i++) {
      const y = 32 + i * 4;
      const w = 10 - i;
      for (let x = -w; x <= w; x++) {
        if (Math.abs(x) < 2) continue;
        p.set(24 + x, y + Math.round((x * x) / 30), bone);
      }
    }
    limb(p, 15, 30, 11, 43, 1.4, bone);
    limb(p, 11, 43, 14, 51, 1.2, bone);
    limb(p, 33, 30, 37, 37, 1.4, bone);
    sphere(p, 24, 17, 9, 9, bone);
    p.rect(19, 23, 10, 5, bone);
    p.ellipse(20, 17, 2.6, 2.8, OL);
    p.ellipse(28, 17, 2.6, 2.8, OL);
    p.set(20, 17, '#ff4040');
    p.set(28, 17, '#ff4040');
    p.set(24, 21, OL);
    for (let x = 20; x <= 28; x += 2) p.vline(x, 24, 27, '#8a8478');
    p.outline(OL);
    return p;
  },
  ghost: () => {
    const p = new Pix(52, 60);
    const c = '#e0e8ff';
    p.ellipse(9, 31, 4, 3, c);
    p.ellipse(43, 31, 4, 3, c);
    sphere(p, 26, 22, 14, 14, c);
    for (let x = 12; x <= 40; x++) {
      const wave = Math.round(Math.sin(x * 0.55) * 2.5);
      const shadeC = x > 33 ? shade(c, -0.18) : x < 17 ? mix(c, '#ffffff', 0.4) : c;
      p.vline(x, 22, 48 + wave, shadeC);
    }
    p.ellipse(21, 20, 2.6, 4, '#2a2040');
    p.ellipse(31, 20, 2.6, 4, '#2a2040');
    p.ellipse(26, 30, 2.6, 3, '#2a2040');
    p.outline(OL);
    // translucency
    for (let i = 0; i < p.data.length; i++) {
      const v = p.data[i];
      if (v >>> 24 === 255) p.data[i] = ((225 << 24) | (v & 0xffffff)) >>> 0;
    }
    return p;
  },
  spider: () => {
    const p = new Pix(72, 48);
    const leg = '#3a2240';
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const kx = 36 + s * (12 + i * 4);
        const ky = 9 + i * 2;
        const fx = 36 + s * (16 + i * 5);
        const fy = 40 + (i % 2);
        p.thickLine(34 + s * 2, 26, kx, ky, 1.1, leg);
        p.thickLine(kx, ky, fx, fy, 1, leg);
      }
    }
    sphere(p, 46, 22, 14, 11, '#4a2a5a');
    poly(
      p,
      [
        [44, 17],
        [49, 17],
        [46, 22],
        [49, 27],
        [44, 27],
        [47, 22],
      ],
      '#d02030',
    );
    sphere(p, 27, 28, 9, 7, '#5a3268');
    for (const [x, y] of [
      [23, 26],
      [26, 25],
      [29, 25],
      [32, 26],
      [25, 28],
      [30, 28],
    ]) p.set(x, y, '#ff3030');
    p.line(25, 33, 24, 37, '#ffffff');
    p.line(30, 33, 31, 37, '#ffffff');
    p.outline(OL);
    return p;
  },
  orc: () => {
    const p = new Pix(64, 84);
    const skin = '#6a8a4a';
    limb(p, 26, 60, 24, 79, 4, '#4a3a2a');
    limb(p, 38, 60, 40, 79, 4, '#4a3a2a');
    p.ellipse(23, 80, 6, 2.5, '#2a2018');
    p.ellipse(41, 80, 6, 2.5, '#2a2018');
    limb(p, 18, 40, 10, 58, 4, skin);
    sphere(p, 32, 46, 15, 16, skin);
    p.rect(17, 54, 30, 4, '#5a3a20');
    p.rect(30, 54, 4, 4, '#c8a040');
    sphere(p, 18, 34, 6, 5, '#8a8a98');
    sphere(p, 46, 34, 6, 5, '#8a8a98');
    limb(p, 46, 40, 52, 30, 4, skin);
    limb(p, 52, 32, 56, 4, 1.6, '#7a5030');
    poly(
      p,
      [
        [55, 4],
        [64, 2],
        [63, 16],
        [56, 13],
      ],
      '#a8b0c0',
    );
    p.line(63, 3, 63, 15, '#e0e4ec');
    sphere(p, 32, 22, 10, 10, skin);
    p.set(28, 20, '#ff3030');
    p.set(29, 20, '#ff3030');
    p.set(35, 20, '#ff3030');
    p.set(36, 20, '#ff3030');
    p.line(26, 17, 30, 19, OL);
    p.line(38, 17, 34, 19, OL);
    p.hline(27, 37, 26, '#2a1a18');
    poly(
      p,
      [
        [27, 27],
        [28, 22],
        [29, 27],
      ],
      '#f0ece0',
    );
    poly(
      p,
      [
        [35, 27],
        [36, 22],
        [37, 27],
      ],
      '#f0ece0',
    );
    p.outline(OL);
    return p;
  },
  plant: () => {
    const p = new Pix(56, 68);
    const green = '#4a9a3a';
    poly(
      p,
      [
        [6, 66],
        [18, 50],
        [27, 66],
      ],
      green,
    );
    poly(
      p,
      [
        [29, 66],
        [38, 50],
        [50, 66],
      ],
      shade(green, -0.15),
    );
    for (let t = 0; t <= 1; t += 0.02) {
      const x = 28 + Math.sin(t * Math.PI * 1.5) * 5;
      const y = 66 - t * 32;
      p.circle(x, y, 3, green);
    }
    p.thickLine(26, 52, 14, 44, 0.8, green);
    p.ellipse(13, 43, 3, 2, '#6ac04a');
    p.thickLine(30, 46, 42, 40, 0.8, green);
    p.ellipse(43, 39, 3, 2, '#6ac04a');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.ellipse(28 + Math.cos(a) * 15, 24 + Math.sin(a) * 13, 6, 6, i % 2 ? '#f0a030' : '#f8c040');
    }
    sphere(p, 28, 24, 15, 13, '#d04a6a');
    p.ellipse(28, 28, 10, 7, '#3a0a14');
    for (let x = 20; x <= 36; x += 3) {
      poly(
        p,
        [
          [x, 21],
          [x + 1.5, 25],
          [x + 3, 21],
        ],
        '#ffffff',
      );
      poly(
        p,
        [
          [x, 35],
          [x + 1.5, 31],
          [x + 3, 35],
        ],
        '#ffffff',
      );
    }
    p.outline(OL);
    return p;
  },
  imp: () => {
    const p = new Pix(52, 60);
    const red = '#c8303a';
    const wing = '#7a1a2a';
    const w: [number, number][] = [
      [22, 32],
      [4, 14],
      [8, 24],
      [2, 30],
      [12, 32],
      [16, 40],
    ];
    poly(p, w, wing);
    poly(p, mirrorPts(w, 26), wing);
    for (let t = 0; t <= 1; t += 0.05) {
      p.circle(30 + t * 16, 46 + Math.sin(t * Math.PI) * 6 - t * 10, 1.3, red);
    }
    poly(
      p,
      [
        [44, 34],
        [50, 34],
        [47, 29],
      ],
      red,
    );
    limb(p, 22, 44, 20, 55, 2, red);
    limb(p, 30, 44, 32, 55, 2, red);
    sphere(p, 26, 38, 8, 9, red);
    limb(p, 32, 36, 38, 30, 1.6, red);
    p.thickLine(39, 52, 39, 14, 0.7, '#c8a040');
    p.hline(35, 43, 18, '#c8a040');
    p.vline(35, 13, 18, '#c8a040');
    p.vline(43, 13, 18, '#c8a040');
    p.vline(39, 10, 14, '#c8a040');
    sphere(p, 26, 22, 9, 8, red);
    poly(
      p,
      [
        [19, 17],
        [16, 7],
        [22, 15],
      ],
      '#f0e0b0',
    );
    poly(
      p,
      [
        [33, 17],
        [36, 7],
        [30, 15],
      ],
      '#f0e0b0',
    );
    p.rect(21, 20, 3, 2, '#f8e040');
    p.rect(29, 20, 3, 2, '#f8e040');
    p.line(21, 26, 26, 28, OL);
    p.line(26, 28, 31, 26, OL);
    p.set(23, 27, '#ffffff');
    p.set(29, 27, '#ffffff');
    p.outline(OL);
    return p;
  },
  golem: () => {
    const p = new Pix(76, 84);
    const stone = '#8a8a7a';
    const block = (x: number, y: number, w: number, h: number, c: string) => {
      p.rect(x, y, w, h, c);
      p.hline(x, x + w - 1, y, mix(c, '#ffffff', 0.3));
      p.vline(x, y, y + h - 1, mix(c, '#ffffff', 0.18));
      p.hline(x, x + w - 1, y + h - 1, shade(c, -0.35));
      p.vline(x + w - 1, y, y + h - 1, shade(c, -0.3));
    };
    block(24, 62, 11, 20, shade(stone, -0.1));
    block(41, 62, 11, 20, shade(stone, -0.1));
    block(18, 28, 40, 36, stone);
    block(5, 30, 13, 26, stone);
    block(58, 30, 13, 26, stone);
    block(4, 54, 15, 10, shade(stone, -0.15));
    block(57, 54, 15, 10, shade(stone, -0.15));
    block(28, 10, 20, 20, stone);
    p.line(26, 34, 34, 48, shade(stone, -0.4));
    p.line(50, 40, 44, 56, shade(stone, -0.4));
    for (const [x, y, r] of [
      [22, 30, 3],
      [52, 29, 2],
      [30, 11, 2.5],
      [8, 31, 2],
    ]) p.ellipse(x, y, r + 1, r * 0.7, '#5a8a3a');
    p.rect(32, 18, 4, 3, '#60f0ff');
    p.rect(41, 18, 4, 3, '#60f0ff');
    p.set(33, 18, '#ffffff');
    p.set(42, 18, '#ffffff');
    p.hline(34, 43, 25, '#3a3a34');
    p.outline(OL);
    return p;
  },
  darkKnight: () => {
    const p = new Pix(60, 84);
    const steel = '#3e4456';
    poly(
      p,
      [
        [15, 24],
        [45, 24],
        [53, 80],
        [7, 80],
      ],
      '#6a1424',
    );
    p.line(15, 26, 9, 78, '#8a2034');
    limb(p, 24, 58, 22, 79, 4, steel);
    limb(p, 36, 58, 38, 79, 4, steel);
    p.ellipse(21, 80, 5, 2, '#20232e');
    p.ellipse(39, 80, 5, 2, '#20232e');
    sphere(p, 30, 43, 11, 15, steel);
    p.vline(30, 32, 55, mix(steel, '#ffffff', 0.25));
    p.rect(19, 54, 22, 3, '#2a2420');
    limb(p, 44, 36, 48, 50, 3, steel);
    limb(p, 48, 52, 56, 10, 2.2, '#b8c0d0');
    p.line(48, 50, 55, 11, '#e8ecf4');
    p.thickLine(44, 52, 53, 50, 1, '#c8a040');
    poly(
      p,
      [
        [5, 36],
        [21, 36],
        [21, 53],
        [13, 61],
        [5, 53],
      ],
      '#2a2e3c',
    );
    poly(
      p,
      [
        [7, 38],
        [19, 38],
        [19, 52],
        [13, 58],
        [7, 52],
      ],
      '#6a1424',
    );
    p.vline(13, 40, 55, '#c8a040');
    p.hline(8, 18, 45, '#c8a040');
    sphere(p, 18, 30, 6, 5, steel);
    sphere(p, 42, 30, 6, 5, steel);
    sphere(p, 30, 17, 8, 9, steel);
    p.rect(24, 17, 12, 2, '#14141c');
    p.rect(26, 17, 3, 2, '#ff3030');
    p.rect(32, 17, 3, 2, '#ff3030');
    poly(
      p,
      [
        [22, 12],
        [14, 2],
        [24, 9],
      ],
      '#c8c0b0',
    );
    poly(
      p,
      [
        [38, 12],
        [46, 2],
        [36, 9],
      ],
      '#c8c0b0',
    );
    p.outline(OL);
    return p;
  },
  wizard: () => {
    const p = new Pix(52, 76);
    const robe = '#3a2a5a';
    poly(
      p,
      [
        [15, 28],
        [34, 28],
        [45, 74],
        [5, 74],
      ],
      robe,
    );
    p.line(15, 30, 7, 72, mix(robe, '#ffffff', 0.2));
    p.hline(5, 45, 73, '#c8a040');
    p.hline(6, 44, 72, '#c8a040');
    p.line(34, 30, 43, 72, shade(robe, -0.3));
    limb(p, 32, 34, 41, 42, 3, robe);
    p.circle(42, 42, 2, '#c8b8a0');
    limb(p, 42, 74, 42, 16, 1.4, '#6a4a2a');
    sphere(p, 42, 12, 5, 5, ['#2a8a4a', '#40c070', '#80f0a8', '#e0fff0']);
    sphere(p, 24, 20, 10, 11, robe);
    p.ellipse(24, 23, 6, 6, '#0e0a14');
    p.rect(21, 22, 2, 1, '#f8e040');
    p.rect(26, 22, 2, 1, '#f8e040');
    poly(
      p,
      [
        [19, 27],
        [29, 27],
        [26, 38],
        [24, 40],
        [22, 38],
      ],
      '#d8d8e0',
    );
    poly(
      p,
      [
        [24, 2],
        [17, 12],
        [31, 12],
      ],
      robe,
    );
    p.outline(OL);
    return p;
  },
  dragon: () => {
    const p = new Pix(128, 112);
    const scale = '#c03a2a';
    const wing = '#7a2018';
    const wingPts: [number, number][] = [
      [70, 44],
      [96, 6],
      [104, 18],
      [122, 4],
      [118, 28],
      [127, 38],
      [110, 46],
      [114, 58],
      [90, 54],
    ];
    poly(p, wingPts, wing);
    for (const [x, y] of [
      [96, 6],
      [122, 4],
      [127, 38],
      [114, 58],
    ]) p.line(72, 44, x, y, mix(wing, '#ffffff', 0.3));
    for (let t = 0; t <= 1; t += 0.01) {
      const x = 92 + t * 34;
      const y = 80 + Math.sin(t * Math.PI) * 14 + t * 6;
      p.circle(x, y, 7 * (1 - t) + 1.2, scale);
      if (Math.floor(t * 100) % 12 === 0) {
        poly(
          p,
          [
            [x - 2, y - 6 * (1 - t) - 1],
            [x, y - 6 * (1 - t) - 6],
            [x + 2, y - 6 * (1 - t) - 1],
          ],
          '#f0d080',
        );
      }
    }
    limb(p, 88, 80, 94, 103, 6, shade(scale, -0.15));
    sphere(p, 76, 70, 26, 20, scale);
    p.ellipse(68, 80, 18, 9, '#e8b070');
    for (let y = 75; y <= 86; y += 3) p.hline(54, 82, y, '#c88a50');
    limb(p, 58, 80, 52, 103, 5, scale);
    for (const x of [86, 50]) {
      for (let i = 0; i < 3; i++) p.line(x + i * 3, 104, x + i * 3 - 1, 107, '#f0f0e0');
    }
    for (let t = 0; t <= 1; t += 0.02) {
      const x = 58 - t * 20;
      const y = 60 - t * 24 - Math.sin(t * Math.PI) * 4;
      p.circle(x, y, 8, scale);
    }
    p.ellipse(44, 50, 4, 10, '#e8b070');
    sphere(p, 32, 30, 14, 11, scale);
    poly(
      p,
      [
        [24, 24],
        [3, 32],
        [5, 38],
        [26, 38],
      ],
      scale,
    );
    poly(
      p,
      [
        [24, 38],
        [6, 40],
        [10, 46],
        [28, 42],
      ],
      shade(scale, -0.2),
    );
    p.line(6, 38, 24, 38, '#3a0a0a');
    for (let x = 8; x < 24; x += 4) {
      p.set(x, 37, '#ffffff');
      p.set(x + 1, 40, '#ffffff');
    }
    p.rect(4, 31, 2, 2, OL);
    poly(
      p,
      [
        [36, 22],
        [52, 4],
        [44, 22],
      ],
      '#f0e0b0',
    );
    poly(
      p,
      [
        [42, 26],
        [60, 14],
        [48, 28],
      ],
      '#e0d0a0',
    );
    p.rect(26, 26, 4, 3, '#f8e040');
    p.vline(28, 26, 28, OL);
    p.outline(OL);
    return p;
  },
  demonLord: () => {
    const p = new Pix(120, 124);
    const skin = '#5a2040';
    const wing: [number, number][] = [
      [50, 46],
      [10, 8],
      [16, 30],
      [2, 40],
      [16, 50],
      [6, 66],
      [26, 66],
      [36, 80],
    ];
    poly(p, wing, '#2a0a1e');
    poly(p, mirrorPts(wing, 60), '#2a0a1e');
    for (const [x, y] of [
      [10, 8],
      [2, 40],
      [6, 66],
    ]) {
      p.line(50, 46, x, y, '#5a1a3a');
      p.line(70, 46, 120 - x, y, '#5a1a3a');
    }
    poly(
      p,
      [
        [38, 70],
        [82, 70],
        [96, 122],
        [24, 122],
      ],
      '#1a0a14',
    );
    p.line(38, 72, 26, 120, '#3a1a2a');
    limb(p, 40, 52, 26, 80, 7, skin);
    limb(p, 80, 52, 94, 80, 7, skin);
    for (const [x, s] of [
      [26, -1],
      [94, 1],
    ]) {
      for (let i = 0; i < 4; i++) p.thickLine(x + (i - 1.5) * 3, 82, x + (i - 1.5) * 3 + s, 89, 0.8, '#e8e0d0');
    }
    sphere(p, 60, 58, 22, 20, skin);
    p.line(60, 44, 60, 70, shade(skin, -0.35));
    p.ellipse(52, 52, 6, 4, mix(skin, '#ffffff', 0.15));
    p.ellipse(68, 52, 6, 4, shade(skin, -0.1));
    sphere(p, 60, 30, 13, 13, skin);
    for (const s of [-1, 1]) {
      for (let t = 0; t <= 1; t += 0.04) {
        const x = 60 + s * (10 + t * 18 - Math.sin(t * Math.PI) * 2);
        const y = 22 - t * 20 + t * t * 4;
        p.circle(x, y, 3.6 * (1 - t) + 0.8, '#e8dcc0');
      }
    }
    p.rect(51, 27, 6, 3, '#ff2020');
    p.rect(63, 27, 6, 3, '#ff2020');
    p.set(53, 27, '#ffff80');
    p.set(65, 27, '#ffff80');
    p.line(50, 24, 57, 26, OL);
    p.line(70, 24, 63, 26, OL);
    p.rect(53, 36, 14, 4, '#1a0410');
    for (let x = 54; x < 67; x += 3) {
      p.set(x, 36, '#ffffff');
      p.set(x + 1, 39, '#ffffff');
    }
    poly(
      p,
      [
        [48, 18],
        [50, 10],
        [54, 16],
        [60, 6],
        [66, 16],
        [70, 10],
        [72, 18],
      ],
      '#c8a040',
    );
    p.outline(OL);
    return p;
  },
};

export function generateEnemy(key: string): HTMLCanvasElement | null {
  const fn = ENEMIES[key];
  if (!fn) return null;
  return fn().toCanvas(2);
}

export const ENEMY_KEYS = Object.keys(ENEMIES);
