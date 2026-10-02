/** Editor shell: toolbar, map list, palette, map view, dialogs, shortcuts and autosave. */

import { useEffect, useRef, useState } from 'react';
import type { MapEvent } from '../core/types';
import { nextId } from '../core/util';
import { MapCanvas } from './map/MapCanvas';
import { MapPropertiesDialog, MapTree } from './map/MapTree';
import { Palette } from './map/Palette';
import { EventEditor } from './events/EventEditor';
import { DatabaseDialog } from './database/Database';
import { Playtest } from './Playtest';
import { ErrorBoundary } from './ErrorBoundary';
import { HelpDialog, ProjectsDialog } from './Projects';
import { exportGame, exportProject } from './exporter';
import { saveProject } from './store/storage';
import { currentMap, useEditor, type EditLayer, type Tool } from './store/store';

const LAYERS: [EditLayer, string, string][] = [
  [0, '1', 'Layer 1 — ground'],
  [1, '2', 'Layer 2 — details'],
  [2, '3', 'Layer 3 — objects'],
  [3, '4', 'Layer 4 — above characters'],
  ['events', 'Events', 'Event mode'],
  ['regions', 'R', 'Regions'],
];

const TOOLS: [Tool, string, string][] = [
  ['pencil', '✏️', 'Pencil (P)'],
  ['rect', '▭', 'Rectangle (R)'],
  ['fill', '🪣', 'Fill (F)'],
  ['eraser', '⌫', 'Eraser (E)'],
  ['picker', '💧', 'Picker (I)'],
];

let eventClipboard: MapEvent | null = null;

function useAutosave() {
  const project = useEditor((s) => s.project);
  const dirty = useEditor((s) => s.dirty);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!project || !dirty) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      setSaving(true);
      await saveProject(useEditor.getState().project!);
      useEditor.setState({ dirty: false });
      setSaving(false);
    }, 800);
  }, [project, dirty]);
  return saving;
}

async function saveNow() {
  const p = useEditor.getState().project;
  if (!p) return;
  await saveProject(p);
  useEditor.setState({ dirty: false });
  useEditor.getState().notify('Project saved');
}

export function App() {
  const project = useEditor((s) => s.project);
  const layer = useEditor((s) => s.layer);
  const tool = useEditor((s) => s.tool);
  const zoom = useEditor((s) => s.zoom);
  const showGrid = useEditor((s) => s.showGrid);
  const dimLayers = useEditor((s) => s.dimLayers);
  const dialog = useEditor((s) => s.dialog);
  const toast = useEditor((s) => s.toast);
  const cursor = useEditor((s) => s.cursor);
  const canUndo = useEditor((s) => s.undo.length > 0);
  const canRedo = useEditor((s) => s.redo.length > 0);
  const dirty = useEditor((s) => s.dirty);
  const map = useEditor(currentMap);
  const set = useEditor((s) => s.set);
  const saving = useAutosave();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useEditor.getState();
      const target = e.target as HTMLElement;
      const typing = target.closest('input, textarea, select, [contenteditable]');
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (st.dialog.kind === 'playtest') return;
      if (e.key === 'F5') {
        e.preventDefault();
        const c = st.cursor;
        set({ dialog: { kind: 'playtest', fromHere: e.shiftKey && c ? { mapId: st.mapId, x: c.x, y: c.y } : undefined } });
        return;
      }
      if (st.dialog.kind !== 'none' || typing) return;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redoAction();
        else st.undoAction();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redoAction();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        set({ dialog: { kind: 'database' } });
      } else if (st.layer === 'events' && st.selectedEvent !== null && (e.key === 'Delete' || e.key === 'Backspace')) {
        const id = st.selectedEvent;
        st.update('Delete event', (p) => {
          const m = p.maps.find((x) => x.id === st.mapId)!;
          m.events = m.events.filter((v) => v.id !== id);
        });
        set({ selectedEvent: null });
      } else if (st.layer === 'events' && mod && e.key.toLowerCase() === 'c' && st.selectedEvent !== null) {
        eventClipboard = structuredClone(currentMap(st)?.events.find((v) => v.id === st.selectedEvent) ?? null);
        if (eventClipboard) st.notify('Event copied');
      } else if (st.layer === 'events' && mod && e.key.toLowerCase() === 'v' && eventClipboard && st.cursor) {
        const m = currentMap(st)!;
        const { x, y } = st.cursor;
        if (m.events.some((v) => v.x === x && v.y === y)) return st.notify('There is already an event here');
        const id = nextId(m.events);
        const clip = eventClipboard;
        st.update('Paste event', (p) => void p.maps.find((mm) => mm.id === m.id)!.events.push({ ...structuredClone(clip), id, x, y }));
        set({ selectedEvent: id });
      } else if (st.layer === 'events' && e.key === 'Enter' && st.selectedEvent !== null) {
        set({ dialog: { kind: 'event', mapId: st.mapId, eventId: st.selectedEvent } });
      } else if (!mod && e.key >= '1' && e.key <= '6') {
        set({ layer: LAYERS[Number(e.key) - 1][0] });
      } else if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        const t = ({ p: 'pencil', r: 'rect', f: 'fill', e: 'eraser', i: 'picker' } as Record<string, Tool>)[k];
        if (t) set({ tool: t });
        else if (k === 'g') set({ showGrid: !st.showGrid });
        else if (k === '+' || k === '=') set({ zoom: Math.min(3, Math.round(st.zoom * 125) / 100) });
        else if (k === '-') set({ zoom: Math.max(0.25, Math.round(st.zoom * 80) / 100) });
        else if (k === '0') set({ zoom: 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (useEditor.getState().dirty) {
        void saveNow();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [set]);

  const close = () => set({ dialog: { kind: 'none' } });

  if (!project) return <div className="loading">Loading…</div>;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand" title="RPG Forge">
          ⚔ <span>RPG Forge</span>
        </div>
        <div className="menu-wrap">
          <button onClick={() => setMenu(!menu)}>File ▾</button>
          {menu && (
            <div className="context-back" onClick={() => setMenu(false)}>
              <div className="context-menu" style={{ left: 90, top: 40 }}>
                <button onClick={() => set({ dialog: { kind: 'projects' } })}>Projects…</button>
                <button onClick={() => void saveNow()}>Save now (Ctrl+S)</button>
                <button onClick={() => exportProject(project)}>Download project (.json)</button>
                <button onClick={() => exportGame(project)}>Export playable game (.html)</button>
                <button onClick={() => set({ dialog: { kind: 'help' } })}>Quick guide</button>
              </div>
            </div>
          )}
        </div>
        <div className="group">
          <button disabled={!canUndo} onClick={() => useEditor.getState().undoAction()} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button disabled={!canRedo} onClick={() => useEditor.getState().redoAction()} title="Redo (Ctrl+Y)">
            ↷
          </button>
        </div>
        <div className="group">
          {LAYERS.map(([l, label, title]) => (
            <button key={String(l)} className={layer === l ? 'sel' : ''} title={title} onClick={() => set({ layer: l })}>
              {label}
            </button>
          ))}
        </div>
        <div className="group">
          {TOOLS.map(([t, icon, title]) => (
            <button
              key={t}
              className={tool === t && layer !== 'events' ? 'sel' : ''}
              disabled={layer === 'events'}
              title={title}
              onClick={() => set({ tool: t })}
            >
              {icon}
            </button>
          ))}
        </div>
        <div className="group">
          <button title="Zoom out (-)" onClick={() => set({ zoom: Math.max(0.25, Math.round(zoom * 80) / 100) })}>
            −
          </button>
          <button title="Reset zoom (0)" className="zoom-label" onClick={() => set({ zoom: 1 })}>
            {Math.round(zoom * 100)}%
          </button>
          <button title="Zoom in (+)" onClick={() => set({ zoom: Math.min(3, Math.round(zoom * 125) / 100) })}>
            +
          </button>
          <button className={showGrid ? 'sel' : ''} title="Grid (G)" onClick={() => set({ showGrid: !showGrid })}>
            #
          </button>
          <button className={dimLayers ? 'sel' : ''} title="Dim other layers" onClick={() => set({ dimLayers: !dimLayers })}>
            ◐
          </button>
        </div>
        <span className="spacer" />
        <button className="db-button" onClick={() => set({ dialog: { kind: 'database' } })} title="Database (Ctrl+D)">
          📖 Database
        </button>
        <button className="play-button" onClick={() => set({ dialog: { kind: 'playtest' } })} title="Playtest (F5)">
          ▶ Play
        </button>
      </header>
      <div className="workspace">
        <aside className="sidebar">
          <Palette />
          <MapTree />
        </aside>
        <main className="main">
          <MapCanvas />
        </main>
      </div>
      <footer className="statusbar">
        <span>{project.system.gameTitle}</span>
        <span>
          {map?.name} {map ? `(${map.width}×${map.height})` : ''}
        </span>
        <span>{cursor ? `${cursor.x}, ${cursor.y}` : ''}</span>
        <span>{map && cursor ? `Region ${map.regions[cursor.y * map.width + cursor.x] || 0}` : ''}</span>
        <span className="spacer" />
        <span>{saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button className="link" onClick={() => set({ dialog: { kind: 'help' } })}>
          ? Help
        </button>
      </footer>
      {toast && <div className="toast">{toast}</div>}
      <ErrorBoundary key={dialog.kind} onReset={close}>
        {dialog.kind === 'event' && <EventEditor mapId={dialog.mapId} eventId={dialog.eventId} onClose={close} />}
        {dialog.kind === 'mapProps' && <MapPropertiesDialog mapId={dialog.mapId} onClose={close} />}
        {dialog.kind === 'database' && <DatabaseDialog tab={dialog.tab} onClose={close} />}
        {dialog.kind === 'playtest' && <Playtest fromHere={dialog.fromHere} onClose={close} />}
        {dialog.kind === 'projects' && <ProjectsDialog onClose={close} />}
        {dialog.kind === 'help' && <HelpDialog onClose={close} />}
      </ErrorBoundary>
    </div>
  );
}
