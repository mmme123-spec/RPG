/**
 * Tile ids and tile flags.
 *
 * A map cell stores one tile id per layer:
 *   0                       empty
 *   1 .. 8191               normal tile: 1 + sheet * SHEET_STRIDE + index-in-sheet
 *   AUTOTILE_BASE + n       autotile number n of the tileset
 *
 * The shape of an autotile (which edge pieces are drawn) is not stored; it is
 * derived from the neighbouring cells whenever the map is drawn.
 */

export const TILE_SIZE = 32;
export const LAYER_COUNT = 4;
export const SHEET_STRIDE = 1024;
export const MAX_SHEETS = 8;
export const AUTOTILE_BASE = 8192;

/** Flag bits (compatible in spirit with RPG Maker MV's tileset flags). */
export const TF = {
  BLOCK_DOWN: 0x1,
  BLOCK_LEFT: 0x2,
  BLOCK_RIGHT: 0x4,
  BLOCK_UP: 0x8,
  BLOCK_ALL: 0xf,
  /** Drawn above characters; ignored for passability. */
  STAR: 0x10,
  LADDER: 0x20,
  /** Lower half of characters is drawn translucent (tall grass, shallow water). */
  BUSH: 0x40,
  /** Talk to events across this tile (shop counters). */
  COUNTER: 0x80,
  /** Hurts the party when walked on. */
  DAMAGE: 0x100,
} as const;

export const LAYER_NAMES = ['Ground', 'Detail', 'Objects', 'Overhead'] as const;

export function isAutotile(tileId: number): boolean {
  return tileId >= AUTOTILE_BASE;
}

export function autotileIndex(tileId: number): number {
  return tileId - AUTOTILE_BASE;
}

export function autotileId(index: number): number {
  return AUTOTILE_BASE + index;
}

export function normalTileId(sheet: number, index: number): number {
  return 1 + sheet * SHEET_STRIDE + index;
}

export function tileSheetOf(tileId: number): number {
  return Math.floor((tileId - 1) / SHEET_STRIDE);
}

export function tileIndexInSheet(tileId: number): number {
  return (tileId - 1) % SHEET_STRIDE;
}

/** The bit that blocks movement in a direction (2/4/6/8). */
export function dirBit(d: number): number {
  return 1 << (d / 2 - 1);
}

export function terrainTagOf(flags: number): number {
  return (flags >> 12) & 0xf;
}

export function withTerrainTag(flags: number, tag: number): number {
  return (flags & ~0xf000) | ((tag & 0xf) << 12);
}

/** Pass mode as displayed in the tileset editor. */
export type PassMode = 'pass' | 'block' | 'star';

export function passModeOf(flags: number): PassMode {
  if (flags & TF.STAR) return 'star';
  if ((flags & TF.BLOCK_ALL) === TF.BLOCK_ALL) return 'block';
  return 'pass';
}

export function withPassMode(flags: number, mode: PassMode): number {
  let f = flags & ~(TF.STAR | TF.BLOCK_ALL);
  if (mode === 'star') f |= TF.STAR;
  if (mode === 'block') f |= TF.BLOCK_ALL;
  return f;
}
