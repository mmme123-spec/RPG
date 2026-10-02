/** Title screen and game over screen. */

import type { Game } from '../game';
import { Scene } from '../scene';
import { SaveScene } from './save';
import { CommandWindow } from '../ui/window';
import { drawText } from '../ui/text';

export class TitleScene extends Scene {
  private commands: CommandWindow;
  private fade = 0;
  private leaving: (() => void) | null = null;
  private leaveFrame = 0;

  constructor(game: Game) {
    super(game);
    const t = game.data.system.terms;
    const w = 220;
    this.commands = new CommandWindow(game, (game.width - w) / 2, game.height - 168, w, [
      { name: t.newGame, symbol: 'new', enabled: true },
      { name: t.continue, symbol: 'continue', enabled: game.saves.hasAny() },
    ]);
    this.commands.align = 'center';
    this.commands.opacity = 200;
    this.commands.setHandler('new', () => this.leave(() => this.game.newGame()));
    this.commands.setHandler('continue', () => this.game.push(new SaveScene(this.game, 'load', () => {})));
    this.commands.select(game.saves.hasAny() ? 1 : 0);
  }

  override start(): void {
    const g = this.game;
    g.screen.clearAll();
    g.message.clear();
    g.audio.playBgm(g.data.system.titleBgm);
    g.audio.playBgs(null);
    this.commands.activate();
  }

  override resume(): void {
    this.commands.commands[1].enabled = this.game.saves.hasAny();
    this.commands.activate();
  }

  private leave(fn: () => void): void {
    this.commands.deactivate();
    this.leaving = fn;
    this.leaveFrame = 0;
    this.game.audio.fadeOutBgm(0.8);
  }

  update(): void {
    if (this.fade < 1) this.fade = Math.min(1, this.fade + 1 / 30);
    if (this.leaving) {
      if (++this.leaveFrame >= 30) {
        const fn = this.leaving;
        this.leaving = null;
        fn();
      }
      return;
    }
    // any key starts audio and shows the menu
    this.commands.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const W = g.width;
    const H = g.height;
    const bg = g.images.get('title', g.data.system.titleBackground);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#1a1440');
      grad.addColorStop(1, '#6a3a6a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    if (g.data.system.showTitleText) {
      const title = g.data.system.gameTitle;
      const size = Math.min(56, Math.floor((W - 60) / Math.max(6, title.length * 0.55)));
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;
      drawText(ctx, title, W / 2, H * 0.28, { size, align: 'center', bold: true, color: '#fff4d0' });
      ctx.restore();
    }
    this.commands.draw(ctx);
    if (!g.audio.isUnlocked()) drawText(ctx, 'Press any key or tap to enable sound', W / 2, H - 14, { size: 14, align: 'center', color: 'rgba(255,255,255,0.6)' });
    const a = this.leaving ? this.leaveFrame / 30 : 1 - this.fade;
    if (a > 0) {
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

export class GameOverScene extends Scene {
  private frame = 0;

  override start(): void {
    const g = this.game;
    g.audio.stopAll();
    g.audio.playMe(g.data.system.gameOverMe);
    g.message.clear();
  }

  update(): void {
    this.frame++;
    const inp = this.game.input;
    if (this.frame > 90 && (inp.isTriggered('ok') || inp.isTriggered('cancel') || inp.pointer.triggered)) {
      this.game.goto(new TitleScene(this.game));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const W = g.width;
    const H = g.height;
    const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    grad.addColorStop(0, '#3a0a14');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    const a = Math.min(1, this.frame / 60);
    ctx.save();
    ctx.globalAlpha = a;
    drawText(ctx, 'GAME OVER', W / 2, H / 2 - 10, { size: 56, align: 'center', bold: true, color: '#e0d0d0' });
    if (this.frame > 90) drawText(ctx, 'Press OK to return to the title', W / 2, H / 2 + 50, { size: 18, align: 'center', color: '#a08888' });
    ctx.restore();
  }
}
