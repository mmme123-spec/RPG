/** Development page that renders every built-in graphic for visual review. */
import { BUILTIN_BATTLEBACKS, BUILTIN_CHARACTERS, BUILTIN_ENEMIES, BUILTIN_FACES, BUILTIN_TITLES, builtinTileId, createStandardTileset } from '../core/builtins';
import { createMap } from '../core/factory';
import { generateBuiltin } from '../art';
import { ImageLibrary } from '../render/images';
import { TileRenderer } from '../render/tilemap';

const root = document.getElementById('root')!;

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  root.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  root.appendChild(row);
  return row;
}

function add(row: HTMLElement, canvas: HTMLCanvasElement | null, label: string, scale = 1): void {
  const item = document.createElement('div');
  item.className = 'item';
  if (canvas) {
    canvas.style.width = `${canvas.width * scale}px`;
    canvas.style.height = `${canvas.height * scale}px`;
    item.appendChild(canvas);
  } else {
    item.append('(missing)');
  }
  item.append(label);
  row.appendChild(item);
}

const t0 = performance.now();
let row = section('Tile sheets');
add(row, generateBuiltin('tiles', 'autotiles'), 'autotiles');
add(row, generateBuiltin('tiles', 'outdoor'), 'outdoor');
add(row, generateBuiltin('tiles', 'indoor'), 'indoor');

// Composed test map exercising autotile shapes
row = section('Autotile composition test');
const lib = new ImageLibrary();
const tileset = createStandardTileset();
const tr = new TileRenderer(lib, tileset);
const map = createMap(1, 'test', 24, 16);
const set = (layer: number, x: number, y: number, key: string) => (map.layers[layer][y * map.width + x] = builtinTileId(key));
for (let y = 0; y < 16; y++) for (let x = 0; x < 24; x++) set(0, x, y, 'grass');
const blob = (key: string, cells: [number, number][]) => cells.forEach(([x, y]) => set(0, x, y, key));
const rect = (key: string, x0: number, y0: number, w: number, h: number, layer = 0) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(layer, x, y, key);
};
rect('water', 1, 1, 6, 4);
blob('water', [[3, 5], [4, 5], [4, 6], [7, 2]]);
set(0, 3, 2, 'grass');
rect('dirt', 9, 1, 5, 2);
rect('dirt', 11, 3, 1, 4);
rect('sand', 15, 1, 3, 3);
rect('cobble', 1, 8, 8, 1);
rect('cobble', 4, 9, 1, 3);
rect('tallGrass', 10, 8, 4, 3, 1);
rect('deepWater', 2, 2, 3, 2);
// house
rect('roofRed', 15, 6, 6, 3);
rect('houseWall', 15, 9, 6, 2);
map.layers[2][10 * 24 + 17] = builtinTileId('door');
map.layers[2][9 * 24 + 16] = builtinTileId('window');
map.layers[2][9 * 24 + 19] = builtinTileId('window');
rect('cliff', 1, 13, 7, 2);
rect('lava', 9, 12, 3, 3);
rect('hedge', 13, 12, 4, 1);
map.layers[2][12 * 24 + 20] = builtinTileId('treeBottom');
map.layers[2][11 * 24 + 20] = builtinTileId('treeTop');
map.layers[2][14 * 24 + 22] = builtinTileId('pineBottom');
map.layers[2][13 * 24 + 22] = builtinTileId('pineTop');
const mc = document.createElement('canvas');
mc.width = 24 * 32;
mc.height = 16 * 32;
const mctx = mc.getContext('2d')!;
mctx.imageSmoothingEnabled = false;
for (let l = 0; l < 4; l++) tr.drawLayer(mctx, map, l, 0, 0, 23, 15, 0, 0, 0);
add(row, mc, 'map');

row = section('Characters');
for (const c of BUILTIN_CHARACTERS) add(row, generateBuiltin('character', c.key), c.key);
row = section('Faces');
for (const f of BUILTIN_FACES) add(row, generateBuiltin('face', f.key), f.key);
row = section('Enemies');
for (const e of BUILTIN_ENEMIES) add(row, generateBuiltin('enemy', e.key), e.key);
row = section('Icons');
add(row, generateBuiltin('icons', ''), 'icons', 1.5);
row = section('Battlebacks');
for (const b of BUILTIN_BATTLEBACKS) add(row, generateBuiltin('battleback', b.key), b.key, 0.5);
row = section('Titles');
for (const t of BUILTIN_TITLES) add(row, generateBuiltin('title', t.key), t.key, 0.5);
const info = document.createElement('p');
info.textContent = `Generated in ${(performance.now() - t0).toFixed(0)} ms`;
info.id = 'done';
root.prepend(info);
