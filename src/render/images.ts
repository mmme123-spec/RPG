/**
 * Resolves image references (`builtin:<key>` / `asset:<id>`) to drawable
 * canvases or images. Built-in graphics are generated on first use and cached.
 */

import type { Asset, CharacterRef, FaceRef } from '../core/types';
import { hueRotateCanvas } from '../art/color';
import { generateBuiltin } from '../art';

export type ImageCategory = 'tiles' | 'character' | 'face' | 'enemy' | 'battleback' | 'title' | 'picture' | 'icons';

export type Drawable = HTMLCanvasElement | HTMLImageElement;

export interface FrameInfo {
  image: Drawable;
  /** Origin of the character/face block inside the image. */
  sx: number;
  sy: number;
  /** Size of one frame. */
  fw: number;
  fh: number;
}

export function parseRef(ref: string): { kind: 'builtin' | 'asset' | 'none'; key: string } {
  if (!ref) return { kind: 'none', key: '' };
  const i = ref.indexOf(':');
  if (i < 0) return { kind: 'builtin', key: ref };
  const prefix = ref.slice(0, i);
  const key = ref.slice(i + 1);
  if (prefix === 'asset') return { kind: 'asset', key };
  return { kind: 'builtin', key };
}

export class ImageLibrary {
  private assets = new Map<string, Asset>();
  private decoded = new Map<string, Drawable>();
  private loading = new Map<string, Promise<void>>();
  private builtin = new Map<string, HTMLCanvasElement | null>();
  private hued = new Map<string, HTMLCanvasElement>();
  /** Called whenever an asynchronously decoded image becomes available. */
  onLoad: (() => void) | null = null;

  constructor(assets: Asset[] = []) {
    this.setAssets(assets);
  }

  setAssets(assets: Asset[]): void {
    const next = new Map(assets.map((a) => [a.id, a]));
    for (const [id, old] of this.assets) {
      const now = next.get(id);
      if (!now || now.dataUrl !== old.dataUrl) {
        this.decoded.delete(id);
        this.loading.delete(id);
        for (const k of [...this.hued.keys()]) if (k.startsWith(`asset:${id}|`)) this.hued.delete(k);
      }
    }
    this.assets = next;
  }

  /** Decode every image asset. Resolves when all are ready (failures are ignored). */
  async preloadAssets(): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const a of this.assets.values()) {
      if (a.kind !== 'audio') jobs.push(this.loadAsset(a.id));
    }
    await Promise.all(jobs);
  }

  private loadAsset(id: string): Promise<void> {
    const existing = this.loading.get(id);
    if (existing) return existing;
    const asset = this.assets.get(id);
    if (!asset) return Promise.resolve();
    const p = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (this.assets.get(id) === asset) {
          this.decoded.set(id, img);
          this.onLoad?.();
        }
        resolve();
      };
      img.onerror = () => resolve();
      img.src = asset.dataUrl;
    });
    this.loading.set(id, p);
    return p;
  }

  getAsset(id: string): Asset | undefined {
    return this.assets.get(id);
  }

  /** Get a drawable for a reference, or null if missing / not yet decoded. */
  get(category: ImageCategory, ref: string): Drawable | null {
    const { kind, key } = parseRef(ref);
    if (kind === 'none') return null;
    if (kind === 'asset') {
      const img = this.decoded.get(key);
      if (!img) {
        if (this.assets.has(key)) void this.loadAsset(key);
        return null;
      }
      return img;
    }
    const cacheKey = `${category}:${key}`;
    if (!this.builtin.has(cacheKey)) {
      this.builtin.set(cacheKey, generateBuiltin(category, key));
    }
    return this.builtin.get(cacheKey) ?? null;
  }

  /** Enemy battler with optional hue rotation. */
  enemy(ref: string, hue: number): Drawable | null {
    const base = this.get('enemy', ref);
    if (!base || !hue) return base;
    const k = `${ref}|${hue}`;
    let c = this.hued.get(k);
    if (!c) {
      c = hueRotateCanvas(base, hue);
      this.hued.set(k, c);
    }
    return c;
  }

  /** Frame layout of a character graphic. Frames: 3 columns x 4 rows (down, left, right, up). */
  character(ref: CharacterRef): FrameInfo | null {
    const image = this.get('character', ref.sheet);
    if (!image) return null;
    const { kind, key } = parseRef(ref.sheet);
    const multi = kind === 'asset' && this.assets.get(key)?.layout === 'multi';
    if (multi) {
      const fw = image.width / 12;
      const fh = image.height / 8;
      const idx = Math.max(0, Math.min(7, ref.index));
      return { image, sx: (idx % 4) * fw * 3, sy: Math.floor(idx / 4) * fh * 4, fw, fh };
    }
    return { image, sx: 0, sy: 0, fw: image.width / 3, fh: image.height / 4 };
  }

  /** Face portrait frame. Built-in face sheets hold 4 expressions in a row. */
  face(ref: FaceRef): FrameInfo | null {
    const image = this.get('face', ref.sheet);
    if (!image) return null;
    const { kind, key } = parseRef(ref.sheet);
    if (kind === 'builtin') {
      const fw = image.width / 4;
      const idx = Math.max(0, Math.min(3, ref.index));
      return { image, sx: idx * fw, sy: 0, fw, fh: image.height };
    }
    const multi = this.assets.get(key)?.layout === 'multi';
    if (multi) {
      const fw = image.width / 4;
      const fh = image.height / 2;
      const idx = Math.max(0, Math.min(7, ref.index));
      return { image, sx: (idx % 4) * fw, sy: Math.floor(idx / 4) * fh, fw, fh };
    }
    return { image, sx: 0, sy: 0, fw: image.width, fh: image.height };
  }
}
