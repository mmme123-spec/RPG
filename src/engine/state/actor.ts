/** Runtime actor (party member). */

import type { Actor, ActorClass, Armor, CharacterRef, FaceRef, Skill, Weapon } from '../../core/types';
import type { GameData } from '../data';
import { Battler, type TraitSource } from './battler';

export const EQUIP_SLOTS = 5;

export interface SerializedActor {
  actorId: number;
  name: string;
  nickname: string;
  classId: number;
  level: number;
  exp: number;
  hp: number;
  mp: number;
  skills: number[];
  equips: number[];
  paramPlus: number[];
  states: number[];
  stateTurns: [number, number][];
  stateSteps: [number, number][];
  character: CharacterRef;
  face: FaceRef | null;
}

export interface LevelChange {
  oldLevel: number;
  newLevel: number;
  learned: number[];
}

/** Parameter value of a class curve at a level. */
export function curveValue(base: number, max: number, growth: number, level: number): number {
  const t = Math.max(0, Math.min(1, (level - 1) / 98));
  return Math.round(base + (max - base) * Math.pow(t, Math.max(0.05, growth)));
}

/** Total experience needed to reach a level. */
export function expForLevel(cls: ActorClass | undefined, level: number): number {
  if (!cls || level <= 1) return 0;
  const n = level - 1;
  const { basis, extra, accel } = cls.exp;
  return Math.round(basis * Math.pow(n, accel) + extra * n);
}

export class GameActor extends Battler {
  readonly actorId: number;
  private _name: string;
  nickname: string;
  classId: number;
  level = 1;
  exp = 0;
  skills: number[] = [];
  equips: number[] = [0, 0, 0, 0, 0];
  paramPlusArr: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  character: CharacterRef;
  face: FaceRef | null;

  constructor(data: GameData, actorId: number) {
    super(data);
    this.actorId = actorId;
    const a = this.actorData();
    this._name = a?.name ?? `Actor ${actorId}`;
    this.nickname = a?.nickname ?? '';
    this.classId = a?.classId ?? 1;
    this.character = a ? { ...a.character } : { sheet: 'builtin:villager', index: 0 };
    this.face = a?.face ? { ...a.face } : null;
    this.setup();
  }

  actorData(): Actor | undefined {
    return this.data.actors.get(this.actorId);
  }

  classData(): ActorClass | undefined {
    return this.data.classes.get(this.classId);
  }

  /** Reset to the database definition (used by "initialize" when joining). */
  setup(): void {
    const a = this.actorData();
    this.level = Math.max(1, a?.initialLevel ?? 1);
    this.exp = expForLevel(this.classData(), this.level);
    this.skills = [];
    for (const l of this.classData()?.learnings ?? []) if (l.level <= this.level) this.learnSkill(l.skillId);
    this.equips = [0, 0, 0, 0, 0];
    (a?.equips ?? []).forEach((id, slot) => {
      if (slot < EQUIP_SLOTS && id && this.canEquipId(slot, id)) this.equips[slot] = id;
    });
    this.paramPlusArr = [0, 0, 0, 0, 0, 0, 0, 0];
    this.recoverAll();
  }

  get name(): string {
    return this._name;
  }

  set name(v: string) {
    this._name = v;
  }

  isActor(): boolean {
    return true;
  }

  maxLevel(): number {
    return this.actorData()?.maxLevel ?? 99;
  }

  paramBase(i: number): number {
    const c = this.classData()?.params[i];
    if (!c) return i === 0 ? 100 : 10;
    return curveValue(c.base, c.max, c.growth, this.level);
  }

  /** Parameter value of the class curve at an arbitrary level (for status previews). */
  paramBaseAt(i: number, level: number): number {
    const c = this.classData()?.params[i];
    if (!c) return 0;
    return curveValue(c.base, c.max, c.growth, level);
  }

  paramPlus(i: number): number {
    let v = this.paramPlusArr[i];
    for (const e of this.equipObjects()) v += e.params[i] ?? 0;
    return v;
  }

  protected baseTraitSources(): TraitSource[] {
    const out: TraitSource[] = [];
    const a = this.actorData();
    if (a) out.push(a);
    const c = this.classData();
    if (c) out.push(c);
    out.push(...this.equipObjects());
    return out;
  }

  // --- equipment ------------------------------------------------------------------

  weapon(): Weapon | undefined {
    return this.equips[0] ? this.data.weapons.get(this.equips[0]) : undefined;
  }

  armorAt(slot: number): Armor | undefined {
    return slot > 0 && this.equips[slot] ? this.data.armors.get(this.equips[slot]) : undefined;
  }

  equipObjects(): (Weapon | Armor)[] {
    const out: (Weapon | Armor)[] = [];
    const w = this.weapon();
    if (w) out.push(w);
    for (let s = 1; s < EQUIP_SLOTS; s++) {
      const a = this.armorAt(s);
      if (a) out.push(a);
    }
    return out;
  }

  canEquipWeapon(w: Weapon): boolean {
    const types = this.classData()?.weaponTypes ?? [];
    return types.length === 0 || types.includes(w.wtypeId);
  }

  canEquipArmor(a: Armor, slot: number): boolean {
    if (a.slot !== slot) return false;
    const types = this.classData()?.armorTypes ?? [];
    return types.length === 0 || types.includes(a.atypeId);
  }

  canEquipId(slot: number, id: number): boolean {
    if (slot === 0) {
      const w = this.data.weapons.get(id);
      return !!w && this.canEquipWeapon(w);
    }
    const a = this.data.armors.get(id);
    return !!a && this.canEquipArmor(a, slot);
  }

  /** Attack animation key from the weapon. */
  attackAnimation(): string {
    return this.weapon()?.animation || 'hit';
  }

  // --- experience & skills ----------------------------------------------------------

  currentLevelExp(): number {
    return expForLevel(this.classData(), this.level);
  }

  nextLevelExp(): number {
    return expForLevel(this.classData(), this.level + 1);
  }

  isMaxLevel(): boolean {
    return this.level >= this.maxLevel();
  }

  /** Exp still needed for the next level. */
  expToNext(): number {
    return this.isMaxLevel() ? 0 : Math.max(0, this.nextLevelExp() - this.exp);
  }

  changeExp(exp: number): LevelChange {
    const oldLevel = this.level;
    const learned: number[] = [];
    this.exp = Math.max(0, Math.round(exp));
    while (!this.isMaxLevel() && this.exp >= this.nextLevelExp()) {
      this.level++;
      for (const l of this.classData()?.learnings ?? []) {
        if (l.level === this.level && !this.skills.includes(l.skillId)) {
          this.learnSkill(l.skillId);
          learned.push(l.skillId);
        }
      }
    }
    while (this.exp < this.currentLevelExp() && this.level > 1) this.level--;
    this.refresh();
    return { oldLevel, newLevel: this.level, learned };
  }

  gainExp(amount: number): LevelChange {
    return this.changeExp(this.exp + amount);
  }

  changeLevel(level: number): LevelChange {
    const l = Math.max(1, Math.min(this.maxLevel(), Math.round(level)));
    return this.changeExp(expForLevel(this.classData(), l));
  }

  learnSkill(id: number): void {
    if (!this.skills.includes(id)) {
      this.skills.push(id);
      this.skills.sort((a, b) => a - b);
    }
  }

  forgetSkill(id: number): void {
    this.skills = this.skills.filter((s) => s !== id);
  }

  /** Learned skills plus skills granted by traits (e.g. from equipment). */
  allSkills(): Skill[] {
    const ids = [...this.skills];
    for (const t of this.traits()) if (t.kind === 'addSkill' && !ids.includes(t.skillId)) ids.push(t.skillId);
    return ids.map((id) => this.data.skills.get(id)).filter((s): s is Skill => !!s);
  }

  hasSkill(id: number): boolean {
    return this.allSkills().some((s) => s.id === id);
  }

  /** Skill types shown as battle commands. */
  skillTypes(): number[] {
    return this.classData()?.skillTypes ?? [];
  }

  isSkillTypeSealed(stypeId: number): boolean {
    return this.sealedSkillTypes().includes(stypeId);
  }

  canPaySkillCost(skill: Skill): boolean {
    return this.mp >= skill.mpCost;
  }

  // --- persistence -----------------------------------------------------------------

  serialize(): SerializedActor {
    return {
      actorId: this.actorId,
      name: this._name,
      nickname: this.nickname,
      classId: this.classId,
      level: this.level,
      exp: this.exp,
      hp: this._hp,
      mp: this._mp,
      skills: [...this.skills],
      equips: [...this.equips],
      paramPlus: [...this.paramPlusArr],
      states: [...this.states],
      stateTurns: [...this.stateTurns],
      stateSteps: [...this.stateSteps],
      character: { ...this.character },
      face: this.face ? { ...this.face } : null,
    };
  }

  static deserialize(data: GameData, s: SerializedActor): GameActor {
    const a = new GameActor(data, s.actorId);
    a._name = s.name;
    a.nickname = s.nickname;
    a.classId = s.classId;
    a.level = s.level;
    a.exp = s.exp;
    a.skills = [...s.skills];
    a.equips = [...s.equips];
    while (a.equips.length < EQUIP_SLOTS) a.equips.push(0);
    a.paramPlusArr = [...s.paramPlus];
    a.states = [...s.states];
    a.stateTurns = new Map(s.stateTurns);
    a.stateSteps = new Map(s.stateSteps);
    a.character = { ...s.character };
    a.face = s.face ? { ...s.face } : null;
    a._hp = s.hp;
    a._mp = s.mp;
    a.refresh();
    return a;
  }
}
