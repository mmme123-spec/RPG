/** Project manager: create, open, import, export and delete projects. */

import { useEffect, useState } from 'react';
import { createEmptyProject, normalizeProject } from '../core/project';
import { createSampleProject } from '../core/sample';
import { randomId } from '../core/util';
import { Modal } from './components/fields';
import { exportGame, exportProject } from './exporter';
import { deleteProject, listProjects, loadProject, saveProject, setLastProjectId, type ProjectMeta } from './store/storage';
import { useEditor } from './store/store';
import type { Project } from '../core/types';

export async function openProject(p: Project): Promise<void> {
  await saveProject(p);
  setLastProjectId(p.id);
  useEditor.getState().setProject(p);
}

export function ProjectsDialog({ onClose }: { onClose: () => void }) {
  const current = useEditor((s) => s.project);
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [title, setTitle] = useState('My Adventure');
  const refresh = () => listProjects().then(setList);
  useEffect(() => void refresh(), []);

  const importFile = (file: File | undefined) => {
    if (!file) return;
    file.text().then(
      async (text) => {
        try {
          const p = normalizeProject(JSON.parse(text));
          if (list.some((m) => m.id === p.id) && !window.confirm('A project with the same id exists. Import as a copy?')) return;
          if (list.some((m) => m.id === p.id)) p.id = randomId();
          await openProject(p);
          onClose();
        } catch (e) {
          window.alert(`Could not import: ${(e as Error).message}`);
        }
      },
      () => window.alert('Could not read the file.'),
    );
  };

  return (
    <Modal title="Projects" onClose={onClose} wide>
      <div className="projects">
        <section>
          <h3>New project</h3>
          <div className="row">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Game title" />
            <button className="primary" onClick={() => openProject(createEmptyProject(title || 'My Adventure')).then(onClose)}>
              Create empty
            </button>
            <button onClick={() => openProject(createSampleProject()).then(onClose)}>Create sample game</button>
          </div>
          <p className="hint">Every new project comes with a full default database (heroes, classes, skills, items, monsters).</p>
          <h3>Import</h3>
          <label className="button">
            Open .json project file…
            <input type="file" hidden accept=".json,application/json" onChange={(e) => importFile(e.target.files?.[0])} />
          </label>
          {current && (
            <>
              <h3>Current project</h3>
              <div className="row">
                <button onClick={() => exportProject(current)}>Download project (.json)</button>
                <button onClick={() => exportGame(current)}>Export playable game (.html)</button>
              </div>
            </>
          )}
        </section>
        <section>
          <h3>Saved in this browser</h3>
          <div className="project-list">
            {list.length === 0 && <p className="hint">No projects yet.</p>}
            {list.map((m) => (
              <div key={m.id} className={`project-item${m.id === current?.id ? ' sel' : ''}`}>
                <div>
                  <b>{m.title || 'Untitled'}</b>
                  <div className="hint">Last saved {new Date(m.modified).toLocaleString()}</div>
                </div>
                <button
                  onClick={async () => {
                    const p = await loadProject(m.id);
                    if (p) {
                      await openProject(normalizeProject(p));
                      onClose();
                    }
                  }}
                >
                  Open
                </button>
                <button
                  className="danger"
                  disabled={m.id === current?.id}
                  onClick={async () => {
                    if (!window.confirm(`Delete "${m.title}" permanently?`)) return;
                    await deleteProject(m.id);
                    refresh();
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Quick guide" onClose={onClose}>
      <div className="help">
        <h3>Building maps</h3>
        <ul>
          <li>Pick a layer (1–4) in the toolbar, choose tiles in the palette and paint. Drag in the palette to select several tiles.</li>
          <li>Layer 1 is the ground; layers 2–3 hold decorations; layer 4 is drawn above characters.</li>
          <li>Tools: Pencil (P), Rectangle (R), Fill (F), Eraser (E), Picker (I or right-click).</li>
          <li>Middle mouse button or Space+drag pans the map. Ctrl+wheel zooms.</li>
        </ul>
        <h3>Events</h3>
        <ul>
          <li>Switch to Events (layer key 5) and double-click a tile to create an event: NPCs, doors, chests, cut-scenes…</li>
          <li>Each event has pages. The last page whose conditions are met is active.</li>
          <li>Right-click a tile in event mode for quick events (door/transfer, treasure chest, set start position).</li>
        </ul>
        <h3>Database</h3>
        <p>Actors, classes, skills, items, equipment, enemies, troops, states, common events, tilesets and system settings. Import your own graphics and audio in Database → Assets.</p>
        <h3>Testing & exporting</h3>
        <p>Press F5 or ▶ Play to test. Shift+F5 starts on the selected tile. File → Export creates a single HTML file anyone can play in a browser.</p>
        <h3>Shortcuts</h3>
        <p>Ctrl+Z / Ctrl+Y undo/redo · Ctrl+S save · Ctrl+D database · G toggle grid · 1–6 select layer · +/- zoom</p>
      </div>
    </Modal>
  );
}
