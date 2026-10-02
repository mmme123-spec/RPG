/**
 * Front-view turn-based battle scene.
 *
 * The battle flow is written as a generator that yields waits (frame counts,
 * 'input' while the player chooses commands, or 'key' to wait for a key).
 */

import type { Item, Skill } from '../../core/types';
import { BattleAction, applyAction, canUse, escapeRatio, isSkill, scopeIsForAll, scopeIsFriend, scopeNeedsSelection, type ActionOutcome } from '../battle/logic';
import type { Game } from '../game';
import type { BattleResult } from '../host';
import { EffectAnimation } from '../render/effects';
import { Scene } from '../scene';
import type { GameActor } from '../state/actor';
import { DEATH_STATE, type Battler } from '../state/battler';
import { GameEnemy } from '../state/enemy';
import { drawIcon, drawWindowFrame } from '../ui/draw';
import { UI, drawText } from '../ui/text';
import { CommandWindow, Window, type Rect } from '../ui/window';
import { HelpWindow, ItemListWindow, SkillListWindow, drawParamGauge, hpColor } from '../ui/windows';
import { GameOverScene } from './title';

type Wait = number | 'input' | 'key';

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  frame: number;
  size: number;
}

interface EnemyFx {
  flash: number;
  shake: number;
  collapse: number;
  blink: number;
}

function fmt(template: string, ...args: string[]): string {
  return template.replace(/%(\d)/g, (_, n) => args[Number(n) - 1] ?? '');
}

class BattleLog extends Window {
  lines: string[] = [];

  push(text: string): void {
    if (!text) return;
    this.lines.push(text);
    while (this.lines.length > 4) this.lines.shift();
  }

  clear(): void {
    this.lines = [];
  }

  override draw(ctx: CanvasRenderingContext2D): void {
    if (this.lines.length === 0) return;
    const h = this.lines.length * 30 + 16;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, h + 20);
    g.addColorStop(0, 'rgba(0,0,0,0.65)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(this.x, this.y, this.w, h + 20);
    this.lines.forEach((l, i) => drawText(ctx, l, this.x + 24, this.y + 22 + i * 30, { size: 20, maxWidth: this.w - 48 }));
    ctx.restore();
  }
}

class StatusWindow extends Window {
  actors: GameActor[] = [];
  highlight: GameActor | null = null;
  cursor: GameActor | null = null;
  cursorAll = false;
  fx = new Map<GameActor, { flash: number; shake: number }>();

  rowRect(i: number): Rect {
    const r = this.inner;
    return { x: r.x, y: r.y + i * 32, w: r.w, h: 32 };
  }

  protected override drawContents(ctx: CanvasRenderingContext2D, r: Rect): void {
    const t = this.ui.data.system.terms;
    this.actors.forEach((a, i) => {
      const row = this.rowRect(i);
      const fx = this.fx.get(a);
      const dx = fx && fx.shake > 0 ? Math.sin(fx.shake * 1.7) * 3 : 0;
      ctx.save();
      ctx.translate(dx, 0);
      const active = a === this.highlight || a === this.cursor || (this.cursorAll && this.cursor !== null);
      if (active) {
        ctx.fillStyle = a === this.cursor || this.cursorAll ? `rgba(255,255,255,${0.22 + 0.1 * Math.sin(this.ui.frameCount() / 6)})` : 'rgba(255,255,255,0.14)';
        ctx.fillRect(row.x - 4, row.y + 1, row.w + 8, row.h - 2);
      }
      if (fx && fx.flash > 0) {
        ctx.fillStyle = `rgba(255,80,80,${fx.flash / 24})`;
        ctx.fillRect(row.x - 4, row.y + 1, row.w + 8, row.h - 2);
      }
      drawText(ctx, a.name, row.x, row.y + 16, { size: 19, color: hpColor(a), maxWidth: 104 });
      a.displayStates()
        .slice(0, 2)
        .forEach((s, k) => drawIcon(ctx, this.ui.images, s.icon, row.x + 106 + k * 22, row.y + 5, 22));
      const gx = row.x + 156;
      const hpW = 136;
      drawParamGauge(ctx, t.hpA, a.hp, a.mhp, gx, row.y - 6, hpW, UI.hp1, UI.hp2, hpColor(a));
      drawParamGauge(ctx, t.mpA, a.mp, a.mmp, gx + hpW + 12, row.y - 6, r.w - 156 - hpW - 12, UI.mp1, UI.mp2);
      ctx.restore();
    });
  }
}

export class BattleScene extends Scene {
  private troopId: number;
  private canEscape: boolean;
  private canLose: boolean;
  private onEnd: (r: BattleResult) => void;
  private enemies: GameEnemy[] = [];
  private flow: Generator<Wait, void, void> | null = null;
  private waitCount = 0;
  private waitKey = false;
  private inputActive = false;
  private turn = 0;
  private escapeFailures = 0;
  private fadeIn = 30;
  private fadeOut = 0;
  private onFadedOut: (() => void) | null = null;
  // windows
  private log: BattleLog;
  private status: StatusWindow;
  private partyCmd: CommandWindow;
  private actorCmd: CommandWindow;
  private help: HelpWindow;
  private skillWin: SkillListWindow;
  private itemWin: ItemListWindow;
  // input state
  private inputIndex = -1;
  private actions = new Map<Battler, BattleAction>();
  private escapeChosen = false;
  private targeting: { action: BattleAction; side: 'enemy' | 'actor'; index: number; back: () => void; frame: number } | null = null;
  // visuals
  private enemyFx = new Map<GameEnemy, EnemyFx>();
  private popups: Popup[] = [];
  private anims: EffectAnimation[] = [];
  private screenShake = 0;
  private active: Battler | null = null;

  constructor(game: Game, troopId: number, canEscape: boolean, canLose: boolean, onEnd: (r: BattleResult) => void) {
    super(game);
    this.troopId = troopId;
    this.canEscape = canEscape;
    this.canLose = canLose;
    this.onEnd = onEnd;
    const W = game.width;
    const H = game.height;
    const t = game.data.system.terms;
    this.log = new BattleLog(game, 0, 0, W, 140);
    this.status = new StatusWindow(game, 192, H - 152, W - 192, 152);
    this.partyCmd = new CommandWindow(game, 0, H - 152, 192, [
      { name: t.fight, symbol: 'fight', enabled: true },
      { name: t.escape, symbol: 'escape', enabled: canEscape },
    ], 4);
    this.actorCmd = new CommandWindow(game, 0, H - 152, 192, [], 4);
    this.help = new HelpWindow(game, 0, 0, W, 80);
    this.skillWin = new SkillListWindow(game, 0, 80, W, H - 152 - 80);
    this.skillWin.help = this.help;
    this.itemWin = new ItemListWindow(game, game.state, 0, 80, W, H - 152 - 80);
    this.itemWin.help = this.help;
    for (const w of [this.partyCmd, this.actorCmd, this.help, this.skillWin, this.itemWin]) w.visible = false;
    this.partyCmd.setHandler('fight', () => this.startActorInput());
    this.partyCmd.setHandler('escape', () => {
      this.escapeChosen = true;
      this.finishInput();
    });
    this.actorCmd.setHandler('attack', () => this.chooseAction(this.game.data.skills.get(this.game.data.system.attackSkillId)));
    this.actorCmd.setHandler('guard', () => this.chooseAction(this.game.data.skills.get(this.game.data.system.guardSkillId)));
    this.actorCmd.setHandler('skill', () => this.openSkills(Number(this.actorCmd.currentExt() ?? 0)));
    this.actorCmd.setHandler('item', () => this.openItems());
    this.actorCmd.setHandler('cancel', () => this.prevActor());
    this.skillWin.setHandler('ok', () => this.chooseAction(this.skillWin.current() ?? undefined, () => this.reopen(this.skillWin)));
    this.skillWin.setHandler('cancel', () => this.closeList());
    this.itemWin.setHandler('ok', () => this.chooseAction((this.itemWin.current()?.item as Item | undefined) ?? undefined, () => this.reopen(this.itemWin)));
    this.itemWin.setHandler('cancel', () => this.closeList());
  }

  override start(): void {
    const g = this.game;
    const troop = g.data.troops.get(this.troopId);
    const members = troop?.members ?? [];
    const counts = new Map<number, number>();
    members.forEach((m) => counts.set(m.enemyId, (counts.get(m.enemyId) ?? 0) + 1));
    const letters = new Map<number, number>();
    members.forEach((m, i) => {
      if (!g.data.enemies.has(m.enemyId)) return;
      const e = new GameEnemy(g.data, m.enemyId, i, m.x, m.y, m.hidden);
      if ((counts.get(m.enemyId) ?? 0) > 1) {
        const n = letters.get(m.enemyId) ?? 0;
        e.letter = String.fromCharCode(65 + n);
        letters.set(m.enemyId, n + 1);
      }
      this.enemies.push(e);
      this.enemyFx.set(e, { flash: 0, shake: 0, collapse: -1, blink: 0 });
    });
    this.status.actors = g.state.battleMembers();
    if (!g.audio.currentBgm() || g.audio.currentBgm()?.name !== g.data.system.battleBgm?.name) g.audio.playBgm(g.data.system.battleBgm);
    this.flow = this.main();
  }

  // --- helpers --------------------------------------------------------------------------

  private actors(): GameActor[] {
    return this.game.state.battleMembers();
  }

  private aliveEnemies(): GameEnemy[] {
    return this.enemies.filter((e) => e.isAlive() && !e.hidden);
  }

  private isOver(): boolean {
    return this.aliveEnemies().length === 0 || this.actors().every((a) => a.isDead());
  }

  private enemyImage(e: GameEnemy) {
    const d = e.enemyData();
    return d ? this.game.images.enemy(d.battler, d.hue) : null;
  }

  /** Screen point to centre effects on a battler. */
  private battlerPoint(b: Battler): { x: number; y: number; scale: number } {
    if (b instanceof GameEnemy) {
      const img = this.enemyImage(b);
      const h = img ? img.height : 64;
      return { x: b.screenX, y: b.screenY - h / 2, scale: Math.max(0.8, Math.min(2, h / 90)) };
    }
    const i = this.status.actors.indexOf(b as GameActor);
    const row = this.status.rowRect(Math.max(0, i));
    return { x: this.status.x + this.status.w / 2, y: row.y + 16, scale: 0.7 };
  }

  private popup(b: Battler, text: string, color: string, size = 28): void {
    const p = this.battlerPoint(b);
    const stack = this.popups.filter((q) => q.frame < 20 && Math.abs(q.x - p.x) < 10).length;
    this.popups.push({ x: p.x, y: p.y - stack * 24, text, color, frame: 0, size });
  }

  private animationFor(action: BattleAction): string {
    const key = action.item.animation;
    if (key === 'attack') return action.subject.isActor() ? (action.subject as GameActor).attackAnimation() : 'hit';
    return key;
  }

  // --- main flow -----------------------------------------------------------------------

  private *main(): Generator<Wait, void, void> {
    const g = this.game;
    if (this.actors().length === 0 || this.enemies.length === 0) {
      this.endBattle('win');
      return;
    }
    yield 20;
    const seen = new Set<string>();
    for (const e of this.aliveEnemies()) {
      const name = e.enemyData()?.name ?? '';
      if (!seen.has(name)) {
        seen.add(name);
        this.log.push(`${name} appears!`);
      }
    }
    yield 50;
    this.log.clear();
    for (;;) {
      yield 'input';
      this.turn++;
      if (this.escapeChosen) {
        const partyAgi = avg(this.actors().filter((a) => a.isAlive()).map((a) => a.agi));
        const troopAgi = avg(this.aliveEnemies().map((e) => e.agi));
        this.log.push('The party tries to run...');
        yield 24;
        if (g.rng() < escapeRatio(partyAgi, troopAgi, this.escapeFailures)) {
          g.sound('escape');
          this.log.push('The party escaped!');
          yield 50;
          this.endBattle('escape');
          return;
        }
        this.escapeFailures++;
        this.log.push("...but couldn't get away!");
        yield 50;
        this.log.clear();
        this.actions.clear();
      }
      this.makeEnemyActions();
      const order = this.turnOrder();
      for (const b of order) {
        if (this.isOver()) break;
        yield* this.processBattler(b);
      }
      if (!this.isOver()) yield* this.turnEnd();
      if (this.aliveEnemies().length === 0) {
        yield* this.victory();
        return;
      }
      if (this.actors().every((a) => a.isDead())) {
        yield* this.defeat();
        return;
      }
      if (g.state.timer.working && g.state.timer.frames <= 0) {
        // MV-style: the battle is aborted when the timer runs out
        this.endBattle('escape');
        return;
      }
    }
  }

  private makeEnemyActions(): void {
    const g = this.game;
    const ctx = { turn: this.turn, partyLevel: g.state.highestLevel(), switches: (id: number) => g.state.getSwitch(id) };
    for (const e of this.aliveEnemies()) {
      if (!e.canMove()) continue;
      const skillId = e.selectAction(ctx, g.rng);
      const skill = skillId ? g.data.skills.get(skillId) : undefined;
      if (skill) this.actions.set(e, new BattleAction(e, skill));
    }
  }

  private turnOrder(): Battler[] {
    const all: Battler[] = [...this.actors().filter((a) => a.isAlive()), ...this.aliveEnemies()];
    const speed = new Map<Battler, number>();
    for (const b of all) {
      const a = this.actions.get(b);
      if (a) {
        a.computeSpeed(this.game.rng);
        speed.set(b, a.speed);
      } else {
        speed.set(b, b.agi + Math.floor(this.game.rng() * Math.floor(5 + b.agi / 4)));
      }
    }
    return all.sort((a, b) => (speed.get(b) ?? 0) - (speed.get(a) ?? 0));
  }

  private *processBattler(b: Battler): Generator<Wait, void, void> {
    const g = this.game;
    if (!b.isAlive()) return;
    if (!b.canMove()) {
      const s = b.stateObjects().find((st) => st.restriction === 'cannotMove' && st.messageStay);
      if (s) {
        this.log.push(fmt(s.messageStay, b.name));
        yield 36;
      }
      yield* this.stateTimers(b, 'actionEnd');
      this.log.clear();
      return;
    }
    let action = this.actions.get(b) ?? null;
    if (b.isConfused()) {
      const atk = g.data.skills.get(g.data.system.attackSkillId);
      action = atk ? new BattleAction(b, atk) : null;
    }
    if (!action) return;
    const item = action.item;
    this.active = b;
    if (action.isGuard(g.data)) {
      b.guarding = true;
      this.log.push(fmt((item as Skill).message || '%1 guards.', b.name, item.name));
      yield 30;
      this.active = null;
      this.log.clear();
      return;
    }
    if (!canUse(b, item, true) || (!isSkill(item) && g.state.numItems('item', item.id) <= 0)) {
      this.log.push(`${b.name} can't use ${item.name}!`);
      yield 30;
      this.active = null;
      this.log.clear();
      return;
    }
    if (isSkill(item)) b.gainMp(-item.mpCost);
    else if ((item as Item).consumable) g.state.gainItem('item', item.id, -1);
    if (b instanceof GameEnemy) {
      const fx = this.enemyFx.get(b)!;
      fx.blink = 12;
      yield 12;
    }
    const msg = isSkill(item) ? fmt(item.message || '%1 uses %2!', b.name, item.name) : `${b.name} uses ${item.name}!`;
    this.log.push(msg);
    if (!action.isAttack(g.data)) g.sound(isSkill(item) ? 'useSkill' : 'useItem');
    yield 14;
    const friends: Battler[] = b.isActor() ? this.actors() : this.enemies.filter((e) => !e.hidden);
    const opponents: Battler[] = b.isActor() ? this.enemies.filter((e) => !e.hidden) : this.actors();
    const targets = action.makeTargets(friends, opponents, g.rng);
    const anim = this.animationFor(action);
    const reps = Math.max(1, item.repeats);
    for (let r = 0; r < reps; r++) {
      for (const target of targets) {
        if (target.isDead() && item.scope !== 'deadAlly' && item.scope !== 'allDeadAllies') continue;
        if (anim) {
          const p = this.battlerPoint(target);
          this.anims.push(new EffectAnimation(anim, p.x, p.y, p.scale));
          if (action.isAttack(g.data)) g.sound('enemyAttack');
          yield scopeIsForAll(item.scope) ? 4 : 14;
        }
        const out = applyAction(action, target, { data: g.data, variables: g.state.variables, rng: g.rng });
        for (const id of out.commonEvents) g.state.reservedCommonEvents.push(id);
        this.showOutcome(b, target, out);
        yield scopeIsForAll(item.scope) ? 10 : 26;
        if (target.isDead() && out.hpDamage > 0) yield* this.collapse(target);
      }
      if (this.isOver()) break;
    }
    this.active = null;
    yield* this.stateTimers(b, 'actionEnd');
    yield 16;
    this.log.clear();
  }

  private showOutcome(subject: Battler, target: Battler, out: ActionOutcome): void {
    const g = this.game;
    const states = g.data.states;
    if (out.missed) {
      g.sound('miss');
      this.popup(target, 'Miss', '#e0e0e0', 24);
      this.log.push(`${subject.name} missed!`);
      return;
    }
    if (out.evaded) {
      g.sound('evasion');
      this.popup(target, 'Evade', '#e0e0e0', 24);
      this.log.push(`${target.name} evaded the attack!`);
      return;
    }
    if (out.critical) {
      this.log.push('A critical hit!');
      this.popup(target, 'Critical!', '#ffe060', 20);
    }
    if (out.hpAffected) {
      if (out.hpDamage > 0) {
        this.popup(target, String(out.hpDamage), '#ffffff');
        this.log.push(`${target.name} took ${out.hpDamage} damage!`);
        this.hurtEffect(target);
      } else if (out.hpDamage < 0) {
        g.sound('recovery');
        this.popup(target, String(-out.hpDamage), '#80ff90');
        this.log.push(`${target.name} recovered ${-out.hpDamage} HP!`);
      } else {
        this.popup(target, '0', '#c0c0c0');
        this.log.push(`${target.name} took no damage.`);
      }
      if (out.drainHp > 0) this.log.push(`${subject.name} drained ${out.drainHp} HP!`);
    }
    if (out.mpAffected) {
      if (out.mpDamage > 0) {
        this.popup(target, `${out.mpDamage} MP`, '#a0c0ff', 22);
        this.log.push(`${target.name} lost ${out.mpDamage} MP!`);
      } else if (out.mpDamage < 0) {
        this.popup(target, `${-out.mpDamage} MP`, '#a0e0ff', 22);
        this.log.push(`${target.name} recovered ${-out.mpDamage} MP!`);
      }
    }
    for (const id of out.addedStates) {
      if (id === DEATH_STATE) continue;
      const s = states.get(id);
      if (s) this.log.push(fmt(target.isActor() ? s.messageActor : s.messageEnemy, target.name));
    }
    for (const id of out.removedStates) {
      const s = states.get(id);
      if (s?.messageRemove) this.log.push(fmt(s.messageRemove, target.name));
    }
    const pn = g.data.system.terms.params;
    for (const p of out.buffs) this.log.push(`${target.name}'s ${pn[p]} rose!`);
    for (const p of out.debuffs) this.log.push(`${target.name}'s ${pn[p]} fell!`);
    for (const id of out.learned) this.log.push(`${target.name} learned ${g.data.skills.get(id)?.name ?? ''}!`);
    if (!out.success) this.log.push(`It had no effect on ${target.name}.`);
  }

  private hurtEffect(target: Battler): void {
    const g = this.game;
    if (target instanceof GameEnemy) {
      const fx = this.enemyFx.get(target)!;
      fx.flash = 16;
      fx.shake = 16;
      g.sound('enemyDamage');
    } else {
      this.status.fx.set(target as GameActor, { flash: 24, shake: 20 });
      this.screenShake = 14;
      g.sound('actorDamage');
    }
  }

  private *collapse(target: Battler): Generator<Wait, void, void> {
    const g = this.game;
    const s = g.data.states.get(DEATH_STATE);
    if (target instanceof GameEnemy) {
      g.sound('enemyCollapse');
      this.enemyFx.get(target)!.collapse = 0;
      if (s) this.log.push(fmt(s.messageEnemy || '%1 is defeated!', target.name));
      yield 20;
    } else {
      g.sound('actorCollapse');
      if (s) this.log.push(fmt(s.messageActor || '%1 has fallen!', target.name));
      yield 24;
    }
  }

  private *stateTimers(b: Battler, timing: 'turnEnd' | 'actionEnd'): Generator<Wait, void, void> {
    const removed = b.updateStateTurns(timing);
    let any = false;
    for (const id of removed) {
      const s = this.game.data.states.get(id);
      if (s?.messageRemove) {
        this.log.push(fmt(s.messageRemove, b.name));
        any = true;
      }
    }
    if (any) yield 30;
  }

  private *turnEnd(): Generator<Wait, void, void> {
    this.actions.clear();
    for (const b of [...this.actors(), ...this.aliveEnemies()]) {
      if (!b.isAlive()) continue;
      const before = b.hp;
      const { hp } = b.regenerate();
      if (hp < 0) {
        this.popup(b, String(-hp), '#e0a0ff');
        this.log.push(`${b.name} took ${before - b.hp} damage!`);
        this.hurtEffect(b);
        yield 30;
      } else if (hp > 0) {
        this.popup(b, String(hp), '#80ff90');
        this.log.push(`${b.name} recovered ${hp} HP!`);
        yield 30;
      }
      yield* this.stateTimers(b, 'turnEnd');
      b.updateBuffTurns();
      b.guarding = false;
    }
    yield 6;
    this.log.clear();
  }

  private *victory(): Generator<Wait, void, void> {
    const g = this.game;
    const st = g.state;
    g.audio.playMe(g.data.system.victoryMe);
    yield 30;
    const exp = this.enemies.reduce((s, e) => s + e.exp(), 0);
    let gold = this.enemies.reduce((s, e) => s + e.gold(), 0);
    if (st.hasPartyAbility('goldDouble')) gold *= 2;
    const dropDouble = st.hasPartyAbility('dropDouble');
    const drops = this.enemies.flatMap((e) => e.makeDrops(g.rng, dropDouble));
    this.log.clear();
    this.log.push('Victory!');
    if (exp > 0) this.log.push(`Gained ${exp} ${g.data.system.terms.expA}.`);
    if (gold > 0) this.log.push(`Found ${gold} ${g.data.system.currency}.`);
    st.gainGold(gold);
    yield 'key';
    if (drops.length) {
      this.log.clear();
      for (const d of drops) {
        const item = g.data.item(d.kind, d.id);
        if (!item) continue;
        st.gainItem(d.kind, d.id, 1);
        this.log.push(`Found ${item.name}!`);
      }
      yield 'key';
    }
    for (const a of st.members()) {
      if (a.isDead()) continue;
      const change = a.gainExp(exp);
      if (change.newLevel > change.oldLevel) {
        this.log.clear();
        g.sound('levelUp');
        this.log.push(`${a.name} is now ${g.data.system.terms.level} ${change.newLevel}!`);
        for (const id of change.learned) this.log.push(`${a.name} learned ${g.data.skills.get(id)?.name ?? ''}!`);
        yield 'key';
      }
    }
    st.winCount++;
    this.endBattle('win');
  }

  private *defeat(): Generator<Wait, void, void> {
    const g = this.game;
    g.audio.playMe(g.data.system.defeatMe);
    this.log.clear();
    this.log.push('The party has been defeated...');
    yield 'key';
    if (this.canLose) {
      for (const a of this.actors()) if (a.isDead()) a.revive();
      this.endBattle('lose');
    } else {
      this.fadeOut = 1;
      this.onFadedOut = () => g.goto(new GameOverScene(g));
    }
  }

  private endBattle(result: BattleResult): void {
    const g = this.game;
    for (const a of g.state.members()) a.onBattleEnd();
    g.state.battleCount++;
    if (result === 'escape') g.state.escapeCount++;
    g.state.touch();
    this.fadeOut = 1;
    this.onFadedOut = () => {
      g.pop();
      g.replayMapAudio();
      this.onEnd(result);
    };
  }

  // --- input ------------------------------------------------------------------------------

  private beginInput(): void {
    this.inputActive = true;
    this.actions.clear();
    this.escapeChosen = false;
    this.inputIndex = -1;
    // actors who can't choose act automatically (confused) or not at all
    this.partyCmd.visible = true;
    this.partyCmd.select(0);
    this.partyCmd.activate();
    this.partyCmd.commands[1].enabled = this.canEscape;
  }

  private finishInput(): void {
    this.inputActive = false;
    this.partyCmd.visible = false;
    this.partyCmd.deactivate();
    this.actorCmd.visible = false;
    this.actorCmd.deactivate();
    this.status.highlight = null;
  }

  private startActorInput(): void {
    this.partyCmd.deactivate();
    this.partyCmd.visible = false;
    this.inputIndex = -1;
    this.nextActor();
  }

  private currentActor(): GameActor | null {
    return this.actors()[this.inputIndex] ?? null;
  }

  private nextActor(): void {
    const list = this.actors();
    do {
      this.inputIndex++;
    } while (this.inputIndex < list.length && !list[this.inputIndex].canInput());
    if (this.inputIndex >= list.length) {
      this.finishInput();
      return;
    }
    this.setupActorCommand(list[this.inputIndex]);
  }

  private prevActor(): void {
    const list = this.actors();
    let i = this.inputIndex - 1;
    while (i >= 0 && !list[i].canInput()) i--;
    if (i < 0) {
      this.actorCmd.visible = false;
      this.actorCmd.deactivate();
      this.status.highlight = null;
      this.partyCmd.visible = true;
      this.partyCmd.activate();
      this.inputIndex = -1;
      return;
    }
    this.inputIndex = i;
    this.actions.delete(list[i]);
    this.setupActorCommand(list[i]);
  }

  private setupActorCommand(a: GameActor): void {
    const g = this.game;
    const t = g.data.system.terms;
    const cmds = [{ name: t.attack, symbol: 'attack', enabled: true }];
    for (const stype of a.skillTypes()) {
      cmds.push({ name: g.data.system.skillTypes[stype - 1] ?? t.skill, symbol: 'skill', enabled: !a.isSkillTypeSealed(stype), ext: stype } as never);
    }
    cmds.push({ name: t.guard, symbol: 'guard', enabled: true }, { name: t.item, symbol: 'item', enabled: true });
    this.actorCmd.setCommands(cmds);
    this.actorCmd.topRow = 0;
    this.actorCmd.select(0);
    this.actorCmd.visible = true;
    this.actorCmd.activate();
    this.status.highlight = a;
  }

  private openSkills(stypeId: number): void {
    const a = this.currentActor();
    if (!a) return;
    this.actorCmd.deactivate();
    this.skillWin.setActor(a, stypeId);
    this.skillWin.enabledFn = (s) => canUse(a, s, true);
    this.skillWin.select(Math.max(0, this.skillWin.index));
    this.skillWin.visible = true;
    this.help.visible = true;
    this.skillWin.activate();
  }

  private openItems(): void {
    const a = this.currentActor();
    if (!a) return;
    this.actorCmd.deactivate();
    this.itemWin.category = 'item';
    this.itemWin.enabledFn = (e) => e.kind === 'item' && canUse(a, e.item as Item, true) && (e.item as Item).scope !== 'none';
    this.itemWin.refresh();
    this.itemWin.visible = true;
    this.help.visible = true;
    this.itemWin.activate();
  }

  private closeList(): void {
    this.skillWin.visible = false;
    this.skillWin.deactivate();
    this.itemWin.visible = false;
    this.itemWin.deactivate();
    this.help.visible = false;
    this.actorCmd.activate();
  }

  private reopen(w: SkillListWindow | ItemListWindow): void {
    w.visible = true;
    this.help.visible = true;
    w.activate();
  }

  private chooseAction(item: Skill | Item | undefined, back?: () => void): void {
    const a = this.currentActor();
    if (!a || !item) return;
    const action = new BattleAction(a, item);
    this.skillWin.deactivate();
    this.itemWin.deactivate();
    this.actorCmd.deactivate();
    if (scopeNeedsSelection(item.scope)) {
      this.skillWin.visible = false;
      this.itemWin.visible = false;
      this.help.visible = false;
      const side = scopeIsFriend(item.scope) ? 'actor' : 'enemy';
      const back2 = back ?? (() => this.actorCmd.activate());
      this.targeting = { action, side, index: side === 'enemy' ? this.firstEnemyIndex() : this.actors().indexOf(a), back: back2, frame: this.game.frameCount() };
      if (side === 'actor' && item.scope === 'deadAlly') {
        const dead = this.actors().findIndex((m) => m.isDead());
        this.targeting.index = Math.max(0, dead);
      }
      return;
    }
    this.commitAction(action);
  }

  private commitAction(action: BattleAction): void {
    this.actions.set(action.subject, action);
    this.closeList();
    this.actorCmd.deactivate();
    this.targeting = null;
    this.status.cursor = null;
    this.nextActor();
  }

  private firstEnemyIndex(): number {
    const i = this.enemies.findIndex((e) => e.isAlive() && !e.hidden);
    return Math.max(0, i);
  }

  private updateTargeting(): void {
    const t = this.targeting!;
    const g = this.game;
    const inp = g.input;
    const list: Battler[] = t.side === 'enemy' ? this.enemies : this.actors();
    const valid = (i: number) => {
      const b = list[i];
      if (!b) return false;
      if (b instanceof GameEnemy && b.hidden) return false;
      return t.action.item.scope === 'deadAlly' ? b.isDead() : b.isAlive();
    };
    const move = (d: number) => {
      const n = list.length;
      for (let k = 1; k <= n; k++) {
        const i = (t.index + d * k + n * 10) % n;
        if (valid(i)) {
          if (i !== t.index) g.sound('cursor');
          t.index = i;
          return;
        }
      }
    };
    if (!valid(t.index)) move(1);
    if (t.side === 'enemy') {
      if (inp.isRepeated('right') || inp.isRepeated('down')) move(1);
      if (inp.isRepeated('left') || inp.isRepeated('up')) move(-1);
    } else {
      if (inp.isRepeated('down') || inp.isRepeated('right')) move(1);
      if (inp.isRepeated('up') || inp.isRepeated('left')) move(-1);
    }
    // touch: tap an enemy or a status row
    const p = inp.pointer;
    if (p.triggered) {
      if (t.side === 'enemy') {
        this.enemies.forEach((e, i) => {
          const img = this.enemyImage(e);
          if (!img || !valid(i)) return;
          if (Math.abs(p.x - e.screenX) < img.width / 2 && p.y > e.screenY - img.height && p.y < e.screenY) {
            if (i === t.index) this.confirmTarget();
            else t.index = i;
          }
        });
      } else if (this.status.contains(p.x, p.y)) {
        const i = Math.floor((p.y - this.status.inner.y) / 32);
        if (valid(i)) {
          if (i === t.index) this.confirmTarget();
          else t.index = i;
        }
      }
    }
    this.status.cursor = t.side === 'actor' ? (this.actors()[t.index] ?? null) : null;
    if (inp.isTriggered('ok')) {
      if (valid(t.index)) this.confirmTarget();
      else g.sound('buzzer');
    } else if (inp.isTriggered('cancel')) {
      g.sound('cancel');
      this.targeting = null;
      this.status.cursor = null;
      t.back();
    }
  }

  private confirmTarget(): void {
    const t = this.targeting;
    if (!t) return;
    this.game.sound('ok');
    t.action.targetIndex = t.index;
    this.commitAction(t.action);
  }

  // --- update & render --------------------------------------------------------------------

  update(): void {
    const g = this.game;
    for (const w of [this.partyCmd, this.actorCmd, this.skillWin, this.itemWin, this.help]) w.update();
    for (const a of this.anims) a.update();
    this.anims = this.anims.filter((a) => !a.isDone());
    for (const p of this.popups) p.frame++;
    this.popups = this.popups.filter((p) => p.frame < 70);
    for (const fx of this.enemyFx.values()) {
      if (fx.flash > 0) fx.flash--;
      if (fx.shake > 0) fx.shake--;
      if (fx.blink > 0) fx.blink--;
      if (fx.collapse >= 0 && fx.collapse < 1) fx.collapse = Math.min(1, fx.collapse + 1 / 32);
    }
    for (const [a, fx] of this.status.fx) {
      if (fx.flash > 0) fx.flash--;
      if (fx.shake > 0) fx.shake--;
      if (fx.flash <= 0 && fx.shake <= 0) this.status.fx.delete(a);
    }
    if (this.screenShake > 0) this.screenShake--;
    if (this.fadeIn > 0) this.fadeIn--;
    if (this.fadeOut > 0) {
      this.fadeOut++;
      if (this.fadeOut > 30) {
        this.fadeOut = 0;
        const cb = this.onFadedOut;
        this.onFadedOut = null;
        cb?.();
      }
      return;
    }
    this.status.actors = g.state.battleMembers();
    if (this.targeting) {
      // the key that opened target selection must not also confirm it
      if (this.targeting.frame !== g.frameCount()) this.updateTargeting();
      return;
    }
    if (this.inputActive) return;
    // highlight the acting party member
    this.status.highlight = this.active && this.active.isActor() ? (this.active as GameActor) : null;
    if (this.waitCount > 0) {
      this.waitCount--;
      // fast-forward battle text while OK is held
      if (g.input.isPressed('ok') && this.waitCount > 4) this.waitCount -= 2;
      return;
    }
    if (this.waitKey) {
      const inp = g.input;
      if (inp.isTriggered('ok') || inp.isTriggered('cancel') || inp.pointer.triggered) this.waitKey = false;
      return;
    }
    if (!this.flow) return;
    const r = this.flow.next();
    if (r.done) {
      this.flow = null;
      return;
    }
    const w = r.value;
    if (w === 'input') this.beginInput();
    else if (w === 'key') this.waitKey = true;
    else this.waitCount = w;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const W = g.width;
    const H = g.height;
    ctx.save();
    if (this.screenShake > 0) ctx.translate(Math.sin(this.screenShake * 2.3) * 4, 0);
    const bb = g.images.get('battleback', g.map.map?.battleback ?? 'builtin:grassland');
    if (bb) ctx.drawImage(bb, 0, 0, W, H);
    else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#3a5a8a');
      grad.addColorStop(1, '#2a3a2a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
    // enemies (back to front)
    const sorted = [...this.enemies].sort((a, b) => a.screenY - b.screenY);
    for (const e of sorted) this.drawEnemy(ctx, e);
    ctx.restore();
    for (const a of this.anims) a.draw(ctx);
    for (const p of this.popups) {
      const rise = Math.min(1, p.frame / 10);
      const bounce = p.frame < 10 ? Math.sin(rise * Math.PI) * 14 : 0;
      ctx.save();
      ctx.globalAlpha = p.frame > 50 ? (70 - p.frame) / 20 : 1;
      drawText(ctx, p.text, p.x, p.y - 20 * rise - bounce, { size: p.size, align: 'center', bold: true, color: p.color });
      ctx.restore();
    }
    this.log.draw(ctx);
    this.status.draw(ctx);
    for (const w of [this.partyCmd, this.actorCmd, this.help, this.skillWin, this.itemWin]) w.draw(ctx);
    if (this.targeting) this.drawTargetInfo(ctx);
    const fade = this.fadeOut > 0 ? this.fadeOut / 30 : this.fadeIn / 30;
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: GameEnemy): void {
    if (e.hidden) return;
    const fx = this.enemyFx.get(e)!;
    if (e.isDead() && fx.collapse < 0) fx.collapse = 1;
    if (fx.collapse >= 1) return;
    const img = this.enemyImage(e);
    if (!img) return;
    const t = this.game.frameCount();
    const breathe = Math.sin(t / 30 + e.index) * 1.5;
    const dx = fx.shake > 0 ? Math.sin(fx.shake * 1.9) * 5 : 0;
    const x = Math.round(e.screenX - img.width / 2 + dx);
    const y = Math.round(e.screenY - img.height + breathe);
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(e.screenX, e.screenY - 2, img.width * 0.36, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    let alpha = 1;
    if (fx.collapse >= 0) alpha = 1 - fx.collapse;
    const target = this.targeting && this.targeting.side === 'enemy' && this.enemies[this.targeting.index] === e;
    if (target) alpha *= 0.7 + 0.3 * Math.sin(t / 4);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y);
    const flash = fx.flash > 0 ? fx.flash / 16 : fx.blink > 0 && Math.floor(fx.blink / 3) % 2 === 0 ? 0.6 : fx.collapse >= 0 ? 0.5 : 0;
    if (flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * flash;
      ctx.drawImage(img, x, y);
      if (fx.collapse >= 0) {
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.restore();
    // state icons above the enemy
    const icons = e.displayStates();
    if (e.isAlive() && icons.length) {
      icons.slice(0, 3).forEach((s, i) => drawIcon(ctx, this.game.images, s.icon, e.screenX - (icons.length * 26) / 2 + i * 26, y - 28, 24));
    }
    if (target) {
      const ay = y - 12 + Math.sin(t / 6) * 3;
      ctx.save();
      ctx.fillStyle = '#ffe060';
      ctx.strokeStyle = '#2a1e10';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.screenX - 10, ay - 12);
      ctx.lineTo(e.screenX + 10, ay - 12);
      ctx.lineTo(e.screenX, ay);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawTargetInfo(ctx: CanvasRenderingContext2D): void {
    const t = this.targeting!;
    const b: Battler | undefined = t.side === 'enemy' ? this.enemies[t.index] : this.actors()[t.index];
    if (!b) return;
    const g = this.game;
    const h = 44;
    const y = g.height - 152 - h - 4;
    drawWindowFrame(ctx, 0, y, 192, h, g.data.system.windowColor, g.data.system.windowOpacity, 1);
    drawText(ctx, b.name, 96, y + h / 2, { size: 19, align: 'center', maxWidth: 176 });
  }
}

function avg(list: number[]): number {
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : 1;
}
