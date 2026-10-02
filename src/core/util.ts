export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function findById<T extends { id: number }>(list: readonly T[], id: number): T | undefined {
  for (const item of list) if (item.id === id) return item;
  return undefined;
}

export function nextId(list: readonly { id: number }[]): number {
  let max = 0;
  for (const item of list) if (item.id > max) max = item.id;
  return max + 1;
}

export function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Pad a numeric id like RPG Maker lists do: 7 -> "0007". */
export function padId(id: number, width = 4): string {
  return String(id).padStart(width, '0');
}

export function randInt(min: number, max: number, rng: () => number = Math.random): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
