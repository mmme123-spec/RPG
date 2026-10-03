/**
 * The services that map/interpreter logic needs from the running game.
 * Kept as an interface so logic can be unit-tested with a fake host.
 */

import type { AudioRef, BalloonType, Direction, ShopGood } from '../core/types';
import type { GameData } from './data';
import type { GameState } from './state/gamestate';
import type { MapRuntime } from './map/gamemap';
import type { Character } from './map/character';
import type { MessageState } from './message';
import type { ScreenState } from './screen';

export type InputButtonName = 'up' | 'down' | 'left' | 'right' | 'ok' | 'cancel' | 'menu' | 'shift' | 'pageup' | 'pagedown' | 'debug';

export interface InputLike {
  isPressed(b: InputButtonName): boolean;
  isTriggered(b: InputButtonName): boolean;
  isRepeated(b: InputButtonName): boolean;
  dir4(): 0 | Direction;
}

export interface AudioLike {
  playSe(a: AudioRef | null | undefined): void;
  playBgm(a: AudioRef | null): void;
  playBgs(a: AudioRef | null): void;
  playMe(a: AudioRef | null): void;
  fadeOutBgm(seconds: number): void;
  stopAll(): void;
  currentBgm(): AudioRef | null;
  currentBgs(): AudioRef | null;
}

export type BattleResult = 'win' | 'escape' | 'lose';

export interface EngineHost {
  data: GameData;
  state: GameState;
  input: InputLike;
  audio: AudioLike;
  message: MessageState;
  screen: ScreenState;
  map: MapRuntime;
  rng: () => number;
  /** True while play-testing from the editor (enables debug features). */
  isTest: boolean;

  requestTransfer(mapId: number, x: number, y: number, direction: Direction | 0, fade: 'black' | 'white' | 'none'): void;
  isTransferring(): boolean;
  requestBattle(troopId: number, canEscape: boolean, canLose: boolean, onEnd: (result: BattleResult) => void): void;
  requestShop(goods: ShopGood[], purchaseOnly: boolean, onEnd: () => void): void;
  requestMenu(): void;
  requestSave(onEnd: () => void): void;
  requestNameInput(actorId: number, maxLength: number, onEnd: () => void): void;
  requestGameOver(): void;
  requestTitle(): void;
  /** Is a non-map scene (battle, menu, shop...) currently in front? */
  isSceneBusy(): boolean;
  showAnimation(target: Character, key: string): void;
  isAnimationPlaying(target: Character): boolean;
  startBalloon(target: Character, type: BalloonType): void;
  /** Run user JavaScript from a Script command or script condition. */
  runScript(code: string, self?: unknown): unknown;
  /** True while a real-time (action mode) fight is going on. */
  combatActive?(): boolean;
  /** Show the level-up / skill-learned messages for an actor. */
  log(text: string): void;
}
