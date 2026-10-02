import { describe, expect, it } from 'vitest';
import { createEmptyProject } from '../../core/project';
import { mulberry32 } from '../../core/util';
import { GameData } from '../data';
import { GameActor, expForLevel } from '../state/actor';
import { GameEnemy } from '../state/enemy';
import { GameState } from '../state/gamestate';
import { BattleAction, applyAction, canUse, escapeRatio, evalFormula } from './logic';

function setup() {
  const project = createEmptyProject();
  const data = new GameData(project);
  const state = new GameState(data);
  state.setupNewGame();
  return { project, data, state };
}

describe('battlers', () => {
  it('computes actor parameters from class curves and equipment', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    const warrior = data.classes.get(1)!;
    expect(leon.level).toBe(1);
    // class base attack + Short Sword
    expect(leon.atk).toBe(warrior.params[2].base + data.weapons.get(1)!.params[2]);
    expect(leon.hp).toBe(leon.mhp);
    leon.changeLevel(99);
    expect(leon.paramBase(0)).toBe(warrior.params[0].max);
  });

  it('levels up and learns skills from exp', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    const need = expForLevel(data.classes.get(1), 3);
    const change = leon.gainExp(need);
    expect(change.newLevel).toBe(3);
    expect(change.learned).toContain(15);
    expect(leon.hasSkill(15)).toBe(true);
  });

  it('synchronises KO with HP', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    leon.gainHp(-99999);
    expect(leon.isDead()).toBe(true);
    expect(leon.hp).toBe(0);
    leon.removeState(1);
    expect(leon.isAlive()).toBe(true);
    expect(leon.hp).toBe(1);
  });

  it('applies state traits like silence sealing magic', () => {
    const { data } = setup();
    const mira = new GameActor(data, 2);
    const fire = data.skills.get(5)!;
    expect(canUse(mira, fire, true)).toBe(true);
    mira.addState(5);
    expect(canUse(mira, fire, true)).toBe(false);
  });

  it('chooses enemy actions by rating', () => {
    const { data } = setup();
    const wolf = new GameEnemy(data, 4, 0, 300, 300);
    const counts = new Map<number, number>();
    const rng = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const id = wolf.selectAction({ turn: 1, partyLevel: 1, switches: () => false }, rng)!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Bite (rating 5) is picked much more often than Howl (rating 2)
    expect(counts.get(19) ?? 0).toBeGreaterThan(counts.get(25) ?? 0);
    expect(counts.get(25) ?? 0).toBeGreaterThan(0);
  });
});

describe('damage', () => {
  it('evaluates formulas with battler parameters', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    const slime = new GameEnemy(data, 1, 0, 0, 0);
    expect(evalFormula('a.atk * 4 - b.def * 2', leon, slime, [])).toBe(leon.atk * 4 - slime.def * 2);
    expect(evalFormula('v[3] + 1', leon, slime, [0, 0, 0, 41])).toBe(42);
    expect(evalFormula('this is not js', leon, slime, [])).toBe(0);
  });

  it('applies attack damage, element rates and guarding', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    const slime = new GameEnemy(data, 1, 0, 0, 0);
    const action = new BattleAction(leon, data.skills.get(1)!);
    const rng = () => 0.5;
    // force a hit with no crit: rng 0.5 < hit 0.95, eva 0.05, cri 0.04
    const out = applyAction(action, slime, { data, variables: [], rng });
    expect(out.missed).toBe(false);
    expect(out.hpDamage).toBeGreaterThan(0);
    expect(slime.hp).toBe(Math.max(0, slime.mhp - out.hpDamage));

    // Fire is 150% against slimes
    const mira = new GameActor(data, 2);
    const s2 = new GameEnemy(data, 1, 0, 0, 0);
    const fire = new BattleAction(mira, data.skills.get(5)!);
    const fireOut = applyAction(fire, s2, { data, variables: [], rng: () => 0.5 });
    const base = Math.max(0, evalFormula(data.skills.get(5)!.damage.formula, mira, s2, []));
    // with rng fixed at 0.5 the variance is (almost) centred: base * 150% ± 1
    // the reported damage is the full (overkill) value, HP is clamped at 0
    expect(Math.abs(fireOut.hpDamage - base * 1.5)).toBeLessThanOrEqual(1);
    expect(s2.hp).toBe(Math.max(0, s2.mhp - fireOut.hpDamage));
  });

  it('heals with recovery effects and revives with feathers', () => {
    const { data, state } = setup();
    const leon = state.actor(1)!;
    leon.gainHp(-100);
    const potion = new BattleAction(leon, data.items.get(1)!);
    applyAction(potion, leon, { data, variables: [], rng: () => 0.1 });
    expect(leon.hp).toBe(leon.mhp);
    leon.gainHp(-99999);
    expect(leon.isDead()).toBe(true);
    const feather = new BattleAction(leon, data.items.get(6)!);
    const targets = feather.makeTargets([leon], [], () => 0);
    expect(targets).toEqual([leon]);
    applyAction(feather, leon, { data, variables: [], rng: () => 0.1 });
    expect(leon.isAlive()).toBe(true);
    // revive sets HP to 1, then the 25% recovery is added
    expect(leon.hp).toBe(1 + Math.floor(leon.mhp * 0.25));
  });

  it('picks valid targets', () => {
    const { data } = setup();
    const leon = new GameActor(data, 1);
    const a = new GameEnemy(data, 1, 0, 0, 0);
    const b = new GameEnemy(data, 1, 1, 0, 0);
    a.die();
    const action = new BattleAction(leon, data.skills.get(1)!);
    action.targetIndex = 0;
    expect(action.makeTargets([leon], [a, b], () => 0)).toEqual([b]);
  });

  it('computes escape chances', () => {
    expect(escapeRatio(10, 20, 0)).toBeCloseTo(0.25);
    expect(escapeRatio(10, 20, 3)).toBeCloseTo(0.55);
    expect(escapeRatio(100, 1, 0)).toBe(1);
  });
});

describe('inventory', () => {
  it('equips items from the inventory', () => {
    const { state } = setup();
    const leon = state.actor(1)!;
    state.gainItem('weapon', 2, 1);
    const atkBefore = leon.atk;
    expect(state.changeEquip(leon, 0, 2)).toBe(true);
    expect(leon.atk).toBe(atkBefore - 10 + 24);
    expect(state.numItems('weapon', 1)).toBe(1);
    expect(state.numItems('weapon', 2)).toBe(0);
    // mages cannot equip swords
    const mira = state.actor(2)!;
    expect(state.changeEquip(mira, 0, 1)).toBe(false);
  });

  it('round-trips through serialisation', () => {
    const { data, state } = setup();
    state.gainGold(1234);
    state.setSwitch(3, true);
    state.setVariable(4, -7);
    state.gainItem('item', 1, 5);
    state.addActor(2);
    state.actor(2)!.changeLevel(7);
    const saved = state.serialize({ mapId: 1, x: 2, y: 3, direction: 4, followersVisible: true, transparent: false, bgm: null, bgs: null, tone: [0, 0, 0, 0], weather: { type: 'none', power: 0 } });
    const copy = new GameState(data);
    copy.load(JSON.parse(JSON.stringify(saved)));
    expect(copy.gold).toBe(1234);
    expect(copy.getSwitch(3)).toBe(true);
    expect(copy.getVariable(4)).toBe(-7);
    expect(copy.numItems('item', 1)).toBe(5);
    expect(copy.party).toEqual([1, 2]);
    expect(copy.actor(2)!.level).toBe(7);
  });
});
