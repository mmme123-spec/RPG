/** Main menu and its sub-screens: items, skills, equipment, status, game end. */

import type { Item, Skill } from '../../core/types';
import { BattleAction, applyAction, canUse, hasEffectOn, scopeIsForAll, scopeIsFriend, type UsableItem } from '../battle/logic';
import type { Game } from '../game';
import { Scene } from '../scene';
import type { GameActor } from '../state/actor';
import { CommandWindow } from '../ui/window';
import {
  EquipSlotWindow,
  EquipStatusWindow,
  GoldWindow,
  HelpWindow,
  ItemListWindow,
  PartyWindow,
  SkillListWindow,
  StatusWindow,
  drawActorBlock,
  type ItemCategory,
} from '../ui/windows';
import { SaveScene } from './save';
import { TitleScene } from './title';

function dim(ctx: CanvasRenderingContext2D, game: Game): void {
  ctx.fillStyle = 'rgba(0,0,10,0.5)';
  ctx.fillRect(0, 0, game.width, game.height);
}

/** Apply a usable item/skill to targets from the menu. Returns true if anything happened. */
function useOnTargets(game: Game, user: GameActor, item: UsableItem, targets: GameActor[]): boolean {
  const action = new BattleAction(user, item);
  let any = false;
  for (const t of targets) {
    if (!hasEffectOn(item, t)) continue;
    for (let r = 0; r < Math.max(1, item.repeats); r++) {
      const out = applyAction(action, t, { data: game.data, variables: game.state.variables, rng: game.rng });
      if (out.success) any = true;
      for (const id of out.commonEvents) game.state.reservedCommonEvents.push(id);
    }
  }
  if (!any && item.effects.some((e) => e.kind === 'commonEvent')) {
    for (const e of item.effects) if (e.kind === 'commonEvent') game.state.reservedCommonEvents.push(e.commonEventId);
    any = true;
  }
  game.state.touch();
  return any;
}

/** Party target selection shared by the item and skill screens. */
class TargetSelector {
  readonly window: PartyWindow;
  onChosen: ((targets: GameActor[]) => void) | null = null;
  onCancel: (() => void) | null = null;

  constructor(game: Game) {
    this.window = new PartyWindow(game, game.state, game.width - 400, 0, 400, game.height);
    this.window.visible = false;
    this.window.setHandler('ok', () => {
      const members = this.window.members();
      const targets = this.window.cursorAll ? members : [members[this.window.index]].filter(Boolean);
      this.onChosen?.(targets);
    });
    this.window.setHandler('cancel', () => this.onCancel?.());
  }

  open(item: UsableItem): void {
    const w = this.window;
    w.cursorAll = scopeIsForAll(item.scope);
    w.enabledFn = (a) => (item.scope === 'deadAlly' || item.scope === 'allDeadAllies' ? a.isDead() : a.isAlive() || item.scope === 'user');
    w.visible = true;
    w.select(Math.max(0, w.index));
    w.activate();
  }

  close(): void {
    this.window.visible = false;
    this.window.deactivate();
  }
}

export class MenuScene extends Scene {
  private commands: CommandWindow;
  private gold: GoldWindow;
  private party: PartyWindow;
  private pendingCommand: string | null = null;

  constructor(game: Game) {
    super(game);
    this.transparent = true;
    const t = game.data.system.terms;
    const m = game.data.system.menu;
    const st = game.state;
    const noParty = st.members().length === 0;
    this.commands = new CommandWindow(game, 0, 0, 200, [
      { name: t.item, symbol: 'item', enabled: m.item },
      { name: t.skill, symbol: 'skill', enabled: m.skill && !noParty },
      { name: t.equip, symbol: 'equip', enabled: m.equip && !noParty },
      { name: t.status, symbol: 'status', enabled: m.status && !noParty },
      { name: t.save, symbol: 'save', enabled: m.save && st.saveEnabled },
      { name: t.gameEnd, symbol: 'gameEnd', enabled: true },
    ]);
    this.gold = new GoldWindow(game, st, 0, game.height - 56, 200);
    this.party = new PartyWindow(game, st, 200, 0, game.width - 200, game.height);
    this.commands.setHandler('item', () => game.push(new ItemScene(game)));
    for (const sym of ['skill', 'equip', 'status']) this.commands.setHandler(sym, () => this.selectActor(sym));
    this.commands.setHandler('save', () => game.push(new SaveScene(game, 'save', () => {})));
    this.commands.setHandler('gameEnd', () => game.push(new GameEndScene(game)));
    this.commands.setHandler('cancel', () => game.pop());
    this.party.setHandler('ok', () => this.onActorChosen());
    this.party.setHandler('cancel', () => {
      this.party.deactivate();
      this.party.select(-1);
      this.commands.activate();
    });
  }

  override start(): void {
    this.commands.activate();
    this.party.select(-1);
  }

  override resume(): void {
    this.commands.activate();
    this.party.deactivate();
    this.party.select(-1);
    this.commands.commands[4].enabled = this.game.data.system.menu.save && this.game.state.saveEnabled;
    if (this.game.state.reservedCommonEvents.length > 0) this.game.pop();
  }

  private selectActor(sym: string): void {
    this.pendingCommand = sym;
    this.commands.deactivate();
    this.party.select(Math.max(0, this.party.index));
    this.party.activate();
  }

  private onActorChosen(): void {
    const actor = this.game.state.members()[this.party.index];
    if (!actor) return;
    const g = this.game;
    if (this.pendingCommand === 'skill') g.push(new SkillScene(g, actor));
    else if (this.pendingCommand === 'equip') g.push(new EquipScene(g, actor));
    else if (this.pendingCommand === 'status') g.push(new StatusScene(g, actor));
  }

  update(): void {
    this.commands.update();
    this.party.update();
    this.gold.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    dim(ctx, this.game);
    this.commands.draw(ctx);
    this.gold.draw(ctx);
    this.party.draw(ctx);
  }
}

class ItemScene extends Scene {
  private help: HelpWindow;
  private categories: CommandWindow;
  private list: ItemListWindow;
  private target: TargetSelector;

  constructor(game: Game) {
    super(game);
    this.transparent = true;
    const t = game.data.system.terms;
    this.help = new HelpWindow(game, 0, 0, game.width, 80);
    this.categories = new CommandWindow(
      game,
      0,
      80,
      game.width,
      [
        { name: t.item, symbol: 'item', enabled: true },
        { name: t.weapon, symbol: 'weapon', enabled: true },
        { name: t.armor, symbol: 'armor', enabled: true },
        { name: t.keyItem, symbol: 'key', enabled: true },
      ],
      1,
      4,
    );
    this.categories.align = 'center';
    this.list = new ItemListWindow(game, game.state, 0, 136, game.width, game.height - 136);
    this.list.help = this.help;
    this.list.enabledFn = (e) => {
      const user = this.user();
      return !!user && e.kind === 'item' && canUse(user, e.item as Item, false) && (e.item as Item).scope !== 'none';
    };
    this.target = new TargetSelector(game);
    this.categories.onSelect = () => {
      this.list.category = this.categories.currentSymbol() as ItemCategory;
      this.list.topRow = 0;
      this.list.index = 0;
      this.list.refresh();
    };
    this.categories.setHandler('ok', () => {
      this.categories.deactivate();
      this.list.activate();
      if (this.list.index < 0 && this.list.maxItems() > 0) this.list.select(0);
    });
    this.categories.setHandler('cancel', () => game.pop());
    this.list.setHandler('ok', () => this.onItem());
    this.list.setHandler('cancel', () => {
      this.list.deactivate();
      this.categories.activate();
      this.help.setText('');
    });
    this.target.onChosen = (targets) => this.applyTo(targets);
    this.target.onCancel = () => {
      this.target.close();
      this.list.activate();
    };
  }

  private user(): GameActor | null {
    return this.game.state.members().find((a) => a.isAlive()) ?? this.game.state.members()[0] ?? null;
  }

  override start(): void {
    this.categories.select(0);
    this.categories.activate();
  }

  private onItem(): void {
    const e = this.list.current();
    if (!e) return;
    const item = e.item as Item;
    if (scopeIsFriend(item.scope)) {
      this.list.deactivate();
      this.target.open(item);
    } else {
      this.game.sound('buzzer');
    }
  }

  private applyTo(targets: GameActor[]): void {
    const e = this.list.current();
    const user = this.user();
    if (!e || !user) return;
    const item = e.item as Item;
    if (useOnTargets(this.game, user, item, targets)) {
      this.game.sound('useItem');
      if (item.consumable) this.game.state.gainItem('item', item.id, -1);
      this.list.refresh();
      if (this.game.state.reservedCommonEvents.length > 0) {
        // the main menu closes itself on resume so the common event can run
        this.game.pop();
        return;
      }
      if (this.game.state.numItems('item', item.id) <= 0) {
        this.target.close();
        this.list.activate();
      }
    } else {
      this.game.sound('buzzer');
    }
  }

  update(): void {
    this.help.update();
    this.categories.update();
    this.list.update();
    this.target.window.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    dim(ctx, this.game);
    this.help.draw(ctx);
    this.categories.draw(ctx);
    this.list.draw(ctx);
    this.target.window.draw(ctx);
  }
}

class SkillScene extends Scene {
  private actor: GameActor;
  private help: HelpWindow;
  private types: CommandWindow;
  private list: SkillListWindow;
  private target: TargetSelector;
  private summary: HelpWindow;

  constructor(game: Game, actor: GameActor) {
    super(game);
    this.transparent = true;
    this.actor = actor;
    this.help = new HelpWindow(game, 0, 0, game.width, 80);
    this.summary = new HelpWindow(game, 200, 80, game.width - 200, 116);
    const stypes = actor.skillTypes().length ? actor.skillTypes() : [...new Set(actor.allSkills().map((s) => s.stypeId).filter((x) => x > 0))];
    this.types = new CommandWindow(
      game,
      0,
      80,
      200,
      stypes.map((id) => ({ name: game.data.system.skillTypes[id - 1] ?? 'Skills', symbol: String(id), enabled: true })),
      3,
    );
    this.list = new SkillListWindow(game, 0, 196, game.width, game.height - 196);
    this.list.help = this.help;
    this.list.enabledFn = (s) => canUse(actor, s, false) && s.occasion !== 'battle' && scopeIsFriend(s.scope);
    this.target = new TargetSelector(game);
    this.types.onSelect = () => this.list.setActor(actor, Number(this.types.currentSymbol() ?? 0));
    this.types.setHandler('ok', () => {
      this.types.deactivate();
      this.list.activate();
      if (this.list.index < 0 && this.list.maxItems() > 0) this.list.select(0);
    });
    this.types.setHandler('cancel', () => game.pop());
    this.list.setHandler('ok', () => {
      const s = this.list.current();
      if (!s) return;
      this.list.deactivate();
      this.target.open(s);
    });
    this.list.setHandler('cancel', () => {
      this.list.deactivate();
      this.types.activate();
    });
    this.target.onChosen = (targets) => this.applyTo(targets);
    this.target.onCancel = () => {
      this.target.close();
      this.list.activate();
    };
  }

  override start(): void {
    this.types.select(0);
    this.list.setActor(this.actor, Number(this.types.currentSymbol() ?? 0));
    this.types.activate();
  }

  private applyTo(targets: GameActor[]): void {
    const s: Skill | null = this.list.current();
    if (!s || !canUse(this.actor, s, false)) {
      this.game.sound('buzzer');
      return;
    }
    const list = s.scope === 'user' ? [this.actor] : targets;
    if (useOnTargets(this.game, this.actor, s, list)) {
      this.game.sound('useSkill');
      this.actor.gainMp(-s.mpCost);
      this.list.refresh();
      if (this.game.state.reservedCommonEvents.length > 0) {
        this.game.pop();
        return;
      }
      if (!canUse(this.actor, s, false)) {
        this.target.close();
        this.list.activate();
      }
    } else {
      this.game.sound('buzzer');
    }
  }

  update(): void {
    this.help.update();
    this.types.update();
    this.list.update();
    this.target.window.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    dim(ctx, g);
    this.help.draw(ctx);
    this.types.draw(ctx);
    // actor summary next to the type list
    this.summary.draw(ctx);
    drawActorBlock(ctx, g, this.actor, this.summary.x + 16, this.summary.y + 20, this.summary.w - 32);
    this.list.draw(ctx);
    this.target.window.draw(ctx);
  }
}

class EquipScene extends Scene {
  private actor: GameActor;
  private help: HelpWindow;
  private status: EquipStatusWindow;
  private slots: EquipSlotWindow;
  private items: ItemListWindow;

  constructor(game: Game, actor: GameActor) {
    super(game);
    this.transparent = true;
    this.actor = actor;
    this.help = new HelpWindow(game, 0, 0, game.width, 80);
    this.status = new EquipStatusWindow(game, 0, 80, 260, game.height - 80);
    this.status.actor = actor;
    this.slots = new EquipSlotWindow(game, 260, 80, game.width - 260, 5 * 32 + 24);
    this.slots.actor = actor;
    const listY = 80 + this.slots.h;
    this.items = new ItemListWindow(game, game.state, 260, listY, game.width - 260, game.height - listY, 1);
    this.items.help = this.help;
    this.slots.onSelect = () => this.refreshItems();
    this.slots.setHandler('ok', () => {
      this.slots.deactivate();
      this.items.activate();
      this.items.select(0);
    });
    this.slots.setHandler('cancel', () => game.pop());
    this.slots.setHandler('pagedown', () => this.switchActor(1));
    this.slots.setHandler('pageup', () => this.switchActor(-1));
    this.items.onSelect = () => {
      this.items.updateHelp();
      this.updatePreview();
    };
    this.items.setHandler('ok', () => this.equipSelected());
    this.items.setHandler('cancel', () => {
      this.items.deactivate();
      this.status.preview = null;
      this.slots.activate();
    });
  }

  private switchActor(d: number): void {
    const members = this.game.state.members();
    const i = members.indexOf(this.actor);
    this.actor = members[(i + d + members.length) % members.length];
    this.status.actor = this.actor;
    this.slots.actor = this.actor;
    this.refreshItems();
  }

  override start(): void {
    this.slots.select(0);
    this.slots.activate();
    this.refreshItems();
  }

  /** Equippable items for the current slot plus an "unequip" entry. */
  private refreshItems(): void {
    const slot = Math.max(0, this.slots.index);
    const a = this.actor;
    this.items.category = slot === 0 ? 'weapon' : 'armor';
    this.items.refresh();
    this.items.entries = this.items.entries.filter((e) => (slot === 0 ? 'wtypeId' in e.item && a.canEquipWeapon(e.item) : 'atypeId' in e.item && a.canEquipArmor(e.item, slot)));
    this.items.entries.push({ kind: slot === 0 ? 'weapon' : 'armor', item: { id: 0, name: '(Remove)', description: 'Unequip this slot.', icon: 0 } as never, count: 0 });
    this.items.rightText = (e) => (e.item.id === 0 ? '' : `×${e.count}`);
    if (this.items.index >= this.items.entries.length) this.items.index = 0;
    this.help.setText(this.slotItemDescription());
  }

  private slotItemDescription(): string {
    const s = Math.max(0, this.slots.index);
    const item = s === 0 ? this.actor.weapon() : this.actor.armorAt(s);
    return item?.description ?? '';
  }

  private updatePreview(): void {
    const e = this.items.current();
    if (!e) {
      this.status.preview = null;
      return;
    }
    const slot = this.slots.index;
    const old = this.actor.equips[slot];
    this.actor.equips[slot] = e.item.id;
    this.status.preview = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => this.actor.param(i));
    this.actor.equips[slot] = old;
  }

  private equipSelected(): void {
    const e = this.items.current();
    if (!e) return;
    const ok = this.game.state.changeEquip(this.actor, this.slots.index, e.item.id);
    if (ok) {
      this.game.sound('equip');
      this.items.deactivate();
      this.status.preview = null;
      this.slots.activate();
      this.refreshItems();
    } else {
      this.game.sound('buzzer');
    }
  }

  update(): void {
    this.help.update();
    this.slots.update();
    this.items.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    dim(ctx, this.game);
    this.help.draw(ctx);
    this.status.draw(ctx);
    this.slots.draw(ctx);
    this.items.draw(ctx);
  }
}

class StatusScene extends Scene {
  private window: StatusWindow;
  private actor: GameActor;

  constructor(game: Game, actor: GameActor) {
    super(game);
    this.transparent = true;
    this.actor = actor;
    this.window = new StatusWindow(game, 0, 0, game.width, game.height);
    this.window.actor = actor;
  }

  update(): void {
    const inp = this.game.input;
    if (inp.isTriggered('cancel') || inp.isTriggered('ok') || inp.pointer.triggered) {
      this.game.sound('cancel');
      this.game.pop();
      return;
    }
    const members = this.game.state.members();
    let d = 0;
    if (inp.isTriggered('pagedown') || inp.isRepeated('right')) d = 1;
    if (inp.isTriggered('pageup') || inp.isRepeated('left')) d = -1;
    if (d && members.length > 1) {
      const i = members.indexOf(this.actor);
      this.actor = members[(i + d + members.length) % members.length];
      this.window.actor = this.actor;
      this.game.sound('cursor');
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    dim(ctx, this.game);
    this.window.draw(ctx);
  }
}

class GameEndScene extends Scene {
  private commands: CommandWindow;

  constructor(game: Game) {
    super(game);
    this.transparent = true;
    const t = game.data.system.terms;
    this.commands = new CommandWindow(game, (game.width - 240) / 2, (game.height - 88) / 2, 240, [
      { name: t.toTitle, symbol: 'title', enabled: true },
      { name: t.cancel, symbol: 'cancel', enabled: true },
    ]);
    this.commands.align = 'center';
    this.commands.setHandler('title', () => {
      game.audio.fadeOutBgm(0.6);
      game.goto(new TitleScene(game));
    });
    this.commands.setHandler('cancel', () => game.pop());
  }

  override start(): void {
    this.commands.activate();
  }

  update(): void {
    this.commands.update();
  }

  render(ctx: CanvasRenderingContext2D): void {
    dim(ctx, this.game);
    this.commands.draw(ctx);
  }
}

