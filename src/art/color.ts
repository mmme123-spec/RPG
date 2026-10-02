/** Colour helpers. Colours are CSS hex strings (#rgb, #rrggbb or #rrggbbaa). */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const cache = new Map<string, number>();

/** Parse a hex colour into a packed 32-bit value in ImageData byte order (little endian ABGR). */
export function packHex(hex: string): number {
  let v = cache.get(hex);
  if (v !== undefined) return v;
  const c = parseHex(hex);
  v = ((c.a << 24) | (c.b << 16) | (c.g << 8) | c.r) >>> 0;
  cache.set(hex, v);
  return v;
}

export function parseHex(hex: string): RGBA {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3 || h.length === 4) h = h.split('').map((ch) => ch + ch).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

export function unpack(v: number): RGBA {
  return { r: v & 255, g: (v >>> 8) & 255, b: (v >>> 16) & 255, a: (v >>> 24) & 255 };
}

export function pack(c: RGBA): number {
  return ((c.a << 24) | (c.b << 16) | (c.g << 8) | c.r) >>> 0;
}

const h2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

export function toHex(c: RGBA): string {
  return `#${h2(c.r)}${h2(c.g)}${h2(c.b)}${c.a < 255 ? h2(c.a) : ''}`;
}

/** Lighten (amount > 0) or darken (amount < 0) a colour; amount in -1..1. */
export function shade(hex: string, amount: number): string {
  const c = parseHex(hex);
  if (amount >= 0) {
    return toHex({ r: c.r + (255 - c.r) * amount, g: c.g + (255 - c.g) * amount, b: c.b + (255 - c.b) * amount, a: c.a });
  }
  const k = 1 + amount;
  return toHex({ r: c.r * k, g: c.g * k, b: c.b * k, a: c.a });
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
    a: ca.a + (cb.a - ca.a) * t,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const c = parseHex(hex);
  return toHex({ ...c, a: Math.round(alpha * 255) });
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hueShift(hex: string, degrees: number): string {
  const c = parseHex(hex);
  const [h, s, l] = rgbToHsl(c.r, c.g, c.b);
  const [r, g, b] = hslToRgb(h + degrees, s, l);
  return toHex({ r, g, b, a: c.a });
}

/** Rotate the hue of every pixel of an image (returns a new canvas). */
export function hueRotateCanvas(src: CanvasImageSource & { width: number; height: number }, degrees: number): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  if (!degrees) return out;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [hh, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (s < 0.05) continue;
    const [r, g, b] = hslToRgb(hh + degrees, s, l);
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Shared palette used by the built-in art so everything looks cohesive. */
export const P = {
  outline: '#1c1626',
  black: '#0e0b14',
  white: '#ffffff',
  // greens
  g0: '#1d4a2a',
  g1: '#2b6a33',
  g2: '#3f8a3c',
  g3: '#58a845',
  g4: '#79c45a',
  g5: '#a3df7c',
  // browns
  b0: '#2e1d12',
  b1: '#4e321c',
  b2: '#6e4828',
  b3: '#916236',
  b4: '#b4824a',
  b5: '#d6a86e',
  // sand
  s1: '#b8955a',
  s2: '#d4b67a',
  s3: '#e6cf98',
  s4: '#f3e6bf',
  // stone
  k0: '#24262e',
  k1: '#3c404b',
  k2: '#5a5f6c',
  k3: '#7c8290',
  k4: '#a0a7b4',
  k5: '#c8ced8',
  k6: '#e6eaf0',
  // water
  w0: '#14306a',
  w1: '#1f4e9a',
  w2: '#2f72c6',
  w3: '#4d96e0',
  w4: '#82bff2',
  w5: '#c6e8ff',
  // reds
  r0: '#4a1218',
  r1: '#7e1e28',
  r2: '#b42e36',
  r3: '#e0504c',
  r4: '#ff8a78',
  // golds
  y0: '#6a4a10',
  y1: '#a87a18',
  y2: '#dcae2e',
  y3: '#ffd860',
  y4: '#fff0a8',
  // purples
  p0: '#2c1a40',
  p1: '#4a2a72',
  p2: '#7046a8',
  p3: '#9c74d4',
  p4: '#c8a8f0',
  // blues
  u0: '#1a2450',
  u1: '#2a3c80',
  u2: '#3e5cb4',
  u3: '#6082dc',
  u4: '#9ab4f4',
  // oranges
  o1: '#a0400e',
  o2: '#e0641c',
  o3: '#ff9a2e',
  o4: '#ffc860',
};
