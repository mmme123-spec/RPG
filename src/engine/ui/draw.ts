/** Drawing helpers shared by windows and scenes. */

import type { CharacterRef, FaceRef } from '../../core/types';
import { ICON_COLUMNS, ICON_SIZE } from '../../core/builtins';
import type { ImageLibrary } from '../../render/images';
import { TEXT_COLORS, drawText, expandEscapes, layoutTokens, tokenize, font, type TextContext } from './text';

function shadeColor(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** RPG-style window background and border. `openness` 0..1 scales vertically. */
export function drawWindowFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, opacity: number, openness = 1): void {
  if (openness <= 0 || w <= 0 || h <= 0) return;
  const hh = h * openness;
  const yy = y + (h - hh) / 2;
  ctx.save();
  ctx.globalAlpha *= opacity / 255;
  const g = ctx.createLinearGradient(0, yy, 0, yy + hh);
  g.addColorStop(0, shadeColor(color, 0.12));
  g.addColorStop(1, shadeColor(color, -0.35));
  roundRectPath(ctx, x + 1, yy + 1, w - 2, hh - 2, 6);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRectPath(ctx, x + 2.5, yy + 2.5, w - 5, hh - 5, 5);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(235,240,255,0.92)';
  ctx.stroke();
  roundRectPath(ctx, x + 0.5, yy + 0.5, w - 1, hh - 1, 7);
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(10,10,20,0.85)';
  ctx.stroke();
  ctx.restore();
}

export function drawIcon(ctx: CanvasRenderingContext2D, images: ImageLibrary, index: number, x: number, y: number, size = ICON_SIZE, alpha = 1): void {
  if (index <= 0) return;
  const img = images.get('icons', 'builtin:icons');
  if (!img) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  const sx = (index % ICON_COLUMNS) * ICON_SIZE;
  const sy = Math.floor(index / ICON_COLUMNS) * ICON_SIZE;
  ctx.drawImage(img, sx, sy, ICON_SIZE, ICON_SIZE, x, y, size, size);
  ctx.restore();
}

export function drawFace(ctx: CanvasRenderingContext2D, images: ImageLibrary, face: FaceRef | null, x: number, y: number, w = 96, h = 96, alpha = 1): void {
  if (!face) return;
  const f = images.face(face);
  if (!f) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  const scale = Math.min(w / f.fw, h / f.fh);
  const dw = f.fw * scale;
  const dh = f.fh * scale;
  ctx.drawImage(f.image, f.sx, f.sy, f.fw, f.fh, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** Character frames wider than a tile (e.g. 48px sheets) are scaled down to tile width. */
export function characterScale(frameWidth: number): number {
  return frameWidth > 32 ? 32 / frameWidth : 1;
}

/** Draw a character's standing frame with its feet at (cx, bottom). */
export function drawCharacterFrame(
  ctx: CanvasRenderingContext2D,
  images: ImageLibrary,
  ref: CharacterRef,
  cx: number,
  bottom: number,
  direction = 2,
  frame = 1,
  alpha = 1,
): void {
  const f = images.character(ref);
  if (!f) return;
  const row = direction / 2 - 1;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.imageSmoothingEnabled = false;
  const scale = characterScale(f.fw);
  const dw = f.fw * scale;
  const dh = f.fh * scale;
  ctx.drawImage(f.image, f.sx + frame * f.fw, f.sy + row * f.fh, f.fw, f.fh, cx - dw / 2, bottom - dh, dw, dh);
  ctx.restore();
}

export function drawGauge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rate: number, c1: string, c2: string, h = 6): void {
  ctx.save();
  ctx.fillStyle = 'rgba(10,10,30,0.8)';
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const fw = Math.max(0, Math.min(1, rate)) * (w - 2);
  if (fw > 0) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    roundRectPath(ctx, x + 1, y + 1, fw, h - 2, (h - 2) / 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw text with control codes (colours, icons) instantly, wrapped to maxWidth.
 * Returns the number of lines drawn.
 */
export function drawRichText(
  ctx: CanvasRenderingContext2D,
  images: ImageLibrary,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  opts: { size?: number; lineHeight?: number; textContext?: TextContext | null; color?: string; maxLines?: number } = {},
): number {
  const size = opts.size ?? 20;
  const lh = opts.lineHeight ?? 28;
  const lines = layoutTokens(ctx, tokenize(expandEscapes(text, opts.textContext ?? null)), maxWidth, size, lh);
  let color = opts.color ?? TEXT_COLORS[0];
  let cy = y;
  let count = 0;
  for (const line of lines) {
    if (opts.maxLines && count >= opts.maxLines) break;
    for (const lt of line.tokens) {
      const t = lt.token;
      if (t.t === 'color') color = TEXT_COLORS[t.c] ?? TEXT_COLORS[0];
      else if (t.t === 'icon') drawIcon(ctx, images, t.i, x + lt.x, cy + lh / 2 - 12, 24);
      else if (t.t === 'ch') drawText(ctx, t.ch, x + lt.x, cy + lh / 2, { size: lt.size, color });
    }
    cy += lh;
    count++;
  }
  return count;
}

export function textWidth(ctx: CanvasRenderingContext2D, text: string, size = 20): number {
  ctx.save();
  ctx.font = font(size);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
