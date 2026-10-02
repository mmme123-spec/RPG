/** Runtime enemy (battle only). */

import type { Drop, Enemy, EnemyAction } from '../../core/types';
import type { GameData } from '../data';
import { Battler, type TraitSource } from './battler';

export interface ActionContext {
  turn: number;
  partyLevel: number;
  switches: (id: number) => boolean;
}

export class GameEnemy extends Battler {
  readonly enemyId: number;
  readonly index: number;
  /** Bottom-centre position on the battle screen. */
  screenX: number;
  screenY: number;
  hidden: boolean;
  letter = '';

  constructor(data: GameData, enemyId: number, index: number, x: number, y: number, hidden = false) {
    super(data);
    this.enemyId = enemyId;
    this.index = index;
    this.screenX = x;
    this.screenY = y;
    this.hidden = hidden;
    this.recoverAll();
  }

  enemyData(): Enemy | undefined {
    return this.data.enemies.get(this.enemyId);
  }

  get name(): string {
    return (this.enemyData()?.name ?? 'Enemy') + (this.letter ? ` ${this.letter}` : '');
  }

  isActor(): boolean {
    return false;
  }

  paramBase(i: number): number {
    return this.enemyData()?.params[i] ?? 1;
  }

  paramPlus(): number {
    return 0;
  }

  protected baseTraitSources(): TraitSource[] {
    const e = this.enemyData();
    return e ? [e] : [];
  }

  exp(): number {
    return this.enemyData()?.exp ?? 0;
  }

  gold(): number {
    return this.enemyData()?.gold ?? 0;
  }

  /** Roll drops. `double` doubles the chance of each drop. */
  makeDrops(rng: () => number, double = false): Drop[] {
    const out: Drop[] = [];
    for (const d of this.enemyData()?.drops ?? []) {
      if (d.denominator <= 0) continue;
      const chance = (double ? 2 : 1) / d.denominator;
      if (rng() < chance) out.push(d);
    }
    return out;
  }

  private actionValid(a: EnemyAction, ctx: ActionContext): boolean {
    switch (a.condition) {
      case 'always':
        return true;
      case 'turn': {
        const n = ctx.turn;
        if (a.param2 === 0) return n === a.param1;
        return n >= a.param1 && (n - a.param1) % a.param2 === 0;
      }
      case 'hp':
        return this.hpRate() * 100 >= a.param1 && this.hpRate() * 100 <= a.param2;
      case 'mp':
        return this.mpRate() * 100 >= a.param1 && this.mpRate() * 100 <= a.param2;
      case 'state':
        return this.hasState(a.param1);
      case 'partyLevel':
        return ctx.partyLevel >= a.param1;
      case 'switch':
        return ctx.switches(a.param1);
    }
  }

  /**
   * Choose a skill id for this turn. Actions are weighted by rating; only
   * actions within 2 rating points of the best valid action are considered.
   */
  selectAction(ctx: ActionContext, rng: () => number): number | null {
    const usable = (this.enemyData()?.actions ?? []).filter((a) => {
      const skill = this.data.skills.get(a.skillId);
      return !!skill && this.mp >= skill.mpCost && this.actionValid(a, ctx);
    });
    if (usable.length === 0) return null;
    const maxRating = Math.max(...usable.map((a) => a.rating));
    const pool = usable.filter((a) => a.rating > maxRating - 3);
    const weights = pool.map((a) => a.rating - (maxRating - 3));
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r < 0) return pool[i].skillId;
    }
    return pool[pool.length - 1].skillId;
  }
}
