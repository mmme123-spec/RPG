/** Save slots stored in localStorage (guarded: storage may be unavailable). */

import type { SaveFile } from './state/gamestate';

export const SAVE_SLOTS = 12;

export class SaveStore {
  private ns: string;
  /** In-memory fallback when localStorage is unavailable. */
  private memory = new Map<string, string>();

  constructor(namespace: string) {
    this.ns = namespace;
  }

  private key(slot: number): string {
    return `rpgforge:${this.ns}:slot${slot}`;
  }

  private read(key: string): string | null {
    try {
      const v = window.localStorage.getItem(key);
      if (v !== null) return v;
    } catch {
      // storage unavailable
    }
    return this.memory.get(key) ?? null;
  }

  private write(key: string, value: string): boolean {
    this.memory.set(key, value);
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return true; // kept in memory for this session
    }
  }

  load(slot: number): SaveFile | null {
    const raw = this.read(this.key(slot));
    if (!raw) return null;
    try {
      const f = JSON.parse(raw) as SaveFile;
      return f.format === 'rpgforge-save' ? f : null;
    } catch {
      return null;
    }
  }

  save(slot: number, file: SaveFile): boolean {
    return this.write(this.key(slot), JSON.stringify(file));
  }

  list(): (SaveFile | null)[] {
    const out: (SaveFile | null)[] = [];
    for (let i = 1; i <= SAVE_SLOTS; i++) out.push(this.load(i));
    return out;
  }

  hasAny(): boolean {
    return this.list().some((f) => f !== null);
  }

  /** Slot number (1-based) of the most recent save, or 1. */
  latestSlot(): number {
    let best = 1;
    let bestTime = -1;
    this.list().forEach((f, i) => {
      if (f && f.savedAt > bestTime) {
        bestTime = f.savedAt;
        best = i + 1;
      }
    });
    return best;
  }
}
