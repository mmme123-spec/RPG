/** Save / load file selection. */

import type { Game } from '../game';
import { SAVE_SLOTS } from '../saves';
import { Scene } from '../scene';
import type { SaveFile } from '../state/gamestate';
import { drawCharacterFrame } from '../ui/draw';
import { UI, drawText } from '../ui/text';
import { SelectableWindow, type Rect } from '../ui/window';
import { HelpWindow } from '../ui/windows';

function formatTime(frames: number): string {
  const s = Math.floor(frames / 60);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

class SaveListWindow extends SelectableWindow {
  files: (SaveFile | null)[] = [];
  mode: 'save' | 'load' = 'save';

  maxItems(): number {
    return SAVE_SLOTS;
  }

  override isEnabled(i: number): boolean {
    return this.mode === 'save' || !!this.files[i];
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const f = this.files[i];
    ctx.save();
    if (!this.isEnabled(i)) ctx.globalAlpha *= 0.5;
    drawText(ctx, `File ${i + 1}`, r.x + 4, r.y + 20, { size: 20, color: UI.system });
    if (f) {
      f.party.slice(0, 4).forEach((m, k) => drawCharacterFrame(ctx, this.ui.images, m.character, r.x + 150 + k * 40, r.y + r.h - 6));
      drawText(ctx, f.mapName, r.x + 330, r.y + 20, { size: 18, maxWidth: r.w - 340 });
      drawText(ctx, formatTime(f.playFrames), r.x + r.w - 4, r.y + 50, { size: 18, align: 'right' });
      const leader = f.party[0];
      if (leader) drawText(ctx, `${leader.name}  Lv ${leader.level}`, r.x + 330, r.y + 50, { size: 17, color: '#c8c8e0' });
    } else {
      drawText(ctx, '— empty —', r.x + 150, r.y + 36, { size: 18, color: '#888899' });
    }
    ctx.restore();
  }
}

export class SaveScene extends Scene {
  private mode: 'save' | 'load';
  private onEnd: () => void;
  private help: HelpWindow;
  private list: SaveListWindow;
  private leaving = 0;

  constructor(game: Game, mode: 'save' | 'load', onEnd: () => void) {
    super(game);
    this.transparent = true;
    this.mode = mode;
    this.onEnd = onEnd;
    this.help = new HelpWindow(game, 0, 0, game.width, 56);
    this.help.setText(mode === 'save' ? 'Save to which file?' : 'Load which file?');
    this.list = new SaveListWindow(game, 0, 56, game.width, game.height - 56);
    this.list.lineHeight = 76;
    this.list.mode = mode;
    this.list.setHandler('ok', () => this.onOk());
    this.list.setHandler('cancel', () => this.close());
  }

  override start(): void {
    this.list.files = this.game.saves.list();
    this.list.select(this.mode === 'load' ? this.game.saves.latestSlot() - 1 : Math.max(0, this.game.saves.latestSlot() - 1));
    this.list.activate();
  }

  private close(): void {
    this.game.pop();
    this.onEnd();
  }

  private onOk(): void {
    const slot = this.list.index + 1;
    if (this.mode === 'save') {
      if (this.game.saveToSlot(slot)) {
        this.game.sound('save');
        this.list.files = this.game.saves.list();
        this.close();
      } else {
        this.game.sound('buzzer');
      }
      return;
    }
    this.list.deactivate();
    this.game.sound('load');
    this.leaving = 1;
    this.game.audio.fadeOutBgm(0.5);
  }

  update(): void {
    if (this.leaving > 0) {
      if (++this.leaving > 24) {
        this.leaving = 0;
        if (!this.game.loadFromSlot(this.list.index + 1)) {
          this.game.sound('buzzer');
          this.list.activate();
        }
      }
      return;
    }
    this.help.update();
    this.list.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,10,0.55)';
    ctx.fillRect(0, 0, this.game.width, this.game.height);
    this.help.draw(ctx);
    this.list.draw(ctx);
    if (this.leaving > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.leaving / 24})`;
      ctx.fillRect(0, 0, this.game.width, this.game.height);
    }
  }
}
