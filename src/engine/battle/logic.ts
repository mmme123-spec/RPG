/**
 * Battle rules independent of presentation: action targets, hit checks,
 * damage formulas and effect application. Also used for items/skills used
 * from the menu.
 */

import type { Effect, Item, Scope, Skill } from '../../core/types';
import type { GameData } from '../data';
import type { Battler } from '../state/battler';
import { DEATH_STATE } from '../state/battler';
import type { GameActor } from '../state/actor';

export type UsableItem = Skill | Item;

export function isSkill(item: UsableItem): item is Skill {
  return 'mpCost' in item;
}

export function scopeIsOpponent(s: Scope): boolean {
  return s === 'enemy' || s === 'allEnemies' || s === 'randomEnemy';
}

export function scopeIsFriend(s: Scope): boolean {
  return s === 'ally' || s === 'allAllies' || s === 'deadAlly' || s === 'allDeadAllies' || s === 'user';
}

export function scopeIsForDead(s: Scope): boolean {
  return s === 'deadAlly' || s === 'allDeadAllies';
}

export function scopeNeedsSelection(s: Scope): boolean {
  return s === 'enemy' || s === 'ally' || s === 'deadAlly';
}

export function scopeIsForAll(s: Scope): boolean {
  return s === 'allEnemies' || s === 'allAllies' || s === 'allDeadAllies';
}

const formulaCache = new Map<string, (a: Battler, b: Battler, v: number[], M: Math) => unknown>();

/** Evaluate a damage formula (e.g. "a.atk * 4 - b.def * 2") safely. */
export function evalFormula(formula: string, a: Battler, b: Battler, variables: number[]): number {
  try {
    let fn = formulaCache.get(formula);
    if (!fn) {
      fn = new Function('a', 'b', 'v', 'Math', `"use strict"; return (${formula || 0});`) as (a: Battler, b: Battler, v: number[], M: Math) => unknown;
      formulaCache.set(formula, fn);
    }
    const r = Number(fn(a, b, variables, Math));
    return Number.isFinite(r) ? r : 0;
  } catch {
    return 0;
  }
}

export class BattleAction {
  readonly subject: Battler;
  item: UsableItem;
  /** Selected target index within the relevant side (-1 = random). */
  targetIndex = -1;
  speed = 0;

  constructor(subject: Battler, item: UsableItem) {
    this.subject = subject;
    this.item = item;
  }

  get scope(): Scope {
    return this.item.scope;
  }

  isSkill(): boolean {
    return isSkill(this.item);
  }

  isAttack(data: GameData): boolean {
    return this.isSkill() && this.item.id === data.system.attackSkillId;
  }

  isGuard(data: GameData): boolean {
    return this.isSkill() && this.item.id === data.system.guardSkillId;
  }

  computeSpeed(rng: () => number): void {
    const agi = this.subject.agi;
    this.speed = agi + Math.floor(rng() * Math.floor(5 + agi / 4)) + this.item.speed;
  }

  /**
   * Resolve targets. `friends` and `opponents` are from the subject's point of view.
   * Confused subjects pick random targets according to their restriction.
   */
  makeTargets(friends: Battler[], opponents: Battler[], rng: () => number): Battler[] {
    const aliveOpp = opponents.filter((b) => b.isAlive());
    const aliveFri = friends.filter((b) => b.isAlive());
    const pick = (list: Battler[]) => (list.length ? [list[Math.floor(rng() * list.length)]] : []);
    if (this.subject.isConfused() && !this.isForUserOnly()) {
      const r = this.subject.restriction();
      if (r === 'attackEnemy') return pick(aliveOpp);
      if (r === 'attackAlly') return pick(aliveFri);
      return pick(rng() < 0.5 ? aliveOpp : aliveFri);
    }
    const s = this.scope;
    switch (s) {
      case 'none':
        return [];
      case 'user':
        return [this.subject];
      case 'enemy': {
        const t = opponents[this.targetIndex];
        return t && t.isAlive() ? [t] : pick(aliveOpp);
      }
      case 'randomEnemy':
        return pick(aliveOpp);
      case 'allEnemies':
        return aliveOpp;
      case 'ally': {
        const t = friends[this.targetIndex];
        return t && t.isAlive() ? [t] : pick(aliveFri);
      }
      case 'allAllies':
        return aliveFri;
      case 'deadAlly': {
        const dead = friends.filter((b) => b.isDead());
        const t = friends[this.targetIndex];
        return t && t.isDead() ? [t] : pick(dead);
      }
      case 'allDeadAllies':
        return friends.filter((b) => b.isDead());
    }
  }

  private isForUserOnly(): boolean {
    return this.scope === 'user' || this.scope === 'none';
  }
}

export interface ActionOutcome {
  target: Battler;
  used: boolean;
  missed: boolean;
  evaded: boolean;
  critical: boolean;
  hpDamage: number;
  mpDamage: number;
  hpAffected: boolean;
  mpAffected: boolean;
  drainHp: number;
  drainMp: number;
  addedStates: number[];
  removedStates: number[];
  buffs: number[];
  debuffs: number[];
  learned: number[];
  growth: number[];
  commonEvents: number[];
  /** Something visible happened */
  success: boolean;
}

function emptyOutcome(target: Battler): ActionOutcome {
  return {
    target,
    used: true,
    missed: false,
    evaded: false,
    critical: false,
    hpDamage: 0,
    mpDamage: 0,
    hpAffected: false,
    mpAffected: false,
    drainHp: 0,
    drainMp: 0,
    addedStates: [],
    removedStates: [],
    buffs: [],
    debuffs: [],
    learned: [],
    growth: [],
    commonEvents: [],
    success: false,
  };
}

export interface ApplyContext {
  data: GameData;
  variables: number[];
  rng: () => number;
}

function elementRate(subject: Battler, target: Battler, elementId: number): number {
  if (elementId < 0) {
    const els = subject.attackElements();
    if (els.length === 0) return 1;
    return Math.max(...els.map((e) => target.elementRate(e)));
  }
  if (elementId === 0) return 1;
  return target.elementRate(elementId);
}

/** Could using this item on the target have any effect? (for menu use checks) */
export function hasEffectOn(item: UsableItem, target: Battler): boolean {
  const d = item.damage;
  if (d.type === 'hpRecover' && target.isAlive() && target.hp < target.mhp) return true;
  if (d.type === 'mpRecover' && target.isAlive() && target.mp < target.mmp) return true;
  if (d.type !== 'none' && d.type !== 'hpRecover' && d.type !== 'mpRecover') return true;
  for (const e of item.effects) {
    switch (e.kind) {
      case 'recoverHp':
        if (target.isAlive() && target.hp < target.mhp) return true;
        break;
      case 'recoverMp':
        if (target.isAlive() && target.mp < target.mmp) return true;
        break;
      case 'addState':
        if (e.stateId !== 0 && !target.hasState(e.stateId)) return true;
        break;
      case 'removeState':
        if (target.hasState(e.stateId)) return true;
        break;
      case 'growth':
      case 'learnSkill':
      case 'commonEvent':
      case 'addBuff':
      case 'addDebuff':
        return true;
    }
  }
  return false;
}

/** Apply an action to one target, mutating battlers. */
export function applyAction(action: BattleAction, target: Battler, ctx: ApplyContext): ActionOutcome {
  const { rng } = ctx;
  const item = action.item;
  const subject = action.subject;
  const out = emptyOutcome(target);

  // hit check
  const opponent = subject.isActor() !== target.isActor();
  const hitRate = (item.successRate / 100) * (item.hitType === 'physical' ? subject.hit : 1);
  const evaRate = opponent && item.hitType === 'physical' ? target.eva : 0;
  if (rng() >= hitRate) {
    out.missed = true;
    return out;
  }
  if (rng() < evaRate) {
    out.evaded = true;
    return out;
  }

  // damage
  const d = item.damage;
  if (d.type !== 'none') {
    const recover = d.type === 'hpRecover' || d.type === 'mpRecover';
    let value = Math.max(0, evalFormula(d.formula, subject, target, ctx.variables));
    value *= elementRate(subject, target, d.elementId);
    if (d.critical && rng() < subject.cri) {
      out.critical = true;
      value *= 3;
    }
    const amp = Math.floor(Math.max((Math.abs(value) * d.variance) / 100, 0));
    value += Math.floor(rng() * (amp + 1)) + Math.floor(rng() * (amp + 1)) - amp;
    if (!recover && value > 0 && target.guarding) value /= 2;
    value = Math.round(value);
    if (recover) value = -value;
    switch (d.type) {
      case 'hpDamage':
      case 'hpRecover':
      case 'hpDrain': {
        if (d.type === 'hpDrain') value = Math.min(target.hp, value);
        out.hpDamage = value;
        out.hpAffected = true;
        target.gainHp(-value);
        if (d.type === 'hpDrain' && value > 0) {
          out.drainHp = value;
          subject.gainHp(value);
        }
        if (value > 0) out.removedStates.push(...target.removeStatesByDamage(rng));
        break;
      }
      case 'mpDamage':
      case 'mpRecover':
      case 'mpDrain': {
        if (d.type !== 'mpRecover') value = Math.min(target.mp, value);
        out.mpDamage = value;
        out.mpAffected = true;
        target.gainMp(-value);
        if (d.type === 'mpDrain' && value > 0) {
          out.drainMp = value;
          subject.gainMp(value);
        }
        break;
      }
    }
    out.success = true;
  }

  // normal attack states ride on damage
  for (const e of item.effects) applyEffect(e, action, target, out, ctx);
  if (target.isDead() && !out.addedStates.includes(DEATH_STATE) && out.hpDamage > 0) out.addedStates.push(DEATH_STATE);
  return out;
}

function lukRate(subject: Battler, target: Battler): number {
  return Math.max(1 + (subject.luk - target.luk) * 0.001, 0);
}

function applyEffect(e: Effect, action: BattleAction, target: Battler, out: ActionOutcome, ctx: ApplyContext): void {
  const { rng } = ctx;
  const subject = action.subject;
  switch (e.kind) {
    case 'recoverHp': {
      if (!target.isAlive()) return;
      const v = Math.floor((target.mhp * e.percent) / 100 + e.flat);
      if (v === 0) return;
      target.gainHp(v);
      out.hpDamage -= v;
      out.hpAffected = true;
      out.success = true;
      return;
    }
    case 'recoverMp': {
      if (!target.isAlive()) return;
      const v = Math.floor((target.mmp * e.percent) / 100 + e.flat);
      if (v === 0) return;
      target.gainMp(v);
      out.mpDamage -= v;
      out.mpAffected = true;
      out.success = true;
      return;
    }
    case 'addState': {
      const add = (stateId: number, chance: number) => {
        if (!target.isStateAddable(stateId)) return;
        let c = chance;
        if (subject !== target && stateId !== DEATH_STATE) c *= target.stateRate(stateId) * lukRate(subject, target);
        if (stateId === DEATH_STATE && subject !== target) c *= target.stateRate(stateId);
        if (rng() < c) {
          if (target.addState(stateId, rng)) out.addedStates.push(stateId);
          out.success = true;
        }
      };
      if (e.stateId === 0) {
        for (const s of subject.attackStates()) add(s.stateId, (e.chance / 100) * s.chance);
      } else {
        add(e.stateId, e.chance / 100);
      }
      return;
    }
    case 'removeState':
      if (target.hasState(e.stateId) && rng() < e.chance / 100) {
        target.removeState(e.stateId);
        out.removedStates.push(e.stateId);
        out.success = true;
      }
      return;
    case 'addBuff':
      target.addBuff(e.param, e.turns);
      out.buffs.push(e.param);
      out.success = true;
      return;
    case 'addDebuff':
      if (rng() < lukRate(subject, target)) {
        target.addDebuff(e.param, e.turns);
        out.debuffs.push(e.param);
        out.success = true;
      }
      return;
    case 'growth':
      if (target.isActor()) {
        (target as GameActor).paramPlusArr[e.param] += e.value;
        target.refresh();
        out.growth.push(e.param);
        out.success = true;
      }
      return;
    case 'learnSkill':
      if (target.isActor()) {
        const a = target as GameActor;
        if (!a.skills.includes(e.skillId)) {
          a.learnSkill(e.skillId);
          out.learned.push(e.skillId);
        }
        out.success = true;
      }
      return;
    case 'commonEvent':
      out.commonEvents.push(e.commonEventId);
      out.success = true;
      return;
  }
}

/** Escape probability for the party (0..1). */
export function escapeRatio(partyAgi: number, troopAgi: number, failures: number): number {
  return Math.min(1, (0.5 * Math.max(1, partyAgi)) / Math.max(1, troopAgi) + failures * 0.1);
}

/** Can the battler use this skill/item right now? */
export function canUse(user: Battler, item: UsableItem, inBattle: boolean): boolean {
  if (!user.canMove()) return false;
  const occ = item.occasion;
  if (occ === 'never') return false;
  if (inBattle && occ === 'menu') return false;
  if (!inBattle && occ === 'battle') return false;
  if (isSkill(item)) {
    if (user.mp < item.mpCost) return false;
    if (item.stypeId > 0 && user.sealedSkillTypes().includes(item.stypeId)) return false;
  }
  return true;
}
