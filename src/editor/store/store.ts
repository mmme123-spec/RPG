/**
 * Editor state (zustand). Project edits go through `update()`, which records
 * Immer patches so every change can be undone/redone.
 */

import { create } from 'zustand';
import { applyPatches, enablePatches, produceWithPatches, setAutoFreeze, type Patch } from 'immer';
import type { Project } from '../../core/types';

enablePatches();
setAutoFreeze(false);

export type Tool = 'pencil' | 'rect' | 'fill' | 'eraser' | 'picker';
/** 0-3 tile layers, 'events', 'regions' */
export type EditLayer = 0 | 1 | 2 | 3 | 'events' | 'regions';

interface UndoEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  time: number;
}

export interface Brush {
  tiles: number[][];
}

export type Dialog =
  | { kind: 'none' }
  | { kind: 'database'; tab?: string }
  | { kind: 'event'; mapId: number; eventId: number }
  | { kind: 'mapProps'; mapId: number }
  | { kind: 'playtest'; fromHere?: { mapId: number; x: number; y: number } }
  | { kind: 'projects' }
  | { kind: 'help' };

export interface EditorState {
  project: Project | null;
  dirty: boolean;
  mapId: number;
  layer: EditLayer;
  tool: Tool;
  brush: Brush;
  region: number;
  zoom: number;
  showGrid: boolean;
  dimLayers: boolean;
  selectedEvent: number | null;
  cursor: { x: number; y: number } | null;
  dialog: Dialog;
  undo: UndoEntry[];
  redo: UndoEntry[];
  toast: string | null;
  setProject(p: Project): void;
  update(label: string, recipe: (draft: Project) => void, coalesce?: boolean): void;
  undoAction(): void;
  redoAction(): void;
  set(partial: Partial<EditorState>): void;
  notify(msg: string): void;
}

export const useEditor = create<EditorState>((set, get) => ({
  project: null,
  dirty: false,
  mapId: 0,
  layer: 0,
  tool: 'pencil',
  brush: { tiles: [[0]] },
  region: 1,
  zoom: 1,
  showGrid: true,
  dimLayers: true,
  selectedEvent: null,
  cursor: null,
  dialog: { kind: 'none' },
  undo: [],
  redo: [],
  toast: null,
  setProject(p) {
    set({ project: p, mapId: p.maps[0]?.id ?? 0, undo: [], redo: [], dirty: false, selectedEvent: null, dialog: { kind: 'none' } });
  },
  update(label, recipe, coalesce = false) {
    const p = get().project;
    if (!p) return;
    const [next, patches, inverse] = produceWithPatches(p, recipe);
    if (patches.length === 0) return;
    const undo = [...get().undo];
    const last = undo[undo.length - 1];
    const now = Date.now();
    if (coalesce && last && last.label === label && now - last.time < 1200) {
      undo[undo.length - 1] = { label, patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], time: now };
    } else {
      undo.push({ label, patches, inverse, time: now });
      if (undo.length > 200) undo.shift();
    }
    set({ project: next, undo, redo: [], dirty: true });
  },
  undoAction() {
    const { undo, project } = get();
    const e = undo[undo.length - 1];
    if (!e || !project) return;
    set({ project: applyPatches(project, e.inverse), undo: undo.slice(0, -1), redo: [...get().redo, e], dirty: true });
    get().notify(`Undo: ${e.label}`);
  },
  redoAction() {
    const { redo, project } = get();
    const e = redo[redo.length - 1];
    if (!e || !project) return;
    set({ project: applyPatches(project, e.patches), redo: redo.slice(0, -1), undo: [...get().undo, e], dirty: true });
    get().notify(`Redo: ${e.label}`);
  },
  set(partial) {
    set(partial);
  },
  notify(msg) {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2200);
  },
}));

export function currentMap(s: EditorState) {
  return s.project?.maps.find((m) => m.id === s.mapId) ?? null;
}
