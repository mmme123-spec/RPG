/** Renders the current map with its characters. */

import type { Tileset } from '../../core/types';
import { TILE_SIZE, LAYER_COUNT } from '../../core/tiles';
import type { ImageLibrary } from '../../render/images';
import { TileRenderer } from '../../render/tilemap';
import { characterScale } from '../ui/draw';
import type { Character } from '../map/character';
import type { MapRuntime } from '../map/gamemap';
import { drawBalloon } from './effects';

const T = TILE_SIZE;

export class MapView {
  private images: ImageLibrary;
  private tr: TileRenderer | null = null;
  private tileset: Tileset | null = null;

  constructor(images: ImageLibrary) {
    this.images = images;
  }

  private renderer(ts: Tileset): TileRenderer {
    if (!this.tr || this.tileset !== ts) {
      this.tr = new TileRenderer(this.images, ts);
      this.tileset = ts;
    }
    return this.tr;
  }

  /** Camera offset in pixels (rounded to avoid seams). */
  camera(map: MapRuntime): { x: number; y: number } {
    return { x: Math.round(map.displayX * T), y: Math.round(map.displayY * T) };
  }

  render(ctx: CanvasRenderingContext2D, map: MapRuntime, width: number, height: number, shakeX = 0, drawOverlay?: (cam: { x: number; y: number }) => void): void {
    const tr = this.renderer(map.tileset);
    const cam = this.camera(map);
    ctx.fillStyle = map.map.bgColor || '#000';
    ctx.fillRect(0, 0, width, height);
    const ox = -cam.x + Math.round(shakeX);
    const oy = -cam.y;
    const x0 = Math.floor(cam.x / T) - 1;
    const y0 = Math.floor(cam.y / T) - 1;
    const x1 = x0 + Math.ceil(width / T) + 2;
    const y1 = y0 + Math.ceil(height / T) + 3;
    for (let l = 0; l < LAYER_COUNT - 1; l++) tr.drawLayer(ctx, map.map, l, x0, y0, x1, y1, ox, oy, map.tick, 'below');

    const chars: Character[] = [];
    for (const e of map.events) if (!e.erased && e.graphic.kind !== 'none') chars.push(e);
    const p = map.player;
    for (let i = p.followers.length - 1; i >= 0; i--) if (p.followers[i].isVisible()) chars.push(p.followers[i]);
    if (!p.transparent) chars.push(p);
    const group = (c: Character) => (c.priority === 'below' ? 0 : c.priority === 'above' ? 2 : 1);
    chars.sort((a, b) => group(a) - group(b) || a.realY - b.realY || (a === p ? 1 : b === p ? -1 : 0));

    for (const c of chars) if (group(c) < 2) this.drawCharacter(ctx, c, tr, ox, oy);
    for (let l = 0; l < LAYER_COUNT; l++) tr.drawLayer(ctx, map.map, l, x0, y0, x1, y1, ox, oy, map.tick, 'above');
    for (const c of chars) if (group(c) === 2) this.drawCharacter(ctx, c, tr, ox, oy);
    drawOverlay?.({ x: cam.x - Math.round(shakeX), y: cam.y });
    for (const c of chars) {
      if (c.balloon) {
        const { x, y } = this.screenPos(c, ox, oy);
        drawBalloon(ctx, c.balloon.type, x, y - this.spriteHeight(c), c.balloon.frame);
      }
    }
  }

  screenPos(c: Character, ox: number, oy: number): { x: number; y: number } {
    return { x: Math.round(c.realX * T + T / 2 + ox), y: Math.round(c.realY * T + T + oy - c.jumpHeight()) };
  }

  spriteHeight(c: Character): number {
    if (c.graphic.kind === 'character') {
      const f = this.images.character({ sheet: c.graphic.sheet, index: c.graphic.index });
      if (f) return f.fh * characterScale(f.fw);
    }
    return T;
  }

  private drawCharacter(ctx: CanvasRenderingContext2D, c: Character, tr: TileRenderer, ox: number, oy: number): void {
    if (c.transparent || c.opacity <= 0) return;
    const { x, y } = this.screenPos(c, ox, oy);
    ctx.save();
    if (c.isJumping()) {
      const gy = y + c.jumpHeight();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, gy - 3, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = c.opacity / 255;
    const g = c.graphic;
    if (g.kind === 'tile') {
      tr.draw(ctx, g.tileId, x - T / 2, y - T, T);
    } else if (g.kind === 'character') {
      const f = this.images.character({ sheet: g.sheet, index: g.index });
      if (f) {
        const s = characterScale(f.fw);
        const dw = f.fw * s;
        const dh = f.fh * s;
        const row = Math.max(0, Math.min(3, c.direction / 2 - 1));
        const sx = f.sx + c.frameIndex() * f.fw;
        const sy = f.sy + row * f.fh;
        const bush = Math.min(dh, c.bushDepth);
        if (bush > 0) {
          const upper = dh - bush;
          const srcUpper = upper / s;
          ctx.drawImage(f.image, sx, sy, f.fw, srcUpper, x - dw / 2, y - dh, dw, upper);
          ctx.globalAlpha *= 0.5;
          ctx.drawImage(f.image, sx, sy + srcUpper, f.fw, f.fh - srcUpper, x - dw / 2, y - bush, dw, bush);
        } else {
          ctx.drawImage(f.image, sx, sy, f.fw, f.fh, x - dw / 2, y - dh, dw, dh);
        }
      }
    }
    ctx.restore();
  }
}
