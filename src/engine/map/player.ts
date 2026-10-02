/** The player character and party followers. */

import type { Direction } from '../../core/types';
import { Character, dirX, dirY } from './character';
import type { GameEvent } from './event';
import type { MapRuntime } from './gamemap';

export class Follower extends Character {
  readonly memberIndex: number;

  constructor(map: MapRuntime, memberIndex: number) {
    super(map);
    this.memberIndex = memberIndex;
    this.through = true;
    this.transparent = false;
  }

  actorId(): number | null {
    return this.map.host.state.party[this.memberIndex] ?? null;
  }

  isVisible(): boolean {
    return this.actorId() !== null && this.map.player.followersVisible && !this.map.player.transparent;
  }

  refreshGraphic(): void {
    const id = this.actorId();
    const actor = id !== null ? this.map.host.state.actor(id) : null;
    this.graphic = actor ? { kind: 'character', sheet: actor.character.sheet, index: actor.character.index, direction: this.direction, pattern: 1 } : { kind: 'none' };
  }

  override update(): void {
    const p = this.map.player;
    this.moveSpeed = p.realMoveSpeed();
    this.opacity = p.opacity;
    this.stepAnime = p.stepAnime;
    super.update();
  }

  override isDashing(): boolean {
    return false;
  }

  chase(target: Character): void {
    const sx = this.deltaXFrom(target.x);
    const sy = this.deltaYFrom(target.y);
    if (sx !== 0 && sy !== 0) this.moveDiagonally(sx > 0 ? 4 : 6, sy > 0 ? 8 : 2);
    else if (sx !== 0) this.moveStraight(sx > 0 ? 4 : 6);
    else if (sy !== 0) this.moveStraight(sy > 0 ? 8 : 2);
  }
}

export class Player extends Character {
  followers: Follower[] = [];
  followersVisible = true;
  encounterCount = 0;
  private dashing = false;
  /** Debug: walk through walls (hold Ctrl while play-testing). */
  debugThrough = false;

  constructor(map: MapRuntime) {
    super(map);
    this.moveSpeed = 4;
    for (let i = 1; i < 4; i++) this.followers.push(new Follower(map, i));
  }

  refreshGraphic(): void {
    const leader = this.map.host.state.leader();
    this.graphic = leader
      ? { kind: 'character', sheet: leader.character.sheet, index: leader.character.index, direction: this.direction, pattern: 1 }
      : { kind: 'none' };
    for (const f of this.followers) f.refreshGraphic();
  }

  override isDashing(): boolean {
    return this.dashing;
  }

  override isDebugThrough(): boolean {
    return this.debugThrough && this.map.host.isTest;
  }

  /** True if (x, y) is occupied by the player or a visible follower. */
  isCollided(x: number, y: number): boolean {
    if (this.through) return false;
    return this.pos(x, y) || this.followers.some((f) => f.isVisible() && f.pos(x, y));
  }

  override isCollidedWithCharacters(x: number, y: number): boolean {
    return this.isCollidedWithEvents(x, y);
  }

  canMove(): boolean {
    const h = this.map.host;
    if (this.map.isEventRunning() || h.message.isBusy() || h.isSceneBusy() || h.isTransferring()) return false;
    if (this.moveRouteForcing) return false;
    return true;
  }

  /** Teleport, including followers. */
  locate(x: number, y: number): void {
    this.setPosition(x, y);
    for (const f of this.followers) {
      f.setPosition(x, y);
      f.direction = this.direction;
    }
  }

  setupFollowerDirections(): void {
    for (const f of this.followers) f.direction = this.direction;
  }

  makeEncounterCount(): void {
    const n = Math.max(1, this.map.map.encounterSteps);
    const r = this.map.rng;
    this.encounterCount = Math.floor(r() * n) + Math.floor(r() * n) + 1;
  }

  override update(active = true): void {
    const wasMoving = this.isMoving();
    const input = this.map.host.input;
    this.debugThrough = false;
    if (active && !this.isMoving() && this.canMove()) {
      const d = input.dir4();
      this.updateDashing(d);
      if (d) this.executeMove(d);
    }
    super.update();
    for (const f of this.followers) f.update();
    if (active) this.updateNonmoving(wasMoving);
  }

  private updateDashing(d: number): void {
    if (this.moveRouteForcing) return;
    const sys = this.map.host.data.system;
    const allowed = !this.map.map.disableDash;
    const shift = this.map.host.input.isPressed('shift');
    this.dashing = !!d && allowed && (sys.alwaysDash ? !shift : shift);
  }

  private executeMove(d: number): void {
    // followers chase the positions of the characters ahead before the player steps
    if (this.canPass(this.x, this.y, d)) this.moveFollowers();
    this.moveStraight(d);
  }

  private moveFollowers(): void {
    for (let i = this.followers.length - 1; i >= 0; i--) {
      this.followers[i].chase(i === 0 ? this : this.followers[i - 1]);
    }
  }

  protected override increaseSteps(): void {
    super.increaseSteps();
    if (this.moveRouteForcing) return;
    this.map.onPlayerStep();
  }

  private updateNonmoving(wasMoving: boolean): void {
    if (this.map.isEventRunning()) return;
    if (wasMoving && !this.isMoving()) {
      this.checkEventTriggerHere(['playerTouch', 'eventTouch']);
      if (this.map.setupStartingEvent()) return;
      if (this.updateEncounter()) return;
    }
    if (this.isMoving()) return;
    if (this.triggerAction()) return;
    if (this.map.host.input.isTriggered('cancel') || this.map.host.input.isTriggered('menu')) {
      if (this.canMove() && this.map.host.state.menuEnabled) this.map.host.requestMenu();
    }
  }

  private updateEncounter(): boolean {
    const m = this.map;
    const st = m.host.state;
    if (!st.encounterEnabled || m.map.encounters.length === 0 || this.moveRouteForcing || m.host.isTest && this.debugThrough) return false;
    if (st.hasPartyAbility('encounterNone')) return false;
    let progress = m.isBush(this.x, this.y) ? 2 : 1;
    if (st.hasPartyAbility('encounterHalf')) progress *= 0.5;
    this.encounterCount -= progress;
    if (this.encounterCount > 0) return false;
    this.makeEncounterCount();
    const troopId = m.pickEncounterTroop(this.x, this.y);
    if (!troopId) return false;
    m.host.requestBattle(troopId, true, false, () => {});
    return true;
  }

  private triggerAction(): boolean {
    if (!this.map.host.input.isTriggered('ok') || !this.canMove()) return false;
    if (this.checkEventTriggerHere(['action'])) return true;
    return this.checkEventTriggerThere(['action', 'playerTouch', 'eventTouch']);
  }

  private startEvents(events: GameEvent[]): boolean {
    let started = false;
    for (const e of events) {
      if (!e.hasCommands()) continue;
      e.start();
      started = true;
    }
    return started && this.map.setupStartingEvent();
  }

  /** Events on the player's own tile (below/above priority). */
  checkEventTriggerHere(triggers: string[]): boolean {
    if (!this.canStartEvents()) return false;
    const events = this.map.eventsAt(this.x, this.y).filter((e) => e.isTriggerIn(triggers as never) && !e.isNormalPriority());
    return this.startEvents(events);
  }

  /** Events in front of the player (same priority), also across counters. */
  checkEventTriggerThere(triggers: string[]): boolean {
    if (!this.canStartEvents()) return false;
    const d = this.direction;
    let x2 = this.x + dirX(d);
    let y2 = this.y + dirY(d);
    let events = this.map.eventsAt(x2, y2).filter((e) => e.isTriggerIn(triggers as never) && e.isNormalPriority());
    if (events.length === 0 && this.map.isCounter(x2, y2)) {
      x2 += dirX(d);
      y2 += dirY(d);
      events = this.map.eventsAt(x2, y2).filter((e) => e.isTriggerIn(triggers as never) && e.isNormalPriority());
    }
    return this.startEvents(events);
  }

  protected override checkEventTriggerTouch(x: number, y: number): void {
    if (!this.canStartEvents()) return;
    const events = this.map.eventsAt(x, y).filter((e) => e.isTriggerIn(['playerTouch', 'eventTouch']) && e.isNormalPriority());
    this.startEvents(events);
  }

  private canStartEvents(): boolean {
    return !this.map.isEventRunning() && !this.map.host.isTransferring();
  }

  /** Direction the player faces after a transfer (0 = keep). */
  applyTransferDirection(d: Direction | 0): void {
    if (d) {
      const fix = this.directionFix;
      this.directionFix = false;
      this.setDirection(d);
      this.directionFix = fix;
    }
    this.setupFollowerDirections();
  }
}
