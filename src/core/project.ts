/** Project creation, validation and migration. */

import type { GameMap, Project } from './types';
import { applyDefaultDatabase } from './database';
import { builtinTileId, createStandardTileset } from './builtins';
import { createMap, defaultSystem } from './factory';
import { LAYER_COUNT } from './tiles';
import { randomId } from './util';

export const PROJECT_SCHEMA = 1;

export function createBlankProject(title = 'My Adventure'): Project {
  const p: Project = {
    format: 'rpgforge-project',
    schema: PROJECT_SCHEMA,
    id: randomId(),
    system: defaultSystem(),
    maps: [],
    tilesets: [createStandardTileset(1)],
    actors: [],
    classes: [],
    skills: [],
    items: [],
    weapons: [],
    armors: [],
    enemies: [],
    troops: [],
    states: [],
    commonEvents: [],
    assets: [],
  };
  p.system.gameTitle = title;
  applyDefaultDatabase(p);
  return p;
}

/** A new project with the default database and one grassy map. */
export function createEmptyProject(title = 'My Adventure'): Project {
  const p = createBlankProject(title);
  const map = createMap(1, 'MAP001', 20, 15, 1);
  map.layers[0].fill(builtinTileId('grass'));
  map.displayName = '';
  p.maps.push(map);
  p.system.startMapId = 1;
  p.system.startX = 9;
  p.system.startY = 7;
  return p;
}

function fixMap(m: GameMap, p: Project): void {
  const size = m.width * m.height;
  if (!Array.isArray(m.layers)) m.layers = [];
  while (m.layers.length < LAYER_COUNT) m.layers.push(new Array<number>(size).fill(0));
  m.layers = m.layers.slice(0, LAYER_COUNT).map((l) => (l.length === size ? l : [...l, ...new Array<number>(Math.max(0, size - l.length)).fill(0)].slice(0, size)));
  if (!Array.isArray(m.regions) || m.regions.length !== size) m.regions = new Array<number>(size).fill(0);
  m.events ??= [];
  m.encounters ??= [];
  m.encounterSteps ??= 30;
  m.bgColor ??= '#000000';
  m.displayName ??= '';
  m.note ??= '';
  m.bgm ??= null;
  m.bgs ??= null;
  m.battleback ??= 'builtin:grassland';
  m.parentId ??= 0;
  m.order ??= m.id;
  m.expanded ??= true;
  m.disableDash ??= false;
  if (!p.tilesets.some((t) => t.id === m.tilesetId)) m.tilesetId = p.tilesets[0]?.id ?? 1;
}

/**
 * Validate and upgrade a project loaded from storage or a file.
 * Throws if the data is not a project at all.
 */
export function normalizeProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') throw new Error('Not a project file');
  const p = raw as Project;
  if (p.format !== 'rpgforge-project') throw new Error('This file is not an RPG Forge project');
  if (typeof p.schema !== 'number' || p.schema > PROJECT_SCHEMA) throw new Error('This project was made with a newer version of RPG Forge');
  const sys = defaultSystem();
  p.system = { ...sys, ...p.system, terms: { ...sys.terms, ...(p.system?.terms ?? {}) }, sounds: { ...sys.sounds, ...(p.system?.sounds ?? {}) }, menu: { ...sys.menu, ...(p.system?.menu ?? {}) } };
  for (const key of ['maps', 'tilesets', 'actors', 'classes', 'skills', 'items', 'weapons', 'armors', 'enemies', 'troops', 'states', 'commonEvents', 'assets'] as const) {
    if (!Array.isArray(p[key])) (p as unknown as Record<string, unknown[]>)[key] = [];
  }
  if (p.tilesets.length === 0) p.tilesets.push(createStandardTileset(1));
  for (const m of p.maps) fixMap(m, p);
  p.id ||= randomId();
  p.schema = PROJECT_SCHEMA;
  return p;
}
