/**
 * Draws tiles and autotiles of a tileset. Autotile shapes are composed from
 * quarter pieces on demand and cached per (autotile, animation frame).
 */

import type { GameMap, Tileset } from '../core/types';
import { TILE_SIZE, TF, autotileIndex, isAutotile, tileIndexInSheet, tileSheetOf, LAYER_COUNT } from '../core/tiles';
import { autotileQuarters, neighborMask, normalizeMask } from '../core/autotile';
import type { ImageLibrary } from './images';

const SLOT_COLS = 8;
const MAX_SLOTS = 64;

interface ShapeAtlas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  slots: Map<number, number>;
}

/** Map an animation tick (frames at 60fps) to a frame index: 0,1,2,1 for 3 frames. */
export function animFrameIndex(frames: number, tick: number): number {
  if (frames <= 1) return 0;
  const step = Math.floor(tick / 20);
  if (frames === 3) return [0, 1, 2, 1][step % 4];
  return step % frames;
}

export type LayerPass = 'all' | 'below' | 'above';

export class TileRenderer {
  readonly tileset: Tileset;
  private images: ImageLibrary;
  private atlases = new Map<string, ShapeAtlas>();

  constructor(images: ImageLibrary, tileset: Tileset) {
    this.images = images;
    this.tileset = tileset;
  }

  flags(tileId: number): number {
    return this.tileset.flags[tileId] ?? 0;
  }

  /** Draw a single tile. For autotiles `mask` selects the shape (0xff = surrounded). */
  draw(ctx: CanvasRenderingContext2D, tileId: number, dx: number, dy: number, size = TILE_SIZE, mask = 0xff, tick = 0): void {
    if (tileId <= 0) return;
    if (isAutotile(tileId)) this.drawAuto(ctx, autotileIndex(tileId), mask, tick, dx, dy, size);
    else this.drawNormal(ctx, tileId, dx, dy, size);
  }

  private drawNormal(ctx: CanvasRenderingContext2D, tileId: number, dx: number, dy: number, size: number): void {
    const sheet = this.tileset.sheets[tileSheetOf(tileId)];
    if (!sheet) return;
    const img = this.images.get('tiles', sheet.image);
    if (!img) return;
    const ts = sheet.tileSize;
    const cols = Math.max(1, Math.floor(img.width / ts));
    const idx = tileIndexInSheet(tileId);
    const sx = (idx % cols) * ts;
    const sy = Math.floor(idx / cols) * ts;
    if (sy + ts > img.height) return;
    ctx.drawImage(img, sx, sy, ts, ts, dx, dy, size, size);
  }

  private drawAuto(ctx: CanvasRenderingContext2D, index: number, mask: number, tick: number, dx: number, dy: number, size: number): void {
    const def = this.tileset.autotiles[index];
    if (!def) return;
    const frame = animFrameIndex(def.frames, tick);
    const shape = normalizeMask(def.type, mask);
    const key = `${index}:${frame}`;
    let atlas = this.atlases.get(key);
    if (!atlas) {
      const canvas = document.createElement('canvas');
      canvas.width = SLOT_COLS * TILE_SIZE;
      canvas.height = Math.ceil(MAX_SLOTS / SLOT_COLS) * TILE_SIZE;
      const actx = canvas.getContext('2d')!;
      actx.imageSmoothingEnabled = false;
      atlas = { canvas, ctx: actx, slots: new Map() };
      this.atlases.set(key, atlas);
    }
    let slot = atlas.slots.get(shape);
    if (slot === undefined) {
      const img = this.images.get('tiles', def.image);
      if (!img) return;
      slot = atlas.slots.size;
      const ts = def.tileSize;
      const q = ts / 2;
      const bx = (def.x + frame * 2) * ts;
      const by = def.y * ts;
      const ox = (slot % SLOT_COLS) * TILE_SIZE;
      const oy = Math.floor(slot / SLOT_COLS) * TILE_SIZE;
      const half = TILE_SIZE / 2;
      autotileQuarters(def.type, shape).forEach(([qx, qy], i) => {
        atlas!.ctx.drawImage(img, bx + qx * q, by + qy * q, q, q, ox + (i % 2) * half, oy + Math.floor(i / 2) * half, half, half);
      });
      atlas.slots.set(shape, slot);
    }
    ctx.drawImage(
      atlas.canvas,
      (slot % SLOT_COLS) * TILE_SIZE,
      Math.floor(slot / SLOT_COLS) * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      dx,
      dy,
      size,
      size,
    );
  }

  /** Neighbour mask of an autotile cell on a map layer. */
  maskAt(map: GameMap, layer: number, x: number, y: number): number {
    const data = map.layers[layer];
    const id = data[y * map.width + x];
    return neighborMask(x, y, map.width, map.height, (nx, ny) => data[ny * map.width + nx] === id);
  }

  /**
   * Draw a rectangle of map cells of one layer.
   * `pass` 'below' skips star tiles and the overhead layer; 'above' draws only those.
   */
  drawLayer(
    ctx: CanvasRenderingContext2D,
    map: GameMap,
    layer: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    offsetX: number,
    offsetY: number,
    tick: number,
    pass: LayerPass = 'all',
    size = TILE_SIZE,
  ): void {
    const data = map.layers[layer];
    if (!data) return;
    const overhead = layer === LAYER_COUNT - 1;
    if (pass === 'below' && overhead) return;
    const xa = Math.max(0, x0);
    const ya = Math.max(0, y0);
    const xb = Math.min(map.width - 1, x1);
    const yb = Math.min(map.height - 1, y1);
    for (let y = ya; y <= yb; y++) {
      for (let x = xa; x <= xb; x++) {
        const id = data[y * map.width + x];
        if (!id) continue;
        if (pass !== 'all') {
          const above = overhead || (this.flags(id) & TF.STAR) !== 0;
          if ((pass === 'above') !== above) continue;
        }
        const dx = offsetX + x * size;
        const dy = offsetY + y * size;
        if (isAutotile(id)) this.draw(ctx, id, dx, dy, size, this.maskAt(map, layer, x, y), tick);
        else this.drawNormal(ctx, id, dx, dy, size);
      }
    }
  }
}
