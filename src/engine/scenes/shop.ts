/** Shop: buy and sell items with quantity selection. */

import type { ItemKind, ShopGood } from '../../core/types';
import { isArmor, isWeapon, type AnyItem } from '../data';
import type { Game } from '../game';
import { Scene } from '../scene';
import { MAX_ITEMS } from '../state/gamestate';
import { drawCharacterFrame, drawIcon } from '../ui/draw';
import { UI, drawText } from '../ui/text';
import { CommandWindow, SelectableWindow, Window, type Rect } from '../ui/window';
import { GoldWindow, HelpWindow, ItemListWindow, type ListEntry } from '../ui/windows';

interface BuyEntry {
  kind: ItemKind;
  item: AnyItem;
  price: number;
}

class BuyWindow extends SelectableWindow {
  goods: BuyEntry[] = [];
  gold = () => 0;
  help: HelpWindow | null = null;

  maxItems(): number {
    return this.goods.length;
  }

  current(): BuyEntry | null {
    return this.goods[this.index] ?? null;
  }

  override isEnabled(i: number): boolean {
    const g = this.goods[i];
    return !!g && g.price <= this.gold();
  }

  drawItem(ctx: CanvasRenderingContext2D, i: number, r: Rect): void {
    const g = this.goods[i];
    ctx.save();
    if (!this.isEnabled(i)) ctx.globalAlpha *= UI.disabledAlpha;
    drawIcon(ctx, this.ui.images, g.item.icon, r.x, r.y + 2, 28);
    drawText(ctx, g.item.name, r.x + 34, r.y + r.h / 2, { size: 19, maxWidth: r.w - 110 });
    drawText(ctx, String(g.price), r.x + r.w, r.y + r.h / 2, { size: 19, align: 'right' });
    ctx.restore();
  }
}

class QuantityWindow extends Window {
  item: AnyItem | null = null;
  qty = 1;
  max = 1;
  price = 0;
  onOk: (() => void) | null = null;
  onCancel: (() => void) | null = null;

  override update(): void {
    super.update();
    if (!this.active || this.justActivated()) return;
    const inp = this.ui.input;
    const change = (d: number) => {
      const next = Math.max(1, Math.min(this.max, this.qty + d));
      if (next !== this.qty) {
        this.qty = next;
        this.ui.sound('cursor');
      }
    };
    if (inp.isRepeated('right')) change(1);
    else if (inp.isRepeated('left')) change(-1);
    else if (inp.isRepeated('up')) change(10);
    else if (inp.isRepeated('down')) change(-10);
    else if (inp.isTriggered('ok')) {
      this.ui.sound('ok');
      this.onOk?.();
    } else if (inp.isTriggered('cancel')) {
      this.ui.sound('cancel');
      this.onCancel?.();
    }
    const p = inp.pointer;
    if (p.triggered && this.contains(p.x, p.y)) {
      const r = this.inner;
      if (p.y > r.y + 40) {
        this.ui.sound('ok');
        this.onOk?.();
      } else if (p.x < r.x + r.w / 2) change(-1);
      else change(1);
    }
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    if (!this.item) return;
    drawIcon(ctx, this.ui.images, this.item.icon, r.x, r.y + 2, 28);
    drawText(ctx, this.item.name, r.x + 34, r.y + 16, { size: 19, maxWidth: r.w - 140 });
    drawText(ctx, `◀ ${this.qty} ▶`, r.x + r.w, r.y + 16, { size: 20, align: 'right' });
    const total = `${this.qty * this.price} ${this.ui.data.system.currency}`;
    drawText(ctx, 'Total', r.x + 34, r.y + 56, { size: 18, color: UI.system });
    drawText(ctx, total, r.x + r.w, r.y + 56, { size: 20, align: 'right' });
    drawText(ctx, 'OK to confirm', r.x + r.w / 2, r.y + 96, { size: 15, align: 'center', color: '#a0a0c0' });
  }
}

class ShopStatusWindow extends Window {
  game: Game;
  item: AnyItem | null = null;
  kind: ItemKind = 'item';

  constructor(game: Game, x: number, y: number, w: number, h: number) {
    super(game, x, y, w, h);
    this.game = game;
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const item = this.item;
    if (!item) return;
    const st = this.game.state;
    drawText(ctx, this.game.data.system.terms.possession, r.x, r.y + 14, { size: 18, color: UI.system });
    drawText(ctx, String(st.numItems(this.kind, item.id)), r.x + r.w, r.y + 14, { size: 19, align: 'right' });
    if (!isWeapon(item) && !isArmor(item)) return;
    const param = isWeapon(item) ? 2 : 3;
    const label = this.game.data.system.terms.params[param];
    drawText(ctx, label, r.x, r.y + 50, { size: 16, color: UI.system });
    st.members().forEach((a, i) => {
      const y = r.y + 72 + i * 52;
      drawCharacterFrame(ctx, this.game.images, a.character, r.x + 16, y + 46);
      const can = isWeapon(item) ? a.canEquipWeapon(item) : a.canEquipArmor(item, item.slot);
      ctx.save();
      if (!can) ctx.globalAlpha *= 0.45;
      drawText(ctx, a.name, r.x + 40, y + 14, { size: 18, maxWidth: r.w - 100 });
      if (can) {
        const slot = isWeapon(item) ? 0 : item.slot;
        const cur = slot === 0 ? a.weapon() : a.armorAt(slot);
        const diff = (item.params[param] ?? 0) - (cur?.params[param] ?? 0);
        const color = diff > 0 ? UI.powerUp : diff < 0 ? UI.powerDown : UI.normal;
        drawText(ctx, `${diff >= 0 ? '+' : ''}${diff}`, r.x + r.w, y + 14, { size: 19, align: 'right', color });
      } else {
        drawText(ctx, "Can't equip", r.x + 40, y + 34, { size: 15, color: '#a0a0b0' });
      }
      ctx.restore();
    });
  }
}

type ShopMode = 'command' | 'buy' | 'buyQty' | 'sell' | 'sellQty';

export class ShopScene extends Scene {
  private onEnd: () => void;
  private mode: ShopMode = 'command';
  private help: HelpWindow;
  private commands: CommandWindow;
  private gold: GoldWindow;
  private buy: BuyWindow;
  private sell: ItemListWindow;
  private status: ShopStatusWindow;
  private qty: QuantityWindow;

  constructor(game: Game, goods: ShopGood[], purchaseOnly: boolean, onEnd: () => void) {
    super(game);
    this.transparent = true;
    this.onEnd = onEnd;
    const t = game.data.system.terms;
    const W = game.width;
    const H = game.height;
    this.help = new HelpWindow(game, 0, 0, W, 80);
    this.commands = new CommandWindow(
      game,
      0,
      80,
      W - 200,
      [
        { name: t.buy, symbol: 'buy', enabled: true },
        { name: t.sell, symbol: 'sell', enabled: !purchaseOnly },
        { name: t.cancel, symbol: 'cancel', enabled: true },
      ],
      1,
      3,
    );
    this.commands.align = 'center';
    this.gold = new GoldWindow(game, game.state, W - 200, 80, 200);
    const listY = 136;
    this.buy = new BuyWindow(game, 0, listY, W - 260, H - listY);
    this.buy.gold = () => game.state.gold;
    this.buy.goods = goods
      .map((g): BuyEntry | null => {
        const item = game.data.item(g.kind, g.id);
        return item ? { kind: g.kind, item, price: g.price ?? item.price } : null;
      })
      .filter((x): x is BuyEntry => !!x);
    this.buy.visible = false;
    this.buy.help = this.help;
    this.buy.onSelect = () => this.onBuySelect();
    this.sell = new ItemListWindow(game, game.state, 0, listY, W, H - listY);
    this.sell.visible = false;
    this.sell.help = this.help;
    this.sell.rightText = (e) => `${Math.floor(e.item.price / 2)}`;
    this.sell.enabledFn = (e: ListEntry) => e.item.price > 0 && !('itype' in e.item && e.item.itype === 'key');
    this.status = new ShopStatusWindow(game, W - 260, listY, 260, H - listY);
    this.status.visible = false;
    this.qty = new QuantityWindow(game, (W - 380) / 2, (H - 150) / 2, 380, 150);
    this.qty.visible = false;

    this.commands.setHandler('buy', () => this.setMode('buy'));
    this.commands.setHandler('sell', () => this.setMode('sell'));
    this.commands.setHandler('cancel', () => this.close());
    this.buy.setHandler('ok', () => this.startQuantity('buy'));
    this.buy.setHandler('cancel', () => this.setMode('command'));
    this.sell.setHandler('ok', () => this.startQuantity('sell'));
    this.sell.setHandler('cancel', () => this.setMode('command'));
    this.qty.onOk = () => this.confirmQuantity();
    this.qty.onCancel = () => this.setMode(this.mode === 'buyQty' ? 'buy' : 'sell');
  }

  override start(): void {
    this.setMode('command');
  }

  private close(): void {
    this.game.pop();
    this.onEnd();
  }

  private onBuySelect(): void {
    const e = this.buy.current();
    this.help.setText(e?.item.description ?? '');
    this.status.item = e?.item ?? null;
    this.status.kind = e?.kind ?? 'item';
  }

  private setMode(m: ShopMode): void {
    this.mode = m;
    this.commands.active = m === 'command';
    this.buy.visible = m === 'buy' || m === 'buyQty';
    this.buy.active = m === 'buy';
    this.status.visible = this.buy.visible;
    this.sell.visible = m === 'sell' || m === 'sellQty';
    this.sell.active = m === 'sell';
    this.qty.visible = m === 'buyQty' || m === 'sellQty';
    this.qty.active = this.qty.visible;
    if (m === 'buy') {
      if (this.buy.index < 0 || this.buy.index >= this.buy.maxItems()) this.buy.select(0);
      this.onBuySelect();
    }
    if (m === 'sell') {
      this.sell.category = 'all';
      this.sell.refresh();
    }
    if (m === 'command') this.help.setText('');
  }

  private startQuantity(kind: 'buy' | 'sell'): void {
    const q = this.qty;
    if (kind === 'buy') {
      const e = this.buy.current();
      if (!e) return;
      q.item = e.item;
      q.price = e.price;
      const owned = this.game.state.numItems(e.kind, e.item.id);
      q.max = Math.max(1, Math.min(MAX_ITEMS - owned, e.price > 0 ? Math.floor(this.game.state.gold / e.price) : MAX_ITEMS));
      if (owned >= MAX_ITEMS) {
        this.game.sound('buzzer');
        return;
      }
    } else {
      const e = this.sell.current();
      if (!e) return;
      q.item = e.item;
      q.price = Math.floor(e.item.price / 2);
      q.max = e.count;
    }
    q.qty = 1;
    this.setMode(kind === 'buy' ? 'buyQty' : 'sellQty');
  }

  private confirmQuantity(): void {
    const st = this.game.state;
    const q = this.qty;
    if (this.mode === 'buyQty') {
      const e = this.buy.current()!;
      st.gainGold(-q.qty * q.price);
      st.gainItem(e.kind, e.item.id, q.qty);
      this.game.sound('shop');
      this.setMode('buy');
    } else {
      const e = this.sell.current()!;
      st.gainGold(q.qty * q.price);
      st.gainItem(e.kind, e.item.id, -q.qty);
      this.game.sound('shop');
      this.setMode('sell');
    }
  }

  update(): void {
    this.help.update();
    this.commands.update();
    this.gold.update();
    if (this.mode === 'buy') this.buy.update();
    if (this.mode === 'sell') this.sell.update();
    if (this.qty.visible) this.qty.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    ctx.fillStyle = 'rgba(0,0,10,0.5)';
    ctx.fillRect(0, 0, g.width, g.height);
    this.help.draw(ctx);
    this.commands.draw(ctx);
    this.gold.draw(ctx);
    this.buy.draw(ctx);
    this.status.draw(ctx);
    this.sell.draw(ctx);
    if (this.qty.visible) this.qty.draw(ctx);
    if (this.mode === 'command') {
      const msg = 'Welcome! What would you like?';
      drawText(ctx, msg, g.width / 2, 136 + (g.height - 136) / 2, { size: 20, align: 'center', color: '#e0e0f0' });
    }
  }
}
