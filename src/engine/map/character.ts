/**
 * Base class for everything that moves on the map: the player, followers
 * and events. Positions are tile coordinates; realX/realY interpolate
 * smoothly between tiles.
 */

import type { BalloonType, Direction, EventGraphic, EventPriority, MoveCommand, MoveRoute } from '../../core/types';
import type { MapRuntime } from './gamemap';

export function dirX(d: number): number {
  return d === 6 ? 1 : d === 4 ? -1 : 0;
}

export function dirY(d: number): number {
  return d === 2 ? 1 : d === 8 ? -1 : 0;
}

export function reverseDir(d: number): Direction {
  return (10 - d) as Direction;
}

export class Character {
  map: MapRuntime;
  x = 0;
  y = 0;
  realX = 0;
  realY = 0;
  direction: Direction = 2;
  pattern = 1;
  originalPattern = 1;
  animCount = 0;
  stopCount = 0;
  moveSpeed = 4;
  moveFrequency = 6;
  walkAnime = true;
  stepAnime = false;
  directionFix = false;
  through = false;
  transparent = false;
  opacity = 255;
  priority: EventPriority = 'same';
  graphic: EventGraphic = { kind: 'none' };
  jumpPeak = 0;
  jumpCount = 0;
  moveRoute: MoveRoute | null = null;
  moveRouteIndex = 0;
  moveRouteForcing = false;
  private originalMoveRoute: MoveRoute | null = null;
  private originalMoveRouteIndex = 0;
  waitCount = 0;
  moveSucceed = true;
  balloon: { type: BalloonType; frame: number } | null = null;
  animationKey: string | null = null;
  animationFrame = 0;
  bushDepth = 0;

  constructor(map: MapRuntime) {
    this.map = map;
  }

  pos(x: number, y: number): boolean {
    return this.x === x && this.y === y;
  }

  setPosition(x: number, y: number): void {
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.realX = this.x;
    this.realY = this.y;
    this.refreshBushDepth();
  }

  copyPosition(c: Character): void {
    this.x = c.x;
    this.y = c.y;
    this.realX = c.realX;
    this.realY = c.realY;
    this.direction = c.direction;
  }

  isMoving(): boolean {
    return this.realX !== this.x || this.realY !== this.y;
  }

  isJumping(): boolean {
    return this.jumpCount > 0;
  }

  isStopping(): boolean {
    return !this.isMoving() && !this.isJumping();
  }

  isDashing(): boolean {
    return false;
  }

  isDebugThrough(): boolean {
    return false;
  }

  realMoveSpeed(): number {
    return this.moveSpeed + (this.isDashing() ? 1 : 0);
  }

  distancePerFrame(): number {
    return Math.pow(2, this.realMoveSpeed()) / 256;
  }

  isNormalPriority(): boolean {
    return this.priority === 'same';
  }

  setDirection(d: number): void {
    if (!this.directionFix && d) this.direction = d as Direction;
    this.stopCount = 0;
  }

  // --- update ---------------------------------------------------------------------

  update(): void {
    if (this.isStopping()) this.updateStop();
    if (this.isJumping()) this.updateJump();
    else if (this.isMoving()) this.updateMove();
    this.updateAnimation();
    if (this.balloon && ++this.balloon.frame > 72) this.balloon = null;
  }

  protected updateStop(): void {
    this.stopCount++;
    if (this.moveRouteForcing) this.updateRoutineMove();
  }

  protected updateMove(): void {
    const d = this.distancePerFrame();
    if (this.x < this.realX) this.realX = Math.max(this.realX - d, this.x);
    if (this.x > this.realX) this.realX = Math.min(this.realX + d, this.x);
    if (this.y < this.realY) this.realY = Math.max(this.realY - d, this.y);
    if (this.y > this.realY) this.realY = Math.min(this.realY + d, this.y);
    if (!this.isMoving()) this.refreshBushDepth();
  }

  protected updateJump(): void {
    this.jumpCount--;
    this.realX = (this.realX * this.jumpCount + this.x) / (this.jumpCount + 1);
    this.realY = (this.realY * this.jumpCount + this.y) / (this.jumpCount + 1);
    this.refreshBushDepth();
    if (this.jumpCount === 0) {
      this.realX = this.x;
      this.realY = this.y;
    }
  }

  jumpHeight(): number {
    return (this.jumpPeak * this.jumpPeak - Math.pow(Math.abs(this.jumpCount - this.jumpPeak), 2)) / 2;
  }

  protected updateAnimation(): void {
    if (this.isMoving() && this.walkAnime) this.animCount += 1.5;
    else if (this.stepAnime || this.pattern !== this.originalPattern) this.animCount++;
    if (this.animCount >= (9 - this.realMoveSpeed()) * 3) {
      if (!this.stepAnime && this.stopCount > 0) this.pattern = this.originalPattern;
      else this.pattern = (this.pattern + 1) % 4;
      this.animCount = 0;
    }
  }

  /** Column of the sprite sheet for the current pattern. */
  frameIndex(): number {
    return this.pattern === 3 ? 1 : this.pattern;
  }

  /** Pixels at the bottom of the sprite drawn translucent (standing in tall grass). */
  refreshBushDepth(): void {
    this.bushDepth = this.graphic.kind === 'character' && !this.isJumping() && this.map.isBush(this.x, this.y) ? 12 : 0;
  }

  // --- passability -----------------------------------------------------------------

  canPass(x: number, y: number, d: number): boolean {
    const x2 = x + dirX(d);
    const y2 = y + dirY(d);
    if (!this.map.isValid(x2, y2)) return false;
    if (this.through || this.isDebugThrough()) return true;
    if (!this.isMapPassable(x, y, d)) return false;
    if (this.isCollidedWithCharacters(x2, y2)) return false;
    return true;
  }

  canPassDiagonally(x: number, y: number, h: number, v: number): boolean {
    const x2 = x + dirX(h);
    const y2 = y + dirY(v);
    return (this.canPass(x, y, v) && this.canPass(x, y2, h)) || (this.canPass(x, y, h) && this.canPass(x2, y, v));
  }

  isMapPassable(x: number, y: number, d: number): boolean {
    const x2 = x + dirX(d);
    const y2 = y + dirY(d);
    return this.map.isPassable(x, y, d) && this.map.isPassable(x2, y2, reverseDir(d));
  }

  isCollidedWithCharacters(x: number, y: number): boolean {
    return this.isCollidedWithEvents(x, y);
  }

  isCollidedWithEvents(x: number, y: number): boolean {
    return this.map.eventsAt(x, y).some((e) => !e.through && e.isNormalPriority() && e !== (this as unknown));
  }

  // --- movement -------------------------------------------------------------------------

  moveStraight(d: number): void {
    this.moveSucceed = this.canPass(this.x, this.y, d);
    if (this.moveSucceed) {
      this.setDirection(d);
      this.x += dirX(d);
      this.y += dirY(d);
      this.increaseSteps();
    } else {
      this.setDirection(d);
      this.checkEventTriggerTouchFront(d);
    }
  }

  moveDiagonally(h: number, v: number): void {
    this.moveSucceed = this.canPassDiagonally(this.x, this.y, h, v);
    if (this.moveSucceed) {
      this.x += dirX(h);
      this.y += dirY(v);
      this.increaseSteps();
    }
    if (this.direction === reverseDir(h)) this.setDirection(h);
    if (this.direction === reverseDir(v)) this.setDirection(v);
  }

  jump(xPlus: number, yPlus: number): void {
    if (Math.abs(xPlus) > Math.abs(yPlus)) {
      if (xPlus !== 0) this.setDirection(xPlus < 0 ? 4 : 6);
    } else if (yPlus !== 0) {
      this.setDirection(yPlus < 0 ? 8 : 2);
    }
    this.x += xPlus;
    this.y += yPlus;
    const distance = Math.round(Math.sqrt(xPlus * xPlus + yPlus * yPlus));
    this.jumpPeak = 10 + distance - this.moveSpeed;
    this.jumpCount = this.jumpPeak * 2;
    this.stopCount = 0;
    this.pattern = this.originalPattern;
  }

  protected increaseSteps(): void {
    this.stopCount = 0;
    this.refreshBushDepth();
  }

  protected checkEventTriggerTouchFront(d: number): void {
    this.checkEventTriggerTouch(this.x + dirX(d), this.y + dirY(d));
  }

  protected checkEventTriggerTouch(_x: number, _y: number): void {}

  deltaXFrom(x: number): number {
    return this.x - x;
  }

  deltaYFrom(y: number): number {
    return this.y - y;
  }

  moveRandom(): void {
    const d = 2 + Math.floor(this.map.rng() * 4) * 2;
    if (this.canPass(this.x, this.y, d)) this.moveStraight(d);
  }

  moveTowardCharacter(c: Character): void {
    const sx = this.deltaXFrom(c.x);
    const sy = this.deltaYFrom(c.y);
    if (Math.abs(sx) > Math.abs(sy)) {
      this.moveStraight(sx > 0 ? 4 : 6);
      if (!this.moveSucceed && sy !== 0) this.moveStraight(sy > 0 ? 8 : 2);
    } else if (sy !== 0) {
      this.moveStraight(sy > 0 ? 8 : 2);
      if (!this.moveSucceed && sx !== 0) this.moveStraight(sx > 0 ? 4 : 6);
    }
  }

  moveAwayFromCharacter(c: Character): void {
    const sx = this.deltaXFrom(c.x);
    const sy = this.deltaYFrom(c.y);
    if (Math.abs(sx) > Math.abs(sy)) {
      this.moveStraight(sx > 0 ? 6 : 4);
      if (!this.moveSucceed && sy !== 0) this.moveStraight(sy > 0 ? 2 : 8);
    } else if (sy !== 0) {
      this.moveStraight(sy > 0 ? 2 : 8);
      if (!this.moveSucceed && sx !== 0) this.moveStraight(sx > 0 ? 6 : 4);
    }
  }

  turnTowardCharacter(c: Character): void {
    const sx = this.deltaXFrom(c.x);
    const sy = this.deltaYFrom(c.y);
    if (Math.abs(sx) > Math.abs(sy)) this.setDirection(sx > 0 ? 4 : 6);
    else if (sy !== 0) this.setDirection(sy > 0 ? 8 : 2);
  }

  turnAwayFromCharacter(c: Character): void {
    const sx = this.deltaXFrom(c.x);
    const sy = this.deltaYFrom(c.y);
    if (Math.abs(sx) > Math.abs(sy)) this.setDirection(sx > 0 ? 6 : 4);
    else if (sy !== 0) this.setDirection(sy > 0 ? 2 : 8);
  }

  moveForward(): void {
    this.moveStraight(this.direction);
  }

  moveBackward(): void {
    const fix = this.directionFix;
    this.directionFix = true;
    this.moveStraight(reverseDir(this.direction));
    this.directionFix = fix;
  }

  turnRight90(): void {
    this.setDirection(({ 2: 4, 4: 8, 6: 2, 8: 6 } as const)[this.direction]);
  }

  turnLeft90(): void {
    this.setDirection(({ 2: 6, 4: 2, 6: 8, 8: 4 } as const)[this.direction]);
  }

  turnRandom(): void {
    this.setDirection(2 + Math.floor(this.map.rng() * 4) * 2);
  }

  // --- move routes ------------------------------------------------------------------

  forceMoveRoute(route: MoveRoute): void {
    if (!this.moveRouteForcing) {
      this.originalMoveRoute = this.moveRoute;
      this.originalMoveRouteIndex = this.moveRouteIndex;
    }
    this.moveRoute = route;
    this.moveRouteIndex = 0;
    this.moveRouteForcing = true;
    this.waitCount = 0;
  }

  setMoveRoute(route: MoveRoute | null): void {
    this.moveRoute = route;
    this.moveRouteIndex = 0;
    this.moveRouteForcing = false;
  }

  protected processRouteEnd(): void {
    if (this.moveRoute?.repeat) {
      this.moveRouteIndex = -1;
    } else if (this.moveRouteForcing) {
      this.moveRouteForcing = false;
      this.moveRoute = this.originalMoveRoute;
      this.moveRouteIndex = this.originalMoveRouteIndex;
      this.originalMoveRoute = null;
    }
  }

  protected updateRoutineMove(): void {
    if (this.waitCount > 0) {
      this.waitCount--;
      return;
    }
    if (!this.moveRoute) return;
    this.moveSucceed = true;
    const cmd = this.moveRoute.commands[this.moveRouteIndex];
    if (cmd) {
      this.processMoveCommand(cmd);
      this.advanceMoveRouteIndex();
    } else {
      this.processRouteEnd();
      if (this.moveRouteIndex === -1) this.moveRouteIndex = 0;
    }
  }

  private advanceMoveRouteIndex(): void {
    if (this.moveRoute && (this.moveSucceed || this.moveRoute.skippable)) {
      const n = this.moveRoute.commands.length;
      this.moveRouteIndex++;
      if (this.moveRouteIndex >= n) {
        this.processRouteEnd();
        if (this.moveRouteIndex === -1) this.moveRouteIndex = 0;
      }
    }
  }

  processMoveCommand(cmd: MoveCommand): void {
    const player = this.map.player;
    switch (cmd.code) {
      case 'moveDown':
        return this.moveStraight(2);
      case 'moveLeft':
        return this.moveStraight(4);
      case 'moveRight':
        return this.moveStraight(6);
      case 'moveUp':
        return this.moveStraight(8);
      case 'moveLowerLeft':
        return this.moveDiagonally(4, 2);
      case 'moveLowerRight':
        return this.moveDiagonally(6, 2);
      case 'moveUpperLeft':
        return this.moveDiagonally(4, 8);
      case 'moveUpperRight':
        return this.moveDiagonally(6, 8);
      case 'moveRandom':
        return this.moveRandom();
      case 'moveToward':
        return this.moveTowardCharacter(player);
      case 'moveAway':
        return this.moveAwayFromCharacter(player);
      case 'moveForward':
        return this.moveForward();
      case 'moveBackward':
        return this.moveBackward();
      case 'jump':
        return this.jump(cmd.x, cmd.y);
      case 'wait':
        this.waitCount = Math.max(0, cmd.frames - 1);
        return;
      case 'turnDown':
        return this.setDirection(2);
      case 'turnLeft':
        return this.setDirection(4);
      case 'turnRight':
        return this.setDirection(6);
      case 'turnUp':
        return this.setDirection(8);
      case 'turn90R':
        return this.turnRight90();
      case 'turn90L':
        return this.turnLeft90();
      case 'turn180':
        return this.setDirection(reverseDir(this.direction));
      case 'turnRandom':
        return this.turnRandom();
      case 'turnToward':
        return this.turnTowardCharacter(player);
      case 'turnAway':
        return this.turnAwayFromCharacter(player);
      case 'switchOn':
        return this.map.host.state.setSwitch(cmd.id, true);
      case 'switchOff':
        return this.map.host.state.setSwitch(cmd.id, false);
      case 'speed':
        this.moveSpeed = cmd.value;
        return;
      case 'frequency':
        this.moveFrequency = cmd.value;
        return;
      case 'walkAnimeOn':
        this.walkAnime = true;
        return;
      case 'walkAnimeOff':
        this.walkAnime = false;
        return;
      case 'stepAnimeOn':
        this.stepAnime = true;
        return;
      case 'stepAnimeOff':
        this.stepAnime = false;
        return;
      case 'dirFixOn':
        this.directionFix = true;
        return;
      case 'dirFixOff':
        this.directionFix = false;
        return;
      case 'throughOn':
        this.through = true;
        return;
      case 'throughOff':
        this.through = false;
        return;
      case 'transparentOn':
        this.transparent = true;
        return;
      case 'transparentOff':
        this.transparent = false;
        return;
      case 'graphic':
        this.graphic = cmd.sheet ? { kind: 'character', sheet: cmd.sheet, index: cmd.index, direction: this.direction, pattern: 1 } : { kind: 'none' };
        return;
      case 'opacity':
        this.opacity = cmd.value;
        return;
      case 'se':
        this.map.host.audio.playSe(cmd.audio);
        return;
      case 'script':
        this.map.host.runScript(cmd.script, this);
        return;
    }
  }

  startBalloon(type: BalloonType): void {
    this.balloon = { type, frame: 0 };
  }

  isBalloonPlaying(): boolean {
    return this.balloon !== null;
  }
}
