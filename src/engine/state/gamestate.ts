/**
 * All persistent game progress: switches, variables, party, inventory,
 * gold and system flags. Serialised into save files.
 */

import type { AudioRef, Direction, ItemKind, PartyAbility } from '../../core/types';
import type { GameData } from '../data';
import { GameActor, type SerializedActor } from './actor';

export const MAX_ITEMS = 99;
export const MAX_GOLD = 99_999_999;
export const MAX_BATTLE_MEMBERS = 4;

export interface SaveFile {
  format: 'rpgforge-save';
  version: 1;
  savedAt: number;
  playFrames: number;
  mapName: string;
  /** For the save list: leader graphics and names. */
  party: { name: string; level: number; character: { sheet: string; index: number } }[];
  state: SerializedState;
}

export interface SerializedState {
  switches: boolean[];
  variables: number[];
  selfSwitches: Record<string, boolean>;
  gold: number;
  steps: number;
  playFrames: number;
  saveCount: number;
  battleCount: number;
  winCount: number;
  escapeCount: number;
  party: number[];
  actors: SerializedActor[];
  items: [ItemKind, number, number][];
  saveEnabled: boolean;
  menuEnabled: boolean;
  encounterEnabled: boolean;
  timer: { working: boolean; frames: number };
  mapId: number;
  x: number;
  y: number;
  direction: Direction;
  followersVisible: boolean;
  transparent: boolean;
  bgm: AudioRef | null;
  bgs: AudioRef | null;
  tone: [number, number, number, number];
  weather: { type: string; power: number };
}

export class GameState {
  readonly data: GameData;
  switches: boolean[] = [];
  variables: number[] = [];
  selfSwitches: Record<string, boolean> = {};
  gold = 0;
  steps = 0;
  playFrames = 0;
  saveCount = 0;
  battleCount = 0;
  winCount = 0;
  escapeCount = 0;
  party: number[] = [];
  actors = new Map<number, GameActor>();
  inventory: Record<ItemKind, Map<number, number>> = { item: new Map(), weapon: new Map(), armor: new Map() };
  saveEnabled = true;
  menuEnabled = true;
  encounterEnabled = true;
  timer = { working: false, frames: 0 };
  /** Incremented whenever something that event page conditions depend on changes. */
  version = 0;
  /** Index of the last choice made (for "last choice" game data). */
  lastChoice = 0;
  /** Common events queued by items/skills, run on the map when possible (not saved). */
  reservedCommonEvents: number[] = [];

  constructor(data: GameData) {
    this.data = data;
  }

  /** Initialise for a new game. */
  setupNewGame(): void {
    const sys = this.data.system;
    this.switches = [];
    this.variables = [];
    this.selfSwitches = {};
    this.gold = Math.max(0, sys.startGold);
    this.steps = 0;
    this.playFrames = 0;
    this.saveCount = 0;
    this.battleCount = 0;
    this.winCount = 0;
    this.escapeCount = 0;
    this.actors.clear();
    this.party = sys.party.filter((id) => this.data.actors.has(id));
    this.inventory = { item: new Map(), weapon: new Map(), armor: new Map() };
    this.saveEnabled = true;
    this.menuEnabled = true;
    this.encounterEnabled = true;
    this.timer = { working: false, frames: 0 };
    this.touch();
  }

  touch(): void {
    this.version++;
  }

  // --- switches & variables ------------------------------------------------------

  getSwitch(id: number): boolean {
    return !!this.switches[id];
  }

  setSwitch(id: number, value: boolean): void {
    if (id <= 0) return;
    if (!!this.switches[id] !== value) {
      this.switches[id] = value;
      this.touch();
    }
  }

  getVariable(id: number): number {
    return this.variables[id] ?? 0;
  }

  setVariable(id: number, value: number): void {
    if (id <= 0) return;
    const v = Number.isFinite(value) ? Math.trunc(value) : 0;
    const clamped = Math.max(-99_999_999, Math.min(99_999_999, v));
    if (this.getVariable(id) !== clamped) {
      this.variables[id] = clamped;
      this.touch();
    }
  }

  selfSwitchKey(mapId: number, eventId: number, letter: string): string {
    return `${mapId},${eventId},${letter}`;
  }

  getSelfSwitch(mapId: number, eventId: number, letter: string): boolean {
    return !!this.selfSwitches[this.selfSwitchKey(mapId, eventId, letter)];
  }

  setSelfSwitch(mapId: number, eventId: number, letter: string, value: boolean): void {
    const k = this.selfSwitchKey(mapId, eventId, letter);
    if (!!this.selfSwitches[k] !== value) {
      if (value) this.selfSwitches[k] = true;
      else delete this.selfSwitches[k];
      this.touch();
    }
  }

  // --- party ------------------------------------------------------------------------

  actor(id: number): GameActor | null {
    if (!this.data.actors.has(id)) return null;
    let a = this.actors.get(id);
    if (!a) {
      a = new GameActor(this.data, id);
      this.actors.set(id, a);
    }
    return a;
  }

  members(): GameActor[] {
    return this.party.map((id) => this.actor(id)).filter((a): a is GameActor => !!a);
  }

  battleMembers(): GameActor[] {
    return this.members().slice(0, MAX_BATTLE_MEMBERS);
  }

  aliveMembers(): GameActor[] {
    return this.battleMembers().filter((a) => a.isAlive());
  }

  isAllDead(): boolean {
    return this.battleMembers().every((a) => a.isDead());
  }

  leader(): GameActor | null {
    return this.members()[0] ?? null;
  }

  addActor(id: number, initialize = false): void {
    if (!this.data.actors.has(id)) return;
    if (initialize) this.actors.delete(id);
    if (!this.party.includes(id)) {
      this.party.push(id);
      this.touch();
    }
    this.actor(id);
  }

  removeActor(id: number): void {
    if (this.party.includes(id)) {
      this.party = this.party.filter((a) => a !== id);
      this.touch();
    }
  }

  highestLevel(): number {
    return Math.max(1, ...this.members().map((a) => a.level));
  }

  hasPartyAbility(ability: PartyAbility): boolean {
    return this.battleMembers().some((a) => a.isAlive() && a.hasPartyAbility(ability));
  }

  // --- gold & items ---------------------------------------------------------------

  gainGold(amount: number): void {
    const next = Math.max(0, Math.min(MAX_GOLD, this.gold + Math.round(amount)));
    if (next !== this.gold) {
      this.gold = next;
      this.touch();
    }
  }

  numItems(kind: ItemKind, id: number): number {
    return this.inventory[kind].get(id) ?? 0;
  }

  /** Count including copies equipped by party members. */
  numItemsWithEquip(kind: ItemKind, id: number): number {
    let n = this.numItems(kind, id);
    if (kind !== 'item') {
      for (const a of this.members()) {
        a.equips.forEach((eid, slot) => {
          if (eid === id && (slot === 0) === (kind === 'weapon')) n++;
        });
      }
    }
    return n;
  }

  hasItem(kind: ItemKind, id: number, includeEquip = false): boolean {
    return (includeEquip ? this.numItemsWithEquip(kind, id) : this.numItems(kind, id)) > 0;
  }

  gainItem(kind: ItemKind, id: number, amount: number, includeEquip = false): void {
    if (!this.data.item(kind, id)) return;
    const cur = this.numItems(kind, id);
    const next = Math.max(0, Math.min(MAX_ITEMS, cur + Math.round(amount)));
    if (next > 0) this.inventory[kind].set(id, next);
    else this.inventory[kind].delete(id);
    // losing more than owned can strip equipment
    let deficit = includeEquip && amount < 0 ? -(cur + Math.round(amount)) : 0;
    if (deficit > 0) {
      for (const a of this.members()) {
        for (let slot = 0; slot < a.equips.length && deficit > 0; slot++) {
          if (a.equips[slot] === id && (slot === 0) === (kind === 'weapon')) {
            a.equips[slot] = 0;
            deficit--;
          }
        }
        a.refresh();
      }
    }
    if (next !== cur || includeEquip) this.touch();
  }

  /** Equip an item from the inventory, returning the previous item to it. */
  changeEquip(actor: GameActor, slot: number, itemId: number): boolean {
    const kind: ItemKind = slot === 0 ? 'weapon' : 'armor';
    if (itemId && (!actor.canEquipId(slot, itemId) || this.numItems(kind, itemId) <= 0)) return false;
    const old = actor.equips[slot];
    if (old) this.gainItem(kind, old, 1);
    if (itemId) this.gainItem(kind, itemId, -1);
    actor.equips[slot] = itemId;
    actor.refresh();
    this.touch();
    return true;
  }

  /** Force-equip (from events): the item doesn't need to be in the inventory. */
  forceEquip(actor: GameActor, slot: number, itemId: number): void {
    const kind: ItemKind = slot === 0 ? 'weapon' : 'armor';
    if (itemId && !actor.canEquipId(slot, itemId)) return;
    if (itemId && this.numItems(kind, itemId) > 0) {
      this.changeEquip(actor, slot, itemId);
      return;
    }
    const old = actor.equips[slot];
    if (old) this.gainItem(kind, old, 1);
    actor.equips[slot] = itemId;
    actor.refresh();
    this.touch();
  }

  /** Inventory entries of a kind, sorted by id. */
  itemList(kind: ItemKind): { id: number; count: number }[] {
    return [...this.inventory[kind].entries()].sort((a, b) => a[0] - b[0]).map(([id, count]) => ({ id, count }));
  }

  // --- persistence -------------------------------------------------------------------

  serialize(extra: Pick<SerializedState, 'mapId' | 'x' | 'y' | 'direction' | 'followersVisible' | 'transparent' | 'bgm' | 'bgs' | 'tone' | 'weather'>): SerializedState {
    const items: [ItemKind, number, number][] = [];
    for (const kind of ['item', 'weapon', 'armor'] as ItemKind[]) {
      for (const [id, n] of this.inventory[kind]) items.push([kind, id, n]);
    }
    return {
      switches: [...this.switches].map((v) => !!v),
      variables: [...this.variables].map((v) => v ?? 0),
      selfSwitches: { ...this.selfSwitches },
      gold: this.gold,
      steps: this.steps,
      playFrames: this.playFrames,
      saveCount: this.saveCount,
      battleCount: this.battleCount,
      winCount: this.winCount,
      escapeCount: this.escapeCount,
      party: [...this.party],
      actors: [...this.actors.values()].map((a) => a.serialize()),
      items,
      saveEnabled: this.saveEnabled,
      menuEnabled: this.menuEnabled,
      encounterEnabled: this.encounterEnabled,
      timer: { ...this.timer },
      ...extra,
    };
  }

  load(s: SerializedState): void {
    this.switches = [...s.switches];
    this.variables = [...s.variables];
    this.selfSwitches = { ...s.selfSwitches };
    this.gold = s.gold;
    this.steps = s.steps;
    this.playFrames = s.playFrames;
    this.saveCount = s.saveCount;
    this.battleCount = s.battleCount;
    this.winCount = s.winCount;
    this.escapeCount = s.escapeCount;
    this.party = s.party.filter((id) => this.data.actors.has(id));
    this.actors.clear();
    for (const a of s.actors) {
      if (this.data.actors.has(a.actorId)) this.actors.set(a.actorId, GameActor.deserialize(this.data, a));
    }
    this.inventory = { item: new Map(), weapon: new Map(), armor: new Map() };
    for (const [kind, id, n] of s.items) if (this.data.item(kind, id)) this.inventory[kind].set(id, n);
    this.saveEnabled = s.saveEnabled;
    this.menuEnabled = s.menuEnabled;
    this.encounterEnabled = s.encounterEnabled;
    this.timer = { ...s.timer };
    this.touch();
  }
}
