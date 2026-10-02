/** A map event: pages, triggers and autonomous movement. */

import type { EventPage, EventTrigger, MapEvent } from '../../core/types';
import { evaluateCondition } from '../conditions';
import { Interpreter } from '../interpreter';
import { Character } from './character';
import type { MapRuntime } from './gamemap';

export class GameEvent extends Character {
  readonly eventId: number;
  readonly data: MapEvent;
  pageIndex = -1;
  page: EventPage | null = null;
  erased = false;
  starting = false;
  locked = false;
  private prelockDirection = 0;
  trigger: EventTrigger | null = null;
  interpreter: Interpreter | null = null;
  private moveType: EventPage['moveType'] = 'fixed';

  constructor(map: MapRuntime, data: MapEvent) {
    super(map);
    this.eventId = data.id;
    this.data = data;
    this.setPosition(data.x, data.y);
    this.refresh();
  }

  name(): string {
    return this.data.name;
  }

  meetsConditions(page: EventPage): boolean {
    const ctx = { host: this.map.host, mapId: this.map.mapId, eventId: this.eventId };
    return page.conditions.every((c) => evaluateCondition(c, ctx));
  }

  findProperPageIndex(): number {
    for (let i = this.data.pages.length - 1; i >= 0; i--) {
      if (this.meetsConditions(this.data.pages[i])) return i;
    }
    return -1;
  }

  refresh(): void {
    const next = this.erased ? -1 : this.findProperPageIndex();
    if (next !== this.pageIndex) {
      this.pageIndex = next;
      this.setupPage();
    }
  }

  private setupPage(): void {
    this.page = this.pageIndex >= 0 ? this.data.pages[this.pageIndex] : null;
    const p = this.page;
    if (p) {
      this.graphic = p.graphic;
      if (p.graphic.kind === 'character') {
        this.directionFix = false;
        this.setDirection(p.graphic.direction);
        this.originalPattern = p.graphic.pattern;
        this.pattern = p.graphic.pattern;
      } else {
        this.originalPattern = 1;
        this.pattern = 1;
      }
      this.moveType = p.moveType;
      this.moveSpeed = p.moveSpeed;
      this.moveFrequency = p.moveFrequency;
      this.setMoveRoute(p.moveType === 'custom' ? p.moveRoute : null);
      this.walkAnime = p.walkAnime;
      this.stepAnime = p.stepAnime;
      this.directionFix = p.directionFix;
      this.through = p.through;
      this.priority = p.priority;
      this.trigger = p.trigger;
      this.interpreter = p.trigger === 'parallel' ? new Interpreter(this.map.host, this.map.mapId) : null;
    } else {
      this.graphic = { kind: 'none' };
      this.moveType = 'fixed';
      this.setMoveRoute(null);
      this.through = true;
      this.trigger = null;
      this.interpreter = null;
      this.priority = 'below';
    }
    this.refreshBushDepth();
    this.starting = false;
    this.checkEventTriggerAuto();
  }

  hasCommands(): boolean {
    return !!this.page && this.page.commands.length > 0;
  }

  /** Request this event to run in the map interpreter. */
  start(): void {
    if (!this.page || this.erased) return;
    if (!this.hasCommands()) return;
    this.starting = true;
    if (this.trigger === 'action' || this.trigger === 'playerTouch' || this.trigger === 'eventTouch') this.lock();
  }

  lock(): void {
    if (!this.locked) {
      this.prelockDirection = this.direction;
      this.turnTowardCharacter(this.map.player);
      this.locked = true;
    }
  }

  unlock(): void {
    if (this.locked) {
      this.locked = false;
      this.setDirection(this.prelockDirection);
    }
  }

  erase(): void {
    this.erased = true;
    this.refresh();
  }

  isTriggerIn(triggers: EventTrigger[]): boolean {
    return this.trigger !== null && triggers.includes(this.trigger);
  }

  override isCollidedWithCharacters(x: number, y: number): boolean {
    return super.isCollidedWithCharacters(x, y) || this.isCollidedWithPlayer(x, y);
  }

  private isCollidedWithPlayer(x: number, y: number): boolean {
    return this.isNormalPriority() && this.map.player.isCollided(x, y);
  }

  protected override checkEventTriggerTouch(x: number, y: number): void {
    if (this.map.isEventRunning()) return;
    if (this.trigger === 'eventTouch' && this.map.player.pos(x, y) && !this.isJumping() && this.isNormalPriority()) {
      this.start();
    }
  }

  checkEventTriggerAuto(): void {
    if (this.trigger === 'autorun' && this.hasCommands()) this.start();
  }

  override update(): void {
    super.update();
    this.checkEventTriggerAuto();
    this.updateParallel();
  }

  private updateParallel(): void {
    if (!this.interpreter || !this.page) return;
    if (!this.interpreter.isRunning()) this.interpreter.setup(this.page.commands, this.eventId);
    this.interpreter.update();
  }

  protected override updateStop(): void {
    if (this.locked) this.resetStopCountIfLocked();
    super.updateStop();
    if (!this.isMoveRouteForcingOrLocked()) this.updateSelfMovement();
  }

  private resetStopCountIfLocked(): void {
    this.stopCount = 0;
  }

  private isMoveRouteForcingOrLocked(): boolean {
    return this.moveRouteForcing || this.locked;
  }

  private stopThreshold(): number {
    return 30 * (5 - this.moveFrequency);
  }

  private updateSelfMovement(): void {
    if (this.stopCount <= this.stopThreshold() || !this.isNearScreen()) return;
    switch (this.moveType) {
      case 'random':
        this.moveTypeRandom();
        break;
      case 'approach':
        this.moveTypeApproach();
        break;
      case 'custom':
        this.updateRoutineMove();
        break;
      default:
        break;
    }
  }

  private isNearScreen(): boolean {
    const v = this.map.viewport();
    return this.x >= v.x - 2 && this.x <= v.x + v.w + 2 && this.y >= v.y - 2 && this.y <= v.y + v.h + 2;
  }

  private moveTypeRandom(): void {
    switch (Math.floor(this.map.rng() * 6)) {
      case 0:
      case 1:
        this.moveRandom();
        break;
      case 2:
      case 3:
      case 4:
        this.moveForward();
        break;
      default:
        this.stopCount = 0;
        break;
    }
  }

  private moveTypeApproach(): void {
    const p = this.map.player;
    const near = Math.abs(this.x - p.x) + Math.abs(this.y - p.y) < 20;
    if (!near) {
      this.moveRandom();
      return;
    }
    switch (Math.floor(this.map.rng() * 6)) {
      case 0:
      case 1:
      case 2:
      case 3:
        this.moveTowardCharacter(p);
        break;
      case 4:
        this.moveRandom();
        break;
      default:
        this.moveForward();
        break;
    }
  }
}
