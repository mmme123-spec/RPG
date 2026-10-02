/**
 * Runtime state of the current map: tiles, passability, events, camera and
 * the interpreters that run map and common events.
 */

import type { GameMap, Tileset } from '../../core/types';
import { LAYER_COUNT, TF, dirBit, terrainTagOf } from '../../core/tiles';
import type { EngineHost } from '../host';
import { Interpreter } from '../interpreter';
import type { Character } from './character';
import { GameEvent } from './event';
import { Player } from './player';

const EMPTY_TILESET: Tileset = { id: 0, name: '', sheets: [], autotiles: [], flags: {}, note: '' };

interface CommonRunner {
  id: number;
  interpreter: Interpreter;
}

export class MapRuntime {
  readonly host: EngineHost;
  mapId = 0;
  map!: GameMap;
  tileset: Tileset = EMPTY_TILESET;
  events: GameEvent[] = [];
  private eventById = new Map<number, GameEvent>();
  readonly player: Player;
  interpreter: Interpreter;
  private commonParallel: CommonRunner[] = [];
  private lastVersion = -1;
  /** Camera position in tiles (top-left of the screen). */
  displayX = 0;
  displayY = 0;
  /** Animation tick for tiles. */
  tick = 0;
  readonly screenTilesX: number;
  readonly screenTilesY: number;

  constructor(host: EngineHost) {
    this.host = host;
    this.screenTilesX = host.data.system.screenWidth / 32;
    this.screenTilesY = host.data.system.screenHeight / 32;
    this.player = new Player(this);
    this.interpreter = new Interpreter(host, 0);
    this.interpreter.onFinish = (eventId) => this.unlockEvent(eventId);
  }

  rng = (): number => this.host.rng();

  /** Load a map. Keeps the player object; positions it separately. */
  setup(mapId: number): boolean {
    const map = this.host.data.maps.get(mapId);
    if (!map) return false;
    this.mapId = mapId;
    this.map = map;
    this.tileset = this.host.data.tilesets.get(map.tilesetId) ?? this.host.data.project.tilesets[0] ?? EMPTY_TILESET;
    // The main interpreter is not cleared: an event that transfers the player
    // keeps running on the new map (cutscenes rely on this).
    this.events = [];
    this.eventById.clear();
    for (const ev of map.events) {
      const ge = new GameEvent(this, ev);
      this.events.push(ge);
      this.eventById.set(ev.id, ge);
    }
    this.commonParallel = this.host.data.project.commonEvents
      .filter((c) => c.trigger === 'parallel')
      .map((c) => ({ id: c.id, interpreter: new Interpreter(this.host, mapId) }));
    this.lastVersion = this.host.state.version;
    this.player.makeEncounterCount();
    this.player.refreshGraphic();
    return true;
  }

  // --- geometry -------------------------------------------------------------------

  get width(): number {
    return this.map.width;
  }

  get height(): number {
    return this.map.height;
  }

  isValid(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.map.width && y < this.map.height;
  }

  tileId(x: number, y: number, layer: number): number {
    if (!this.isValid(x, y)) return 0;
    return this.map.layers[layer]?.[y * this.map.width + x] ?? 0;
  }

  regionId(x: number, y: number): number {
    if (!this.isValid(x, y)) return 0;
    return this.map.regions[y * this.map.width + x] ?? 0;
  }

  flags(tileId: number): number {
    return this.tileset.flags[tileId] ?? 0;
  }

  /** Flags of the tiles that affect passability, top layer first (overhead layer excluded). */
  private passageFlags(x: number, y: number): number[] {
    const out: number[] = [];
    for (let l = LAYER_COUNT - 2; l >= 0; l--) {
      const id = this.tileId(x, y, l);
      if (!id) continue;
      out.push(this.flags(id));
    }
    return out;
  }

  /** Can a character leave/enter tile (x, y) through its edge in direction d? */
  isPassable(x: number, y: number, d: number): boolean {
    const bit = dirBit(d);
    for (const f of this.passageFlags(x, y)) {
      if (f & TF.STAR) continue;
      return (f & bit) === 0;
    }
    return true;
  }

  private anyFlag(x: number, y: number, flag: number): boolean {
    if (!this.isValid(x, y)) return false;
    return this.passageFlags(x, y).some((f) => (f & flag) !== 0);
  }

  isLadder(x: number, y: number): boolean {
    return this.anyFlag(x, y, TF.LADDER);
  }

  isBush(x: number, y: number): boolean {
    if (!this.map) return false;
    const f = this.passageFlags(x, y).find((ff) => !(ff & TF.STAR));
    return f !== undefined && (f & TF.BUSH) !== 0;
  }

  isCounter(x: number, y: number): boolean {
    return this.anyFlag(x, y, TF.COUNTER);
  }

  isDamageFloor(x: number, y: number): boolean {
    return this.anyFlag(x, y, TF.DAMAGE);
  }

  terrainTag(x: number, y: number): number {
    for (const f of this.passageFlags(x, y)) {
      const t = terrainTagOf(f);
      if (t) return t;
    }
    return 0;
  }

  // --- characters -------------------------------------------------------------------

  event(id: number): GameEvent | undefined {
    return this.eventById.get(id);
  }

  eventsAt(x: number, y: number): GameEvent[] {
    return this.events.filter((e) => e.pos(x, y) && !e.erased);
  }

  /** -1 player, 0 the given "this" event, >0 event id. */
  character(target: number, thisEventId: number): Character | null {
    if (target < 0) return this.player;
    return this.event(target === 0 ? thisEventId : target) ?? null;
  }

  unlockEvent(eventId: number): void {
    this.event(eventId)?.unlock();
  }

  // --- camera ------------------------------------------------------------------------

  /** Visible area in tiles. */
  viewport(): { x: number; y: number; w: number; h: number } {
    return { x: Math.floor(this.displayX), y: Math.floor(this.displayY), w: this.screenTilesX, h: this.screenTilesY };
  }

  centerOn(realX: number, realY: number): void {
    const cx = (this.screenTilesX - 1) / 2;
    const cy = (this.screenTilesY - 1) / 2;
    let dx = realX - cx;
    let dy = realY - cy;
    if (this.map.width <= this.screenTilesX) dx = (this.map.width - this.screenTilesX) / 2;
    else dx = Math.max(0, Math.min(this.map.width - this.screenTilesX, dx));
    if (this.map.height <= this.screenTilesY) dy = (this.map.height - this.screenTilesY) / 2;
    else dy = Math.max(0, Math.min(this.map.height - this.screenTilesY, dy));
    this.displayX = dx;
    this.displayY = dy;
  }

  // --- events & interpreters -----------------------------------------------------

  isEventRunning(): boolean {
    return this.interpreter.isRunning() || this.events.some((e) => e.starting);
  }

  refreshIfNeeded(): void {
    if (this.host.state.version !== this.lastVersion) {
      this.lastVersion = this.host.state.version;
      for (const e of this.events) e.refresh();
    }
  }

  /** Start the next pending event in the main interpreter. */
  setupStartingEvent(): boolean {
    this.refreshIfNeeded();
    if (this.interpreter.isRunning()) return false;
    const reserved = this.host.state.reservedCommonEvents.shift();
    if (reserved !== undefined) {
      const ce = this.host.data.commonEvents.get(reserved);
      if (ce) {
        this.interpreter.setup(ce.commands, 0);
        return true;
      }
    }
    for (const e of this.events) {
      if (e.starting) {
        e.starting = false;
        if (e.page) {
          this.interpreter.setup(e.page.commands, e.eventId);
          return true;
        }
      }
    }
    for (const ce of this.host.data.project.commonEvents) {
      if (ce.trigger === 'autorun' && this.host.state.getSwitch(ce.switchId) && ce.commands.length) {
        this.interpreter.setup(ce.commands, 0);
        return true;
      }
    }
    return false;
  }

  update(active: boolean): void {
    this.refreshIfNeeded();
    if (active) {
      this.interpreter.update();
      if (!this.interpreter.isRunning()) this.setupStartingEvent();
    }
    this.player.update(active);
    for (const e of this.events) e.update();
    if (active) this.updateCommonParallel();
    this.centerOn(this.player.realX, this.player.realY);
    this.tick++;
  }

  private updateCommonParallel(): void {
    for (const r of this.commonParallel) {
      const ce = this.host.data.commonEvents.get(r.id);
      if (!ce || !this.host.state.getSwitch(ce.switchId)) continue;
      if (!r.interpreter.isRunning()) r.interpreter.setup(ce.commands, 0);
      r.interpreter.update();
    }
  }

  // --- walking ----------------------------------------------------------------------

  onPlayerStep(): void {
    const st = this.host.state;
    st.steps++;
    for (const a of st.members()) a.onStep();
    if (this.isDamageFloor(this.player.x, this.player.y)) {
      for (const a of st.members()) if (a.isAlive()) a.gainHp(-Math.min(10, a.hp));
      this.host.screen.startFlash([255, 0, 0, 128], 8);
      if (st.isAllDead()) this.host.requestGameOver();
    }
    st.touch();
  }

  /** Choose a troop for a random encounter at the given position. */
  pickEncounterTroop(x: number, y: number): number {
    const region = this.regionId(x, y);
    const list = this.map.encounters.filter((e) => e.weight > 0 && this.host.data.troops.has(e.troopId) && (e.regions.length === 0 || e.regions.includes(region)));
    const total = list.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return 0;
    let r = this.rng() * total;
    for (const e of list) {
      r -= e.weight;
      if (r < 0) return e.troopId;
    }
    return list[list.length - 1].troopId;
  }
}
