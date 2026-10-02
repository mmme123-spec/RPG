import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { normalizeProject } from '../core/project';
import { createSampleProject } from '../core/sample';
import { getLastProjectId, listProjects, loadProject } from './store/storage';
import { openProject } from './Projects';
import { useEditor } from './store/store';
import './styles.css';

async function boot() {
  const last = getLastProjectId();
  let id = last;
  if (!id) id = (await listProjects())[0]?.id ?? null;
  const raw = id ? await loadProject(id) : null;
  if (raw) {
    try {
      useEditor.getState().setProject(normalizeProject(raw));
      return;
    } catch (e) {
      console.error('Could not load the last project', e);
    }
  }
  await openProject(createSampleProject());
  useEditor.getState().set({ dialog: { kind: 'help' } });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
void boot();
