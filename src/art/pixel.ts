/**
 * A tiny software pixel canvas used to author the built-in pixel art.
 * Drawing happens at "art resolution" (e.g. 16x16 per tile) and is scaled up
 * with nearest-neighbour sampling when converted to a real canvas.
 */

import { packHex, unpack, pack } from './color';

export type Color = string | number;

function toPacked(c: Color): number {
  return typeof c === 'number' ? c : packHex(c);
}

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  /**
   * Build a Pix from rows of characters; each character is looked up in the
   * palette ('.' and ' ' are transparent; unknown characters throw).
   */
  static parse(rows: string[], palette: Record<string, string>, width?: number): Pix {
    const w = width ?? Math.max(...rows.map((r) => r.length));
    const p = new Pix(w, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (col === undefined) throw new Error(`Pix.parse: no colour for '${ch}'`);
        if (col) p.set(x, y, col);
      }
    });
    return p;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: Color): void {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = toPacked(c);
  }

  /** Alpha-blend a colour over the existing pixel. */
  blend(x: number, y: number, c: Color, alpha = 1): void {
    x |= 0;
    y |= 0;
    if (!this.inBounds(x, y)) return;
    const src = unpack(toPacked(c));
    const a = (src.a / 255) * alpha;
    if (a <= 0) return;
    const i = y * this.w + x;
    const dst = unpack(this.data[i]);
    const da = dst.a / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    this.data[i] = pack({
      r: Math.round((src.r * a + dst.r * da * (1 - a)) / oa),
      g: Math.round((src.g * a + dst.g * da * (1 - a)) / oa),
      b: Math.round((src.b * a + dst.b * da * (1 - a)) / oa),
      a: Math.round(oa * 255),
    });
  }

  get(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[y * this.w + x];
  }

  alphaAt(x: number, y: number): number {
    return this.get(x, y) >>> 24;
  }

  opaque(x: number, y: number): boolean {
    return this.alphaAt(x, y) > 0;
  }

  clear(x: number, y: number): void {
    if (this.inBounds(x, y)) this.data[y * this.w + x] = 0;
  }

  fill(c: Color): this {
    this.data.fill(toPacked(c));
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    const v = toPacked(c);
    const x0 = Math.round(x);
    const y0 = Math.round(y);
    const x1 = Math.round(x + w);
    const y1 = Math.round(y + h);
    for (let yy = Math.max(0, y0); yy < Math.min(this.h, y1); yy++) {
      for (let xx = Math.max(0, x0); xx < Math.min(this.w, x1); xx++) {
        this.data[yy * this.w + xx] = v;
      }
    }
    return this;
  }

  strokeRect(x: number, y: number, w: number, h: number, c: Color): this {
    this.hline(x, x + w - 1, y, c);
    this.hline(x, x + w - 1, y + h - 1, c);
    this.vline(x, y, y + h - 1, c);
    this.vline(x + w - 1, y, y + h - 1, c);
    return this;
  }

  hline(x0: number, x1: number, y: number, c: Color): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
    return this;
  }

  vline(x: number, y0: number, y1: number, c: Color): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** Filled ellipse centred at (cx, cy) with radii rx, ry (pixel centres). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color): this {
    const v = toPacked(c);
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / (rx + 0.01);
        const ny = (y + 0.5 - cy) / (ry + 0.01);
        if (nx * nx + ny * ny <= 1 && this.inBounds(x, y)) this.data[y * this.w + x] = v;
      }
    }
    return this;
  }

  circle(cx: number, cy: number, r: number, c: Color): this {
    return this.ellipse(cx, cy, r, r, c);
  }

  /** Filled polygon (even-odd rule) with vertices in pixel coordinates. */
  poly(points: [number, number][], c: Color): this {
    const v = toPacked(c);
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of points) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) {
          xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) {
          if (this.inBounds(x, y)) this.data[y * this.w + x] = v;
        }
      }
    }
    return this;
  }

  /** Thick line made of discs. */
  thickLine(x0: number, y0: number, x1: number, y1: number, r: number, c: Color): this {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
    }
    return this;
  }

  /** Copy another Pix onto this one (transparent pixels are skipped). */
  blit(src: Pix, dx: number, dy: number, flipH = false): this {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const v = src.data[y * src.w + (flipH ? src.w - 1 - x : x)];
        if (v >>> 24 === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (this.inBounds(tx, ty)) this.data[ty * this.w + tx] = v;
      }
    }
    return this;
  }

  /** Copy a region of this Pix into a new Pix. */
  crop(x: number, y: number, w: number, h: number): Pix {
    const out = new Pix(w, h);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) out.data[yy * w + xx] = this.get(x + xx, y + yy);
    }
    return out;
  }

  clone(): Pix {
    const out = new Pix(this.w, this.h);
    out.data.set(this.data);
    return out;
  }

  flipped(): Pix {
    const out = new Pix(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) out.data[y * this.w + x] = this.data[y * this.w + (this.w - 1 - x)];
    }
    return out;
  }

  /**
   * Draw an outline in every transparent pixel that touches an opaque pixel
   * (4-neighbourhood, or 8 with `diagonal`). Restricted to a region if given.
   */
  outline(c: Color, diagonal = false, region?: { x: number; y: number; w: number; h: number }): this {
    const v = toPacked(c);
    const rx = region?.x ?? 0;
    const ry = region?.y ?? 0;
    const rw = region?.w ?? this.w;
    const rh = region?.h ?? this.h;
    const src = this.data.slice();
    const op = (x: number, y: number) =>
      x >= rx && y >= ry && x < rx + rw && y < ry + rh && x < this.w && y < this.h && x >= 0 && y >= 0 && src[y * this.w + x] >>> 24 > 0;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (op(x, y)) continue;
        if (
          op(x - 1, y) ||
          op(x + 1, y) ||
          op(x, y - 1) ||
          op(x, y + 1) ||
          (diagonal && (op(x - 1, y - 1) || op(x + 1, y - 1) || op(x - 1, y + 1) || op(x + 1, y + 1)))
        ) {
          this.set(x, y, v);
        }
      }
    }
    return this;
  }

  /**
   * Simple lighting: pixels on the upper-left silhouette edge get lighter,
   * pixels on the lower-right edge get darker.
   */
  autoShade(light = 0.25, dark = 0.3, region?: { x: number; y: number; w: number; h: number }): this {
    const rx = region?.x ?? 0;
    const ry = region?.y ?? 0;
    const rw = region?.w ?? this.w;
    const rh = region?.h ?? this.h;
    const src = this.data.slice();
    const op = (x: number, y: number) =>
      x >= rx && y >= ry && x < rx + rw && y < ry + rh && x >= 0 && y >= 0 && x < this.w && y < this.h && src[y * this.w + x] >>> 24 > 0;
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (!op(x, y)) continue;
        const i = y * this.w + x;
        const c = unpack(src[i]);
        if (!op(x + 1, y) || !op(x, y + 1)) {
          const k = 1 - dark;
          this.data[i] = pack({ r: c.r * k, g: c.g * k, b: c.b * k, a: c.a });
        } else if (!op(x - 1, y) || !op(x, y - 1)) {
          this.data[i] = pack({ r: c.r + (255 - c.r) * light, g: c.g + (255 - c.g) * light, b: c.b + (255 - c.b) * light, a: c.a });
        }
      }
    }
    return this;
  }

  /** Replace every pixel of one colour with another. */
  recolor(from: Color, to: Color): this {
    const f = toPacked(from);
    const t = toPacked(to);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === f) this.data[i] = t;
    return this;
  }

  toImageData(): ImageData {
    const img = new ImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.data);
    return img;
  }

  /** Render to a new canvas, scaled up by an integer factor. */
  toCanvas(scale = 1): HTMLCanvasElement {
    const base = document.createElement('canvas');
    base.width = this.w;
    base.height = this.h;
    base.getContext('2d')!.putImageData(this.toImageData(), 0, 0);
    if (scale === 1) return base;
    const out = document.createElement('canvas');
    out.width = this.w * scale;
    out.height = this.h * scale;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, out.width, out.height);
    return out;
  }
}

/** Deterministic hash noise in [0, 1) for integer coordinates. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Tileable value noise with the given period (in pixels) and cell size. */
export function tileNoise(x: number, y: number, period: number, cell: number, seed = 0): number {
  const cells = Math.max(1, Math.round(period / cell));
  const fx = x / cell;
  const fy = y / cell;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const m = (v: number) => ((v % cells) + cells) % cells;
  const v00 = hash2(m(x0), m(y0), seed);
  const v10 = hash2(m(x0 + 1), m(y0), seed);
  const v01 = hash2(m(x0), m(y0 + 1), seed);
  const v11 = hash2(m(x0 + 1), m(y0 + 1), seed);
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  return (v00 * (1 - sx) + v10 * sx) * (1 - sy) + (v01 * (1 - sx) + v11 * sx) * sy;
}
