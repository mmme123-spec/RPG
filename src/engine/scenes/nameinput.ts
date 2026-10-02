/** Name entry with an on-screen character grid. */

import type { Game } from '../game';
import { Scene } from '../scene';
import type { GameActor } from '../state/actor';
import { drawFace } from '../ui/draw';
import { drawText } from '../ui/text';
import { SelectableWindow, Window, type Rect } from '../ui/window';

const CHARS = [
  ...'ABCDEFGHIJ',
  ...'KLMNOPQRST',
  ...'UVWXYZ.-\'!',
  ...'abcdefghij',
  ...'klmnopqrst',
  ...'uvwxyz?&, ',
  ...'0123456789',
  '⌫',
  'OK',
];

class GridWindow extends SelectableWindow {
  maxItems(): number {
    return CHARS.length;
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const c = CHARS[i];
    const label = c === ' ' ? '␣' : c;
    drawText(ctx, label, r.x + r.w / 2, r.y + r.h / 2, { size: c.length > 1 ? 16 : 20, align: 'center', color: c.length > 1 || c === '⌫' ? '#ffe080' : '#ffffff' });
  }
}

class NameWindow extends Window {
  actor: GameActor | null = null;
  name = '';
  max = 8;

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    if (this.actor) drawFace(ctx, this.ui.images, this.actor.face, r.x, r.y, 96, 96);
    const x0 = r.x + 120;
    const cw = Math.min(30, (r.w - 130) / this.max);
    for (let i = 0; i < this.max; i++) {
      const ch = this.name[i] ?? '';
      drawText(ctx, ch, x0 + i * cw + cw / 2, r.y + 44, { size: 24, align: 'center' });
      ctx.fillStyle = i === this.name.length ? '#ffe080' : 'rgba(255,255,255,0.6)';
      ctx.fillRect(x0 + i * cw + 3, r.y + 62, cw - 6, 2);
    }
  }
}

export class NameInputScene extends Scene {
  private actor: GameActor | null;
  private onEnd: () => void;
  private nameWin: NameWindow;
  private grid: GridWindow;

  constructor(game: Game, actorId: number, maxLength: number, onEnd: () => void) {
    super(game);
    this.transparent = true;
    this.actor = game.state.actor(actorId);
    this.onEnd = onEnd;
    const W = game.width;
    this.nameWin = new NameWindow(game, 40, 30, W - 80, 128);
    this.nameWin.actor = this.actor;
    this.nameWin.max = Math.max(1, Math.min(16, maxLength));
    this.nameWin.name = (this.actor?.name ?? '').slice(0, this.nameWin.max);
    this.grid = new GridWindow(game, 40, 168, W - 80, 8 * 34 + 24);
    this.grid.maxCols = 10;
    this.grid.lineHeight = 34;
    this.grid.setHandler('ok', () => this.onChar());
    this.grid.setHandler('cancel', () => this.backspace());
  }

  override start(): void {
    this.grid.select(0);
    this.grid.activate();
  }

  private backspace(): void {
    this.nameWin.name = this.nameWin.name.slice(0, -1);
  }

  private onChar(): void {
    const c = CHARS[this.grid.index];
    if (c === 'OK') {
      const name = this.nameWin.name.trim();
      if (!name) {
        this.game.sound('buzzer');
        return;
      }
      if (this.actor) this.actor.name = name;
      this.game.state.touch();
      this.game.pop();
      this.onEnd();
      return;
    }
    if (c === '⌫') {
      this.backspace();
      return;
    }
    if (this.nameWin.name.length < this.nameWin.max) this.nameWin.name += c;
    else this.game.sound('buzzer');
  }

  update(): void {
    this.grid.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.6)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    this.nameWin.draw(ctx);
    this.grid.draw(ctx);
  }
}
