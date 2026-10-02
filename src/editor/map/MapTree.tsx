/** Map list (tree) and the map properties dialog. */

import { useState } from 'react';
import type { GameMap } from '../../core/types';
import { createMap, resizeMapData } from '../../core/factory';
import { builtinTileId, BUILTIN_BATTLEBACKS } from '../../core/builtins';
import { nextId } from '../../core/util';
import { AudioPicker, Check, Field, IdSelect, Modal, NumberInput, Row, Select, TextInput } from '../components/fields';
import { useEditor } from '../store/store';

export function MapTree() {
  const project = useEditor((s) => s.project)!;
  const mapId = useEditor((s) => s.mapId);
  const [menu, setMenu] = useState<{ id: number; x: number; y: number } | null>(null);
  const update = useEditor((s) => s.update);

  const children = (parent: number) => project.maps.filter((m) => m.parentId === parent).sort((a, b) => a.order - b.order);

  const addMap = (parentId: number) => {
    const id = nextId(project.maps);
    update('New map', (p) => {
      const m = createMap(id, `MAP${String(id).padStart(3, '0')}`, 20, 15, p.tilesets[0]?.id ?? 1);
      m.parentId = parentId;
      m.layers[0].fill(builtinTileId('grass'));
      p.maps.push(m);
    });
    useEditor.getState().set({ mapId: id, dialog: { kind: 'mapProps', mapId: id } });
  };

  const copyMap = (id: number) => {
    const src = project.maps.find((m) => m.id === id);
    if (!src) return;
    const nid = nextId(project.maps);
    update('Copy map', (p) => {
      p.maps.push({ ...structuredClone(src), id: nid, name: `${src.name} (copy)`, order: nid });
    });
  };

  const deleteMap = (id: number) => {
    if (project.maps.length <= 1) return useEditor.getState().notify('A project needs at least one map.');
    const m = project.maps.find((x) => x.id === id);
    if (!m || !window.confirm(`Delete map "${m.name}"? Child maps move up a level.`)) return;
    update('Delete map', (p) => {
      p.maps = p.maps.filter((x) => x.id !== id);
      for (const c of p.maps) if (c.parentId === id) c.parentId = m.parentId;
    });
    if (mapId === id) useEditor.getState().set({ mapId: project.maps.find((x) => x.id !== id)!.id });
  };

  const node = (m: GameMap, depth: number) => (
    <div key={m.id}>
      <div
        className={`tree-item${m.id === mapId ? ' sel' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => useEditor.getState().set({ mapId: m.id, selectedEvent: null })}
        onDoubleClick={() => useEditor.getState().set({ dialog: { kind: 'mapProps', mapId: m.id } })}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu({ id: m.id, x: e.clientX, y: e.clientY });
        }}
      >
        <span className="tree-icon">{project.system.startMapId === m.id ? '★' : '▦'}</span> {m.name}
        <button
          className="tree-more"
          title="Map actions"
          onClick={(e) => {
            e.stopPropagation();
            setMenu({ id: m.id, x: e.clientX, y: e.clientY });
          }}
        >
          ⋯
        </button>
      </div>
      {children(m.id).map((c) => node(c, depth + 1))}
    </div>
  );

  return (
    <div className="map-tree">
      <div className="panel-title">
        Maps
        <button title="New map" onClick={() => addMap(0)}>
          ＋
        </button>
      </div>
      <div className="tree-scroll">{children(0).map((m) => node(m, 0))}</div>
      {menu && (
        <div className="context-back" onClick={() => setMenu(null)}>
          <div className="context-menu" style={{ left: menu.x, top: menu.y }}>
            <button onClick={() => useEditor.getState().set({ dialog: { kind: 'mapProps', mapId: menu.id } })}>Properties…</button>
            <button onClick={() => addMap(menu.id)}>New child map</button>
            <button onClick={() => copyMap(menu.id)}>Duplicate</button>
            <button onClick={() => update('Set start', (p) => void (p.system.startMapId = menu.id))}>Set as start map</button>
            <button className="danger" onClick={() => deleteMap(menu.id)}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MapPropertiesDialog({ mapId, onClose }: { mapId: number; onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const map = project.maps.find((m) => m.id === mapId);
  const update = useEditor((s) => s.update);
  const [size, setSize] = useState({ w: map?.width ?? 20, h: map?.height ?? 15 });
  if (!map) return null;
  const set = (fn: (m: GameMap) => void) =>
    update(
      'Map properties',
      (p) => {
        const m = p.maps.find((x) => x.id === mapId);
        if (m) fn(m);
      },
      true,
    );
  return (
    <Modal title={`Map Properties — ${map.name}`} onClose={onClose}>
      <div className="form-grid">
        <Field label="Name">
          <TextInput value={map.name} onChange={(v) => set((m) => (m.name = v))} />
        </Field>
        <Field label="Display name (shown in game)">
          <TextInput value={map.displayName} onChange={(v) => set((m) => (m.displayName = v))} />
        </Field>
        <Field label="Tileset">
          <IdSelect value={map.tilesetId} list={project.tilesets} onChange={(v) => set((m) => (m.tilesetId = v))} />
        </Field>
        <Field label="Size (width × height)">
          <Row>
            <NumberInput value={size.w} min={1} max={256} onChange={(w) => setSize((s) => ({ ...s, w }))} />
            <NumberInput value={size.h} min={1} max={256} onChange={(h) => setSize((s) => ({ ...s, h }))} />
            <button disabled={size.w === map.width && size.h === map.height} onClick={() => set((m) => resizeMapData(m, size.w, size.h))}>
              Resize
            </button>
          </Row>
        </Field>
        <Field label="Background music">
          <AudioPicker kind="bgm" value={map.bgm} onChange={(v) => set((m) => (m.bgm = v))} />
        </Field>
        <Field label="Background sound">
          <AudioPicker kind="bgs" value={map.bgs} onChange={(v) => set((m) => (m.bgs = v))} />
        </Field>
        <Field label="Battle background">
          <Select value={map.battleback} options={[...BUILTIN_BATTLEBACKS.map((b): [string, string] => [`builtin:${b.key}`, b.label]), ...project.assets.filter((a) => a.kind === 'battleback').map((a): [string, string] => [`asset:${a.id}`, a.name])]} onChange={(v) => set((m) => (m.battleback = v))} />
        </Field>
        <Field label="Background colour">
          <input type="color" value={map.bgColor} onChange={(e) => set((m) => (m.bgColor = e.target.value))} />
        </Field>
        <Check label="Disable dashing" value={map.disableDash} onChange={(v) => set((m) => (m.disableDash = v))} />
      </div>
      <h3>Random encounters</h3>
      <div className="encounters">
        <Field label="Average steps between encounters">
          <NumberInput value={map.encounterSteps} min={1} max={999} onChange={(v) => set((m) => (m.encounterSteps = v))} />
        </Field>
        {map.encounters.map((e, i) => (
          <Row key={i}>
            <IdSelect value={e.troopId} list={project.troops} onChange={(v) => set((m) => (m.encounters[i].troopId = v))} />
            <label className="mini">
              weight <NumberInput value={e.weight} min={1} max={100} onChange={(v) => set((m) => (m.encounters[i].weight = v))} />
            </label>
            <label className="mini">
              regions
              <TextInput value={e.regions.join(',')} placeholder="any" onChange={(v) => set((m) => (m.encounters[i].regions = v.split(',').map(Number).filter((n) => n > 0)))} />
            </label>
            <button onClick={() => set((m) => m.encounters.splice(i, 1))}>✕</button>
          </Row>
        ))}
        <button onClick={() => set((m) => m.encounters.push({ troopId: project.troops[0]?.id ?? 1, weight: 10, regions: [] }))}>＋ Add encounter</button>
      </div>
      <Field label="Note" wide>
        <TextInput value={map.note} onChange={(v) => set((m) => (m.note = v))} />
      </Field>
    </Modal>
  );
}
