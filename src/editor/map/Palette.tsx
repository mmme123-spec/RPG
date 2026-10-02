/** Tile palette: autotiles and tile sheets of the current map's tileset. */

import { useEffect, useRef, useState } from 'react';
import { TILE_SIZE, autotileId, normalTileId, SHEET_STRIDE } from '../../core/tiles';
import { TileRenderer } from '../../render/tilemap';
import { getImages, onImagesLoaded } from '../components/images';
import { currentMap, useEditor } from '../store/store';

const T = TILE_SIZE;
const COLS = 8;

export function Palette() {
  const project = useEditor((s) => s.project);
  const map = useEditor(currentMap);
  const brush = useEditor((s) => s.brush);
  const layer = useEditor((s) => s.layer);
  const region = useEditor((s) => s.region);
  const [tab, setTab] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sel = useRef<{ x0: number; y0: number } | null>(null);
  const [, force] = useState(0);
  useEffect(() => onImagesLoaded(() => force((n) => n + 1)), []);

  const tileset = project && map ? (project.tilesets.find((t) => t.id === map.tilesetId) ?? project.tilesets[0]) : null;
  const sheetImg = tileset && tab > 0 ? getImages().get('tiles', tileset.sheets[tab - 1]?.image ?? '') : null;
  const sheet = tileset && tab > 0 ? tileset.sheets[tab - 1] : null;
  const sheetCols = sheet && sheetImg ? Math.max(1, Math.floor(sheetImg.width / sheet.tileSize)) : COLS;
  const count = !tileset ? 0 : tab === 0 ? tileset.autotiles.length : sheet && sheetImg ? Math.min(SHEET_STRIDE, sheetCols * Math.floor(sheetImg.height / sheet.tileSize)) : 0;
  const cols = tab === 0 ? COLS : sheetCols;
  const rows = Math.ceil(count / cols);

  const idAt = (i: number) => (tab === 0 ? autotileId(i) : normalTileId(tab - 1, i));

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !tileset) return;
    c.width = cols * T;
    c.height = Math.max(1, rows) * T;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const tr = new TileRenderer(getImages(), tileset);
    for (let i = 0; i < count; i++) tr.draw(ctx, idAt(i), (i % cols) * T, Math.floor(i / cols) * T, T, 0);
    // selection highlight
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    for (let y = 0; y < brush.tiles.length; y++)
      for (let x = 0; x < brush.tiles[y].length; x++) {
        const id = brush.tiles[y][x];
        for (let i = 0; i < count; i++) if (idAt(i) === id) ctx.strokeRect((i % cols) * T + 1, Math.floor(i / cols) * T + 1, T - 2, T - 2);
      }
  });

  if (!tileset) return null;

  if (layer === 'regions') {
    return (
      <div className="palette">
        <div className="palette-tabs">
          <span>Region IDs</span>
        </div>
        <div className="region-grid">
          {Array.from({ length: 32 }, (_, i) => i + 1).map((r) => (
            <button key={r} className={r === region ? 'sel' : ''} onClick={() => useEditor.getState().set({ region: r, tool: 'pencil' })}>
              {r}
            </button>
          ))}
        </div>
        <p className="hint">Regions mark areas for encounters and events. They are invisible in game.</p>
      </div>
    );
  }
  if (layer === 'events') {
    return (
      <div className="palette">
        <p className="hint">
          <b>Event mode.</b> Double-click a tile to create or edit an event. Drag events to move them. Select one and press Delete to remove it, or Ctrl+C / Ctrl+V to copy it.
        </p>
      </div>
    );
  }

  const cellOf = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const sx = canvasRef.current!.width / r.width;
    return { x: Math.floor(((e.clientX - r.left) * sx) / T), y: Math.floor(((e.clientY - r.top) * sx) / T) };
  };
  const select = (x0: number, y0: number, x1: number, y1: number) => {
    const tiles: number[][] = [];
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
      const row: number[] = [];
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        const i = y * cols + x;
        row.push(i < count ? idAt(i) : 0);
      }
      tiles.push(row);
    }
    const st = useEditor.getState();
    useEditor.getState().set({ brush: { tiles }, tool: st.tool === 'eraser' || st.tool === 'picker' ? 'pencil' : st.tool });
  };

  return (
    <div className="palette">
      <div className="palette-tabs">
        <button className={tab === 0 ? 'sel' : ''} onClick={() => setTab(0)} title="Autotiles">
          A
        </button>
        {tileset.sheets.map((_, i) => (
          <button key={i} className={tab === i + 1 ? 'sel' : ''} onClick={() => setTab(i + 1)}>
            {String.fromCharCode(66 + i)}
          </button>
        ))}
      </div>
      <div className="palette-scroll">
        <canvas
          ref={canvasRef}
          className="pixel palette-canvas"
          onPointerDown={(e) => {
            const c = cellOf(e);
            sel.current = { x0: c.x, y0: c.y };
            select(c.x, c.y, c.x, c.y);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!sel.current || tab === 0) return;
            const c = cellOf(e);
            select(sel.current.x0, sel.current.y0, c.x, c.y);
          }}
          onPointerUp={() => (sel.current = null)}
        />
      </div>
    </div>
  );
}
