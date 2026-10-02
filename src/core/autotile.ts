/**
 * Autotile shape logic using the classic quarter-tile technique.
 *
 * Each destination tile is assembled from four 'quarter' pieces (half a tile
 * wide and tall). Which piece is used for a quarter depends on whether the
 * horizontally adjacent, vertically adjacent and diagonal neighbours on that
 * corner contain the same autotile.
 *
 * Floor autotiles use a 2x3 tile block (RPG Maker A2 layout, measured in
 * quarter units this is 4 x 6):
 *   tile (0,0)   isolated preview tile
 *   tile (1,0)   inner corners
 *   tiles (0,1)-(1,2)  2x2 area with outer border, edges and centre
 * Wall autotiles use a 2x2 tile block (A3 layout) and ignore diagonals.
 */

import type { AutotileType } from './types';

/** Source quarter coordinates in quarter units relative to the block origin. */
export type QuarterSource = [qx: number, qy: number];

/**
 * Neighbour mask bits. A set bit means the neighbour in that direction
 * contains the same autotile (or lies outside the map).
 */
export const N = {
  UP: 1,
  DOWN: 2,
  LEFT: 4,
  RIGHT: 8,
  UL: 16,
  UR: 32,
  DL: 64,
  DR: 128,
} as const;

/**
 * Quarter source for a floor autotile.
 * sx: 0 = left half, 1 = right half; sy: 0 = top half, 1 = bottom half.
 */
export function floorQuarter(mask: number, sx: number, sy: number): QuarterSource {
  const h = (mask & (sx === 0 ? N.LEFT : N.RIGHT)) !== 0;
  const v = (mask & (sy === 0 ? N.UP : N.DOWN)) !== 0;
  const diagBit = sy === 0 ? (sx === 0 ? N.UL : N.UR) : sx === 0 ? N.DL : N.DR;
  const d = (mask & diagBit) !== 0;
  const outerX = sx === 0 ? 0 : 3;
  const innerX = sx === 0 ? 2 : 1;
  const outerY = sy === 0 ? 2 : 5;
  const innerY = sy === 0 ? 4 : 3;
  if (!h && !v) return [outerX, outerY];
  if (h && !v) return [innerX, outerY];
  if (!h && v) return [outerX, innerY];
  if (d) return [innerX, innerY];
  return [2 + sx, sy];
}

/** Quarter source for a wall autotile (no diagonal check). */
export function wallQuarter(mask: number, sx: number, sy: number): QuarterSource {
  const h = (mask & (sx === 0 ? N.LEFT : N.RIGHT)) !== 0;
  const v = (mask & (sy === 0 ? N.UP : N.DOWN)) !== 0;
  const outerX = sx === 0 ? 0 : 3;
  const innerX = sx === 0 ? 2 : 1;
  const outerY = sy === 0 ? 0 : 3;
  const innerY = sy === 0 ? 2 : 1;
  return [h ? innerX : outerX, v ? innerY : outerY];
}

/** The four quarter sources (TL, TR, BL, BR) for a tile with the given neighbour mask. */
export function autotileQuarters(type: AutotileType, mask: number): QuarterSource[] {
  const fn = type === 'wall' ? wallQuarter : floorQuarter;
  return [fn(mask, 0, 0), fn(mask, 1, 0), fn(mask, 0, 1), fn(mask, 1, 1)];
}

/**
 * Reduce a mask to the bits that influence the shape, so that equivalent
 * masks share a cache entry. Diagonals only matter when both adjacent
 * orthogonal neighbours are the same; walls ignore diagonals entirely.
 */
export function normalizeMask(type: AutotileType, mask: number): number {
  let m = mask & 0xf;
  if (type === 'wall') return m;
  if (mask & N.UP && mask & N.LEFT && mask & N.UL) m |= N.UL;
  if (mask & N.UP && mask & N.RIGHT && mask & N.UR) m |= N.UR;
  if (mask & N.DOWN && mask & N.LEFT && mask & N.DL) m |= N.DL;
  if (mask & N.DOWN && mask & N.RIGHT && mask & N.DR) m |= N.DR;
  return m;
}

/**
 * Compute the neighbour mask of cell (x, y) given a predicate telling whether
 * a cell holds the same autotile. Cells outside the map count as the same so
 * terrain continues seamlessly to the map edge.
 */
export function neighborMask(
  x: number,
  y: number,
  width: number,
  height: number,
  same: (x: number, y: number) => boolean,
): number {
  const s = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true;
    return same(nx, ny);
  };
  let m = 0;
  if (s(0, -1)) m |= N.UP;
  if (s(0, 1)) m |= N.DOWN;
  if (s(-1, 0)) m |= N.LEFT;
  if (s(1, 0)) m |= N.RIGHT;
  if (s(-1, -1)) m |= N.UL;
  if (s(1, -1)) m |= N.UR;
  if (s(-1, 1)) m |= N.DL;
  if (s(1, 1)) m |= N.DR;
  return m;
}

/** Size of an autotile block in tiles (per animation frame). */
export function autotileBlockSize(type: AutotileType): { w: number; h: number } {
  return type === 'wall' ? { w: 2, h: 2 } : { w: 2, h: 3 };
}
