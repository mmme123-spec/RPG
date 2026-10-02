/** The map editing canvas: tile painting, regions and event placement. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameMap, MapEvent, Project } from '../../core/types';
import { TILE_SIZE, LAYER_COUNT } from '../../core/tiles';
import { createEvent, createPage } from '../../core/factory';
import { nextId } from '../../core/util';
import { TileRenderer } from '../../render/tilemap';
import { characterScale } from '../../engine/ui/draw';
import { getImages, onImagesLoaded } from '../components/images';
import { currentMap, useEditor } from '../store/store';

const T = TILE_SIZE;
const REGION_COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6'];

let rendererCache: { ts: unknown; r: TileRenderer } | null = null;
function rendererFor(project: Project, map: GameMap): TileRenderer {
  const ts = project.tilesets.find((t) => t.id === map.tilesetId) ?? project.tilesets[0];
  if (!rendererCache || rendererCache.ts !== ts) rendererCache = { ts, r: new TileRenderer(getImages(), ts) };
  return rendererCache.r;
}

export function drawEventSprite(ctx: CanvasRenderingContext2D, project: Project, map: GameMap, ev: MapEvent, x: number, y: number, size: number): void {
  const page = ev.pages[0];
  const g = page?.graphic;
  if (g?.kind === 'character') {
    const f = getImages().character({ sheet: g.sheet, index: g.index });
    if (f) {
      const s = characterScale(f.fw) * (size / T);
      const row = g.direction / 2 - 1;
      ctx.drawImage(f.image, f.sx + g.pattern * f.fw, f.sy + row * f.fh, f.fw, f.fh, x + size / 2 - (f.fw * s) / 2, y + size - f.fh * s, f.fw * s, f.fh * s);
    }
  } else if (g?.kind === 'tile') {
    rendererFor(project, map).draw(ctx, g.tileId, x, y, size);
  }
}

export function MapCanvas() {
  const project = useEditor((s) => s.project);
  const map = useEditor(currentMap);
  const layer = useEditor((s) => s.layer);
  const tool = useEditor((s) => s.tool);
  const brush = useEditor((s) => s.brush);
  const zoom = useEditor((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const dimLayers = useEditor((s) => s.dimLayers);
  const selectedEvent = useEditor((s) => s.selectedEvent);
  const region = useEditor((s) => s.region);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState({ w: 800, h: 600, sx: 0, sy: 0 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startY: number; mode: 'paint' | 'rect' | 'moveEvent' | 'pan'; eventId?: number; px?: number; py?: number; button?: number; moved?: number } | null>(null);
  const [quick, setQuick] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const [rect, setRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [, force] = useState(0);
  const cell = T * zoom;

  useEffect(() => onImagesLoaded(() => force((n) => n + 1)), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView((v) => ({ ...v, w: el.clientWidth, h: el.clientHeight })));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !project || !map) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(view.w * dpr));
    canvas.height = Math.max(1, Math.floor(view.h * dpr));
    canvas.style.width = `${view.w}px`;
    canvas.style.height = `${view.h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1b1d24';
    ctx.fillRect(0, 0, view.w, view.h);
    const tr = rendererFor(project, map);
    const ox = -view.sx;
    const oy = -view.sy;
    ctx.fillStyle = map.bgColor || '#000';
    ctx.fillRect(ox, oy, map.width * cell, map.height * cell);
    const x0 = Math.max(0, Math.floor(view.sx / cell));
    const y0 = Math.max(0, Math.floor(view.sy / cell));
    const x1 = Math.min(map.width - 1, Math.ceil((view.sx + view.w) / cell));
    const y1 = Math.min(map.height - 1, Math.ceil((view.sy + view.h) / cell));
    for (let l = 0; l < LAYER_COUNT; l++) {
      const dim = dimLayers && typeof layer === 'number' && l > layer;
      ctx.globalAlpha = dim ? 0.35 : 1;
      tr.drawLayer(ctx, map, l, x0, y0, x1, y1, ox, oy, 0, 'all', cell);
    }
    ctx.globalAlpha = 1;
    if (layer === 'regions') {
      ctx.font = `bold ${Math.round(12 * zoom)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const r = map.regions[y * map.width + x];
          if (!r) continue;
          ctx.fillStyle = REGION_COLORS[r % REGION_COLORS.length] + '88';
          ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
          ctx.fillStyle = '#fff';
          ctx.fillText(String(r), ox + x * cell + cell / 2, oy + y * cell + cell / 2);
        }
    }
    // events
    for (const ev of map.events) {
      const ex = ox + ev.x * cell;
      const ey = oy + ev.y * cell;
      if (ex < -cell * 2 || ey < -cell * 2 || ex > view.w || ey > view.h + cell) continue;
      drawEventSprite(ctx, project, map, ev, ex, ey, cell);
      if (layer === 'events') {
        ctx.strokeStyle = ev.id === selectedEvent ? '#ffd166' : 'rgba(255,255,255,0.85)';
        ctx.lineWidth = ev.id === selectedEvent ? 3 : 1.5;
        ctx.strokeRect(ex + 2, ey + 2, cell - 4, cell - 4);
        if (ev.pages[0]?.graphic.kind === 'none') {
          ctx.fillStyle = 'rgba(80,140,255,0.35)';
          ctx.fillRect(ex + 3, ey + 3, cell - 6, cell - 6);
        }
      }
    }
    // start position
    const sys = project.system;
    if (sys.startMapId === map.id) {
      ctx.strokeStyle = '#4cd964';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(ox + sys.startX * cell + 1, oy + sys.startY * cell + 1, cell - 2, cell - 2);
      ctx.setLineDash([]);
      ctx.fillStyle = '#4cd964';
      ctx.font = `bold ${Math.round(10 * zoom)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText('START', ox + sys.startX * cell + 3, oy + sys.startY * cell + 10 * zoom);
    }
    if (showGrid) {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) {
        ctx.moveTo(Math.round(ox + x * cell) + 0.5, oy + y0 * cell);
        ctx.lineTo(Math.round(ox + x * cell) + 0.5, oy + (y1 + 1) * cell);
      }
      for (let y = y0; y <= y1 + 1; y++) {
        ctx.moveTo(ox + x0 * cell, Math.round(oy + y * cell) + 0.5);
        ctx.lineTo(ox + (x1 + 1) * cell, Math.round(oy + y * cell) + 0.5);
      }
      ctx.stroke();
    }
    // hover / rectangle preview
    const bw = brush.tiles[0]?.length ?? 1;
    const bh = brush.tiles.length;
    if (rect) {
      const rx = Math.min(rect.x0, rect.x1);
      const ry = Math.min(rect.y0, rect.y1);
      ctx.fillStyle = 'rgba(255,209,102,0.25)';
      ctx.fillRect(ox + rx * cell, oy + ry * cell, (Math.abs(rect.x1 - rect.x0) + 1) * cell, (Math.abs(rect.y1 - rect.y0) + 1) * cell);
    } else if (hover) {
      const w = typeof layer === 'number' && (tool === 'pencil') ? bw : 1;
      const h = typeof layer === 'number' && tool === 'pencil' ? bh : 1;
      if (typeof layer === 'number' && tool === 'pencil') {
        ctx.globalAlpha = 0.6;
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) tr.draw(ctx, brush.tiles[y][x], ox + (hover.x + x) * cell, oy + (hover.y + y) * cell, cell);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + hover.x * cell + 1, oy + hover.y * cell + 1, w * cell - 2, h * cell - 2);
    }
  });

  const cellAt = useCallback(
    (e: React.PointerEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: Math.floor((e.clientX - r.left + view.sx) / cell), y: Math.floor((e.clientY - r.top + view.sy) / cell) };
    },
    [view, cell],
  );

  if (!project || !map) return <div className="map-empty">No map selected. Create a map in the map list.</div>;

  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < map.width && y < map.height;
  const update = useEditor.getState().update;
  const mapIndex = (p: Project) => p.maps.findIndex((m) => m.id === map.id);

  const paintAt = (x: number, y: number) => {
    if (typeof layer === 'number') {
      update(
        'Paint tiles',
        (p) => {
          const m = p.maps[mapIndex(p)];
          const data = m.layers[layer];
          if (tool === 'eraser') {
            if (inMap(x, y)) data[y * m.width + x] = 0;
            return;
          }
          for (let dy = 0; dy < brush.tiles.length; dy++)
            for (let dx = 0; dx < brush.tiles[dy].length; dx++) {
              const tx = x + dx;
              const ty = y + dy;
              if (inMap(tx, ty)) data[ty * m.width + tx] = brush.tiles[dy][dx];
            }
        },
        true,
      );
    } else if (layer === 'regions') {
      update(
        'Paint regions',
        (p) => {
          const m = p.maps[mapIndex(p)];
          if (inMap(x, y)) m.regions[y * m.width + x] = tool === 'eraser' ? 0 : region;
        },
        true,
      );
    }
  };

  const fillAt = (x: number, y: number) => {
    if (!inMap(x, y)) return;
    update('Fill', (p) => {
      const m = p.maps[mapIndex(p)];
      const data = layer === 'regions' ? m.regions : m.layers[layer as number];
      const target = data[y * m.width + x];
      const value = layer === 'regions' ? region : tool === 'eraser' ? 0 : brush.tiles[0][0];
      if (target === value) return;
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        if (!inMap(cx, cy) || data[cy * m.width + cx] !== target) continue;
        data[cy * m.width + cx] = value;
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    });
  };

  const fillRect = (r: { x0: number; y0: number; x1: number; y1: number }) => {
    update('Rectangle', (p) => {
      const m = p.maps[mapIndex(p)];
      const xa = Math.min(r.x0, r.x1);
      const ya = Math.min(r.y0, r.y1);
      for (let y = ya; y <= Math.max(r.y0, r.y1); y++)
        for (let x = xa; x <= Math.max(r.x0, r.x1); x++) {
          if (!inMap(x, y)) continue;
          if (layer === 'regions') m.regions[y * m.width + x] = region;
          else {
            const row = brush.tiles[(y - ya) % brush.tiles.length];
            m.layers[layer as number][y * m.width + x] = row[(x - xa) % row.length];
          }
        }
    });
  };

  const onDown = (e: React.PointerEvent) => {
    const { x, y } = cellAt(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 1 || e.button === 2 || e.altKey) {
      drag.current = { startX: x, startY: y, mode: 'pan', px: e.clientX, py: e.clientY, button: e.button, moved: 0 };
      return;
    }
    if (layer === 'events') {
      const ev = map.events.find((v) => v.x === x && v.y === y);
      useEditor.getState().set({ selectedEvent: ev?.id ?? null });
      if (ev) drag.current = { startX: x, startY: y, mode: 'moveEvent', eventId: ev.id };
      return;
    }
    if (tool === 'picker') {
      if (typeof layer === 'number' && inMap(x, y)) useEditor.getState().set({ brush: { tiles: [[map.layers[layer][y * map.width + x]]] }, tool: 'pencil' });
      else if (layer === 'regions' && inMap(x, y)) useEditor.getState().set({ region: map.regions[y * map.width + x] || 1 });
      return;
    }
    if (tool === 'fill') return fillAt(x, y);
    if (tool === 'rect') {
      drag.current = { startX: x, startY: y, mode: 'rect' };
      setRect({ x0: x, y0: y, x1: x, y1: y });
      return;
    }
    drag.current = { startX: x, startY: y, mode: 'paint' };
    paintAt(x, y);
  };

  const onMove = (e: React.PointerEvent) => {
    const c = cellAt(e);
    if (!hover || hover.x !== c.x || hover.y !== c.y) {
      setHover(inMap(c.x, c.y) ? c : null);
      useEditor.getState().set({ cursor: inMap(c.x, c.y) ? c : null });
    }
    const d = drag.current;
    if (!d) return;
    if (d.mode === 'pan') {
      const el = scrollRef.current!;
      d.moved! += Math.abs(e.clientX - d.px!) + Math.abs(e.clientY - d.py!);
      el.scrollLeft -= e.clientX - d.px!;
      el.scrollTop -= e.clientY - d.py!;
      d.px = e.clientX;
      d.py = e.clientY;
    } else if (d.mode === 'paint') {
      if (c.x !== d.startX || c.y !== d.startY) {
        d.startX = c.x;
        d.startY = c.y;
        paintAt(c.x, c.y);
      }
    } else if (d.mode === 'rect') {
      setRect((r) => (r ? { ...r, x1: c.x, y1: c.y } : r));
    } else if (d.mode === 'moveEvent' && inMap(c.x, c.y) && (c.x !== d.startX || c.y !== d.startY)) {
      if (map.events.some((v) => v.x === c.x && v.y === c.y)) return;
      d.startX = c.x;
      d.startY = c.y;
      update(
        'Move event',
        (p) => {
          const ev = p.maps[mapIndex(p)].events.find((v) => v.id === d.eventId);
          if (ev) {
            ev.x = c.x;
            ev.y = c.y;
          }
        },
        true,
      );
    }
  };

  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d?.mode === 'pan' && d.button === 2 && d.moved! < 4 && inMap(d.startX, d.startY)) {
      // a right click without dragging: quick menu (events) or tile picker
      if (layer === 'events') setQuick({ x: d.startX, y: d.startY, cx: e.clientX, cy: e.clientY });
      else if (layer === 'regions') useEditor.getState().set({ region: map.regions[d.startY * map.width + d.startX] || 1 });
      else {
        const st = useEditor.getState();
        st.set({ brush: { tiles: [[map.layers[layer][d.startY * map.width + d.startX]]] }, tool: st.tool === 'eraser' || st.tool === 'picker' ? 'pencil' : st.tool });
      }
    }
    if (d?.mode === 'rect' && rect) fillRect(rect);
    setRect(null);
    drag.current = null;
  };

  const onDouble = (e: React.MouseEvent) => {
    if (layer !== 'events') return;
    const r = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left + view.sx) / cell);
    const y = Math.floor((e.clientY - r.top + view.sy) / cell);
    if (!inMap(x, y)) return;
    let ev = map.events.find((v) => v.x === x && v.y === y);
    if (!ev) {
      const id = nextId(map.events);
      update('New event', (p) => {
        p.maps[mapIndex(p)].events.push(createEvent(id, x, y));
      });
      ev = { id } as MapEvent;
    }
    useEditor.getState().set({ selectedEvent: ev.id, dialog: { kind: 'event', mapId: map.id, eventId: ev.id } });
  };

  return (
    <div
      className="map-scroll"
      ref={scrollRef}
      onScroll={(e) => setView((v) => ({ ...v, sx: e.currentTarget.scrollLeft, sy: e.currentTarget.scrollTop }))}
      onWheel={(e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const z = Math.max(0.25, Math.min(3, zoom * (e.deltaY < 0 ? 1.25 : 0.8)));
          useEditor.getState().set({ zoom: Math.round(z * 100) / 100 });
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div style={{ width: map.width * cell + 64, height: map.height * cell + 64, position: 'relative' }}>
        <canvas
          ref={canvasRef}
          className="map-canvas"
          style={{ position: 'sticky', left: 0, top: 0, touchAction: 'none', cursor: layer === 'events' ? 'pointer' : 'crosshair' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={() => {
            setHover(null);
            useEditor.getState().set({ cursor: null });
          }}
          onDoubleClick={onDouble}
        />
      </div>
      {quick && <QuickMenu {...quick} onClose={() => setQuick(null)} />}
    </div>
  );
}

/** Right-click menu in event mode. */
function QuickMenu({ x, y, cx, cy, onClose }: { x: number; y: number; cx: number; cy: number; onClose: () => void }) {
  const st = useEditor.getState();
  const map = currentMap(st)!;
  const ev = map.events.find((v) => v.x === x && v.y === y);
  const mi = (p: Project) => p.maps.findIndex((m) => m.id === map.id);
  const make = (label: string, fill: (e: MapEvent) => void) => {
    const id = nextId(map.events);
    st.update(label, (p) => {
      const e = createEvent(id, x, y);
      fill(e);
      p.maps[mi(p)].events.push(e);
    });
    st.set({ selectedEvent: id, dialog: { kind: 'event', mapId: map.id, eventId: id } });
    onClose();
  };
  const item = (label: string, fn: () => void, cls = '') => (
    <button className={cls} onClick={() => (fn(), onClose())}>
      {label}
    </button>
  );
  return (
    <div className="context-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()} onContextMenu={(e) => (e.preventDefault(), onClose())}>
      <div className="context-menu" style={{ left: cx, top: cy }}>
        <div className="context-title">
          ({x}, {y})
        </div>
        {ev ? (
          <>
            {item('Edit event…', () => st.set({ selectedEvent: ev.id, dialog: { kind: 'event', mapId: map.id, eventId: ev.id } }))}
            {item(
              'Delete event',
              () => st.update('Delete event', (p) => void (p.maps[mi(p)].events = p.maps[mi(p)].events.filter((v) => v.id !== ev.id))),
              'danger',
            )}
          </>
        ) : (
          <>
            {item('New event…', () => make('New event', () => {}))}
            <button
              onClick={() =>
                make('Quick door', (e) => {
                  e.name = 'Door';
                  e.pages[0].trigger = 'playerTouch';
                  e.pages[0].priority = 'below';
                  e.pages[0].commands = [
                    { type: 'playSe', audio: { name: 'builtin:door', volume: 80, pitch: 100 } },
                    { type: 'transferPlayer', mapId: map.id, x, y, direction: 0, fade: 'black' },
                  ];
                })
              }
            >
              Quick: door / transfer…
            </button>
            <button
              onClick={() =>
                make('Quick chest', (e) => {
                  e.name = 'Chest';
                  const pg = e.pages[0];
                  pg.graphic = { kind: 'character', sheet: 'builtin:chest', index: 0, direction: 2, pattern: 1 };
                  pg.directionFix = true;
                  pg.walkAnime = false;
                  pg.commands = [
                    { type: 'playSe', audio: { name: 'builtin:chest', volume: 80, pitch: 100 } },
                    { type: 'changeItems', itemKind: 'item', id: 1, op: '+', operand: { kind: 'constant', value: 1 } },
                    { type: 'showText', face: null, speaker: '', text: 'Found a \\C[6]Potion\\C[0]!', position: 'bottom', background: 'window' },
                    { type: 'controlSelfSwitch', letter: 'A', value: true },
                  ];
                  const open = createPage();
                  open.conditions = [{ kind: 'selfSwitch', letter: 'A', value: true }];
                  open.graphic = { kind: 'character', sheet: 'builtin:chest', index: 0, direction: 8, pattern: 1 };
                  open.directionFix = true;
                  e.pages.push(open);
                })
              }
            >
              Quick: treasure chest…
            </button>
          </>
        )}
        {item('Set player start here', () =>
          st.update('Set start', (p) => {
            p.system.startMapId = map.id;
            p.system.startX = x;
            p.system.startY = y;
          }),
        )}
        {item('Playtest from here', () => st.set({ dialog: { kind: 'playtest', fromHere: { mapId: map.id, x, y } } }))}
      </div>
    </div>
  );
}
