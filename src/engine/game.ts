/**
 * The running game: owns the canvas, main loop, scene stack and all runtime
 * services. Implements the host interfaces used by map logic and windows.
 */

import type { AudioRef, BalloonType, Direction, Project, ShopGood, SystemSound } from '../core/types';
import { AudioEngine } from '../audio/engine';
import { ImageLibrary } from '../render/images';
import { GameData } from './data';
import type { BattleResult, EngineHost } from './host';
import { Input } from './input';
import type { Character } from './map/character';
import { MapRuntime } from './map/gamemap';
import { MessageState } from './message';
import { SaveStore } from './saves';
import { Scene } from './scene';
import { ScreenState } from './screen';
import type { SaveFile } from './state/gamestate';
import { GameState } from './state/gamestate';
import { loadGameFont, type TextContext } from './ui/text';
import type { UiContext } from './ui/window';
import { MapScene } from './scenes/map';
import { TitleScene, GameOverScene } from './scenes/title';
import { BattleScene } from './scenes/battle';
import { ShopScene } from './scenes/shop';
import { MenuScene } from './scenes/menu';
import { SaveScene } from './scenes/save';
import { NameInputScene } from './scenes/nameinput';
import { ActionCombat } from './action/combat';

export interface GameOptions {
  container: HTMLElement;
  project: Project;
  /** Play-testing from the editor: enables debug features (Ctrl to walk through walls). */
  isTest?: boolean;
  /** Skip the title and start at this position. */
  startAt?: { mapId: number; x: number; y: number };
  skipTitle?: boolean;
  /** Namespace for save files. */
  saveNamespace?: string;
  /** 'auto' shows the touch pad on touch devices. */
  touchControls?: 'auto' | 'on' | 'off';
  /** Called every frame (used by the editor's debug panel). */
  onFrame?: (game: Game) => void;
}

const STEP = 1 / 60;

export class Game implements EngineHost, UiContext {
  readonly data: GameData;
  readonly state: GameState;
  readonly input = new Input();
  readonly audio: AudioEngine;
  readonly message = new MessageState();
  readonly screen = new ScreenState();
  readonly images: ImageLibrary;
  readonly map: MapRuntime;
  readonly action: ActionCombat = new ActionCombat(this);
  readonly saves: SaveStore;
  readonly isTest: boolean;
  readonly width: number;
  readonly height: number;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  rng: () => number = Math.random;
  transfer: { mapId: number; x: number; y: number; direction: Direction | 0; fade: 'black' | 'white' | 'none' } | null = null;
  private renderScale = 1;
  private scenes: Scene[] = [];
  private deferred: (() => void)[] = [];
  private frame = 0;
  private running = false;
  private rafId = 0;
  private lastTime = 0;
  private acc = 0;
  private root: HTMLElement;
  private wrapper: HTMLDivElement;
  private resizeObserver: ResizeObserver | null = null;
  private options: GameOptions;
  private scriptCache = new Map<string, (...args: unknown[]) => unknown>();
  private savedBgm: AudioRef | null = null;
  private savedBgs: AudioRef | null = null;
  destroyed = false;

  static async create(options: GameOptions): Promise<Game> {
    await loadGameFont();
    const game = new Game(options);
    await game.images.preloadAssets();
    game.boot();
    game.start();
    return game;
  }

  constructor(options: GameOptions) {
    this.options = options;
    this.data = new GameData(options.project);
    this.state = new GameState(this.data);
    this.isTest = !!options.isTest;
    this.width = this.data.system.screenWidth;
    this.height = this.data.system.screenHeight;
    this.images = new ImageLibrary(options.project.assets);
    this.audio = new AudioEngine(options.project.assets);
    this.saves = new SaveStore(options.saveNamespace ?? `game:${options.project.id}`);
    this.map = new MapRuntime(this);
    this.root = options.container;

    this.wrapper = document.createElement('div');
    this.wrapper.style.cssText = 'position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000;touch-action:none;user-select:none;-webkit-user-select:none';
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'display:block;outline:none';
    this.canvas.tabIndex = 0;
    this.wrapper.appendChild(this.canvas);
    this.root.appendChild(this.wrapper);
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;

    this.input.attach(this.canvas, (cx, cy) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: ((cx - r.left) / Math.max(1, r.width)) * this.width, y: ((cy - r.top) / Math.max(1, r.height)) * this.height };
    });
    const touch = options.touchControls ?? 'auto';
    const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);
    if (touch === 'on' || (touch === 'auto' && isTouch)) this.input.createTouchPad(this.wrapper);
    window.addEventListener('keydown', this.unlockAudio, true);
    window.addEventListener('pointerdown', this.unlockAudio, true);
    window.addEventListener('touchstart', this.unlockAudio, true);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.root);
    this.resize();
  }

  private unlockAudio = (): void => {
    this.audio.unlock();
  };

  private resize(): void {
    const r = this.root.getBoundingClientRect();
    const fit = Math.max(0.1, Math.min((r.width || this.width) / this.width, (r.height || this.height) / this.height));
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.min(4, Math.round(fit * dpr)));
    if (this.canvas.width !== this.width * scale) {
      this.canvas.width = this.width * scale;
      this.canvas.height = this.height * scale;
    }
    this.canvas.style.width = `${Math.floor(this.width * fit)}px`;
    this.canvas.style.height = `${Math.floor(this.height * fit)}px`;
    this.renderScale = scale;
  }

  // --- lifecycle ---------------------------------------------------------------------

  private boot(): void {
    if (this.options.startAt) {
      this.newGame(this.options.startAt);
    } else if (this.options.skipTitle) {
      this.newGame();
    } else {
      this.goto(new TitleScene(this));
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
    this.canvas.focus({ preventScroll: true });
  }

  destroy(): void {
    this.destroyed = true;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    for (const s of this.scenes) s.stop();
    this.scenes = [];
    this.input.detach();
    this.audio.dispose();
    this.resizeObserver?.disconnect();
    window.removeEventListener('keydown', this.unlockAudio, true);
    window.removeEventListener('pointerdown', this.unlockAudio, true);
    window.removeEventListener('touchstart', this.unlockAudio, true);
    this.wrapper.remove();
  }

  private loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.update();
      this.acc -= STEP;
      n++;
    }
    if (n === 5) this.acc = 0;
    this.render();
  };

  private update(): void {
    this.input.update();
    const top = this.scenes[this.scenes.length - 1];
    top?.update();
    for (let guard = 0; this.deferred.length && guard < 20; guard++) {
      const ops = this.deferred;
      this.deferred = [];
      for (const op of ops) op();
    }
    this.frame++;
    if (this.inGame()) {
      this.state.playFrames++;
      if (this.state.timer.working && this.state.timer.frames > 0) this.state.timer.frames--;
    }
    this.options.onFrame?.(this);
  }

  private inGame(): boolean {
    return this.scenes.some((s) => s instanceof MapScene);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.setTransform(this.renderScale, 0, 0, this.renderScale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);
    // find the lowest scene that needs drawing
    let start = this.scenes.length - 1;
    while (start > 0 && this.scenes[start].transparent) start--;
    for (let i = Math.max(0, start); i < this.scenes.length; i++) {
      ctx.save();
      this.scenes[i].render(ctx);
      ctx.restore();
    }
  }

  frameCount(): number {
    return this.frame;
  }

  // --- scenes ------------------------------------------------------------------------

  topScene(): Scene | undefined {
    return this.scenes[this.scenes.length - 1];
  }

  mapScene(): MapScene | null {
    return (this.scenes.find((s) => s instanceof MapScene) as MapScene | undefined) ?? null;
  }

  /** Replace the whole stack. */
  goto(scene: Scene): void {
    this.defer(() => {
      for (const s of this.scenes) s.stop();
      this.scenes = [scene];
      this.input.clear();
      scene.start();
    });
  }

  push(scene: Scene): void {
    this.defer(() => {
      this.scenes.push(scene);
      scene.start();
    });
  }

  pop(): void {
    this.defer(() => {
      const s = this.scenes.pop();
      s?.stop();
      this.topScene()?.resume();
    });
  }

  private defer(op: () => void): void {
    this.deferred.push(op);
  }

  // --- game flow ---------------------------------------------------------------------

  newGame(start?: { mapId: number; x: number; y: number }): void {
    this.action.reset();
    const sys = this.data.system;
    this.state.setupNewGame();
    this.screen.clearAll();
    this.message.clear();
    this.audio.stopAll();
    const mapId = start?.mapId ?? sys.startMapId;
    this.map.interpreter.clear();
    const ok = this.map.setup(mapId) || this.map.setup(this.data.project.maps[0]?.id ?? 0);
    if (!ok) {
      this.goto(new TitleScene(this));
      return;
    }
    this.map.player.direction = sys.startDirection;
    this.map.player.locate(start?.x ?? sys.startX, start?.y ?? sys.startY);
    this.map.player.followersVisible = sys.followers;
    this.map.player.transparent = false;
    this.map.player.refreshGraphic();
    this.goto(new MapScene(this, true));
  }

  makeSaveFile(): SaveFile {
    const p = this.map.player;
    this.state.saveCount++;
    return {
      format: 'rpgforge-save',
      version: 1,
      savedAt: Date.now(),
      playFrames: this.state.playFrames,
      mapName: this.data.mapDisplayName(this.map.mapId),
      party: this.state.members().map((a) => ({ name: a.name, level: a.level, character: { ...a.character } })),
      state: this.state.serialize({
        mapId: this.map.mapId,
        x: p.x,
        y: p.y,
        direction: p.direction,
        followersVisible: p.followersVisible,
        transparent: p.transparent,
        bgm: this.audio.currentBgm(),
        bgs: this.audio.currentBgs(),
        tone: [...this.screen.tone] as [number, number, number, number],
        weather: { type: this.screen.weatherType, power: this.screen.weatherPower },
      }),
    };
  }

  saveToSlot(slot: number): boolean {
    return this.saves.save(slot, this.makeSaveFile());
  }

  loadFromSlot(slot: number): boolean {
    this.action.reset();
    const file = this.saves.load(slot);
    if (!file) return false;
    const s = file.state;
    this.state.load(s);
    this.screen.clearAll();
    this.message.clear();
    this.audio.stopAll();
    this.map.interpreter.clear();
    if (!this.map.setup(s.mapId)) return false;
    const p = this.map.player;
    p.direction = s.direction;
    p.locate(s.x, s.y);
    p.followersVisible = s.followersVisible;
    p.transparent = s.transparent;
    p.refreshGraphic();
    this.screen.startTint(s.tone, 0);
    if (s.weather.type !== 'none') this.screen.changeWeather(s.weather.type as never, s.weather.power, 0);
    this.goto(new MapScene(this, true, { bgm: s.bgm, bgs: s.bgs }));
    return true;
  }

  // --- EngineHost ------------------------------------------------------------------

  requestTransfer(mapId: number, x: number, y: number, direction: Direction | 0, fade: 'black' | 'white' | 'none'): void {
    this.transfer = { mapId, x, y, direction, fade };
  }

  isTransferring(): boolean {
    return this.transfer !== null;
  }

  private sceneRequested = false;

  combatActive(): boolean {
    return this.action.active;
  }

  requestBattle(troopId: number, canEscape: boolean, canLose: boolean, onEnd: (result: BattleResult) => void): void {
    if (!this.data.troops.has(troopId)) return;
    if (this.data.system.combatMode === 'action' && this.mapScene() && !this.action.active) {
      this.action.start(troopId, canEscape, canLose, onEnd);
      return;
    }
    this.sceneRequested = true;
    this.savedBgm = this.audio.currentBgm();
    this.savedBgs = this.audio.currentBgs();
    const ms = this.mapScene();
    const startBattle = () => {
      this.sceneRequested = false;
      this.push(new BattleScene(this, troopId, canEscape, canLose, (result) => {
        onEnd(result);
      }));
    };
    if (ms) ms.startEncounterEffect(startBattle);
    else startBattle();
  }

  /** Restore map music after a battle. */
  replayMapAudio(): void {
    this.audio.playBgm(this.savedBgm);
    this.audio.playBgs(this.savedBgs);
  }

  requestShop(goods: ShopGood[], purchaseOnly: boolean, onEnd: () => void): void {
    this.push(new ShopScene(this, goods, purchaseOnly, onEnd));
  }

  requestMenu(): void {
    this.sound('ok');
    this.push(new MenuScene(this));
  }

  requestSave(onEnd: () => void): void {
    this.push(new SaveScene(this, 'save', onEnd));
  }

  requestNameInput(actorId: number, maxLength: number, onEnd: () => void): void {
    this.push(new NameInputScene(this, actorId, maxLength, onEnd));
  }

  requestGameOver(): void {
    this.goto(new GameOverScene(this));
  }

  requestTitle(): void {
    this.screen.startFadeOut(30);
    this.audio.fadeOutBgm(1);
    this.goto(new TitleScene(this));
  }

  isSceneBusy(): boolean {
    return this.sceneRequested || this.deferred.length > 0 || !(this.topScene() instanceof MapScene);
  }

  showAnimation(target: Character, key: string): void {
    this.mapScene()?.addAnimation(target, key);
  }

  isAnimationPlaying(target: Character): boolean {
    return this.mapScene()?.isAnimationPlaying(target) ?? false;
  }

  startBalloon(target: Character, type: BalloonType): void {
    target.startBalloon(type);
  }

  log(text: string): void {
    console.info(`[game] ${text}`);
  }

  /** Objects available to user scripts (with RPG Maker-style aliases). */
  private scriptGlobals(): Record<string, unknown> {
    const st = this.state;
    return {
      game: this,
      state: st,
      data: this.data,
      map: this.map,
      player: this.map.player,
      $gameVariables: { value: (id: number) => st.getVariable(id), setValue: (id: number, v: number) => st.setVariable(id, v) },
      $gameSwitches: { value: (id: number) => st.getSwitch(id), setValue: (id: number, v: boolean) => st.setSwitch(id, v) },
      $gameParty: {
        gold: () => st.gold,
        gainGold: (n: number) => st.gainGold(n),
        members: () => st.members(),
        numItems: (id: number) => st.numItems('item', id),
        gainItem: (id: number, n: number) => st.gainItem('item', id, n),
      },
      $gamePlayer: this.map.player,
      $gameMap: this.map,
      $gameActors: { actor: (id: number) => st.actor(id) },
    };
  }

  runScript(code: string, self?: unknown): unknown {
    const globals = this.scriptGlobals();
    const names = Object.keys(globals);
    let fn = this.scriptCache.get(code);
    if (!fn) {
      try {
        fn = new Function(...names, 'self', `"use strict"; return (${code});`) as (...a: unknown[]) => unknown;
      } catch {
        try {
          fn = new Function(...names, 'self', `"use strict"; ${code}`) as (...a: unknown[]) => unknown;
        } catch (e) {
          console.error('Script error:', e);
          return undefined;
        }
      }
      this.scriptCache.set(code, fn);
    }
    try {
      return fn(...names.map((n) => globals[n]), self);
    } catch (e) {
      console.error('Script error:', e);
      return undefined;
    }
  }

  // --- UiContext --------------------------------------------------------------------

  sound(name: SystemSound): void {
    this.audio.playSe(this.data.system.sounds[name]);
  }

  textContext(): TextContext {
    const st = this.state;
    return {
      variable: (id) => st.getVariable(id),
      actorName: (id) => st.actor(id)?.name ?? '',
      partyMemberName: (i) => st.members()[i - 1]?.name ?? '',
      currency: this.data.system.currency,
    };
  }
}
