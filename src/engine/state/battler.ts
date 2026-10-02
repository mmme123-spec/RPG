/**
 * Shared battler logic for actors and enemies: parameters, traits, HP/MP,
 * states and buffs. Formulas follow the conventions of classic RPG makers.
 */

import type { PartyAbility, State, StateRestriction, Trait, XParam } from '../../core/types';
import type { GameData } from '../data';

export const PARAM_KEYS = ['mhp', 'mmp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk'] as const;
export type ParamKey = (typeof PARAM_KEYS)[number];

/** State id 1 is the "knocked out" state; it is synchronised with HP 0. */
export const DEATH_STATE = 1;

const RESTRICTION_ORDER: StateRestriction[] = ['none', 'attackEnemy', 'attackAnyone', 'attackAlly', 'cannotMove'];

const BASE_XPARAM: Record<XParam, number> = { hit: 0.95, eva: 0.05, cri: 0.04, hrg: 0, mrg: 0 };

export interface TraitSource {
  traits: Trait[];
}

export abstract class Battler {
  readonly data: GameData;
  protected _hp = 1;
  protected _mp = 0;
  /** Active state ids, highest priority first. */
  states: number[] = [];
  stateTurns = new Map<number, number>();
  stateSteps = new Map<number, number>();
  /** Buff levels per parameter, -2..2 */
  buffs: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  buffTurns: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  guarding = false;

  constructor(data: GameData) {
    this.data = data;
  }

  abstract get name(): string;
  abstract isActor(): boolean;
  abstract paramBase(i: number): number;
  abstract paramPlus(i: number): number;
  /** Database objects whose traits apply to this battler (excluding states). */
  protected abstract baseTraitSources(): TraitSource[];

  isEnemy(): boolean {
    return !this.isActor();
  }

  stateObjects(): State[] {
    const out: State[] = [];
    for (const id of this.states) {
      const s = this.data.states.get(id);
      if (s) out.push(s);
    }
    return out;
  }

  traits(): Trait[] {
    const out: Trait[] = [];
    for (const src of this.baseTraitSources()) out.push(...src.traits);
    for (const s of this.stateObjects()) out.push(...s.traits);
    return out;
  }

  // --- parameters -------------------------------------------------------------

  paramRate(i: number): number {
    let rate = 1;
    for (const t of this.traits()) if (t.kind === 'paramRate' && t.param === i) rate *= t.value / 100;
    return rate;
  }

  buffRate(i: number): number {
    return 1 + this.buffs[i] * 0.25;
  }

  paramMax(i: number): number {
    if (i === 0) return 999999;
    if (i === 1) return 9999;
    return 999;
  }

  param(i: number): number {
    const v = (this.paramBase(i) + this.paramPlus(i)) * this.paramRate(i) * this.buffRate(i);
    const min = i === 0 ? 1 : 0;
    return Math.round(Math.max(min, Math.min(this.paramMax(i), v)));
  }

  get mhp(): number {
    return this.param(0);
  }
  get mmp(): number {
    return this.param(1);
  }
  get atk(): number {
    return this.param(2);
  }
  get def(): number {
    return this.param(3);
  }
  get mat(): number {
    return this.param(4);
  }
  get mdf(): number {
    return this.param(5);
  }
  get agi(): number {
    return this.param(6);
  }
  get luk(): number {
    return this.param(7);
  }
  get hp(): number {
    return this._hp;
  }
  get mp(): number {
    return this._mp;
  }

  xparam(x: XParam): number {
    let v = !this.isActor() && x === 'cri' ? 0 : BASE_XPARAM[x];
    for (const t of this.traits()) if (t.kind === 'xparam' && t.xparam === x) v += t.value / 100;
    return v;
  }

  get hit(): number {
    return this.xparam('hit');
  }
  get eva(): number {
    return this.xparam('eva');
  }
  get cri(): number {
    return this.xparam('cri');
  }

  elementRate(elementId: number): number {
    let rate = 1;
    for (const t of this.traits()) if (t.kind === 'elementRate' && t.elementId === elementId) rate *= t.value / 100;
    return rate;
  }

  stateRate(stateId: number): number {
    let rate = 1;
    for (const t of this.traits()) if (t.kind === 'stateRate' && t.stateId === stateId) rate *= t.value / 100;
    return rate;
  }

  isStateResist(stateId: number): boolean {
    return this.traits().some((t) => t.kind === 'stateResist' && t.stateId === stateId);
  }

  attackElements(): number[] {
    const out: number[] = [];
    for (const t of this.traits()) if (t.kind === 'attackElement' && !out.includes(t.elementId)) out.push(t.elementId);
    return out;
  }

  attackStates(): { stateId: number; chance: number }[] {
    const out: { stateId: number; chance: number }[] = [];
    for (const t of this.traits()) if (t.kind === 'attackState') out.push({ stateId: t.stateId, chance: t.value / 100 });
    return out;
  }

  sealedSkillTypes(): number[] {
    return this.traits()
      .filter((t): t is Extract<Trait, { kind: 'sealSkillType' }> => t.kind === 'sealSkillType')
      .map((t) => t.stypeId);
  }

  hasPartyAbility(a: PartyAbility): boolean {
    return this.traits().some((t) => t.kind === 'partyAbility' && t.ability === a);
  }

  // --- HP / MP --------------------------------------------------------------------

  setHp(v: number): void {
    this._hp = Math.round(Math.max(0, Math.min(this.mhp, v)));
    this.refresh();
  }

  setMp(v: number): void {
    this._mp = Math.round(Math.max(0, Math.min(this.mmp, v)));
  }

  gainHp(v: number): void {
    this.setHp(this._hp + v);
  }

  gainMp(v: number): void {
    this.setMp(this._mp + v);
  }

  /** Clamp HP/MP to the current maxima and synchronise the KO state. */
  refresh(): void {
    this._hp = Math.max(0, Math.min(this.mhp, this._hp));
    this._mp = Math.max(0, Math.min(this.mmp, this._mp));
    if (this._hp === 0) {
      if (!this.states.includes(DEATH_STATE)) this.die();
    } else if (this.states.includes(DEATH_STATE)) {
      this.eraseState(DEATH_STATE);
    }
  }

  hpRate(): number {
    return this.mhp > 0 ? this._hp / this.mhp : 0;
  }

  mpRate(): number {
    return this.mmp > 0 ? this._mp / this.mmp : 0;
  }

  isDead(): boolean {
    return this.states.includes(DEATH_STATE);
  }

  isAlive(): boolean {
    return !this.isDead();
  }

  isDying(): boolean {
    return this.isAlive() && this._hp < this.mhp / 4;
  }

  die(): void {
    this._hp = 0;
    this.states = [];
    this.stateTurns.clear();
    this.stateSteps.clear();
    this.buffs = [0, 0, 0, 0, 0, 0, 0, 0];
    this.buffTurns = [0, 0, 0, 0, 0, 0, 0, 0];
    this.states.push(DEATH_STATE);
    this.guarding = false;
  }

  revive(): void {
    this.eraseState(DEATH_STATE);
    if (this._hp === 0) this._hp = 1;
  }

  recoverAll(): void {
    this.states = [];
    this.stateTurns.clear();
    this.stateSteps.clear();
    this.buffs = [0, 0, 0, 0, 0, 0, 0, 0];
    this.buffTurns = [0, 0, 0, 0, 0, 0, 0, 0];
    this._hp = this.mhp;
    this._mp = this.mmp;
  }

  // --- states ---------------------------------------------------------------------

  restriction(): StateRestriction {
    let best = 0;
    for (const s of this.stateObjects()) best = Math.max(best, RESTRICTION_ORDER.indexOf(s.restriction));
    return RESTRICTION_ORDER[best];
  }

  canMove(): boolean {
    return this.isAlive() && this.restriction() !== 'cannotMove';
  }

  isConfused(): boolean {
    const r = this.restriction();
    return this.isAlive() && (r === 'attackEnemy' || r === 'attackAnyone' || r === 'attackAlly');
  }

  canInput(): boolean {
    return this.isAlive() && this.restriction() === 'none';
  }

  hasState(id: number): boolean {
    return this.states.includes(id);
  }

  isStateAddable(id: number): boolean {
    if (id === DEATH_STATE) return this.isAlive();
    return this.isAlive() && this.data.states.has(id) && !this.isStateResist(id);
  }

  /** Add a state. Returns true if it was newly added. */
  addState(id: number, rng: () => number = Math.random): boolean {
    if (!this.isStateAddable(id)) return false;
    if (id === DEATH_STATE) {
      this.die();
      return true;
    }
    const isNew = !this.states.includes(id);
    if (isNew) {
      this.states.push(id);
      this.sortStates();
    }
    this.resetStateCounts(id, rng);
    return isNew;
  }

  /** Remove a state. Returns true if it was present. */
  removeState(id: number): boolean {
    if (!this.states.includes(id)) return false;
    if (id === DEATH_STATE) {
      this.revive();
      return true;
    }
    this.eraseState(id);
    return true;
  }

  protected eraseState(id: number): void {
    this.states = this.states.filter((s) => s !== id);
    this.stateTurns.delete(id);
    this.stateSteps.delete(id);
  }

  protected sortStates(): void {
    const pri = (id: number) => (id === DEATH_STATE ? 1e9 : this.data.states.get(id)?.priority ?? 0);
    this.states.sort((a, b) => pri(b) - pri(a));
  }

  protected resetStateCounts(id: number, rng: () => number): void {
    const s = this.data.states.get(id);
    if (!s) return;
    const min = Math.max(1, s.minTurns);
    const max = Math.max(min, s.maxTurns);
    this.stateTurns.set(id, min + Math.floor(rng() * (max - min + 1)));
    this.stateSteps.set(id, s.stepsToRemove);
  }

  /** States whose icons should be displayed (excluding KO). */
  displayStates(): State[] {
    return this.stateObjects().filter((s) => s.id !== DEATH_STATE && s.icon > 0);
  }

  // --- buffs -------------------------------------------------------------------------

  addBuff(i: number, turns: number): void {
    if (!this.isAlive()) return;
    this.buffs[i] = Math.min(2, this.buffs[i] + 1);
    if (this.buffs[i] !== 0) this.buffTurns[i] = Math.max(this.buffTurns[i], turns);
    else this.buffTurns[i] = 0;
  }

  addDebuff(i: number, turns: number): void {
    if (!this.isAlive()) return;
    this.buffs[i] = Math.max(-2, this.buffs[i] - 1);
    if (this.buffs[i] !== 0) this.buffTurns[i] = Math.max(this.buffTurns[i], turns);
    else this.buffTurns[i] = 0;
  }

  // --- turn processing ------------------------------------------------------------

  /** HP/MP regeneration at the end of a turn. Returns the HP change (for popups). */
  regenerate(): { hp: number; mp: number } {
    if (!this.isAlive()) return { hp: 0, mp: 0 };
    const hp = Math.floor(this.mhp * this.xparam('hrg'));
    const mp = Math.floor(this.mmp * this.xparam('mrg'));
    // regeneration (e.g. poison) never knocks a battler out
    const hpChange = Math.max(hp, -(this._hp - 1));
    if (hpChange) this.gainHp(hpChange);
    if (mp) this.gainMp(mp);
    return { hp: hpChange, mp };
  }

  /** Count down state/buff turns. Returns ids of states removed. */
  updateStateTurns(timing: 'turnEnd' | 'actionEnd'): number[] {
    const removed: number[] = [];
    for (const s of this.stateObjects()) {
      if (s.autoRemoval !== timing) continue;
      const left = (this.stateTurns.get(s.id) ?? 0) - 1;
      this.stateTurns.set(s.id, left);
      if (left <= 0) {
        this.removeState(s.id);
        removed.push(s.id);
      }
    }
    return removed;
  }

  updateBuffTurns(): void {
    for (let i = 0; i < 8; i++) {
      if (this.buffTurns[i] > 0 && --this.buffTurns[i] === 0) this.buffs[i] = 0;
    }
  }

  /** Remove states that wear off when taking damage. Returns removed ids. */
  removeStatesByDamage(rng: () => number = Math.random): number[] {
    const removed: number[] = [];
    for (const s of this.stateObjects()) {
      if (s.removeByDamage && rng() < s.damageRemovalChance / 100) {
        this.removeState(s.id);
        removed.push(s.id);
      }
    }
    return removed;
  }

  /** Called each step on the map; returns ids of states that wore off. */
  onStep(): number[] {
    const removed: number[] = [];
    for (const s of this.stateObjects()) {
      if (!s.removeByWalking) continue;
      const left = (this.stateSteps.get(s.id) ?? s.stepsToRemove) - 1;
      this.stateSteps.set(s.id, left);
      if (left <= 0) {
        this.removeState(s.id);
        removed.push(s.id);
      }
    }
    return removed;
  }

  onBattleEnd(): void {
    for (const s of this.stateObjects()) if (s.removeAtBattleEnd) this.removeState(s.id);
    this.buffs = [0, 0, 0, 0, 0, 0, 0, 0];
    this.buffTurns = [0, 0, 0, 0, 0, 0, 0, 0];
    this.guarding = false;
  }
}
