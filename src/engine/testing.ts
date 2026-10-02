/** Test helpers: a headless engine host with a controllable input stub. */

import type { Direction, Project } from '../core/types';
import { mulberry32 } from '../core/util';
import { GameData } from './data';
import type { AudioLike, BattleResult, EngineHost, InputButtonName, InputLike } from './host';
import { MapRuntime } from './map/gamemap';
import { MessageState } from './message';
import { ScreenState } from './screen';
import { GameState } from './state/gamestate';

export class StubInput implements InputLike {
  pressed = new Set<InputButtonName>();
  triggered = new Set<InputButtonName>();
  dir: 0 | Direction = 0;
  isPressed(b: InputButtonName): boolean {
    return this.pressed.has(b);
  }
  isTriggered(b: InputButtonName): boolean {
    return this.triggered.has(b);
  }
  isRepeated(b: InputButtonName): boolean {
    return this.triggered.has(b);
  }
  dir4(): 0 | Direction {
    return this.dir;
  }
}

export interface TestHost extends EngineHost {
  input: StubInput;
  calls: { type: string; args: unknown[] }[];
  battleResult: BattleResult;
  transfer: { mapId: number; x: number; y: number } | null;
  /** Run the map for n frames. */
  step(n?: number): void;
}

const silentAudio: AudioLike = {
  playSe() {},
  playBgm() {},
  playBgs() {},
  playMe() {},
  fadeOutBgm() {},
  stopAll() {},
  currentBgm: () => null,
  currentBgs: () => null,
};

export function makeTestHost(project: Project, seed = 1): TestHost {
  const data = new GameData(project);
  const state = new GameState(data);
  state.setupNewGame();
  const calls: { type: string; args: unknown[] }[] = [];
  let sceneBusy = false;
  const host = {
    data,
    state,
    input: new StubInput(),
    audio: silentAudio,
    message: new MessageState(),
    screen: new ScreenState(),
    rng: mulberry32(seed),
    isTest: true,
    calls,
    battleResult: 'win' as BattleResult,
    transfer: null as { mapId: number; x: number; y: number } | null,
    requestTransfer(mapId: number, x: number, y: number) {
      calls.push({ type: 'transfer', args: [mapId, x, y] });
      host.transfer = { mapId, x, y };
      host.map.setup(mapId);
      host.map.player.locate(x, y);
      host.transfer = null;
    },
    isTransferring: () => host.transfer !== null,
    requestBattle(troopId: number, canEscape: boolean, canLose: boolean, onEnd: (r: BattleResult) => void) {
      calls.push({ type: 'battle', args: [troopId, canEscape, canLose] });
      onEnd(host.battleResult);
    },
    requestShop(goods: unknown, purchaseOnly: boolean, onEnd: () => void) {
      calls.push({ type: 'shop', args: [goods, purchaseOnly] });
      onEnd();
    },
    requestMenu() {
      calls.push({ type: 'menu', args: [] });
    },
    requestSave(onEnd: () => void) {
      calls.push({ type: 'save', args: [] });
      onEnd();
    },
    requestNameInput(actorId: number, max: number, onEnd: () => void) {
      calls.push({ type: 'nameInput', args: [actorId, max] });
      onEnd();
    },
    requestGameOver() {
      calls.push({ type: 'gameOver', args: [] });
      sceneBusy = true;
    },
    requestTitle() {
      calls.push({ type: 'title', args: [] });
    },
    isSceneBusy: () => sceneBusy,
    showAnimation(_t: unknown, key: string) {
      calls.push({ type: 'animation', args: [key] });
    },
    isAnimationPlaying: () => false,
    startBalloon(t: { startBalloon(b: string): void }, b: string) {
      t.startBalloon(b);
    },
    runScript(code: string) {
      return new Function('state', `return (${code});`)(state);
    },
    log(text: string) {
      calls.push({ type: 'log', args: [text] });
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        host.map.update(true);
        host.screen.update();
      }
    },
  } as unknown as TestHost;
  host.map = new MapRuntime(host);
  return host;
}
