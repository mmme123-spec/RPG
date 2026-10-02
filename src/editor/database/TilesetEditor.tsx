/** Tileset editor: sheets/autotile images and per-tile flags (passage, bush, ladder, counter, damage, terrain tag). */

import { useEffect, useRef, useState } from 'react';
import type { Tileset } from '../../core/types';
import { SHEET_STRIDE, TF, TILE_SIZE, autotileId, normalTileId, passModeOf, terrainTagOf, withPassMode, withTerrainTag } from '../../core/tiles';
import { TileRenderer } from '../../render/tilemap';
import { Field, Row, Select, TextInput } from '../components/fields';
import { getImages, onImagesLoaded } from '../components/images';
import { useEditor } from '../store/store';

type Mode = 'passage' | 'bush' | 'ladder' | 'counter' | 'damage' | 'terrain';
const T = TILE_SIZE;

export function TilesetEditor({ t, set }: { t: Tileset; set: (fn: (t: Tileset) => void) => void }) {
  const assets = useEditor((s) => s.project!.assets.filter((a) => a.kind === 'tileset'));
  const [tab, setTab] = useState(0);
  const [mode, setMode] = useState<Mode>('passage');
  const ref = useRef<HTMLCanvasElement>(null);
  const [, force] = useState(0);
  useEffect(() => onImagesLoaded(() => force((n) => n + 1)), []);

  const sheet = tab > 0 ? t.sheets[tab - 1] : null;
  const img = sheet ? getImages().get('tiles', sheet.image) : null;
  const cols = tab === 0 ? 8 : img && sheet ? Math.max(1, Math.floor(img.width / sheet.tileSize)) : 8;
  const count = tab === 0 ? t.autotiles.length : img && sheet ? Math.min(SHEET_STRIDE, cols * Math.floor(img.height / sheet.tileSize)) : 0;
  const idAt = (i: number) => (tab === 0 ? autotileId(i) : normalTileId(tab - 1, i));

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = cols * T;
    c.height = Math.max(1, Math.ceil(count / cols)) * T;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const tr = new TileRenderer(getImages(), t);
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < count; i++) {
      const x = (i % cols) * T,
        y = Math.floor(i / cols) * T;
      tr.draw(ctx, idAt(i), x, y, T, 0);
      const f = t.flags[idAt(i)] ?? 0;
      let label = '';
      let color = '#fff';
      if (mode === 'passage') {
        const pm = passModeOf(f);
        label = pm === 'block' ? '×' : pm === 'star' ? '★' : '○';
        color = pm === 'block' ? '#ff6b6b' : pm === 'star' ? '#ffd166' : '#8fd';
      } else if (mode === 'terrain') {
        label = String(terrainTagOf(f));
      } else {
        const bit = { bush: TF.BUSH, ladder: TF.LADDER, counter: TF.COUNTER, damage: TF.DAMAGE }[mode];
        label = f & bit ? '●' : '·';
        color = f & bit ? '#ffd166' : '#ccc';
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 8, y + 8, 16, 16);
      ctx.fillStyle = color;
      ctx.fillText(label, x + T / 2, y + T / 2 + 1);
    }
  });

  const click = (e: React.MouseEvent<HTMLCanvasElement>, dir: 1 | -1) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = e.currentTarget.width / r.width;
    const i = Math.floor(((e.clientY - r.top) * s) / T) * cols + Math.floor(((e.clientX - r.left) * s) / T);
    if (i >= count) return;
    const id = idAt(i);
    set((ts) => {
      const f = ts.flags[id] ?? 0;
      let nf = f;
      if (mode === 'passage') {
        const order = ['pass', 'block', 'star'] as const;
        nf = withPassMode(f, order[(order.indexOf(passModeOf(f)) + (dir === 1 ? 1 : 2)) % 3]);
      } else if (mode === 'terrain') nf = withTerrainTag(f, (terrainTagOf(f) + (dir === 1 ? 1 : 7)) % 8);
      else nf = f ^ { bush: TF.BUSH, ladder: TF.LADDER, counter: TF.COUNTER, damage: TF.DAMAGE }[mode];
      if (nf) ts.flags[id] = nf;
      else delete ts.flags[id];
    });
  };

  const imageOptions: [string, string][] = [
    ['builtin:outdoor', 'Built-in: Outdoor'],
    ['builtin:indoor', 'Built-in: Indoor'],
    ...assets.map((a): [string, string] => [`asset:${a.id}`, a.name]),
  ];

  return (
    <>
      <div className="form-grid">
        <Field label="Name">
          <TextInput value={t.name} onChange={(v) => set((x) => (x.name = v))} />
        </Field>
        <Field label="Note">
          <TextInput value={t.note} onChange={(v) => set((x) => (x.note = v))} />
        </Field>
      </div>
      <fieldset>
        <legend>Tile sheets</legend>
        {t.sheets.map((sh, i) => (
          <Row key={i}>
            <b>{String.fromCharCode(66 + i)}</b>
            <Select value={imageOptions.some(([k]) => k === sh.image) ? sh.image : imageOptions[0][0]} options={imageOptions} onChange={(v) => set((x) => (x.sheets[i].image = v))} />
            <Select
              value={sh.tileSize}
              options={[
                [16, '16 px tiles'],
                [24, '24 px tiles'],
                [32, '32 px tiles'],
                [48, '48 px tiles'],
              ]}
              onChange={(v) => set((x) => (x.sheets[i].tileSize = v))}
            />
            <button onClick={() => set((x) => void x.sheets.splice(i, 1))}>✕</button>
          </Row>
        ))}
        <button disabled={t.sheets.length >= 7} onClick={() => set((x) => void x.sheets.push({ image: imageOptions[imageOptions.length - 1][0], tileSize: 32 }))}>
          ＋ Sheet
        </button>
        <p className="hint">Upload tile sheet images in Database → Assets (kind “Tileset”). Each tile is read in a grid of the given size.</p>
      </fieldset>
      <div className="palette-tabs">
        <button className={tab === 0 ? 'sel' : ''} onClick={() => setTab(0)}>
          A
        </button>
        {t.sheets.map((_, i) => (
          <button key={i} className={tab === i + 1 ? 'sel' : ''} onClick={() => setTab(i + 1)}>
            {String.fromCharCode(66 + i)}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <Select
          value={mode}
          options={[
            ['passage', 'Passage (○ × ★)'],
            ['bush', 'Bush'],
            ['ladder', 'Ladder'],
            ['counter', 'Counter'],
            ['damage', 'Damage floor'],
            ['terrain', 'Terrain tag'],
          ]}
          onChange={setMode}
        />
      </div>
      <div className="tileset-scroll">
        <canvas
          ref={ref}
          className="pixel"
          onClick={(e) => click(e, 1)}
          onContextMenu={(e) => {
            e.preventDefault();
            click(e, -1);
          }}
        />
      </div>
      <p className="hint">Click to change, right-click to change backwards. ○ passable · × blocked · ★ drawn above characters.</p>
    </>
  );
}
