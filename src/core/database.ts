/**
 * The default database that new projects start with: a small but complete
 * set of classes, actors, skills, items, equipment, enemies, troops and states.
 */

import type {
  Actor,
  ActorClass,
  Armor,
  CommonEvent,
  Damage,
  Effect,
  Enemy,
  EnemyAction,
  Item,
  Project,
  Skill,
  State,
  Trait,
  Troop,
  Weapon,
} from './types';
import { audio, createClass, params } from './factory';

// Element ids (index + 1 into system.elements)
export const EL = { physical: 1, fire: 2, ice: 3, thunder: 4, water: 5, earth: 6, wind: 7, light: 8, dark: 9 } as const;
// Skill type ids
export const ST = { magic: 1, special: 2 } as const;
// Weapon type ids
export const WT = { sword: 1, axe: 2, dagger: 3, spear: 4, bow: 5, staff: 6, mace: 7 } as const;
// Armor type ids
export const AT = { general: 1, light: 2, heavy: 3, robe: 4, smallShield: 5, largeShield: 6 } as const;
// Equipment slots
export const SLOT = { weapon: 0, shield: 1, head: 2, body: 3, accessory: 4 } as const;
// State ids
export const S = { knockout: 1, poison: 2, sleep: 3, paralysis: 4, silence: 5, blind: 6, confusion: 7, regen: 8 } as const;
// Icon indices (see BUILTIN_ICONS)
const I = {
  redPotion: 1,
  bluePotion: 2,
  greenPotion: 3,
  elixir: 4,
  herb: 5,
  bread: 6,
  feather: 7,
  scroll: 8,
  book: 9,
  key: 10,
  ruby: 11,
  sapphire: 12,
  goldBag: 13,
  letter: 14,
  bomb: 15,
  sword: 16,
  greatsword: 17,
  dagger: 18,
  axe: 19,
  spear: 20,
  bow: 21,
  staff: 22,
  mace: 23,
  buckler: 24,
  shield: 25,
  helmet: 26,
  hat: 27,
  armor: 28,
  robe: 29,
  ring: 30,
  amulet: 31,
  boots: 32,
  gloves: 33,
  fire: 34,
  ice: 35,
  thunder: 36,
  wind: 37,
  earth: 38,
  water: 39,
  light: 40,
  dark: 41,
  heal: 42,
  cure: 43,
  star: 44,
  skull: 45,
  poison: 46,
  sleep: 47,
  paralysis: 48,
  silence: 49,
  blind: 50,
  confusion: 51,
  atkUp: 52,
  defUp: 53,
  speedUp: 54,
  atkDown: 55,
  defDown: 56,
  guard: 57,
  fist: 58,
  run: 59,
  chest: 60,
  map: 61,
  tent: 62,
  music: 63,
} as const;
export { I as ICON };

function dmg(type: Damage['type'], formula: string, elementId = 0, critical = false, variance = 20): Damage {
  return { type, elementId, formula, variance, critical };
}

const NO_DAMAGE: Damage = dmg('none', '0');

function skill(
  id: number,
  name: string,
  o: Partial<Skill> & Pick<Skill, 'scope'>,
): Skill {
  return {
    id,
    name,
    description: '',
    icon: 0,
    stypeId: 0,
    mpCost: 0,
    message: '%1 uses %2!',
    occasion: 'battle',
    speed: 0,
    successRate: 100,
    repeats: 1,
    hitType: 'certain',
    animation: '',
    damage: NO_DAMAGE,
    effects: [],
    note: '',
    ...o,
  };
}

export function defaultSkills(): Skill[] {
  const attackState: Effect = { kind: 'addState', stateId: 0, chance: 100 };
  return [
    skill(1, 'Attack', {
      description: 'A basic attack with the equipped weapon.',
      icon: I.fist,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'attack',
      message: '%1 attacks!',
      damage: dmg('hpDamage', 'a.atk * 4 - b.def * 2', -1, true),
      effects: [attackState],
    }),
    skill(2, 'Guard', { description: 'Halves damage taken until your next turn.', icon: I.guard, scope: 'user', message: '%1 guards.', speed: 2000 }),
    skill(3, 'Wait', { scope: 'none', message: '%1 is watching closely.' }),
    skill(4, 'Heal', {
      description: 'Restores HP to one ally.',
      icon: I.heal,
      stypeId: ST.magic,
      mpCost: 5,
      scope: 'ally',
      occasion: 'always',
      animation: 'heal',
      message: '%1 casts %2!',
      damage: dmg('hpRecover', '200 + a.mat * 2', 0, false, 10),
    }),
    skill(5, 'Fire', {
      description: 'Scorches one enemy with flames.',
      icon: I.fire,
      stypeId: ST.magic,
      mpCost: 6,
      scope: 'enemy',
      hitType: 'magical',
      animation: 'fire',
      message: '%1 casts %2!',
      damage: dmg('hpDamage', '100 + a.mat * 2 - b.mdf * 2', EL.fire),
    }),
    skill(6, 'Ice', {
      description: 'Freezes one enemy with shards of ice.',
      icon: I.ice,
      stypeId: ST.magic,
      mpCost: 6,
      scope: 'enemy',
      hitType: 'magical',
      animation: 'ice',
      message: '%1 casts %2!',
      damage: dmg('hpDamage', '100 + a.mat * 2 - b.mdf * 2', EL.ice),
    }),
    skill(7, 'Thunder', {
      description: 'Strikes one enemy with lightning.',
      icon: I.thunder,
      stypeId: ST.magic,
      mpCost: 7,
      scope: 'enemy',
      hitType: 'magical',
      animation: 'thunder',
      message: '%1 casts %2!',
      damage: dmg('hpDamage', '120 + a.mat * 2 - b.mdf * 2', EL.thunder),
    }),
    skill(8, 'Flame Storm', {
      description: 'Engulfs all enemies in fire.',
      icon: I.fire,
      stypeId: ST.magic,
      mpCost: 16,
      scope: 'allEnemies',
      hitType: 'magical',
      animation: 'explosion',
      message: '%1 casts %2!',
      damage: dmg('hpDamage', '150 + a.mat * 2 - b.mdf * 2', EL.fire),
    }),
    skill(9, 'Cure', {
      description: 'Cures poison, blindness and silence.',
      icon: I.cure,
      stypeId: ST.magic,
      mpCost: 4,
      scope: 'ally',
      occasion: 'always',
      animation: 'cure',
      message: '%1 casts %2!',
      effects: [
        { kind: 'removeState', stateId: S.poison, chance: 100 },
        { kind: 'removeState', stateId: S.blind, chance: 100 },
        { kind: 'removeState', stateId: S.silence, chance: 100 },
        { kind: 'removeState', stateId: S.paralysis, chance: 100 },
      ],
    }),
    skill(10, 'Raise', {
      description: 'Revives a fallen ally.',
      icon: I.feather,
      stypeId: ST.magic,
      mpCost: 20,
      scope: 'deadAlly',
      occasion: 'always',
      animation: 'light',
      message: '%1 casts %2!',
      effects: [
        { kind: 'removeState', stateId: S.knockout, chance: 100 },
        { kind: 'recoverHp', percent: 30, flat: 0 },
      ],
    }),
    skill(11, 'Healing Wave', {
      description: 'Restores HP to the whole party.',
      icon: I.heal,
      stypeId: ST.magic,
      mpCost: 16,
      scope: 'allAllies',
      occasion: 'always',
      animation: 'heal',
      message: '%1 casts %2!',
      damage: dmg('hpRecover', '150 + a.mat * 1.5', 0, false, 10),
    }),
    skill(12, 'Holy Light', {
      description: 'Smites one enemy with sacred light.',
      icon: I.light,
      stypeId: ST.magic,
      mpCost: 12,
      scope: 'enemy',
      hitType: 'magical',
      animation: 'light',
      message: '%1 casts %2!',
      damage: dmg('hpDamage', '180 + a.mat * 2.5 - b.mdf * 2', EL.light),
    }),
    skill(13, 'Sleep', {
      description: 'Lulls one enemy to sleep.',
      icon: I.sleep,
      stypeId: ST.magic,
      mpCost: 5,
      scope: 'enemy',
      hitType: 'magical',
      animation: 'sleep',
      message: '%1 casts %2!',
      effects: [{ kind: 'addState', stateId: S.sleep, chance: 75 }],
    }),
    skill(14, 'Barrier', {
      description: "Raises an ally's defense for 5 turns.",
      icon: I.defUp,
      stypeId: ST.magic,
      mpCost: 6,
      scope: 'ally',
      animation: 'buff',
      message: '%1 casts %2!',
      effects: [{ kind: 'addBuff', param: 3, turns: 5 }],
    }),
    skill(15, 'Power Strike', {
      description: 'A mighty blow dealing heavy damage.',
      icon: I.atkUp,
      stypeId: ST.special,
      mpCost: 5,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'slash',
      message: '%1 uses %2!',
      damage: dmg('hpDamage', 'a.atk * 6 - b.def * 2', -1, true),
    }),
    skill(16, 'Double Slash', {
      description: 'Strikes one enemy twice.',
      icon: I.sword,
      stypeId: ST.special,
      mpCost: 8,
      scope: 'enemy',
      hitType: 'physical',
      repeats: 2,
      animation: 'slash',
      message: '%1 uses %2!',
      damage: dmg('hpDamage', 'a.atk * 3.5 - b.def * 1.5', -1, true),
    }),
    skill(17, 'Poison Strike', {
      description: 'An attack that may poison the target.',
      icon: I.poison,
      stypeId: ST.special,
      mpCost: 4,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'pierce',
      message: '%1 uses %2!',
      damage: dmg('hpDamage', 'a.atk * 4 - b.def * 2', -1, true),
      effects: [{ kind: 'addState', stateId: S.poison, chance: 60 }],
    }),
    skill(18, 'Haste', {
      description: "Raises an ally's agility for 5 turns.",
      icon: I.speedUp,
      stypeId: ST.special,
      mpCost: 4,
      scope: 'ally',
      animation: 'buff',
      message: '%1 uses %2!',
      effects: [{ kind: 'addBuff', param: 6, turns: 5 }],
    }),
    // --- enemy skills -----------------------------------------------------------
    skill(19, 'Bite', {
      icon: I.fist,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'claw',
      message: '%1 bites!',
      damage: dmg('hpDamage', 'a.atk * 4.5 - b.def * 2', EL.physical),
    }),
    skill(20, 'Poison Bite', {
      icon: I.poison,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'poison',
      message: '%1 bites with venomous fangs!',
      damage: dmg('hpDamage', 'a.atk * 3.5 - b.def * 2', EL.physical),
      effects: [{ kind: 'addState', stateId: S.poison, chance: 50 }],
    }),
    skill(21, 'Fire Breath', {
      icon: I.fire,
      scope: 'allEnemies',
      hitType: 'magical',
      animation: 'fire',
      message: '%1 breathes fire!',
      damage: dmg('hpDamage', '80 + a.mat * 2 - b.mdf', EL.fire),
    }),
    skill(22, 'Dark Bolt', {
      icon: I.dark,
      scope: 'enemy',
      hitType: 'magical',
      mpCost: 5,
      animation: 'dark',
      message: '%1 hurls a bolt of darkness!',
      damage: dmg('hpDamage', '80 + a.mat * 2 - b.mdf * 2', EL.dark),
    }),
    skill(23, 'Drain', {
      icon: I.dark,
      scope: 'enemy',
      hitType: 'magical',
      mpCost: 8,
      animation: 'dark',
      message: '%1 drains life!',
      damage: dmg('hpDrain', '60 + a.mat * 2 - b.mdf', EL.dark),
    }),
    skill(24, 'Sleep Spores', {
      icon: I.sleep,
      scope: 'allEnemies',
      hitType: 'magical',
      animation: 'sleep',
      message: '%1 releases sleeping spores!',
      effects: [{ kind: 'addState', stateId: S.sleep, chance: 35 }],
    }),
    skill(25, 'Howl', {
      icon: I.atkUp,
      scope: 'user',
      animation: 'buff',
      message: '%1 lets out a fearsome howl!',
      effects: [{ kind: 'addBuff', param: 2, turns: 3 }],
    }),
    skill(26, 'Crushing Blow', {
      icon: I.mace,
      scope: 'enemy',
      hitType: 'physical',
      animation: 'blunt',
      message: '%1 delivers a crushing blow!',
      damage: dmg('hpDamage', 'a.atk * 6 - b.def * 2', EL.physical, true),
    }),
    skill(27, 'Tail Sweep', {
      icon: I.wind,
      scope: 'allEnemies',
      hitType: 'physical',
      animation: 'blunt',
      message: '%1 sweeps its tail!',
      damage: dmg('hpDamage', 'a.atk * 3.5 - b.def * 2', EL.physical),
    }),
  ];
}

function state(id: number, name: string, o: Partial<State>): State {
  return {
    id,
    name,
    icon: 0,
    restriction: 'none',
    priority: 50,
    removeAtBattleEnd: true,
    autoRemoval: 'turnEnd',
    minTurns: 3,
    maxTurns: 5,
    removeByDamage: false,
    damageRemovalChance: 100,
    removeByWalking: false,
    stepsToRemove: 100,
    messageActor: '',
    messageEnemy: '',
    messageStay: '',
    messageRemove: '',
    color: '',
    traits: [],
    note: '',
    ...o,
  };
}

export function defaultStates(): State[] {
  return [
    state(1, 'Knockout', {
      icon: I.skull,
      restriction: 'cannotMove',
      priority: 100,
      removeAtBattleEnd: false,
      autoRemoval: 'none',
      messageActor: '%1 has fallen!',
      messageEnemy: '%1 is defeated!',
      messageRemove: '%1 gets back up!',
    }),
    state(2, 'Poison', {
      icon: I.poison,
      priority: 60,
      removeAtBattleEnd: false,
      autoRemoval: 'none',
      messageActor: '%1 is poisoned!',
      messageEnemy: '%1 is poisoned!',
      messageRemove: '%1 is no longer poisoned.',
      color: '#7a3aa8',
      traits: [{ kind: 'xparam', xparam: 'hrg', value: -10 }],
    }),
    state(3, 'Sleep', {
      icon: I.sleep,
      restriction: 'cannotMove',
      priority: 70,
      minTurns: 2,
      maxTurns: 4,
      removeByDamage: true,
      messageActor: '%1 falls asleep!',
      messageEnemy: '%1 falls asleep!',
      messageStay: '%1 is sound asleep...',
      messageRemove: '%1 wakes up.',
      color: '#3a5ab0',
      traits: [{ kind: 'xparam', xparam: 'eva', value: -100 }],
    }),
    state(4, 'Paralysis', {
      icon: I.paralysis,
      restriction: 'cannotMove',
      priority: 75,
      minTurns: 1,
      maxTurns: 3,
      messageActor: '%1 is paralyzed!',
      messageEnemy: '%1 is paralyzed!',
      messageStay: '%1 cannot move!',
      messageRemove: '%1 can move again.',
      color: '#c0b020',
    }),
    state(5, 'Silence', {
      icon: I.silence,
      priority: 55,
      messageActor: '%1 is silenced!',
      messageEnemy: '%1 is silenced!',
      messageRemove: '%1 can speak again.',
      traits: [{ kind: 'sealSkillType', stypeId: ST.magic }],
    }),
    state(6, 'Blind', {
      icon: I.blind,
      priority: 50,
      messageActor: '%1 is blinded!',
      messageEnemy: '%1 is blinded!',
      messageRemove: '%1 can see again.',
      color: '#202020',
      traits: [{ kind: 'xparam', xparam: 'hit', value: -50 }],
    }),
    state(7, 'Confusion', {
      icon: I.confusion,
      restriction: 'attackAnyone',
      priority: 65,
      minTurns: 2,
      maxTurns: 3,
      removeByDamage: true,
      damageRemovalChance: 50,
      messageActor: '%1 is confused!',
      messageEnemy: '%1 is confused!',
      messageRemove: '%1 comes to their senses.',
      color: '#d06ad0',
    }),
    state(8, 'Regen', {
      icon: I.heal,
      priority: 40,
      minTurns: 4,
      maxTurns: 5,
      messageActor: "%1's wounds begin to close.",
      messageEnemy: "%1's wounds begin to close.",
      messageRemove: '%1 stops regenerating.',
      traits: [{ kind: 'xparam', xparam: 'hrg', value: 8 }],
    }),
  ];
}

function cls(id: number, name: string, p: [number, number][], learnings: [number, number][], skillTypes: number[], weaponTypes: number[], armorTypes: number[], traits: Trait[] = []): ActorClass {
  const c = createClass(id);
  c.name = name;
  c.params = p.map(([base, max]) => ({ base, max, growth: 1 }));
  c.learnings = learnings.map(([level, skillId]) => ({ level, skillId }));
  c.skillTypes = skillTypes;
  c.weaponTypes = weaponTypes;
  c.armorTypes = armorTypes;
  c.traits = traits;
  return c;
}

export function defaultClasses(): ActorClass[] {
  return [
    cls(
      1,
      'Warrior',
      [
        [450, 9000],
        [40, 800],
        [18, 300],
        [16, 260],
        [8, 140],
        [10, 180],
        [12, 200],
        [12, 180],
      ],
      [
        [3, 15],
        [6, 18],
        [9, 16],
      ],
      [ST.special],
      [WT.sword, WT.axe, WT.spear],
      [AT.general, AT.light, AT.heavy, AT.smallShield, AT.largeShield],
    ),
    cls(
      2,
      'Mage',
      [
        [300, 6000],
        [90, 2000],
        [10, 160],
        [10, 150],
        [22, 330],
        [18, 290],
        [14, 220],
        [14, 200],
      ],
      [
        [1, 5],
        [2, 6],
        [4, 7],
        [5, 13],
        [10, 8],
      ],
      [ST.magic],
      [WT.staff, WT.dagger],
      [AT.general, AT.robe],
    ),
    cls(
      3,
      'Priest',
      [
        [340, 7000],
        [80, 1800],
        [12, 190],
        [12, 200],
        [18, 280],
        [20, 320],
        [12, 200],
        [16, 220],
      ],
      [
        [1, 4],
        [3, 9],
        [5, 14],
        [8, 12],
        [10, 10],
        [12, 11],
      ],
      [ST.magic],
      [WT.mace, WT.staff],
      [AT.general, AT.light, AT.robe, AT.smallShield],
    ),
    cls(
      4,
      'Thief',
      [
        [380, 7600],
        [50, 1000],
        [15, 250],
        [12, 200],
        [10, 170],
        [12, 180],
        [20, 320],
        [20, 300],
      ],
      [
        [2, 17],
        [4, 18],
        [7, 16],
      ],
      [ST.special],
      [WT.dagger, WT.bow],
      [AT.general, AT.light],
      [{ kind: 'xparam', xparam: 'eva', value: 5 }],
    ),
  ];
}

export function defaultActors(): Actor[] {
  const a = (id: number, name: string, classId: number, sheet: string, equips: number[], profile: string, nickname: string): Actor => ({
    id,
    name,
    nickname,
    classId,
    initialLevel: 1,
    maxLevel: 99,
    character: { sheet: `builtin:${sheet}`, index: 0 },
    face: { sheet: `builtin:${sheet}`, index: 0 },
    equips,
    traits: [],
    profile,
    note: '',
  });
  return [
    a(1, 'Leon', 1, 'hero', [1, 1, 0, 7, 0], 'A young swordsman from Willowbrook with a big heart and a bigger appetite.', 'The Brave'),
    a(2, 'Mira', 2, 'mage', [9, 0, 5, 9, 0], 'A wandering mage searching for the secrets of the ancient crystals.', 'Spellweaver'),
    a(3, 'Sera', 3, 'priest', [11, 1, 0, 9, 0], 'A gentle priestess of the Dawn Temple.', 'The Gentle'),
    a(4, 'Kit', 4, 'thief', [5, 0, 3, 7, 0], 'A quick-fingered rogue who insists he only steals from villains.', 'Shadowstep'),
  ];
}

function item(id: number, name: string, o: Partial<Item>): Item {
  return {
    id,
    name,
    description: '',
    icon: I.redPotion,
    itype: 'regular',
    price: 0,
    consumable: true,
    scope: 'ally',
    occasion: 'always',
    speed: 0,
    successRate: 100,
    repeats: 1,
    hitType: 'certain',
    animation: 'heal',
    damage: NO_DAMAGE,
    effects: [],
    note: '',
    ...o,
  };
}

export function defaultItems(): Item[] {
  return [
    item(1, 'Potion', { description: 'Restores 250 HP.', icon: I.redPotion, price: 40, effects: [{ kind: 'recoverHp', percent: 0, flat: 250 }] }),
    item(2, 'Hi-Potion', { description: 'Restores 800 HP.', icon: I.redPotion, price: 180, effects: [{ kind: 'recoverHp', percent: 0, flat: 800 }] }),
    item(3, 'Ether', { description: 'Restores 50 MP.', icon: I.bluePotion, price: 150, effects: [{ kind: 'recoverMp', percent: 0, flat: 50 }] }),
    item(4, 'Antidote', {
      description: 'Cures poison.',
      icon: I.greenPotion,
      price: 20,
      animation: 'cure',
      effects: [{ kind: 'removeState', stateId: S.poison, chance: 100 }],
    }),
    item(5, 'Remedy Herb', {
      description: 'Cures most ailments.',
      icon: I.herb,
      price: 90,
      animation: 'cure',
      effects: [S.poison, S.sleep, S.paralysis, S.silence, S.blind, S.confusion].map((id) => ({ kind: 'removeState', stateId: id, chance: 100 }) as Effect),
    }),
    item(6, 'Phoenix Feather', {
      description: 'Revives a fallen ally with some HP.',
      icon: I.feather,
      price: 300,
      scope: 'deadAlly',
      animation: 'light',
      effects: [
        { kind: 'removeState', stateId: S.knockout, chance: 100 },
        { kind: 'recoverHp', percent: 25, flat: 0 },
      ],
    }),
    item(7, 'Elixir', {
      description: 'Fully restores HP and MP.',
      icon: I.elixir,
      price: 1500,
      effects: [
        { kind: 'recoverHp', percent: 100, flat: 0 },
        { kind: 'recoverMp', percent: 100, flat: 0 },
      ],
    }),
    item(8, 'Tent', {
      description: 'Rest anywhere outside of battle. Fully restores the party.',
      icon: I.tent,
      price: 400,
      scope: 'allAllies',
      occasion: 'menu',
      effects: [
        { kind: 'recoverHp', percent: 100, flat: 0 },
        { kind: 'recoverMp', percent: 100, flat: 0 },
      ],
    }),
    item(9, 'Fire Bomb', {
      description: 'Explodes, damaging all enemies.',
      icon: I.bomb,
      price: 120,
      scope: 'allEnemies',
      occasion: 'battle',
      animation: 'explosion',
      damage: dmg('hpDamage', '250', EL.fire, false, 10),
    }),
    item(10, 'Old Key', { description: 'A rusty key engraved with a flame.', icon: I.key, itype: 'key', consumable: false, occasion: 'never', scope: 'none' }),
    item(11, 'Ember Crystal', {
      description: 'A warm, glowing crystal that protects Willowbrook.',
      icon: I.ruby,
      itype: 'key',
      consumable: false,
      occasion: 'never',
      scope: 'none',
    }),
    item(12, "Elder's Letter", { description: 'A letter of introduction from the village elder.', icon: I.letter, itype: 'key', consumable: false, occasion: 'never', scope: 'none' }),
  ];
}

function weapon(id: number, name: string, wtypeId: number, icon: number, price: number, p: number[], animation: string, description: string, traits: Trait[] = []): Weapon {
  return {
    id,
    name,
    description,
    icon,
    wtypeId,
    price,
    params: params(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0, p[4] ?? 0, p[5] ?? 0, p[6] ?? 0, p[7] ?? 0),
    traits: [{ kind: 'attackElement', elementId: EL.physical }, ...traits],
    animation,
    note: '',
  };
}

export function defaultWeapons(): Weapon[] {
  return [
    weapon(1, 'Short Sword', WT.sword, I.sword, 100, [0, 0, 10], 'slash', 'A simple, reliable blade.'),
    weapon(2, 'Long Sword', WT.sword, I.sword, 480, [0, 0, 24], 'slash', 'A well-balanced steel sword.'),
    weapon(3, 'Knight Sword', WT.sword, I.greatsword, 1500, [0, 0, 42, 4], 'slash', 'A broad blade carried by royal knights.'),
    weapon(4, 'Battle Axe', WT.axe, I.axe, 700, [0, 0, 32, 0, 0, 0, -4], 'slash', 'Heavy, but devastating.'),
    weapon(5, 'Dagger', WT.dagger, I.dagger, 80, [0, 0, 8, 0, 0, 0, 4], 'pierce', 'Light and quick.'),
    weapon(6, 'Viper Dagger', WT.dagger, I.dagger, 1100, [0, 0, 26, 0, 0, 0, 8], 'pierce', 'Its blade drips with venom.', [{ kind: 'attackState', stateId: S.poison, value: 25 }]),
    weapon(7, 'Iron Spear', WT.spear, I.spear, 400, [0, 0, 20], 'pierce', 'Keeps enemies at a distance.'),
    weapon(8, 'Hunter Bow', WT.bow, I.bow, 300, [0, 0, 15, 0, 0, 0, 3], 'pierce', 'A sturdy hunting bow.'),
    weapon(9, 'Oak Staff', WT.staff, I.staff, 120, [0, 0, 5, 0, 10], 'blunt', 'Channels magic through living wood.'),
    weapon(10, 'Arcane Staff', WT.staff, I.staff, 1400, [0, 10, 10, 0, 28], 'blunt', 'Hums with arcane power.'),
    weapon(11, 'Mace', WT.mace, I.mace, 250, [0, 0, 14, 0, 5], 'blunt', 'A blessed iron mace.'),
    weapon(12, 'Holy Mace', WT.mace, I.mace, 1600, [0, 0, 28, 0, 18], 'light', 'Shines with holy light.', [{ kind: 'attackElement', elementId: EL.light }]),
  ];
}

function armor(id: number, name: string, slot: number, atypeId: number, icon: number, price: number, p: number[], description: string, traits: Trait[] = []): Armor {
  return {
    id,
    name,
    description,
    icon,
    atypeId,
    slot,
    price,
    params: params(p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0, p[4] ?? 0, p[5] ?? 0, p[6] ?? 0, p[7] ?? 0),
    traits,
    note: '',
  };
}

export function defaultArmors(): Armor[] {
  return [
    armor(1, 'Leather Shield', SLOT.shield, AT.smallShield, I.buckler, 80, [0, 0, 0, 5], 'A small shield of hardened leather.'),
    armor(2, 'Iron Shield', SLOT.shield, AT.largeShield, I.shield, 420, [0, 0, 0, 14], 'A heavy iron shield.'),
    armor(3, 'Leather Cap', SLOT.head, AT.light, I.helmet, 60, [0, 0, 0, 3], 'Better than nothing.'),
    armor(4, 'Iron Helm', SLOT.head, AT.heavy, I.helmet, 360, [0, 0, 0, 9], 'Protects the head from heavy blows.'),
    armor(5, 'Wizard Hat', SLOT.head, AT.robe, I.hat, 300, [0, 0, 0, 2, 6, 4], 'Pointy, and surprisingly magical.'),
    armor(6, 'Traveler Clothes', SLOT.body, AT.general, I.robe, 40, [0, 0, 0, 2], 'Comfortable clothes for long journeys.'),
    armor(7, 'Leather Armor', SLOT.body, AT.light, I.armor, 200, [0, 0, 0, 9], 'Light armor of tanned hide.'),
    armor(8, 'Chain Mail', SLOT.body, AT.heavy, I.armor, 820, [0, 0, 0, 20, 0, 0, -3], 'Interlocking steel rings.'),
    armor(9, 'Silk Robe', SLOT.body, AT.robe, I.robe, 340, [0, 0, 0, 5, 4, 10], 'Woven with protective runes.'),
    armor(10, 'Power Ring', SLOT.accessory, AT.general, I.ring, 800, [0, 0, 10], 'Increases attack.'),
    armor(11, 'Swift Boots', SLOT.accessory, AT.general, I.boots, 900, [0, 0, 0, 0, 0, 0, 15], 'Increases agility.'),
    armor(12, 'Life Amulet', SLOT.accessory, AT.general, I.amulet, 1200, [200], 'Raises max HP and prevents poison.', [{ kind: 'stateResist', stateId: S.poison }]),
  ];
}

function enemy(
  id: number,
  name: string,
  battler: string,
  p: number[],
  exp: number,
  gold: number,
  actions: [number, number][],
  extra: Partial<Enemy> = {},
): Enemy {
  return {
    id,
    name,
    battler: `builtin:${battler}`,
    hue: 0,
    params: params(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7]),
    exp,
    gold,
    drops: [],
    actions: actions.map(([skillId, rating]): EnemyAction => ({ skillId, rating, condition: 'always', param1: 0, param2: 0 })),
    traits: [],
    note: '',
    ...extra,
  };
}

const weak = (elementId: number, value = 200): Trait => ({ kind: 'elementRate', elementId, value });

export function defaultEnemies(): Enemy[] {
  return [
    enemy(1, 'Slime', 'slime', [160, 0, 26, 12, 10, 10, 10, 10], 12, 6, [[1, 5]], { drops: [{ kind: 'item', id: 1, denominator: 5 }], traits: [weak(EL.fire, 150)] }),
    enemy(2, 'Bat', 'bat', [130, 0, 28, 10, 10, 10, 26, 12], 14, 7, [
      [1, 5],
      [19, 4],
    ]),
    enemy(3, 'Goblin', 'goblin', [240, 0, 34, 18, 10, 14, 16, 12], 24, 18, [
      [1, 5],
      [26, 3],
    ], { drops: [{ kind: 'item', id: 1, denominator: 3 }] }),
    enemy(4, 'Wolf', 'wolf', [280, 0, 38, 18, 8, 14, 30, 12], 30, 14, [
      [19, 5],
      [25, 3],
    ], { traits: [weak(EL.fire, 150)] }),
    enemy(5, 'Snake', 'snake', [250, 0, 36, 16, 16, 16, 20, 12], 28, 16, [
      [1, 5],
      [20, 4],
    ], { drops: [{ kind: 'item', id: 4, denominator: 3 }], traits: [weak(EL.ice, 150)] }),
    enemy(6, 'Fungoid', 'mushroom', [320, 30, 34, 22, 26, 22, 12, 12], 34, 22, [
      [1, 5],
      [24, 3],
    ], { traits: [weak(EL.fire)] }),
    enemy(7, 'Skeleton', 'skeleton', [420, 0, 48, 30, 10, 18, 18, 12], 55, 34, [
      [1, 5],
      [26, 3],
    ], { traits: [weak(EL.light), weak(EL.dark, 0)], drops: [{ kind: 'item', id: 3, denominator: 6 }] }),
    enemy(8, 'Ghost', 'ghost', [340, 60, 34, 50, 40, 36, 26, 18], 60, 30, [
      [22, 5],
      [1, 3],
    ], { traits: [weak(EL.light), weak(EL.physical, 50), weak(EL.dark, 0)] }),
    enemy(9, 'Cave Spider', 'spider', [380, 0, 46, 26, 14, 18, 30, 12], 58, 30, [
      [1, 4],
      [20, 5],
    ], { traits: [weak(EL.fire)] }),
    enemy(10, 'Orc', 'orc', [700, 0, 62, 38, 12, 20, 18, 12], 90, 60, [
      [1, 5],
      [26, 3],
    ], { drops: [{ kind: 'item', id: 2, denominator: 4 }] }),
    enemy(11, 'Man-eater', 'plant', [560, 40, 52, 30, 38, 28, 14, 12], 80, 48, [
      [1, 5],
      [24, 3],
    ], { traits: [weak(EL.fire)] }),
    enemy(12, 'Imp', 'imp', [380, 80, 40, 26, 48, 38, 38, 22], 70, 42, [
      [1, 3],
      [5, 4],
    ], { traits: [weak(EL.ice), weak(EL.fire, 50)] }),
    enemy(13, 'Golem', 'golem', [1600, 0, 80, 70, 14, 40, 10, 12], 200, 100, [
      [1, 5],
      [26, 4],
    ], { traits: [weak(EL.thunder), weak(EL.physical, 70)] }),
    enemy(14, 'Dark Knight', 'darkKnight', [2400, 100, 70, 48, 44, 44, 34, 24], 600, 500, [
      [1, 5],
      [15, 4],
      [22, 3],
    ], { traits: [weak(EL.light), weak(EL.dark, 50)], drops: [{ kind: 'weapon', id: 3, denominator: 1 }] }),
    enemy(15, 'Dark Wizard', 'wizard', [1800, 400, 44, 40, 80, 70, 40, 24], 500, 400, [
      [5, 4],
      [6, 4],
      [7, 4],
      [23, 3],
    ], { traits: [weak(EL.light)] }),
    enemy(16, 'Red Dragon', 'dragon', [7000, 500, 110, 70, 100, 70, 50, 30], 2000, 2000, [
      [1, 5],
      [21, 5],
      [27, 4],
    ], { traits: [weak(EL.ice), weak(EL.fire, 0)] }),
    enemy(17, 'Demon Lord', 'demonLord', [14000, 1500, 130, 85, 130, 85, 60, 40], 8000, 6000, [
      [1, 4],
      [22, 5],
      [21, 4],
      [23, 4],
    ], { traits: [weak(EL.light, 150), weak(EL.dark, 0)] }),
  ];
}

function troop(id: number, name: string, members: [number, number, number][]): Troop {
  return { id, name, members: members.map(([enemyId, x, y]) => ({ enemyId, x, y, hidden: false })) };
}

export function defaultTroops(): Troop[] {
  return [
    troop(1, 'Slime x2', [
      [1, 240, 300],
      [1, 400, 300],
    ]),
    troop(2, 'Slime x3', [
      [1, 170, 300],
      [1, 320, 290],
      [1, 470, 300],
    ]),
    troop(3, 'Bat x2', [
      [2, 240, 250],
      [2, 400, 250],
    ]),
    troop(4, 'Goblin & Slime', [
      [3, 260, 300],
      [1, 420, 300],
    ]),
    troop(5, 'Wolf x2', [
      [4, 220, 300],
      [4, 430, 300],
    ]),
    troop(6, 'Snake & Bat', [
      [5, 260, 300],
      [2, 420, 250],
    ]),
    troop(7, 'Goblin x2', [
      [3, 240, 300],
      [3, 400, 300],
    ]),
    troop(8, 'Skeleton x2', [
      [7, 240, 300],
      [7, 400, 300],
    ]),
    troop(9, 'Ghost & Skeleton', [
      [8, 240, 280],
      [7, 410, 300],
    ]),
    troop(10, 'Cave Spider x2', [
      [9, 230, 300],
      [9, 410, 300],
    ]),
    troop(11, 'Fungoid x2', [
      [6, 240, 300],
      [6, 400, 300],
    ]),
    troop(12, 'Dark Knight', [[14, 320, 310]]),
    troop(13, 'Orc', [[10, 320, 310]]),
    troop(14, 'Golem', [[13, 320, 310]]),
    troop(15, 'Red Dragon', [[16, 320, 320]]),
    troop(16, 'Demon Lord', [[17, 320, 330]]),
  ];
}

export function defaultCommonEvents(): CommonEvent[] {
  return [
    {
      id: 1,
      name: 'Rest & Recover',
      trigger: 'none',
      switchId: 1,
      commands: [
        { type: 'fadeOut' },
        { type: 'playMe', audio: audio('builtin:inn', 80) },
        { type: 'recoverAll', actorId: 0 },
        { type: 'wait', frames: 150 },
        { type: 'fadeIn' },
      ],
    },
  ];
}

/** Fill a project with the default database (replacing database lists). */
export function applyDefaultDatabase(p: Project): void {
  p.actors = defaultActors();
  p.classes = defaultClasses();
  p.skills = defaultSkills();
  p.items = defaultItems();
  p.weapons = defaultWeapons();
  p.armors = defaultArmors();
  p.enemies = defaultEnemies();
  p.troops = defaultTroops();
  p.states = defaultStates();
  p.commonEvents = defaultCommonEvents();
}
