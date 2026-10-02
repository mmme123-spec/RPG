/** Project persistence in IndexedDB (falls back to memory when unavailable). */

import type { Project } from '../../core/types';

const DB_NAME = 'rpgforge';
const STORE = 'projects';

export interface ProjectMeta {
  id: string;
  title: string;
  modified: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = new Map<string, { project: Project; modified: number }>();

function openDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(null);
        try {
          const req = fn(db.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export async function saveProject(project: Project): Promise<void> {
  const rec = { id: project.id, title: project.system.gameTitle, modified: Date.now(), project };
  memory.set(project.id, { project, modified: rec.modified });
  await tx('readwrite', (s) => s.put(rec));
}

export async function loadProject(id: string): Promise<Project | null> {
  const rec = await tx<{ project: Project }>('readonly', (s) => s.get(id));
  return rec?.project ?? memory.get(id)?.project ?? null;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<{ id: string; title: string; modified: number }[]>('readonly', (s) => s.getAll());
  const list = all ? all.map(({ id, title, modified }) => ({ id, title, modified })) : [...memory.entries()].map(([id, v]) => ({ id, title: v.project.system.gameTitle, modified: v.modified }));
  return list.sort((a, b) => b.modified - a.modified);
}

export async function deleteProject(id: string): Promise<void> {
  memory.delete(id);
  await tx('readwrite', (s) => s.delete(id));
}

const LAST_KEY = 'rpgforge:lastProject';
export function getLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
export function setLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // ignore
  }
}
