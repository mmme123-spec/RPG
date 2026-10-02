/** Reusable windows for menus, shops and battles. */

import type { ItemKind, Skill } from '../../core/types';
import type { AnyItem } from '../data';
import type { GameActor } from '../state/actor';
import type { Battler } from '../state/battler';
import type { GameState } from '../state/gamestate';
import { drawCharacterFrame, drawFace, drawGauge, drawIcon, drawRichText } from './draw';
import { UI, drawText, measureText } from './text';
import { SelectableWindow, Window, type Rect, type UiContext } from './window';

// ---------------------------------------------------------------------------
// drawing helpers for battlers
// ---------------------------------------------------------------------------

export function hpColor(b: Battler): string {
  if (b.isDead()) return UI.death;
  if (b.isDying()) return UI.crisis;
  return UI.normal;
}

export function drawStateIcons(ctx: CanvasRenderingContext2D, ui: UiContext, b: Battler, x: number, y: number, max = 4, size = 24): void {
  b.displayStates()
    .slice(0, max)
    .forEach((s, i) => drawIcon(ctx, ui.images, s.icon, x + i * (size + 2), y, size));
}

export function drawParamGauge(
  ctx: CanvasRenderingContext2D,
  label: string,
  cur: number,
  max: number,
  x: number,
  y: number,
  w: number,
  c1: string,
  c2: string,
  color = UI.normal,
): void {
  drawGauge(ctx, x, y + 20, w, max > 0 ? cur / max : 0, c1, c2, 6);
  drawText(ctx, label, x, y + 12, { size: 16, color: UI.system });
  drawText(ctx, `${cur}`, x + w - 44, y + 12, { size: 20, align: 'right', color });
  drawText(ctx, `/${max}`, x + w, y + 13, { size: 15, align: 'right', color: '#c8c8d8' });
}

/** Name, level, HP and MP of an actor in a compact block. */
export function drawActorBlock(ctx: CanvasRenderingContext2D, ui: UiContext, a: GameActor, x: number, y: number, w: number): void {
  const t = ui.data.system.terms;
  drawText(ctx, a.name, x, y + 14, { size: 20, color: hpColor(a), maxWidth: w * 0.45 });
  drawText(ctx, `${t.levelA} ${a.level}`, x + w * 0.5, y + 14, { size: 18, color: UI.system });
  drawStateIcons(ctx, ui, a, x + w - 52, y + 2, 2, 24);
  const gw = (w - 12) / 2;
  drawParamGauge(ctx, t.hpA, a.hp, a.mhp, x, y + 30, gw, UI.hp1, UI.hp2, hpColor(a));
  drawParamGauge(ctx, t.mpA, a.mp, a.mmp, x + gw + 12, y + 30, gw, UI.mp1, UI.mp2);
}

export function itemCountText(n: number): string {
  return `×${n}`;
}

// ---------------------------------------------------------------------------
// simple windows
// ---------------------------------------------------------------------------

export class HelpWindow extends Window {
  text = '';

  setText(t: string): void {
    this.text = t;
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    drawRichText(ctx, this.ui.images, this.text, r.x + 4, r.y, r.w - 8, { size: 19, lineHeight: 26, textContext: this.ui.textContext(), maxLines: Math.max(1, Math.floor(r.h / 26)) });
  }
}

export class GoldWindow extends Window {
  state: GameState;

  constructor(ui: UiContext, state: GameState, x: number, y: number, w: number) {
    super(ui, x, y, w, 56);
    this.state = state;
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const cur = this.ui.data.system.currency;
    const cw = measureText(ctx, cur, 18) + 8;
    drawText(ctx, String(this.state.gold), r.x + r.w - cw, r.y + r.h / 2, { size: 20, align: 'right' });
    drawText(ctx, cur, r.x + r.w, r.y + r.h / 2, { size: 18, align: 'right', color: UI.system });
  }
}

/** Party list with faces (main menu and target selection). */
export class PartyWindow extends SelectableWindow {
  state: GameState;
  /** For target selection: entries that can't be targeted are dimmed. */
  enabledFn: ((a: GameActor) => boolean) | null = null;
  compact = false;

  constructor(ui: UiContext, state: GameState, x: number, y: number, w: number, h: number) {
    super(ui, x, y, w, h);
    this.state = state;
  }

  members(): GameActor[] {
    return this.state.members();
  }

  maxItems(): number {
    return this.members().length;
  }

  override visibleRows(): number {
    return this.compact ? Math.max(1, Math.floor(this.inner.h / this.lineHeight)) : 4;
  }

  override itemRect(i: number): Rect {
    const r = this.inner;
    const rows = this.visibleRows();
    const h = this.compact ? this.lineHeight * 2 : Math.floor(r.h / rows);
    return { x: r.x, y: r.y + (i - this.topRow) * h, w: r.w, h };
  }

  override isEnabled(i: number): boolean {
    const a = this.members()[i];
    return !!a && (!this.enabledFn || this.enabledFn(a));
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, rect: Rect): void {
    const a = this.members()[i];
    if (!a) return;
    ctx.save();
    if (this.enabledFn && !this.enabledFn(a)) ctx.globalAlpha *= 0.55;
    const faceSize = Math.min(96, rect.h - 8);
    if (a.face) drawFace(ctx, this.ui.images, a.face, rect.x + 2, rect.y + (rect.h - faceSize) / 2, faceSize, faceSize, a.isDead() ? 0.5 : 1);
    else drawCharacterFrame(ctx, this.ui.images, a.character, rect.x + faceSize / 2, rect.y + rect.h - 10);
    const x = rect.x + faceSize + 12;
    drawActorBlock(ctx, this.ui, a, x, rect.y + (rect.h - 72) / 2, rect.w - faceSize - 16);
    ctx.restore();
  }
}

export type ItemCategory = 'item' | 'weapon' | 'armor' | 'key' | 'all';

export interface ListEntry {
  kind: ItemKind;
  item: AnyItem;
  count: number;
}

/** Inventory list (2 columns) for a category. */
export class ItemListWindow extends SelectableWindow {
  state: GameState;
  category: ItemCategory = 'item';
  entries: ListEntry[] = [];
  enabledFn: (e: ListEntry) => boolean = () => true;
  /** Shown instead of the count (e.g. prices in the shop). */
  rightText: ((e: ListEntry) => string) | null = null;
  help: HelpWindow | null = null;

  constructor(ui: UiContext, state: GameState, x: number, y: number, w: number, h: number, cols = 2) {
    super(ui, x, y, w, h);
    this.state = state;
    this.maxCols = cols;
    this.onSelect = () => this.updateHelp();
  }

  refresh(): void {
    const st = this.state;
    const d = this.ui.data;
    const out: ListEntry[] = [];
    const kinds: ItemKind[] = this.category === 'all' ? ['item', 'weapon', 'armor'] : this.category === 'weapon' ? ['weapon'] : this.category === 'armor' ? ['armor'] : ['item'];
    for (const kind of kinds) {
      for (const { id, count } of st.itemList(kind)) {
        const item = d.item(kind, id);
        if (!item) continue;
        if (kind === 'item' && 'itype' in item) {
          if (this.category === 'key' && item.itype !== 'key') continue;
          if (this.category === 'item' && item.itype === 'key') continue;
        }
        out.push({ kind, item, count });
      }
    }
    this.entries = out;
    if (this.index >= out.length) this.index = Math.max(0, out.length - 1);
    if (out.length === 0) this.index = -1;
    else if (this.index < 0) this.index = 0;
    this.ensureVisible();
    this.updateHelp();
  }

  current(): ListEntry | null {
    return this.entries[this.index] ?? null;
  }

  maxItems(): number {
    return this.entries.length;
  }

  override isEnabled(i: number): boolean {
    const e = this.entries[i];
    return !!e && this.enabledFn(e);
  }

  updateHelp(): void {
    this.help?.setText(this.current()?.item.description ?? '');
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const e = this.entries[i];
    ctx.save();
    if (!this.enabledFn(e)) ctx.globalAlpha *= UI.disabledAlpha;
    drawIcon(ctx, this.ui.images, e.item.icon, r.x, r.y + (r.h - 28) / 2, 28);
    const right = this.rightText ? this.rightText(e) : itemCountText(e.count);
    const rw = measureText(ctx, right, 18) + 6;
    drawText(ctx, e.item.name, r.x + 34, r.y + r.h / 2, { size: 19, maxWidth: r.w - 34 - rw });
    drawText(ctx, right, r.x + r.w, r.y + r.h / 2, { size: 18, align: 'right' });
    ctx.restore();
  }
}

/** Skills of an actor filtered by skill type (0 = all). */
export class SkillListWindow extends SelectableWindow {
  actor: GameActor | null = null;
  stypeId = 0;
  skills: Skill[] = [];
  enabledFn: (s: Skill) => boolean = () => true;
  help: HelpWindow | null = null;

  constructor(ui: UiContext, x: number, y: number, w: number, h: number, cols = 2) {
    super(ui, x, y, w, h);
    this.maxCols = cols;
    this.onSelect = () => this.updateHelp();
  }

  setActor(a: GameActor | null, stypeId: number): void {
    this.actor = a;
    this.stypeId = stypeId;
    this.refresh();
  }

  refresh(): void {
    const a = this.actor;
    this.skills = a ? a.allSkills().filter((s) => (this.stypeId ? s.stypeId === this.stypeId : s.stypeId > 0)) : [];
    if (this.index >= this.skills.length) this.index = this.skills.length - 1;
    if (this.index < 0 && this.skills.length) this.index = 0;
    this.ensureVisible();
    this.updateHelp();
  }

  current(): Skill | null {
    return this.skills[this.index] ?? null;
  }

  maxItems(): number {
    return this.skills.length;
  }

  override isEnabled(i: number): boolean {
    const s = this.skills[i];
    return !!s && this.enabledFn(s);
  }

  updateHelp(): void {
    this.help?.setText(this.current()?.description ?? '');
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const s = this.skills[i];
    ctx.save();
    if (!this.enabledFn(s)) ctx.globalAlpha *= UI.disabledAlpha;
    drawIcon(ctx, this.ui.images, s.icon, r.x, r.y + (r.h - 28) / 2, 28);
    const cost = s.mpCost > 0 ? String(s.mpCost) : '';
    drawText(ctx, s.name, r.x + 34, r.y + r.h / 2, { size: 19, maxWidth: r.w - 80 });
    if (cost) drawText(ctx, cost, r.x + r.w, r.y + r.h / 2, { size: 18, align: 'right', color: UI.mpCost });
    ctx.restore();
  }
}

/** Equipment slots of an actor. */
export class EquipSlotWindow extends SelectableWindow {
  actor: GameActor | null = null;

  maxItems(): number {
    return 5;
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const a = this.actor;
    const label = this.ui.data.system.terms.equipSlots[i] ?? `Slot ${i + 1}`;
    drawText(ctx, label, r.x, r.y + r.h / 2, { size: 17, color: UI.system, maxWidth: 110 });
    if (!a) return;
    const item = i === 0 ? a.weapon() : a.armorAt(i);
    if (item) {
      drawIcon(ctx, this.ui.images, item.icon, r.x + 116, r.y + (r.h - 28) / 2, 28);
      drawText(ctx, item.name, r.x + 150, r.y + r.h / 2, { size: 19, maxWidth: r.w - 150 });
    } else {
      drawText(ctx, '—', r.x + 150, r.y + r.h / 2, { size: 19, color: '#888' });
    }
  }
}

/** Parameter comparison for equipment changes. */
export class EquipStatusWindow extends Window {
  actor: GameActor | null = null;
  preview: number[] | null = null;

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const a = this.actor;
    if (!a) return;
    drawText(ctx, a.name, r.x, r.y + 14, { size: 20 });
    const names = this.ui.data.system.terms.params;
    for (let i = 2; i < 8; i++) {
      const y = r.y + 40 + (i - 2) * 30;
      drawText(ctx, names[i], r.x, y + 12, { size: 17, color: UI.system, maxWidth: 110 });
      drawText(ctx, String(a.param(i)), r.x + 150, y + 12, { size: 19, align: 'right' });
      if (this.preview) {
        const nv = this.preview[i];
        drawText(ctx, '→', r.x + 172, y + 12, { size: 17, align: 'center', color: UI.system });
        const color = nv > a.param(i) ? UI.powerUp : nv < a.param(i) ? UI.powerDown : UI.normal;
        drawText(ctx, String(nv), r.x + 230, y + 12, { size: 19, align: 'right', color });
      }
    }
  }
}

/** Full actor status page. */
export class StatusWindow extends Window {
  actor: GameActor | null = null;

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const a = this.actor;
    if (!a) return;
    const ui = this.ui;
    const t = ui.data.system.terms;
    drawFace(ctx, ui.images, a.face, r.x, r.y, 96, 96);
    drawText(ctx, a.name, r.x + 112, r.y + 16, { size: 24, bold: true });
    drawText(ctx, a.nickname, r.x + 112, r.y + 44, { size: 18, color: '#c8c8e0' });
    drawText(ctx, ui.data.classes.get(a.classId)?.name ?? '', r.x + 330, r.y + 16, { size: 20 });
    drawText(ctx, `${t.levelA} ${a.level}`, r.x + 330, r.y + 44, { size: 20, color: UI.system });
    drawStateIcons(ctx, ui, a, r.x + 112, r.y + 60, 6, 28);
    const gw = 200;
    drawParamGauge(ctx, t.hpA, a.hp, a.mhp, r.x + 330, r.y + 64, gw, UI.hp1, UI.hp2, hpColor(a));
    ctx.save();
    drawParamGauge(ctx, t.mpA, a.mp, a.mmp, r.x + 330, r.y + 98, gw, UI.mp1, UI.mp2);
    ctx.restore();
    // exp
    const ey = r.y + 140;
    drawText(ctx, `${t.exp}`, r.x, ey, { size: 18, color: UI.system });
    drawText(ctx, String(a.exp), r.x + 250, ey, { size: 19, align: 'right' });
    drawText(ctx, 'To next', r.x, ey + 28, { size: 18, color: UI.system });
    drawText(ctx, a.isMaxLevel() ? '—' : String(a.expToNext()), r.x + 250, ey + 28, { size: 19, align: 'right' });
    // params
    for (let i = 2; i < 8; i++) {
      const y = ey + 64 + (i - 2) * 28;
      drawText(ctx, t.params[i], r.x, y, { size: 18, color: UI.system, maxWidth: 140 });
      drawText(ctx, String(a.param(i)), r.x + 250, y, { size: 19, align: 'right' });
    }
    // equipment
    for (let s = 0; s < 5; s++) {
      const item = s === 0 ? a.weapon() : a.armorAt(s);
      const y = ey + s * 32;
      const x = r.x + 300;
      drawText(ctx, t.equipSlots[s] ?? '', x, y, { size: 16, color: UI.system, maxWidth: 90 });
      if (item) {
        drawIcon(ctx, ui.images, item.icon, x + 96, y - 14, 28);
        drawText(ctx, item.name, x + 130, y, { size: 18, maxWidth: r.w - 430 });
      }
    }
    const profile = ui.data.actors.get(a.actorId)?.profile ?? '';
    if (profile) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(r.x, r.y + r.h - 62, r.w, 1);
      ctx.restore();
      drawRichText(ctx, ui.images, profile, r.x, r.y + r.h - 56, r.w, { size: 18, lineHeight: 26, maxLines: 2 });
    }
  }
}
