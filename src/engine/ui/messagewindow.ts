/** The dialogue window: typewriter text, faces, speaker names, choices and number input. */

import type { MessageState } from '../message';
import { drawFace, drawIcon, drawWindowFrame } from './draw';
import { TEXT_COLORS, drawText, expandEscapes, layoutTokens, measureText, tokenize, type Line } from './text';
import { SelectableWindow, Window, type Rect, type UiContext } from './window';

class ChoiceWindow extends SelectableWindow {
  items: string[] = [];

  maxItems(): number {
    return this.items.length;
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    drawText(ctx, this.items[i], r.x + 4, r.y + r.h / 2, { size: 20, maxWidth: r.w - 8 });
  }
}

class NumberWindow extends Window {
  digits = 2;
  value = 0;
  cursor = 0;
  onDone: ((v: number) => void) | null = null;

  setup(digits: number, initial: number): void {
    this.digits = Math.max(1, Math.min(8, digits));
    const max = Math.pow(10, this.digits) - 1;
    this.value = Math.max(0, Math.min(max, initial));
    this.cursor = this.digits - 1;
    this.w = this.digits * 28 + this.padding * 2 + 8;
    this.h = this.lineHeight + this.padding * 2;
  }

  private digitAt(i: number): number {
    return Math.floor(this.value / Math.pow(10, this.digits - 1 - i)) % 10;
  }

  private changeDigit(i: number, up: boolean): void {
    const place = Math.pow(10, this.digits - 1 - i);
    const d = this.digitAt(i);
    const nd = (d + (up ? 1 : 9)) % 10;
    this.value += (nd - d) * place;
  }

  override update(): void {
    super.update();
    if (!this.active || !this.isOpen() || this.justActivated()) return;
    const inp = this.ui.input;
    if (inp.isRepeated('right')) {
      this.cursor = (this.cursor + 1) % this.digits;
      this.ui.sound('cursor');
    } else if (inp.isRepeated('left')) {
      this.cursor = (this.cursor + this.digits - 1) % this.digits;
      this.ui.sound('cursor');
    } else if (inp.isRepeated('up')) {
      this.changeDigit(this.cursor, true);
      this.ui.sound('cursor');
    } else if (inp.isRepeated('down')) {
      this.changeDigit(this.cursor, false);
      this.ui.sound('cursor');
    } else if (inp.isTriggered('ok')) {
      this.ui.sound('ok');
      this.onDone?.(this.value);
    }
    const p = inp.pointer;
    if (p.triggered && this.contains(p.x, p.y)) {
      const r = this.inner;
      const i = Math.floor((p.x - r.x - 4) / 28);
      if (i >= 0 && i < this.digits) {
        if (i === this.cursor) this.changeDigit(i, p.y < r.y + r.h / 2);
        this.cursor = i;
        this.ui.sound('cursor');
      }
    }
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    for (let i = 0; i < this.digits; i++) {
      const x = r.x + 4 + i * 28;
      if (i === this.cursor) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(x, r.y, 24, r.h);
      }
      drawText(ctx, String(this.digitAt(i)), x + 12, r.y + r.h / 2, { size: 22, align: 'center' });
    }
  }
}

type Phase = 'idle' | 'opening' | 'typing' | 'pageWait' | 'endWait' | 'choices' | 'number' | 'closing';

export class MessageWindow extends Window {
  private msg: MessageState;
  private serial = -1;
  private phase: Phase = 'idle';
  private lines: Line[] = [];
  private pageStart = 0;
  private revealLine = 0;
  private revealToken = 0;
  private waitCount = 0;
  private instant = false;
  private readonly linesPerPage = 4;
  private choiceWindow: ChoiceWindow;
  private numberWindow: NumberWindow;
  private hasText = false;
  private pausePending = false;
  /** Ignore input on the frame a message starts. */
  private justStarted = false;

  constructor(ui: UiContext, msg: MessageState, screenW: number, screenH: number) {
    const h = 4 * 32 + 24;
    super(ui, 0, screenH - h, screenW, h);
    this.msg = msg;
    this.openness = 0;
    this.choiceWindow = new ChoiceWindow(ui, 0, 0, 200, 100);
    this.choiceWindow.setOpen(false);
    this.choiceWindow.visible = false;
    this.numberWindow = new NumberWindow(ui, 0, 0, 100, 56);
    this.numberWindow.setOpen(false);
    this.numberWindow.visible = false;
    this.choiceWindow.setHandler('ok', () => this.finishChoice(this.choiceWindow.index));
    this.choiceWindow.setHandler('cancel', () => {
      const c = this.msg.choices;
      if (!c || c.cancel === -1) return;
      this.finishChoice(c.cancel === -2 ? -2 : c.cancel);
    });
    this.numberWindow.onDone = (v) => this.finishNumber(v);
  }

  /** True while the window is showing or animating. */
  isBusy(): boolean {
    return this.phase !== 'idle';
  }

  private screenH(): number {
    return this.ui.data.system.screenHeight;
  }

  private start(): void {
    const req = this.msg.text;
    this.hasText = !!req && req.text.length > 0;
    const sh = this.screenH();
    const pos = req?.position ?? 'bottom';
    this.y = pos === 'top' ? 0 : pos === 'middle' ? (sh - this.h) / 2 : sh - this.h;
    const faceW = req?.face ? 112 : 0;
    const scratch = document.createElement('canvas').getContext('2d')!;
    if (req && this.hasText) {
      const expanded = expandEscapes(req.text, this.ui.textContext());
      this.lines = layoutTokens(scratch, tokenize(expanded), this.inner.w - faceW - 8, 20, 32);
    } else {
      this.lines = [];
    }
    this.pageStart = 0;
    this.revealLine = 0;
    this.revealToken = 0;
    this.instant = false;
    this.waitCount = 0;
    this.pausePending = false;
    this.justStarted = true;
    if (this.hasText) {
      this.phase = this.isOpen() ? 'typing' : 'opening';
      this.open();
    } else {
      this.phase = 'typing';
      this.finishPage();
    }
  }

  private pageEnd(): number {
    return Math.min(this.lines.length, this.pageStart + this.linesPerPage);
  }

  private revealAllOnPage(): void {
    this.revealLine = this.pageEnd();
    this.revealToken = 0;
  }

  private typeStep(): void {
    if (this.waitCount > 0) {
      this.waitCount--;
      return;
    }
    let budget = this.instant ? 999 : 1;
    while (budget > 0 && this.revealLine < this.pageEnd()) {
      const line = this.lines[this.revealLine];
      if (this.revealToken >= line.tokens.length) {
        this.revealLine++;
        this.revealToken = 0;
        continue;
      }
      const t = line.tokens[this.revealToken++].token;
      if (t.t === 'ch' || t.t === 'icon') budget--;
      else if (t.t === 'wait' && !this.instant) {
        this.waitCount = t.f;
        return;
      } else if (t.t === 'pause') {
        this.pausePending = true;
        return;
      } else if (t.t === 'instant') this.instant = t.on;
    }
    if (this.revealLine >= this.pageEnd()) this.finishPage();
  }

  private finishPage(): void {
    if (this.pageEnd() < this.lines.length) {
      this.phase = 'pageWait';
      return;
    }
    if (this.msg.choices) {
      this.openChoices();
    } else if (this.msg.number) {
      this.openNumber();
    } else {
      this.phase = 'endWait';
    }
  }

  private openChoices(): void {
    const c = this.msg.choices!;
    const cw = this.choiceWindow;
    cw.items = c.items;
    const scratch = document.createElement('canvas').getContext('2d')!;
    const widest = Math.max(80, ...c.items.map((s) => measureText(scratch, s, 20)));
    cw.w = Math.min(this.w, widest + 48);
    cw.h = Math.min(8, c.items.length) * cw.lineHeight + cw.padding * 2;
    cw.x = this.w - cw.w - 8;
    const sh = this.screenH();
    if (this.hasText) cw.y = this.y >= sh / 2 ? this.y - cw.h - 4 : this.y + this.h + 4;
    else cw.y = sh - cw.h - 8;
    cw.topRow = 0;
    cw.select(Math.max(0, Math.min(c.items.length - 1, c.defaultIndex)));
    cw.visible = true;
    cw.openness = 0;
    cw.open();
    cw.activate();
    this.phase = 'choices';
  }

  private openNumber(): void {
    const n = this.msg.number!;
    const nw = this.numberWindow;
    nw.setup(n.digits, n.initial);
    nw.x = this.hasText ? this.w - nw.w - 8 : (this.w - nw.w) / 2;
    const sh = this.screenH();
    nw.y = this.hasText ? (this.y >= sh / 2 ? this.y - nw.h - 4 : this.y + this.h + 4) : (sh - nw.h) / 2;
    nw.visible = true;
    nw.openness = 0;
    nw.open();
    nw.active = true;
    this.phase = 'number';
  }

  private finishChoice(result: number): void {
    this.choiceWindow.deactivate();
    this.choiceWindow.close();
    this.endMessage(result);
  }

  private finishNumber(v: number): void {
    this.numberWindow.active = false;
    this.numberWindow.close();
    this.endMessage(v);
  }

  private endMessage(result: number): void {
    this.phase = 'closing';
    const msg = this.msg;
    msg.finish(result);
    // if another message follows immediately, keep the window open
    if (msg.isBusy()) {
      this.serial = msg.serial;
      this.start();
      return;
    }
    if (this.hasText) this.close();
  }

  private inputTriggered(): boolean {
    const inp = this.ui.input;
    return inp.isTriggered('ok') || inp.isTriggered('cancel') || (inp.pointer.triggered && !this.choiceWindow.contains(inp.pointer.x, inp.pointer.y));
  }

  override update(): void {
    super.update();
    this.choiceWindow.update();
    this.numberWindow.update();
    if (this.msg.isBusy() && this.msg.serial !== this.serial) {
      this.serial = this.msg.serial;
      this.start();
    }
    if (this.justStarted) {
      this.justStarted = false;
      return;
    }
    switch (this.phase) {
      case 'idle':
        return;
      case 'opening':
        if (this.isOpen()) this.phase = 'typing';
        return;
      case 'typing':
        if (this.pausePending) {
          if (this.inputTriggered()) this.pausePending = false;
          return;
        }
        if (this.ui.input.isTriggered('ok') || this.ui.input.pointer.triggered) {
          this.revealAllOnPage();
          this.finishPage();
          return;
        }
        this.typeStep();
        return;
      case 'pageWait':
        if (this.inputTriggered()) {
          this.pageStart = this.pageEnd();
          this.revealLine = this.pageStart;
          this.revealToken = 0;
          this.phase = 'typing';
        }
        return;
      case 'endWait':
        if (this.inputTriggered()) this.endMessage(-1);
        return;
      case 'choices':
      case 'number':
        return;
      case 'closing':
        if (this.isClosed() || !this.hasText) {
          if (!this.choiceWindow.isAnimating() && !this.numberWindow.isAnimating()) {
            this.choiceWindow.visible = false;
            this.numberWindow.visible = false;
            this.phase = 'idle';
          }
        }
        return;
    }
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    if (this.hasText && this.visible && this.openness > 0) {
      const bg = this.msg.text?.background ?? 'window';
      const req = this.msg.text;
      if (bg === 'window' || !req) {
        drawWindowFrame(ctx, this.x, this.y, this.w, this.h, this.ui.data.system.windowColor, this.opacity, this.openness);
      } else if (bg === 'dim') {
        ctx.save();
        ctx.globalAlpha = 0.55 * this.openness;
        const g = ctx.createLinearGradient(0, this.y, 0, this.y + this.h);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.2, 'rgba(0,0,0,1)');
        g.addColorStop(0.8, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(this.x, this.y, this.w, this.h);
        ctx.restore();
      }
      if (this.openness >= 1 && req) this.drawText(ctx);
    }
    this.choiceWindow.draw(ctx);
    this.numberWindow.draw(ctx);
  }

  private drawText(ctx: CanvasRenderingContext2D): void {
    const req = this.msg.text!;
    const r = this.inner;
    let x0 = r.x + 4;
    if (req.face) {
      drawFace(ctx, this.ui.images, req.face, r.x, r.y + (r.h - 96) / 2, 96, 96);
      x0 = r.x + 112;
    }
    if (req.speaker) {
      const nw = Math.max(90, measureText(ctx, req.speaker, 20, true) + 32);
      const ny = this.y >= 60 ? this.y - 44 : this.y + this.h + 4;
      drawWindowFrame(ctx, this.x + 8, ny, nw, 40, this.ui.data.system.windowColor, this.opacity, 1);
      drawText(ctx, req.speaker, this.x + 8 + nw / 2, ny + 20, { size: 20, align: 'center', color: TEXT_COLORS[17], bold: true });
    }
    let color = TEXT_COLORS[0];
    // replay colours from earlier pages
    for (let l = 0; l < this.pageStart; l++) {
      for (const lt of this.lines[l].tokens) if (lt.token.t === 'color') color = TEXT_COLORS[lt.token.c] ?? TEXT_COLORS[0];
    }
    for (let l = this.pageStart; l < this.pageEnd(); l++) {
      if (l > this.revealLine) break;
      const line = this.lines[l];
      const y = r.y + (l - this.pageStart) * 32 + 16;
      const limit = l < this.revealLine ? line.tokens.length : this.revealToken;
      for (let i = 0; i < limit; i++) {
        const lt = line.tokens[i];
        const t = lt.token;
        if (t.t === 'color') color = TEXT_COLORS[t.c] ?? TEXT_COLORS[0];
        else if (t.t === 'icon') drawIcon(ctx, this.ui.images, t.i, x0 + lt.x, y - 12, 24);
        else if (t.t === 'ch') drawText(ctx, t.ch, x0 + lt.x, y, { size: lt.size, color });
      }
    }
    if (this.phase === 'pageWait' || this.phase === 'endWait' || this.pausePending) {
      const t = this.ui.frameCount();
      const ay = this.y + this.h - 12 + Math.round(Math.sin(t / 6) * 2);
      const ax = this.x + this.w / 2;
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.moveTo(ax - 7, ay - 5);
      ctx.lineTo(ax + 7, ay - 5);
      ctx.lineTo(ax, ay + 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}
