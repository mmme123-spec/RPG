/**
 * Read-only, indexed view of a Project for fast lookups at runtime.
 */

import type {
  Actor,
  ActorClass,
  Armor,
  CommonEvent,
  Enemy,
  GameMap,
  Item,
  ItemKind,
  Project,
  Skill,
  State,
  SystemSettings,
  Tileset,
  Troop,
  Weapon,
} from '../core/types';

function index<T extends { id: number }>(list: T[]): Map<number, T> {
  return new Map(list.map((e) => [e.id, e]));
}

export type AnyItem = Item | Weapon | Armor;

export class GameData {
  readonly project: Project;
  readonly system: SystemSettings;
  readonly actors: Map<number, Actor>;
  readonly classes: Map<number, ActorClass>;
  readonly skills: Map<number, Skill>;
  readonly items: Map<number, Item>;
  readonly weapons: Map<number, Weapon>;
  readonly armors: Map<number, Armor>;
  readonly enemies: Map<number, Enemy>;
  readonly troops: Map<number, Troop>;
  readonly states: Map<number, State>;
  readonly commonEvents: Map<number, CommonEvent>;
  readonly tilesets: Map<number, Tileset>;
  readonly maps: Map<number, GameMap>;

  constructor(project: Project) {
    this.project = project;
    this.system = project.system;
    this.actors = index(project.actors);
    this.classes = index(project.classes);
    this.skills = index(project.skills);
    this.items = index(project.items);
    this.weapons = index(project.weapons);
    this.armors = index(project.armors);
    this.enemies = index(project.enemies);
    this.troops = index(project.troops);
    this.states = index(project.states);
    this.commonEvents = index(project.commonEvents);
    this.tilesets = index(project.tilesets);
    this.maps = index(project.maps);
  }

  item(kind: ItemKind, id: number): AnyItem | undefined {
    if (kind === 'item') return this.items.get(id);
    if (kind === 'weapon') return this.weapons.get(id);
    return this.armors.get(id);
  }

  term(key: keyof SystemSettings['terms']): string {
    const v = this.system.terms[key];
    return typeof v === 'string' ? v : '';
  }

  elementName(id: number): string {
    return this.system.elements[id - 1] ?? '';
  }

  /** Display name of a map (falls back to the editor name). */
  mapDisplayName(id: number): string {
    const m = this.maps.get(id);
    return m ? m.displayName || m.name : '';
  }
}

export function isWeapon(item: AnyItem): item is Weapon {
  return 'wtypeId' in item;
}

export function isArmor(item: AnyItem): item is Armor {
  return 'atypeId' in item;
}

export function isUsable(item: AnyItem): item is Item {
  return 'itype' in item;
}
