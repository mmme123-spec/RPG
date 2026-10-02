/** The map scene: exploration, events, transfers and screen effects. */

import type { AudioRef } from '../../core/types';
import type { Game } from '../game';
import type { Character } from '../map/character';
import { EffectAnimation, Weather } from '../render/effects';
import { MapView } from '../render/mapview';
import { Scene } from '../scene';
import { drawWindowFrame } from '../ui/draw';
import { MessageWindow } from '../ui/messagewindow';
import { drawText } from '../ui/text';

/** Draw a screen tone ([r, g, b, gray], each -255..255) over the canvas. */
export function drawTone(ctx: CanvasRenderingContext2D, tone: number[], w: number, h: number): void {
  const [r, g, b, gray] = tone;
  if (!r && !g && !b && !gray) return;
  ctx.save();
  if (gray > 0) {
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = Math.min(1, gray / 255);
    ctx.fillStyle = 'rgb(128,128,128)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
  if (r < 0 || g < 0 || b < 0) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${255 + Math.min(0, r)},${255 + Math.min(0, g)},${255 + Math.min(0, b)})`;
    ctx.fillRect(0, 0, w, h);
  }
  if (r > 0 || g > 0 || b > 0) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

export class MapScene extends Scene {
  private view: MapView;
  private msgWin: MessageWindow;
  private animations: { target: Character; anim: EffectAnimation }[] = [];
  private weather = new Weather();
  private mapNameTimer = 0;
  private mapName = '';
  private encounter: { frame: number; cb: () => void } | null = null;
  private fadingForTransfer = false;
  private fadeInOnStart: boolean;
  private restoreAudio: { bgm: AudioRef | null; bgs: AudioRef | null } | null;

  constructor(game: Game, fadeIn = false, restoreAudio: { bgm: AudioRef | null; bgs: AudioRef | null } | null = null) {
    super(game);
    this.view = new MapView(game.images);
    this.msgWin = new MessageWindow(game, game.message, game.width, game.height);
    this.fadeInOnStart = fadeIn;
    this.restoreAudio = restoreAudio;
  }

  override start(): void {
    const g = this.game;
    if (this.fadeInOnStart) {
      g.screen.brightness = 0;
      g.screen.fadeColor = 'black';
      g.screen.startFadeIn(30);
    }
    if (this.restoreAudio) {
      g.audio.playBgm(this.restoreAudio.bgm);
      g.audio.playBgs(this.restoreAudio.bgs);
    } else {
      this.autoplay();
    }
    g.map.centerOn(g.map.player.realX, g.map.player.realY);
    this.showMapName();
  }

  override resume(): void {
    this.game.input.clear();
  }

  private autoplay(): void {
    const m = this.game.map.map;
    if (m.bgm) this.game.audio.playBgm(m.bgm);
    if (m.bgs) this.game.audio.playBgs(m.bgs);
  }

  private showMapName(): void {
    this.mapName = this.game.map.map.displayName;
    this.mapNameTimer = this.mapName ? 160 : 0;
  }

  addAnimation(target: Character, key: string): void {
    const pos = this.characterScreenPos(target);
    this.animations.push({ target, anim: new EffectAnimation(key, pos.x, pos.y - 24, 0.8) });
  }

  isAnimationPlaying(target: Character): boolean {
    return this.animations.some((a) => a.target === target);
  }

  private characterScreenPos(c: Character): { x: number; y: number } {
    const cam = this.view.camera(this.game.map);
    return this.view.screenPos(c, -cam.x, -cam.y);
  }

  startEncounterEffect(cb: () => void): void {
    this.encounter = { frame: 0, cb };
    this.game.sound('battleStart');
    this.game.audio.playBgm(this.game.data.system.battleBgm);
    this.game.audio.playBgs(null);
  }

  private updateTransfer(): void {
    const g = this.game;
    const t = g.transfer;
    if (!t) return;
    if (!this.fadingForTransfer) {
      if (t.fade !== 'none') {
        g.screen.startFadeOut(16, t.fade);
        this.fadingForTransfer = true;
        return;
      }
      this.performTransfer();
      return;
    }
    if (!g.screen.isFading()) this.performTransfer();
  }

  private performTransfer(): void {
    const g = this.game;
    const t = g.transfer!;
    g.transfer = null;
    this.fadingForTransfer = false;
    const map = g.map;
    if (t.mapId !== map.mapId) {
      if (!map.setup(t.mapId)) return;
      this.animations = [];
      this.autoplay();
      this.showMapName();
    }
    map.player.locate(t.x, t.y);
    map.player.applyTransferDirection(t.direction);
    map.player.refreshGraphic();
    map.centerOn(map.player.realX, map.player.realY);
    if (t.fade !== 'none') g.screen.startFadeIn(16);
  }

  update(): void {
    const g = this.game;
    if (this.encounter) {
      this.encounter.frame++;
      if (this.encounter.frame === 44) {
        const cb = this.encounter.cb;
        cb();
      }
      if (this.encounter.frame > 44) this.encounter = null;
      return;
    }
    this.updateTransfer();
    const active = !g.isTransferring() && g.topScene() === this;
    g.map.player.debugThrough = g.isTest && g.input.ctrl;
    g.map.update(active);
    g.screen.update();
    this.msgWin.update();
    for (const a of this.animations) {
      const pos = this.characterScreenPos(a.target);
      a.anim.x = pos.x;
      a.anim.y = pos.y - 24;
      a.anim.update();
    }
    this.animations = this.animations.filter((a) => !a.anim.isDone());
    this.weather.update(g.screen.weatherType, g.screen.weatherPower, g.width, g.height);
    if (this.mapNameTimer > 0) this.mapNameTimer--;
    if (g.isTest && g.input.isTriggered('debug')) g.log(`Map ${g.map.mapId} (${g.map.player.x}, ${g.map.player.y})`);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const W = g.width;
    const H = g.height;
    ctx.save();
    if (this.encounter) {
      const f = this.encounter.frame;
      if (f > 14) {
        const z = 1 + (f - 14) * 0.02;
        ctx.translate(W / 2, H / 2);
        ctx.scale(z, z);
        ctx.translate(-W / 2, -H / 2);
      }
    }
    this.view.render(ctx, g.map, W, H, g.screen.shake);
    for (const a of this.animations) a.anim.draw(ctx);
    ctx.restore();
    this.weather.draw(ctx, g.screen.weatherType, g.screen.weatherPower, W, H);
    this.drawPictures(ctx);
    drawTone(ctx, g.screen.tone, W, H);
    const fc = g.screen.flashColor;
    if (fc[3] > 0) {
      ctx.fillStyle = `rgba(${fc[0]},${fc[1]},${fc[2]},${fc[3] / 255})`;
      ctx.fillRect(0, 0, W, H);
    }
    this.drawTimer(ctx);
    this.drawMapName(ctx);
    this.msgWin.draw(ctx);
    if (g.screen.brightness < 1) {
      ctx.fillStyle = g.screen.fadeColor === 'white' ? `rgba(255,255,255,${1 - g.screen.brightness})` : `rgba(0,0,0,${1 - g.screen.brightness})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.encounter) {
      const f = this.encounter.frame;
      if (f < 14) {
        const a = Math.sin((f / 14) * Math.PI * 2) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
        ctx.fillRect(0, 0, W, H);
      } else {
        ctx.fillStyle = `rgba(0,0,0,${Math.min(1, (f - 14) / 28)})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  }

  private drawPictures(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const ids = [...g.screen.pictures.keys()].sort((a, b) => a - b);
    for (const id of ids) {
      const p = g.screen.pictures.get(id)!;
      const img = g.images.get('picture', p.image);
      if (!img) continue;
      const s = p.scale / 100;
      const w = img.width * s;
      const h = img.height * s;
      const x = p.origin === 'center' ? p.x - w / 2 : p.x;
      const y = p.origin === 'center' ? p.y - h / 2 : p.y;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.opacity / 255));
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    }
  }

  private drawTimer(ctx: CanvasRenderingContext2D): void {
    const t = this.game.state.timer;
    if (!t.working) return;
    const secs = Math.ceil(t.frames / 60);
    const text = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    drawText(ctx, text, this.game.width - 20, 28, { size: 28, align: 'right', bold: true, color: secs <= 10 ? '#ff8080' : '#ffffff' });
  }

  private drawMapName(ctx: CanvasRenderingContext2D): void {
    if (this.mapNameTimer <= 0 || !this.mapName) return;
    const t = this.mapNameTimer;
    const a = t > 140 ? (160 - t) / 20 : t < 30 ? t / 30 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    drawWindowFrame(ctx, 20, 16, 260, 44, this.game.data.system.windowColor, 200, 1);
    drawText(ctx, this.mapName, 150, 38, { size: 20, align: 'center', maxWidth: 236 });
    ctx.restore();
  }
}
