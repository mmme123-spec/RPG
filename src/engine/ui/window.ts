/** Retained-mode canvas windows: base window, selectable lists and command menus. */

import type { SystemSound } from '../../core/types';
import type { GameData } from '../data';
import type { Input } from '../input';
import type { ImageLibrary } from '../../render/images';
import { drawWindowFrame } from './draw';
import { drawText, type TextContext } from './text';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Services windows need from the game. */
export interface UiContext {
  data: GameData;
  images: ImageLibrary;
  input: Input;
  sound(name: SystemSound): void;
  textContext(): TextContext;
  frameCount(): number;
}

export class Window {
  ui: UiContext;
  x: number;
  y: number;
  w: number;
  h: number;
  padding = 12;
  openness = 1;
  private openSpeed = 0;
  visible = true;
  private _active = false;
  private activatedAt = -1;
  /** Draw the frame/background. */
  frame = true;
  opacity: number;
  lineHeight = 32;

  constructor(ui: UiContext, x: number, y: number, w: number, h: number) {
    this.ui = ui;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.opacity = ui.data.system.windowOpacity;
  }

  get active(): boolean {
    return this._active;
  }

  set active(v: boolean) {
    if (v && !this._active) this.activatedAt = this.ui.frameCount();
    this._active = v;
  }

  /** True on the frame the window became active: input that activated it must not be handled twice. */
  protected justActivated(): boolean {
    return this.activatedAt === this.ui.frameCount();
  }

  get inner(): Rect {
    return { x: this.x + this.padding, y: this.y + this.padding, w: this.w - this.padding * 2, h: this.h - this.padding * 2 };
  }

  open(): void {
    if (this.openness < 1) this.openSpeed = 1 / 6;
    this.visible = true;
  }

  close(): void {
    if (this.openness > 0) this.openSpeed = -1 / 6;
  }

  setOpen(open: boolean): void {
    this.openness = open ? 1 : 0;
    this.openSpeed = 0;
  }

  isOpen(): boolean {
    return this.openness >= 1;
  }

  isClosed(): boolean {
    return this.openness <= 0;
  }

  isAnimating(): boolean {
    return this.openSpeed !== 0;
  }

  contains(px: number, py: number): boolean {
    return px >= this.x && py >= this.y && px < this.x + this.w && py < this.y + this.h;
  }

  update(): void {
    if (this.openSpeed !== 0) {
      this.openness = Math.max(0, Math.min(1, this.openness + this.openSpeed));
      if (this.openness <= 0 || this.openness >= 1) this.openSpeed = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.visible || this.openness <= 0) return;
    if (this.frame) drawWindowFrame(ctx, this.x, this.y, this.w, this.h, this.ui.data.system.windowColor, this.opacity, this.openness);
    if (this.openness < 1) return;
    const r = this.inner;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
    ctx.clip();
    this.drawContents(ctx, r);
    ctx.restore();
  }

  protected drawContents(_ctx: CanvasRenderingContext2D, _r: Rect): void {}
}

export type Handler = () => void;

export abstract class SelectableWindow extends Window {
  index = 0;
  topRow = 0;
  maxCols = 1;
  colSpacing = 8;
  private handlers = new Map<string, Handler>();
  /** Called when the cursor moves. */
  onSelect: ((index: number) => void) | null = null;
  cursorAll = false;
  wrap = true;

  abstract maxItems(): number;
  abstract drawItem(ctx: CanvasRenderingContext2D, index: number, rect: Rect): void;

  isEnabled(_index: number): boolean {
    return true;
  }

  setHandler(name: string, fn: Handler): this {
    this.handlers.set(name, fn);
    return this;
  }

  hasHandler(name: string): boolean {
    return this.handlers.has(name);
  }

  protected callHandler(name: string): void {
    this.handlers.get(name)?.();
  }

  activate(): this {
    this.active = true;
    return this;
  }

  deactivate(): this {
    this.active = false;
    return this;
  }

  maxRows(): number {
    return Math.max(1, Math.ceil(this.maxItems() / this.maxCols));
  }

  visibleRows(): number {
    return Math.max(1, Math.floor(this.inner.h / this.lineHeight));
  }

  itemWidth(): number {
    return (this.inner.w - this.colSpacing * (this.maxCols - 1)) / this.maxCols;
  }

  itemRect(i: number): Rect {
    const r = this.inner;
    const col = i % this.maxCols;
    const row = Math.floor(i / this.maxCols) - this.topRow;
    const w = this.itemWidth();
    return { x: r.x + col * (w + this.colSpacing), y: r.y + row * this.lineHeight, w, h: this.lineHeight };
  }

  select(i: number): void {
    const n = this.maxItems();
    this.index = n === 0 ? -1 : Math.max(-1, Math.min(n - 1, i));
    this.ensureVisible();
    this.onSelect?.(this.index);
  }

  ensureVisible(): void {
    if (this.index < 0) return;
    const row = Math.floor(this.index / this.maxCols);
    if (row < this.topRow) this.topRow = row;
    const vis = this.visibleRows();
    if (row >= this.topRow + vis) this.topRow = row - vis + 1;
    this.topRow = Math.max(0, Math.min(this.topRow, Math.max(0, this.maxRows() - vis)));
  }

  override update(): void {
    super.update();
    if (!this.active || !this.isOpen() || !this.visible || this.justActivated()) return;
    this.processCursor();
    this.processHandling();
    this.processTouch();
  }

  private moveCursor(delta: number, wrapAllowed: boolean): void {
    const n = this.maxItems();
    if (n === 0) return;
    let next = this.index + delta;
    if (next < 0 || next >= n) {
      if (!wrapAllowed || !this.wrap) next = Math.max(0, Math.min(n - 1, next));
      else next = (next + n) % n;
    }
    if (next !== this.index) {
      this.select(next);
      this.ui.sound('cursor');
    }
  }

  protected processCursor(): void {
    const inp = this.ui.input;
    if (this.cursorAll) return;
    if (inp.isRepeated('down')) this.moveCursor(this.maxCols, inp.isTriggered('down'));
    else if (inp.isRepeated('up')) this.moveCursor(-this.maxCols, inp.isTriggered('up'));
    else if (this.maxCols > 1 && inp.isRepeated('right')) this.moveCursor(1, inp.isTriggered('right'));
    else if (this.maxCols > 1 && inp.isRepeated('left')) this.moveCursor(-1, inp.isTriggered('left'));
    if (inp.isTriggered('pagedown') && !this.hasHandler('pagedown')) this.moveCursor(this.visibleRows() * this.maxCols, false);
    if (inp.isTriggered('pageup') && !this.hasHandler('pageup')) this.moveCursor(-this.visibleRows() * this.maxCols, false);
  }

  protected processHandling(): void {
    const inp = this.ui.input;
    if (inp.isTriggered('ok')) {
      this.processOk();
    } else if (inp.isTriggered('cancel') && this.hasHandler('cancel')) {
      this.ui.sound('cancel');
      this.callHandler('cancel');
    } else if (inp.isTriggered('pagedown') && this.hasHandler('pagedown')) {
      this.ui.sound('cursor');
      this.callHandler('pagedown');
    } else if (inp.isTriggered('pageup') && this.hasHandler('pageup')) {
      this.ui.sound('cursor');
      this.callHandler('pageup');
    }
  }

  protected processOk(): void {
    if (this.index >= 0 && this.isEnabled(this.index)) {
      this.ui.sound('ok');
      this.callHandler('ok');
    } else {
      this.ui.sound('buzzer');
    }
  }

  private processTouch(): void {
    const p = this.ui.input.pointer;
    if (!p.triggered || !this.contains(p.x, p.y)) return;
    const n = this.maxItems();
    for (let i = 0; i < n; i++) {
      const r = this.itemRect(i);
      if (r.y + r.h <= this.inner.y || r.y >= this.inner.y + this.inner.h) continue;
      if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) {
        if (i === this.index || this.cursorAll) this.processOk();
        else {
          this.select(i);
          this.ui.sound('cursor');
        }
        return;
      }
    }
  }

  protected drawCursor(ctx: CanvasRenderingContext2D, r: Rect): void {
    const t = this.ui.frameCount();
    const a = this.active ? 0.28 + 0.12 * Math.sin(t / 8) : 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.strokeStyle = `rgba(255,255,255,${a + 0.35})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(r.x - 4 + 0.5, r.y + 1.5, r.w + 8 - 1, r.h - 3, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const n = this.maxItems();
    const vis = this.visibleRows();
    if (this.cursorAll && this.active && n > 0) {
      this.drawCursor(ctx, { x: r.x, y: r.y, w: r.w, h: Math.min(n, vis) * this.lineHeight });
    } else if (this.index >= 0 && this.index < n) {
      const row = Math.floor(this.index / this.maxCols);
      if (row >= this.topRow && row < this.topRow + vis) this.drawCursor(ctx, this.itemRect(this.index));
    }
    for (let i = this.topRow * this.maxCols; i < Math.min(n, (this.topRow + vis) * this.maxCols); i++) {
      this.drawItem(ctx, i, this.itemRect(i));
    }
    // scroll arrows
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const cx = this.x + this.w / 2;
    if (this.topRow > 0) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, this.y + 10);
      ctx.lineTo(cx + 8, this.y + 10);
      ctx.lineTo(cx, this.y + 3);
      ctx.fill();
    }
    if (this.topRow + vis < this.maxRows()) {
      ctx.beginPath();
      ctx.moveTo(cx - 8, this.y + this.h - 10);
      ctx.lineTo(cx + 8, this.y + this.h - 10);
      ctx.lineTo(cx, this.y + this.h - 3);
      ctx.fill();
    }
    ctx.restore();
  }
}

export interface Command {
  name: string;
  symbol: string;
  enabled: boolean;
  ext?: unknown;
}

export class CommandWindow extends SelectableWindow {
  commands: Command[] = [];
  align: CanvasTextAlign = 'left';
  textSize = 20;

  constructor(ui: UiContext, x: number, y: number, w: number, commands: Command[], rows?: number, cols = 1) {
    super(ui, x, y, w, 0);
    this.commands = commands;
    this.maxCols = cols;
    const r = rows ?? Math.ceil(commands.length / cols);
    this.h = r * this.lineHeight + this.padding * 2;
  }

  setCommands(commands: Command[]): void {
    this.commands = commands;
    if (this.index >= commands.length) this.select(commands.length - 1);
  }

  maxItems(): number {
    return this.commands.length;
  }

  override isEnabled(i: number): boolean {
    return !!this.commands[i]?.enabled;
  }

  currentSymbol(): string | null {
    return this.commands[this.index]?.symbol ?? null;
  }

  currentExt(): unknown {
    return this.commands[this.index]?.ext;
  }

  selectSymbol(symbol: string): void {
    const i = this.commands.findIndex((c) => c.symbol === symbol);
    this.select(Math.max(0, i));
  }

  protected override processOk(): void {
    if (this.index >= 0 && this.isEnabled(this.index)) {
      this.ui.sound('ok');
      const sym = this.currentSymbol()!;
      if (this.hasHandler(sym)) this.callHandler(sym);
      else this.callHandler('ok');
    } else {
      this.ui.sound('buzzer');
    }
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const c = this.commands[i];
    ctx.save();
    ctx.globalAlpha *= c.enabled ? 1 : 0.45;
    const x = this.align === 'center' ? r.x + r.w / 2 : this.align === 'right' ? r.x + r.w : r.x;
    drawText(ctx, c.name, x, r.y + r.h / 2, { size: this.textSize, align: this.align, maxWidth: r.w });
    ctx.restore();
  }
}
