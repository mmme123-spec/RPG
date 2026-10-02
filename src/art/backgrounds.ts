/**
 * Built-in battle backgrounds and title screens (320x240 art, scaled 2x).
 */

import { P, mix, shade } from './color';
import { Pix, hash2 } from './pixel';

const W = 320;
const H = 240;
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function dither(x: number, y: number): number {
  return (BAYER[y & 3][x & 3] + 0.5) / 16;
}

/** Vertical gradient through colour stops with ordered dithering. */
function gradient(p: Pix, x0: number, y0: number, w: number, h: number, stops: string[]): void {
  for (let y = y0; y < y0 + h; y++) {
    const t = ((y - y0) / Math.max(1, h - 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    const f = t - i;
    for (let x = x0; x < x0 + w; x++) p.set(x, y, f > dither(x, y) ? stops[i + 1] : stops[i]);
  }
}

function noise1(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash2(i, 0, seed);
  const b = hash2(i + 1, 0, seed);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

function fbm(x: number, seed: number): number {
  return noise1(x, seed) * 0.6 + noise1(x * 2.1, seed + 1) * 0.28 + noise1(x * 4.3, seed + 2) * 0.12;
}

/** Fill a noisy ridge silhouette from its top edge down to `bottom`. */
function ridge(p: Pix, base: number, amp: number, freq: number, seed: number, color: string, bottom = H, light?: string): void {
  for (let x = 0; x < W; x++) {
    const top = Math.round(base - fbm(x * freq, seed) * amp);
    for (let y = Math.max(0, top); y < bottom; y++) p.set(x, y, color);
    if (light) p.set(x, top, light);
  }
}

function clouds(p: Pix, seed: number, y0: number, y1: number, count: number, color = '#ffffff'): void {
  for (let i = 0; i < count; i++) {
    const cx = hash2(i, 1, seed) * W;
    const cy = y0 + hash2(i, 2, seed) * (y1 - y0);
    const w = 18 + hash2(i, 3, seed) * 30;
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * w * 0.28;
      const r = w * (0.22 + 0.12 * Math.sin(k * 1.7 + i));
      p.ellipse(cx + ox, cy - r * 0.3, r, r * 0.7, color);
    }
    p.ellipse(cx, cy + 2, w * 0.7, 3, shade(color, -0.08));
  }
}

function stars(p: Pix, seed: number, y1: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash2(i, 7, seed) * W);
    const y = Math.floor(hash2(i, 8, seed) * y1);
    const b = hash2(i, 9, seed);
    p.set(x, y, b > 0.8 ? '#ffffff' : b > 0.4 ? '#c8d0f0' : '#8890c0');
    if (b > 0.93) {
      p.set(x - 1, y, '#8890c0');
      p.set(x + 1, y, '#8890c0');
      p.set(x, y - 1, '#8890c0');
      p.set(x, y + 1, '#8890c0');
    }
  }
}

/** Ground plane with perspective bands. */
function ground(p: Pix, horizon: number, a: string, b: string, seed: number, specks?: string[]): void {
  for (let y = horizon; y < H; y++) {
    const t = (y - horizon) / (H - horizon);
    const band = Math.floor(Math.pow(t, 0.6) * 12);
    for (let x = 0; x < W; x++) p.set(x, y, band % 2 === 0 ? a : mix(a, b, 0.5));
  }
  if (specks) {
    for (let i = 0; i < 400; i++) {
      const y = horizon + Math.floor(Math.pow(hash2(i, 3, seed), 0.7) * (H - horizon));
      const x = Math.floor(hash2(i, 4, seed) * W);
      const t = (y - horizon) / (H - horizon);
      const s = Math.max(1, Math.round(t * 3));
      p.rect(x, y, s, Math.max(1, Math.round(s / 2)), specks[i % specks.length]);
    }
  }
}

function treeSilhouette(p: Pix, x: number, base: number, h: number, c: string, trunk: string): void {
  p.rect(x - 2, base - h * 0.4, 4, h * 0.4, trunk);
  p.ellipse(x, base - h * 0.62, h * 0.32, h * 0.4, c);
  p.ellipse(x - h * 0.1, base - h * 0.72, h * 0.18, h * 0.16, mix(c, '#ffffff', 0.12));
}

function pineSilhouette(p: Pix, x: number, base: number, h: number, c: string): void {
  p.poly(
    [
      [x, base - h],
      [x + h * 0.3, base],
      [x - h * 0.3, base],
    ],
    c,
  );
}

const BATTLEBACKS: Record<string, () => Pix> = {
  grassland: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 130, ['#4a8ae0', '#6aaaf0', '#9ccaf8', '#d0ecff']);
    clouds(p, 3, 20, 80, 6);
    ridge(p, 120, 30, 0.012, 11, '#7aa0c8', 140);
    ridge(p, 132, 22, 0.02, 12, '#4a9a5a', 150, '#6ab06a');
    ground(p, 140, P.g3, P.g4, 5, [P.g2, P.g5, '#f0e060', P.r4]);
    for (let i = 0; i < 6; i++) treeSilhouette(p, 20 + i * 58 + hash2(i, 0, 9) * 20, 142, 30 + hash2(i, 1, 9) * 14, '#3a8a46', '#5a3a24');
    return p;
  },
  forest: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 150, ['#1a3a28', '#2a5a38', '#5a9a5a', '#a0d090']);
    for (let i = 0; i < 14; i++) {
      const x = hash2(i, 0, 21) * W;
      const w = 6 + hash2(i, 1, 21) * 10;
      const c = i % 2 ? '#2a1e14' : '#3a2a1c';
      p.rect(x, 0, w, 160, c);
      p.vline(Math.floor(x), 0, 159, '#4a3a28');
    }
    ridge(p, 40, 30, 0.03, 22, '#1e4a2a', 0);
    for (let x = 0; x < W; x++) {
      const bottom = Math.round(30 + fbm(x * 0.03, 23) * 40);
      for (let y = 0; y < bottom; y++) p.set(x, y, y > bottom - 3 ? '#3a7a40' : '#1e4a2a');
    }
    ground(p, 150, '#3a6a34', '#4a7a3a', 7, ['#2a5a2a', '#6a5a30', '#5a8a40']);
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 70;
      for (let y = 0; y < 150; y++) if ((x + y) % 3 === 0) p.blend(x + y * 0.4, y, '#fff8c0', 0.12);
    }
    return p;
  },
  cave: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 150, ['#120e0c', '#2a221c', '#3e3228', '#4e4032']);
    for (let i = 0; i < 18; i++) {
      const x = hash2(i, 0, 31) * W;
      const len = 10 + hash2(i, 1, 31) * 40;
      const w = 4 + hash2(i, 2, 31) * 8;
      p.poly(
        [
          [x - w, 0],
          [x + w, 0],
          [x, len],
        ],
        i % 2 ? '#2e241e' : '#3a2e26',
      );
    }
    ground(p, 150, '#5a4a3a', '#4a3c30', 9, ['#3a2e24', '#6a5a48', '#2a2018']);
    for (let i = 0; i < 6; i++) {
      const x = hash2(i, 5, 31) * W;
      const h = 14 + hash2(i, 6, 31) * 26;
      p.poly(
        [
          [x - 8, 150 + h * 0.5],
          [x, 150 - h * 0.5],
          [x + 8, 150 + h * 0.5],
        ],
        '#5e4c3c',
      );
    }
    for (const [x, y] of [
      [40, 140],
      [270, 146],
      [180, 130],
    ]) {
      p.poly(
        [
          [x - 4, y + 8],
          [x, y - 8],
          [x + 4, y + 8],
        ],
        '#4ac8e8',
      );
      p.vline(x - 1, y - 5, y + 6, '#c8f4ff');
    }
    return p;
  },
  dungeon: () => {
    const p = new Pix(W, H);
    p.rect(0, 0, W, 150, '#3a3e4a');
    for (let y = 0; y < 150; y += 10) {
      p.hline(0, W - 1, y, '#262a34');
      for (let x = (y / 10) % 2 ? 0 : 12; x < W; x += 24) p.vline(x, y, y + 9, '#262a34');
    }
    gradient(p, 0, 0, W, 40, ['#0e1016', '#262a34']);
    for (const x of [60, 160, 260]) {
      p.rect(x - 3, 70, 6, 14, '#5a3a24');
      p.poly(
        [
          [x - 6, 70],
          [x, 54],
          [x + 6, 70],
        ],
        P.o2,
      );
      p.poly(
        [
          [x - 3, 70],
          [x, 60],
          [x + 3, 70],
        ],
        P.y3,
      );
      for (let r = 30; r > 0; r -= 6) {
        for (let a = 0; a < 360; a += 12) {
          const rad = (a * Math.PI) / 180;
          p.blend(x + Math.cos(rad) * r, 66 + Math.sin(rad) * r, '#ffa040', 0.05);
        }
      }
    }
    for (let y = 150; y < H; y++) {
      const t = (y - 150) / (H - 150);
      for (let x = 0; x < W; x++) {
        const px = (x - W / 2) / (0.4 + t);
        const tileX = Math.floor(px / 24);
        const tileY = Math.floor(Math.pow(t, 0.7) * 8);
        p.set(x, y, (tileX + tileY) % 2 === 0 ? '#5a5e6a' : '#4a4e5a');
      }
    }
    return p;
  },
  desert: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 140, ['#e8a050', '#f0c070', '#f8dca0', '#fff0c8']);
    p.circle(250, 50, 18, '#fff4d0');
    p.circle(250, 50, 14, '#ffffff');
    ridge(p, 128, 24, 0.01, 41, '#d8a860', 145, '#e8c080');
    ridge(p, 140, 14, 0.018, 42, '#e0b468', 150, '#f0cc88');
    ground(p, 148, '#e8c47c', '#d8b06a', 11, ['#c89850', '#f4dca0']);
    for (const [x, s] of [
      [40, 1],
      [270, 0.8],
      [120, 0.6],
    ]) {
      const h = 40 * s;
      p.rect(x - 3 * s, 150 - h, 6 * s, h, '#4a8a3a');
      p.rect(x - 12 * s, 150 - h * 0.7, 9 * s, 4 * s, '#4a8a3a');
      p.rect(x - 12 * s, 150 - h * 0.95, 4 * s, h * 0.3, '#4a8a3a');
      p.rect(x + 3 * s, 150 - h * 0.55, 8 * s, 4 * s, '#4a8a3a');
      p.rect(x + 7 * s, 150 - h * 0.8, 4 * s, h * 0.28, '#4a8a3a');
    }
    return p;
  },
  snowfield: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 140, ['#8aa8d8', '#a8c4e8', '#d0e0f4', '#eef4fc']);
    ridge(p, 110, 60, 0.012, 51, '#9ab0d0', 140, '#ffffff');
    for (let x = 0; x < W; x++) {
      const top = Math.round(110 - fbm(x * 0.012, 51) * 60);
      for (let y = top; y < top + 12; y++) p.set(x, y, '#f4f8ff');
    }
    ridge(p, 136, 16, 0.02, 52, '#e0e8f4', 150, '#ffffff');
    ground(p, 146, '#f0f4fa', '#d8e2f0', 13, ['#c8d4e8', '#ffffff']);
    for (let i = 0; i < 5; i++) pineSilhouette(p, 30 + i * 66, 150, 30 + hash2(i, 0, 53) * 14, '#3a5a5a');
    for (let i = 0; i < 160; i++) p.set(hash2(i, 1, 54) * W, hash2(i, 2, 54) * H, '#ffffff');
    return p;
  },
  castle: () => {
    const p = new Pix(W, H);
    p.rect(0, 0, W, 150, '#5a4a48');
    for (let y = 0; y < 150; y += 12) {
      p.hline(0, W - 1, y, '#4a3c3a');
      for (let x = (y / 12) % 2 ? 0 : 16; x < W; x += 32) p.vline(x, y, y + 11, '#4a3c3a');
    }
    for (const x of [50, 270]) {
      p.rect(x - 10, 10, 20, 140, '#8a7a70');
      p.vline(x - 10, 10, 149, '#a89a90');
      p.vline(x + 9, 10, 149, '#6a5a50');
      p.rect(x - 14, 6, 28, 8, '#9a8a80');
    }
    for (const x of [110, 210]) {
      p.rect(x - 12, 20, 24, 50, '#b02830');
      p.poly(
        [
          [x - 12, 70],
          [x, 62],
          [x + 12, 70],
          [x + 12, 76],
          [x, 68],
          [x - 12, 76],
        ],
        '#b02830',
      );
      p.circle(x, 40, 6, '#e8c040');
      p.hline(x - 14, x + 13, 18, '#c8a040');
    }
    for (let y = 150; y < H; y++) {
      const t = (y - 150) / (H - 150);
      for (let x = 0; x < W; x++) {
        const half = 30 + t * 70;
        const inCarpet = Math.abs(x - W / 2) < half;
        const edge = Math.abs(Math.abs(x - W / 2) - half) < 2 + t * 2;
        p.set(x, y, edge ? '#e0b040' : inCarpet ? '#a02028' : (Math.floor(x / 20) + Math.floor(t * 6)) % 2 ? '#7a6a62' : '#6a5a52');
      }
    }
    return p;
  },
  volcano: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 140, ['#2a0a0a', '#5a1a10', '#a03a18', '#e06a20']);
    clouds(p, 61, 10, 60, 5, '#3a2020');
    ridge(p, 130, 50, 0.01, 62, '#2a1a18', 150, '#4a2a20');
    ground(p, 146, '#3a2622', '#2a1a18', 15, ['#4a3028', '#1e1210']);
    for (let i = 0; i < 3; i++) {
      const y0 = 160 + i * 26;
      for (let x = 0; x < W; x++) {
        const y = y0 + Math.round(Math.sin(x * 0.03 + i) * 5);
        const th = 2 + i * 2;
        for (let k = 0; k < th; k++) p.set(x, y + k, k === 0 ? P.y3 : P.o2);
      }
    }
    return p;
  },
};

const TITLES: Record<string, () => Pix> = {
  castle: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 180, ['#1a1440', '#3a2a6a', '#8a4a8a', '#e08a6a', '#f8c070']);
    stars(p, 71, 80, 90);
    p.circle(60, 46, 14, '#fff4d8');
    p.circle(66, 42, 12, mix('#1a1440', '#3a2a6a', 0.5));
    ridge(p, 170, 40, 0.008, 72, '#4a3060', 200);
    ridge(p, 196, 20, 0.02, 73, '#2a1a3a', H);
    // castle on the hill
    const c = '#1e1428';
    const cx = 200;
    p.rect(cx - 40, 110, 80, 60, c);
    for (const [x, w, h] of [
      [cx - 46, 16, 80],
      [cx + 30, 16, 80],
      [cx - 8, 18, 104],
    ]) {
      p.rect(x, 170 - h, w, h, c);
      for (let k = 0; k < w; k += 4) p.rect(x + k, 170 - h - 4, 2, 4, c);
      p.poly(
        [
          [x - 2, 170 - h - 4],
          [x + w / 2, 170 - h - 22],
          [x + w + 2, 170 - h - 4],
        ],
        c,
      );
    }
    for (let k = 0; k < 80; k += 6) p.rect(cx - 40 + k, 106, 3, 4, c);
    for (const [x, y] of [
      [cx - 40, 110],
      [cx - 25, 130],
      [cx + 5, 90],
      [cx + 34, 120],
      [cx + 14, 140],
      [cx - 2, 120],
    ]) p.rect(x, y, 3, 4, '#f8d070');
    p.poly(
      [
        [cx - 6, 170],
        [cx - 6, 152],
        [cx, 146],
        [cx + 6, 152],
        [cx + 6, 170],
      ],
      '#0a0610',
    );
    for (let i = 0; i < 9; i++) pineSilhouette(p, 10 + i * 38 + hash2(i, 0, 74) * 10, 240, 40 + hash2(i, 1, 74) * 30, '#140c1c');
    return p;
  },
  field: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 160, ['#3a7ad8', '#5a9ae8', '#8abcf4', '#c8e4ff']);
    clouds(p, 81, 20, 90, 7);
    ridge(p, 130, 50, 0.009, 82, '#8aa4cc', 160, '#b8cce8');
    ridge(p, 150, 26, 0.016, 83, '#5aa860', 180, '#7ac070');
    ridge(p, 176, 22, 0.02, 84, '#4a9a50', H, '#6ab864');
    for (let y = 176; y < H; y++) {
      const t = (y - 176) / (H - 176);
      const half = 4 + t * 40;
      const center = W / 2 + Math.sin(t * 3) * 20;
      for (let x = Math.floor(center - half); x <= center + half; x++) p.set(x, y, t * 10 % 2 < 1 ? '#c8a46a' : '#d4b27a');
    }
    for (const [x, y] of [
      [70, 156],
      [90, 158],
      [240, 160],
    ]) {
      p.rect(x, y, 12, 8, '#f0e0c0');
      p.poly(
        [
          [x - 2, y],
          [x + 6, y - 6],
          [x + 14, y],
        ],
        '#c03a2a',
      );
      p.rect(x + 5, y + 4, 2, 4, '#5a3a24');
    }
    for (let i = 0; i < 7; i++) treeSilhouette(p, 10 + i * 50, 200 + (i % 2) * 20, 36, '#3a8a46', '#5a3a24');
    return p;
  },
  night: () => {
    const p = new Pix(W, H);
    gradient(p, 0, 0, W, 170, ['#05061a', '#0e1440', '#1e2a6a', '#3a4a8a']);
    stars(p, 91, 150, 220);
    p.circle(230, 60, 22, '#f8f4e0');
    p.circle(224, 54, 5, '#e8e0c8');
    p.circle(240, 68, 3, '#e8e0c8');
    ridge(p, 150, 60, 0.01, 92, '#141a3a', 175);
    ridge(p, 168, 24, 0.02, 93, '#0c1028', 180);
    gradient(p, 0, 180, W, 60, ['#1a2450', '#0a0e24']);
    for (let y = 182; y < H; y += 3) {
      const t = (y - 180) / 60;
      const w = 20 - t * 10;
      for (let x = 230 - w; x < 230 + w; x++) if (hash2(x, y, 94) > 0.4) p.set(x, y, '#c8c4b0');
    }
    for (let i = 0; i < 6; i++) pineSilhouette(p, i * 64 + 20, 182, 30 + hash2(i, 0, 95) * 20, '#060814');
    return p;
  },
};

export function generateBattleback(key: string): HTMLCanvasElement | null {
  const fn = BATTLEBACKS[key];
  return fn ? fn().toCanvas(2) : null;
}

export function generateTitle(key: string): HTMLCanvasElement | null {
  const fn = TITLES[key];
  return fn ? fn().toCanvas(2) : null;
}

export const BATTLEBACK_KEYS = Object.keys(BATTLEBACKS);
export const TITLE_KEYS = Object.keys(TITLES);
