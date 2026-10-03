/**
 * Real-time, top-down shooter combat played directly on the map (action
 * combat mode). Battles requested by encounters or the Battle Processing
 * command spawn the troop's enemies around the player; the player aims with
 * the mouse (or right stick / auto-aim on keyboard), fires their weapon,
 * casts their first attack skill and dodge-rolls through bullets.
 *
 * Coordinates are in tiles; an entity's (x, y) is its centre.
 */

import type { AudioRef, Enemy, Skill, Weapon } from '../../core/types';
import { TILE_SIZE } from '../../core/tiles';
import type { Drawable } from '../../render/images';
import { evalFormula } from '../battle/logic';
import type { BattleResult } from '../host';
import type { Game } from '../game';
import type { Input } from '../input';
import type { GameActor } from '../state/actor';
import { GameEnemy } from '../state/enemy';
import { drawText } from '../ui/text';

const T = TILE_SIZE;
const TAU = Math.PI * 2;

type WeaponKind = 'melee' | 'spear' | 'knife' | 'bow' | 'staff' | 'fist';

interface WeaponProfile {
  kind: WeaponKind;
  cooldown: number;
  /** Multiplier on the attack formula per hit. */
  power: number;
  speed: number;
  spread: number;
  color: string;
  sound: string;
}

const WEAPONS: Record<WeaponKind, WeaponProfile> = {
  melee: { kind: 'melee', cooldown: 22, power: 1.1, speed: 0, spread: 0, color: '#e8eef8', sound: 'slash' },
  spear: { kind: 'spear', cooldown: 20, power: 1.0, speed: 0, spread: 0, color: '#e8eef8', sound: 'slash' },
  fist: { kind: 'fist', cooldown: 16, power: 0.6, speed: 0, spread: 0, color: '#ffffff', sound: 'hit' },
  knife: { kind: 'knife', cooldown: 8, power: 0.34, speed: 0.36, spread: 0.08, color: '#dfe6f0', sound: 'miss' },
  bow: { kind: 'bow', cooldown: 19, power: 0.8, speed: 0.42, spread: 0.02, color: '#ffe08a', sound: 'miss' },
  staff: { kind: 'staff', cooldown: 13, power: 0.5, speed: 0.24, spread: 0.06, color: '#9fd8ff', sound: 'magic' },
};

/** Weapon type ids of the default database: 1 sword, 2 axe, 3 dagger, 4 spear, 5 bow, 6 staff, 7 mace. */
function weaponProfile(w: Weapon | undefined): WeaponProfile {
  if (!w) return WEAPONS.fist;
  const name = w.name.toLowerCase();
  if (w.wtypeId === 3 || /dagger|knife/.test(name)) return WEAPONS.knife;
  if (w.wtypeId === 4 || /spear|lance/.test(name)) return WEAPONS.spear;
  if (w.wtypeId === 5 || /bow|gun|sling/.test(name)) return WEAPONS.bow;
  if (w.wtypeId === 6 || /staff|wand|rod/.test(name)) return WEAPONS.staff;
  return WEAPONS.melee;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  damage: number;
  enemy: boolean;
  life: number;
  color: string;
  pierce: number;
  hit: Set<ActEnemy>;
  elementId: number;
  /** A skill's state effects travel with the bullet. */
  big?: boolean;
}

interface ActEnemy {
  battler: GameEnemy;
  data: Enemy;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'melee' | 'ranged' | 'boss';
  speed: number;
  cooldown: number;
  /** Melee: windup then lunge. */
  phase: 'move' | 'windup' | 'lunge';
  phaseT: number;
  lungeX: number;
  lungeY: number;
  flash: number;
  spawn: number;
  facing: number;
  strafe: number;
  contactCd: number;
  pattern: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  big: boolean;
}

interface Corpse {
  img: Drawable | null;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  life: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: 'hp' | 'mp';
  life: number;
}

interface Slash {
  x: number;
  y: number;
  angle: number;
  reach: number;
  arc: number;
  life: number;
}

const se = (name: string, volume = 70, pitch = 100): AudioRef => ({ name: `builtin:${name}`, volume, pitch });

export class ActionCombat {
  active = false;
  enemies: ActEnemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  corpses: Corpse[] = [];
  pickups: Pickup[] = [];
  slashes: Slash[] = [];
  shake = 0;
  hitstop = 0;
  aim = Math.PI / 2;
  private fireCd = 0;
  private skillCd = 0;
  private invuln = 0;
  private hurtFlash = 0;
  private onEnd: ((r: BattleResult) => void) | null = null;
  private canEscape = true;
  private canLose = false;
  private savedAudio: { bgm: AudioRef | null; bgs: AudioRef | null } | null = null;
  private endTimer = 0;
  private banner: { text: string; sub: string; life: number } | null = null;
  private bossName = '';
  private recoil = 0;
  private game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  private rng(): number {
    return this.game.rng();
  }

  private get input(): Input {
    return this.game.input;
  }

  private player() {
    return this.game.map.player;
  }

  /** Centre of the player's body in tiles. */
  private pc(): { x: number; y: number } {
    const p = this.player();
    return { x: p.realX + 0.5, y: p.realY + 0.45 };
  }

  private fighter(): GameActor | null {
    return this.game.state.aliveMembers()[0] ?? null;
  }

  // --- start / end ------------------------------------------------------------------

  start(troopId: number, canEscape: boolean, canLose: boolean, onEnd: (r: BattleResult) => void): void {
    const g = this.game;
    const troop = g.data.troops.get(troopId);
    if (!troop) return onEnd('win');
    this.clearField();
    this.active = true;
    this.onEnd = onEnd;
    this.canEscape = canEscape;
    this.canLose = canLose;
    this.endTimer = 0;
    this.savedAudio = { bgm: g.audio.currentBgm(), bgs: g.audio.currentBgs() };
    const members = troop.members.filter((m) => g.data.enemies.has(m.enemyId));
    const boss = members.length === 1 && (g.data.enemies.get(members[0].enemyId)!.params[0] >= 1000 || members[0].enemyId >= 14);
    g.audio.playBgm(boss ? { name: 'builtin:boss', volume: 75, pitch: 100 } : g.data.system.battleBgm);
    g.sound('battleStart');
    g.screen.startFlash([255, 255, 255, 140], 10);
    this.shake = 6;
    const pc = this.pc();
    const letters = new Map<number, number>();
    members.forEach((m, i) => {
      const data = g.data.enemies.get(m.enemyId)!;
      const battler = new GameEnemy(g.data, m.enemyId, i, m.x, m.y);
      const count = members.filter((o) => o.enemyId === m.enemyId).length;
      if (count > 1) {
        const n = (letters.get(m.enemyId) ?? 0) + 1;
        letters.set(m.enemyId, n);
        battler.letter = String.fromCharCode(64 + n);
      }
      const spot = this.findSpawn(pc.x, pc.y, boss ? 4 : 4.5 + this.rng() * 3, (i / Math.max(1, members.length)) * TAU + this.rng());
      const ranged = data.actions.some((a) => {
        const s = g.data.skills.get(a.skillId);
        return !!s && s.hitType === 'magical' && s.damage.type === 'hpDamage';
      });
      const kind = boss ? 'boss' : ranged ? 'ranged' : 'melee';
      this.enemies.push({
        battler,
        data,
        x: spot.x,
        y: spot.y,
        vx: 0,
        vy: 0,
        r: boss ? 0.75 : 0.36,
        kind,
        speed: Math.max(0.022, Math.min(0.07, 0.02 + data.params[6] / 900)) * (kind === 'ranged' ? 0.8 : 1),
        cooldown: 60 + Math.floor(this.rng() * 60),
        phase: 'move',
        phaseT: 0,
        lungeX: 0,
        lungeY: 0,
        flash: 0,
        spawn: 36 + i * 6,
        facing: 1,
        strafe: this.rng() < 0.5 ? 1 : -1,
        contactCd: 0,
        pattern: 0,
      });
    });
    this.bossName = boss ? members.map((m) => g.data.enemies.get(m.enemyId)!.name)[0] : '';
    if (this.enemies.length === 0) this.finish('win');
  }

  /** A free tile near (x, y) at about `dist` tiles, trying angles around `angle`. */
  private findSpawn(x: number, y: number, dist: number, angle: number): { x: number; y: number } {
    const m = this.game.map;
    for (let tries = 0; tries < 40; tries++) {
      const a = angle + tries * 0.7;
      const d = Math.max(2, dist - Math.floor(tries / 8));
      const tx = Math.floor(x + Math.cos(a) * d);
      const ty = Math.floor(y + Math.sin(a) * d);
      if (m.isValid(tx, ty) && !m.isSolid(tx, ty) && !m.hasBlockingEvent(tx, ty)) return { x: tx + 0.5, y: ty + 0.5 };
    }
    return { x, y };
  }

  private clearField(): void {
    this.enemies = [];
    this.bullets = this.bullets.filter((b) => !b.enemy);
    this.pickups = [];
    this.banner = null;
  }

  private finish(result: BattleResult): void {
    const g = this.game;
    this.active = false;
    this.bullets = this.bullets.filter((b) => !b.enemy);
    this.player().aimDirection = 0;
    if (this.savedAudio) {
      g.audio.playBgm(this.savedAudio.bgm);
      g.audio.playBgs(this.savedAudio.bgs);
    }
    const cb = this.onEnd;
    this.onEnd = null;
    cb?.(result);
  }

  /** Leaving the map ends the fight (counts as escaping). */
  abort(): void {
    if (!this.active) return;
    this.enemies = [];
    this.finish(this.canEscape ? 'escape' : 'win');
  }

  private victory(): void {
    const g = this.game;
    const st = g.state;
    let exp = 0;
    let gold = 0;
    const drops: string[] = [];
    for (const e of this.deadEnemies) {
      exp += e.exp();
      gold += e.gold();
      for (const d of e.makeDrops(() => this.rng(), st.hasPartyAbility('dropDouble'))) {
        st.gainItem(d.kind, d.id, 1);
        const list = d.kind === 'item' ? g.data.items : d.kind === 'weapon' ? g.data.weapons : g.data.armors;
        const name = list.get(d.id)?.name;
        if (name) drops.push(name);
      }
    }
    this.deadEnemies = [];
    if (st.hasPartyAbility('goldDouble')) gold *= 2;
    st.gainGold(gold);
    const pc = this.pc();
    for (const a of st.aliveMembers()) {
      const ch = a.gainExp(exp);
      if (ch.newLevel > ch.oldLevel) {
        this.popups.push({ x: pc.x, y: pc.y - 1.2, text: `${a.name} LEVEL ${ch.newLevel}!`, color: '#ffe066', life: 110, big: true });
        g.audio.playSe(se('powerUp', 80));
        for (const s of ch.learned) {
          const sk = g.data.skills.get(s);
          if (sk) this.popups.push({ x: pc.x, y: pc.y - 0.6, text: `Learned ${sk.name}`, color: '#a0e0ff', life: 110, big: false });
        }
      }
    }
    this.banner = { text: 'VICTORY', sub: `+${exp} EXP   +${gold} ${g.data.system.currency}${drops.length ? `   ${drops.join(', ')}` : ''}`, life: 170 };
    g.audio.playSe(se('coin', 70));
    this.finish('win');
  }

  private deadEnemies: GameEnemy[] = [];

  // --- update -----------------------------------------------------------------------

  /** Called every frame by the map scene while the player can act. */
  update(playerFree: boolean): void {
    if (this.shake > 0) this.shake *= 0.86;
    if (this.shake < 0.3) this.shake = 0;
    if (this.recoil > 0) this.recoil *= 0.7;
    this.updateFx();
    if (!this.game.map.player.freeMode()) return;
    if (playerFree) this.updateAim();
    else this.player().aimDirection = 0;
    if (this.fireCd > 0) this.fireCd--;
    if (this.skillCd > 0) this.skillCd--;
    if (this.invuln > 0) this.invuln--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (playerFree) {
      if (this.input.isFiring() && this.fireCd === 0) this.fire();
      if (this.input.isSkillTriggered()) this.castSkill();
    }
    this.updateBullets();
    if (!this.active) return;
    if (playerFree) {
      this.updateFlow();
      for (const e of this.enemies) this.updateEnemy(e);
    }
    this.updatePickups();
    this.enemies = this.enemies.filter((e) => {
      if (e.battler.hp > 0) return true;
      this.kill(e);
      return false;
    });
    if (this.enemies.length === 0) {
      if (++this.endTimer > 30) this.victory();
      return;
    }
    if (this.canEscape && playerFree) {
      const pc = this.pc();
      const far = this.enemies.every((e) => Math.hypot(e.x - pc.x, e.y - pc.y) > 13);
      if (far) {
        this.popups.push({ x: pc.x, y: pc.y - 1, text: 'Escaped!', color: '#ffffff', life: 80, big: true });
        this.enemies = [];
        this.finish('escape');
      }
    }
  }

  private updateAim(): void {
    const p = this.player();
    const pc = this.pc();
    const inp = this.input;
    if (inp.padAim) {
      this.aim = Math.atan2(inp.padAim.y, inp.padAim.x);
    } else if (inp.mouseSeen) {
      const cam = this.camera();
      const mx = (inp.pointer.x + cam.x) / T;
      const my = (inp.pointer.y + cam.y) / T;
      this.aim = Math.atan2(my - pc.y, mx - pc.x);
    } else {
      // keyboard only: auto-aim at the nearest visible enemy, else face forward
      const target = this.nearestEnemy(pc.x, pc.y, 10);
      if (target) this.aim = Math.atan2(target.y - pc.y, target.x - pc.x);
      else this.aim = Math.atan2(p.direction === 2 ? 1 : p.direction === 8 ? -1 : 0, p.direction === 6 ? 1 : p.direction === 4 ? -1 : 0);
    }
    const aiming = this.active || inp.isFiring() || (inp.mouseSeen && !inp.padAim);
    if (aiming) {
      const c = Math.cos(this.aim);
      const s = Math.sin(this.aim);
      p.aimDirection = Math.abs(c) > Math.abs(s) ? (c > 0 ? 6 : 4) : s > 0 ? 2 : 8;
    } else p.aimDirection = 0;
  }

  private nearestEnemy(x: number, y: number, max: number): ActEnemy | null {
    let best: ActEnemy | null = null;
    let bd = max;
    for (const e of this.enemies) {
      if (e.spawn > 0) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd && this.lineOfSight(x, y, e.x, e.y)) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  camera(): { x: number; y: number } {
    const m = this.game.map;
    return { x: Math.round(m.displayX * T), y: Math.round(m.displayY * T) };
  }

  private solidAt(x: number, y: number): boolean {
    return this.game.map.isSolid(Math.floor(x), Math.floor(y));
  }

  private lineOfSight(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  // --- pathfinding: a distance field from the player's tile --------------------------

  private flow: Int16Array | null = null;
  private flowW = 0;
  private flowAt = -999;
  private flowFrom = -1;

  private updateFlow(): void {
    const m = this.game.map;
    const p = this.player();
    const W = m.map.width;
    const H = m.map.height;
    const start = p.y * W + p.x;
    const frame = this.game.frameCount();
    if (this.flow && this.flowFrom === start && frame - this.flowAt < 30) return;
    this.flowAt = frame;
    this.flowFrom = start;
    this.flowW = W;
    const f = new Int16Array(W * H).fill(-1);
    if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return void (this.flow = f);
    const queue = [start];
    f[start] = 0;
    for (let qi = 0; qi < queue.length; qi++) {
      const i = queue[qi];
      const d = f[i];
      if (d >= 40) continue;
      const x = i % W;
      const y = (i - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (f[ni] !== -1 || m.isSolid(nx, ny)) continue;
        f[ni] = d + 1;
        queue.push(ni);
      }
    }
    this.flow = f;
  }

  /** Unit vector toward the player along walkable tiles (null if unreachable). */
  private pathDir(e: { x: number; y: number }): { x: number; y: number } | null {
    const f = this.flow;
    if (!f) return null;
    const W = this.flowW;
    const tx = Math.floor(e.x);
    const ty = Math.floor(e.y);
    const here = f[ty * W + tx];
    let best: [number, number] | null = null;
    let bd = here < 0 ? 9999 : here;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny * W + nx >= f.length) continue;
      const v = f[ny * W + nx];
      if (v >= 0 && v < bd) {
        bd = v;
        best = [nx, ny];
      }
    }
    if (!best) return null;
    const vx = best[0] + 0.5 - e.x;
    const vy = best[1] + 0.5 - e.y;
    const l = Math.hypot(vx, vy) || 1;
    return { x: vx / l, y: vy / l };
  }

  private circleFree(x: number, y: number, r: number): boolean {
    const k = r * 0.75;
    return !this.solidAt(x - k, y - k) && !this.solidAt(x + k, y - k) && !this.solidAt(x - k, y + k) && !this.solidAt(x + k, y + k);
  }

  // --- player attacks ----------------------------------------------------------------

  private attackSkill(): Skill | undefined {
    return this.game.data.skills.get(this.game.data.system.attackSkillId);
  }

  private formulaDamage(skill: Skill | undefined, a: GameActor | GameEnemy, b: GameActor | GameEnemy, elementId = 0): number {
    const f = skill?.damage.formula || 'a.atk * 4 - b.def * 2';
    let v = Math.max(1, evalFormula(f, a, b, this.game.state.variables));
    if (elementId > 0) v *= b.elementRate(elementId);
    return v * (0.9 + this.rng() * 0.2);
  }

  private fire(): void {
    const actor = this.fighter();
    if (!actor) return;
    const w = weaponProfile(actor.weapon());
    this.fireCd = w.cooldown;
    const pc = this.pc();
    const g = this.game;
    g.audio.playSe(se(w.sound, 55, 90 + Math.floor(this.rng() * 30)));
    this.recoil = 4;
    if (w.kind === 'melee' || w.kind === 'spear' || w.kind === 'fist') {
      const reach = w.kind === 'spear' ? 2.0 : w.kind === 'fist' ? 1.0 : 1.5;
      const arc = w.kind === 'spear' ? 0.5 : w.kind === 'fist' ? 0.9 : 1.9;
      this.slashes.push({ x: pc.x, y: pc.y, angle: this.aim, reach, arc, life: 10 });
      this.shake = Math.max(this.shake, 2);
      // hit enemies in the arc
      for (const e of this.enemies) {
        if (e.spawn > 0) continue;
        const dx = e.x - pc.x;
        const dy = e.y - pc.y;
        const d = Math.hypot(dx, dy) - e.r;
        if (d > reach) continue;
        const da = Math.abs(((Math.atan2(dy, dx) - this.aim + Math.PI * 3) % TAU) - Math.PI);
        if (da > arc / 2 + 0.2) continue;
        this.damageEnemy(e, this.formulaDamage(this.attackSkill(), actor, e.battler, actor.attackElements()[0] ?? 0) * w.power, this.aim, 0.25);
      }
      // deflect enemy bullets (Nuclear Throne style)
      if (w.kind !== 'fist') {
        for (const b of this.bullets) {
          if (!b.enemy) continue;
          const dx = b.x - pc.x;
          const dy = b.y - pc.y;
          if (Math.hypot(dx, dy) > reach + 0.2) continue;
          const da = Math.abs(((Math.atan2(dy, dx) - this.aim + Math.PI * 3) % TAU) - Math.PI);
          if (da > arc / 2 + 0.3) continue;
          const sp = Math.hypot(b.vx, b.vy) * 1.3;
          b.enemy = false;
          b.vx = Math.cos(this.aim) * sp;
          b.vy = Math.sin(this.aim) * sp;
          b.color = '#ffe066';
          b.damage = this.formulaDamage(this.attackSkill(), actor, actor, 0) * 0.6;
          b.life = 90;
          this.burst(b.x, b.y, '#ffffff', 6, 0.08);
        }
      }
      return;
    }
    const count = 1;
    for (let i = 0; i < count; i++) {
      const a = this.aim + (this.rng() - 0.5) * w.spread * 2;
      const dmg = this.formulaDamage(this.attackSkill(), actor, actor, 0) * w.power;
      this.bullets.push({
        x: pc.x + Math.cos(a) * 0.5,
        y: pc.y + Math.sin(a) * 0.5,
        vx: Math.cos(a) * w.speed,
        vy: Math.sin(a) * w.speed,
        r: w.kind === 'staff' ? 0.16 : 0.1,
        damage: dmg,
        enemy: false,
        life: 70,
        color: w.color,
        pierce: w.kind === 'bow' ? 1 : 0,
        hit: new Set(),
        elementId: actor.attackElements()[0] ?? 0,
      });
    }
    this.burst(pc.x + Math.cos(this.aim) * 0.6, pc.y + Math.sin(this.aim) * 0.6, w.color, 3, 0.06);
    this.shake = Math.max(this.shake, 1.2);
  }

  private castSkill(): void {
    const actor = this.fighter();
    if (!actor || this.skillCd > 0) return;
    const usable = actor.allSkills().filter((s) => s.stypeId > 0 && (s.occasion === 'always' || s.occasion === 'battle') && actor.canPaySkillCost(s));
    const heal = usable.find((s) => s.damage.type === 'hpRecover');
    const attack = usable.find((s) => s.damage.type === 'hpDamage' && s.scope !== 'user');
    const skill = heal && (actor.hpRate() < 0.45 || !attack) ? heal : attack;
    const pc = this.pc();
    if (!skill) {
      this.game.sound('buzzer');
      this.popups.push({ x: pc.x, y: pc.y - 1, text: actor.mp > 0 ? 'No skill' : 'No MP', color: '#9ab', life: 40, big: false });
      return;
    }
    actor.gainMp(-skill.mpCost);
    this.skillCd = 30;
    this.game.audio.playSe(se(skill.damage.elementId === 2 ? 'fire' : skill.damage.elementId === 3 ? 'ice' : skill.damage.elementId === 4 ? 'thunder' : 'magic', 80));
    this.popups.push({ x: pc.x, y: pc.y - 1.1, text: skill.name, color: '#c9e8ff', life: 50, big: false });
    if (skill.damage.type === 'hpRecover') {
      const v = Math.round(this.formulaDamage(skill, actor, actor));
      for (const a of this.game.state.aliveMembers()) a.gainHp(v);
      this.popups.push({ x: pc.x, y: pc.y - 0.5, text: `+${v}`, color: '#7dff9a', life: 60, big: true });
      this.burst(pc.x, pc.y, '#7dff9a', 20, 0.08);
      return;
    }
    const color = skill.damage.elementId === 2 ? '#ff8a3d' : skill.damage.elementId === 3 ? '#8fe3ff' : skill.damage.elementId === 4 ? '#fff36b' : '#d59bff';
    const all = skill.scope === 'allEnemies';
    const n = all ? 14 : 3;
    for (let i = 0; i < n; i++) {
      const a = all ? (i / n) * TAU : this.aim + (i - 1) * 0.18;
      this.bullets.push({
        x: pc.x,
        y: pc.y,
        vx: Math.cos(a) * 0.26,
        vy: Math.sin(a) * 0.26,
        r: 0.24,
        damage: this.formulaDamage(skill, actor, actor, 0) * (all ? 0.8 : 0.9),
        enemy: false,
        life: all ? 45 : 80,
        color,
        pierce: 2,
        hit: new Set(),
        elementId: skill.damage.elementId > 0 ? skill.damage.elementId : 0,
        big: true,
      });
    }
    this.shake = Math.max(this.shake, 5);
    this.burst(pc.x, pc.y, color, 16, 0.1);
  }

  private damageEnemy(e: ActEnemy, raw: number, angle: number, knock: number, elementId = 0): void {
    let v = raw;
    if (elementId > 0) v *= e.battler.elementRate(elementId);
    const crit = this.rng() < 0.06;
    if (crit) v *= 2;
    v = Math.max(1, Math.round(v));
    e.battler.gainHp(-v);
    e.flash = 6;
    const k = e.kind === 'boss' ? knock * 0.25 : knock;
    e.vx += Math.cos(angle) * k;
    e.vy += Math.sin(angle) * k;
    if (e.phase === 'windup' && e.kind !== 'boss') e.phase = 'move';
    this.popups.push({ x: e.x + (this.rng() - 0.5) * 0.4, y: e.y - e.r - 0.3, text: String(v), color: crit ? '#ffdd44' : '#ffffff', life: 40, big: crit });
    this.burst(e.x, e.y, '#ff5a5a', crit ? 10 : 5, 0.09);
    this.game.audio.playSe(se('hit', 55, 90 + Math.floor(this.rng() * 30)));
    this.hitstop = Math.max(this.hitstop, crit ? 4 : 2);
    this.shake = Math.max(this.shake, crit ? 5 : 2.5);
  }

  private kill(e: ActEnemy): void {
    const g = this.game;
    this.deadEnemies.push(e.battler);
    g.audio.playSe(se('enemyDie', 75));
    this.burst(e.x, e.y, '#ff4040', 22, 0.14);
    this.burst(e.x, e.y, '#ffffff', 8, 0.1);
    this.shake = Math.max(this.shake, e.kind === 'boss' ? 14 : 6);
    this.hitstop = e.kind === 'boss' ? 20 : 5;
    const img = g.images.enemy(e.data.battler, e.data.hue);
    this.corpses.push({ img, x: e.x, y: e.y, scale: this.spriteScale(e, img), flip: e.facing < 0, life: 900 });
    if (this.corpses.length > 40) this.corpses.shift();
    const roll = this.rng();
    if (roll < 0.22) this.pickups.push({ x: e.x, y: e.y, kind: 'hp', life: 600 });
    else if (roll < 0.34) this.pickups.push({ x: e.x, y: e.y, kind: 'mp', life: 600 });
  }

  // --- enemies ----------------------------------------------------------------------

  private pickSkill(e: ActEnemy): Skill | undefined {
    const acts = e.data.actions.filter((a) => this.game.data.skills.has(a.skillId));
    if (!acts.length) return this.attackSkill();
    let total = acts.reduce((n, a) => n + a.rating, 0) * this.rng();
    for (const a of acts) {
      total -= a.rating;
      if (total <= 0) return this.game.data.skills.get(a.skillId);
    }
    return this.game.data.skills.get(acts[0].skillId);
  }

  private moveEnemy(e: ActEnemy, dx: number, dy: number): void {
    if (this.circleFree(e.x + dx, e.y, e.r)) e.x += dx;
    else e.vx *= -0.3;
    if (this.circleFree(e.x, e.y + dy, e.r)) e.y += dy;
    else e.vy *= -0.3;
  }

  private updateEnemy(e: ActEnemy): void {
    if (e.spawn > 0) {
      e.spawn--;
      return;
    }
    if (e.flash > 0) e.flash--;
    if (e.contactCd > 0) e.contactCd--;
    const pc = this.pc();
    const dx = pc.x - e.x;
    const dy = pc.y - e.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const ux = dx / dist;
    const uy = dy / dist;
    if (Math.abs(dx) > 0.1) e.facing = dx > 0 ? 1 : -1;
    const sees = dist < 14 && this.lineOfSight(e.x, e.y, pc.x, pc.y);
    const enraged = e.battler.hpRate() < 0.5;
    let mx = 0;
    let my = 0;
    e.cooldown--;

    if (e.kind === 'melee') {
      if (e.phase === 'move') {
        if (sees) {
          mx = ux * e.speed;
          my = uy * e.speed;
          // a little sideways wobble so groups spread out
          mx += -uy * Math.sin(e.phaseT++ / 20) * e.speed * 0.5;
          my += ux * Math.sin(e.phaseT / 20) * e.speed * 0.5;
          if (dist < 2.6 && e.cooldown <= 0) {
            e.phase = 'windup';
            e.phaseT = 22;
          }
        } else {
          const pd = dist < 20 ? this.pathDir(e) : null;
          if (pd) {
            mx = pd.x * e.speed;
            my = pd.y * e.speed;
          }
        }
      } else if (e.phase === 'windup') {
        if (--e.phaseT <= 0) {
          e.phase = 'lunge';
          e.phaseT = 14;
          e.lungeX = ux * Math.min(0.22, e.speed * 4);
          e.lungeY = uy * Math.min(0.22, e.speed * 4);
        }
      } else {
        mx = e.lungeX;
        my = e.lungeY;
        if (--e.phaseT <= 0) {
          e.phase = 'move';
          e.cooldown = 50 + Math.floor(this.rng() * 50);
        }
      }
    } else if (e.kind === 'ranged') {
      const want = 5;
      if (sees) {
        const toward = dist > want + 1 ? 1 : dist < want - 1.5 ? -1 : 0;
        mx = (ux * toward + -uy * e.strafe * 0.7) * e.speed;
        my = (uy * toward + ux * e.strafe * 0.7) * e.speed;
        if (this.rng() < 0.008) e.strafe *= -1;
        if (e.cooldown <= 0) {
          const skill = this.pickSkill(e);
          const spread = e.data.params[4] > 30 ? 3 : 1;
          this.enemyShoot(e, Math.atan2(dy, dx), spread, 0.2, skill, 0.16);
          e.cooldown = 80 + Math.floor(this.rng() * 50);
        }
      } else if (dist < 20) {
        const pd = this.pathDir(e);
        if (pd) {
          mx = pd.x * e.speed * 0.8;
          my = pd.y * e.speed * 0.8;
        }
      }
    } else {
      // boss: chase slowly and alternate attack patterns
      const pd = sees ? { x: ux, y: uy } : this.pathDir(e);
      mx = (pd?.x ?? 0) * e.speed * 0.6;
      my = (pd?.y ?? 0) * e.speed * 0.6;
      if (e.phase === 'lunge') {
        mx = e.lungeX;
        my = e.lungeY;
        if (--e.phaseT <= 0) e.phase = 'move';
      } else if (e.phase === 'windup') {
        mx = my = 0;
        if (--e.phaseT <= 0) {
          e.phase = 'lunge';
          e.phaseT = 22;
          e.lungeX = ux * 0.2;
          e.lungeY = uy * 0.2;
        }
      } else if (e.cooldown <= 0) {
        const skill = this.pickSkill(e);
        const p = e.pattern++ % 3;
        if (p === 0) this.enemyShoot(e, Math.atan2(dy, dx), enraged ? 7 : 5, 0.16, skill, 0.18, 0.22);
        else if (p === 1) {
          const n = enraged ? 20 : 14;
          const off = this.rng() * TAU;
          for (let i = 0; i < n; i++) this.enemyShoot(e, off + (i / n) * TAU, 1, 0.12, skill, 0.2);
          this.shake = Math.max(this.shake, 4);
        } else {
          e.phase = 'windup';
          e.phaseT = 30;
        }
        e.cooldown = enraged ? 55 : 80;
      }
    }

    // knockback velocity decays
    e.vx *= 0.82;
    e.vy *= 0.82;
    this.moveEnemy(e, mx + e.vx, my + e.vy);
    // separate from other enemies
    for (const o of this.enemies) {
      if (o === e || o.spawn > 0) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const od = Math.hypot(ox, oy);
      const min = e.r + o.r;
      if (od > 0 && od < min) this.moveEnemy(e, (ox / od) * (min - od) * 0.3, (oy / od) * (min - od) * 0.3);
    }
    // contact damage
    if (dist < e.r + 0.3 && e.contactCd === 0) {
      const skill = e.phase === 'lunge' ? this.pickSkill(e) : this.attackSkill();
      this.hurtPlayer(e, skill, e.phase === 'lunge' ? 0.7 : 0.4, Math.atan2(dy, dx));
      e.contactCd = 40;
    }
  }

  private enemyShoot(e: ActEnemy, angle: number, count: number, speed: number, skill: Skill | undefined, r: number, gap = 0.2): void {
    const target = this.fighter();
    if (!target) return;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * gap;
      this.bullets.push({
        x: e.x + Math.cos(a) * e.r,
        y: e.y + Math.sin(a) * e.r,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r,
        damage: this.formulaDamage(skill, e.battler, target, skill?.damage.elementId ?? 0) * 0.45,
        enemy: true,
        life: 160,
        color: '#ff3df0',
        pierce: 0,
        hit: new Set(),
        elementId: 0,
      });
    }
    this.game.audio.playSe(se('magic', 45, 70));
  }

  private hurtPlayer(e: ActEnemy | null, skill: Skill | undefined, factor: number, angle: number, preset?: number): void {
    const p = this.player();
    if (this.invuln > 0 || p.isRolling()) return;
    const actor = this.fighter();
    if (!actor) return;
    const raw = preset ?? (e ? this.formulaDamage(skill, e.battler, actor, skill?.damage.elementId ?? 0) * factor : 10);
    const v = Math.max(1, Math.round(raw));
    actor.gainHp(-v);
    this.invuln = 45;
    this.hurtFlash = 12;
    this.shake = Math.max(this.shake, 7);
    this.hitstop = Math.max(this.hitstop, 3);
    const pc = this.pc();
    this.popups.push({ x: pc.x, y: pc.y - 1, text: String(v), color: '#ff6060', life: 45, big: true });
    this.burst(pc.x, pc.y, '#ff3030', 10, 0.1);
    this.game.audio.playSe(se('damage', 80));
    // knock the player back a little
    p.vx += Math.cos(angle) * 0.12;
    p.vy += Math.sin(angle) * 0.12;
    if (actor.isDead()) this.onFighterDown(actor);
  }

  private onFighterDown(actor: GameActor): void {
    const g = this.game;
    const st = g.state;
    g.audio.playSe(se('collapse', 85));
    const alive = st.aliveMembers();
    const pc = this.pc();
    if (alive.length > 0) {
      // the next party member takes over
      st.party = [...st.party.filter((id) => st.actor(id)?.isAlive()), ...st.party.filter((id) => !st.actor(id)?.isAlive())];
      this.player().refreshGraphic();
      this.invuln = 90;
      this.popups.push({ x: pc.x, y: pc.y - 1.4, text: `${actor.name} fell! ${alive[0].name} steps in`, color: '#ffb0b0', life: 120, big: false });
      return;
    }
    if (this.canLose) {
      actor.revive();
      this.enemies = [];
      this.finish('lose');
    } else {
      this.active = false;
      this.enemies = [];
      this.onEnd = null;
      g.requestGameOver();
    }
  }

  // --- bullets, pickups, effects -------------------------------------------------------

  private updateBullets(): void {
    const pc = this.pc();
    for (const b of this.bullets) {
      const steps = Math.ceil(Math.hypot(b.vx, b.vy) / 0.15);
      for (let s = 0; s < steps && b.life > 0; s++) {
        b.x += b.vx / steps;
        b.y += b.vy / steps;
        if (this.solidAt(b.x, b.y)) {
          b.life = 0;
          this.burst(b.x - b.vx / steps, b.y - b.vy / steps, b.color, 4, 0.05);
          break;
        }
        if (b.enemy) {
          if (Math.hypot(b.x - pc.x, b.y - pc.y) < b.r + 0.24 && this.invuln === 0 && !this.player().isRolling()) {
            this.hurtPlayer(null, undefined, 1, Math.atan2(b.vy, b.vx), b.damage);
            b.life = 0;
          }
        } else {
          for (const e of this.enemies) {
            if (e.spawn > 0 || b.hit.has(e) || e.battler.hp <= 0) continue;
            if (Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.r) {
              b.hit.add(e);
              this.damageEnemy(e, b.damage, Math.atan2(b.vy, b.vx), b.big ? 0.2 : 0.12, b.elementId);
              if (b.pierce-- <= 0) {
                b.life = 0;
                break;
              }
            }
          }
        }
      }
      b.life--;
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private updatePickups(): void {
    const pc = this.pc();
    const actor = this.fighter();
    for (const k of this.pickups) {
      k.life--;
      const d = Math.hypot(k.x - pc.x, k.y - pc.y);
      if (d < 2.2) {
        k.x += (pc.x - k.x) * 0.15;
        k.y += (pc.y - k.y) * 0.15;
      }
      if (d < 0.5 && actor) {
        k.life = 0;
        if (k.kind === 'hp') {
          const v = Math.max(5, Math.round(actor.mhp * 0.15));
          actor.gainHp(v);
          this.popups.push({ x: pc.x, y: pc.y - 1, text: `+${v}`, color: '#7dff9a', life: 45, big: false });
        } else {
          const v = Math.max(3, Math.round(actor.mmp * 0.2));
          actor.gainMp(v);
          this.popups.push({ x: pc.x, y: pc.y - 1, text: `+${v} MP`, color: '#8fc8ff', life: 45, big: false });
        }
        this.game.audio.playSe(se('heal', 55, 130));
      }
    }
    this.pickups = this.pickups.filter((k) => k.life > 0);
  }

  private burst(x: number, y: number, color: string, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * TAU;
      const s = speed * (0.3 + this.rng());
      const life = 14 + Math.floor(this.rng() * 14);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 2 + Math.floor(this.rng() * 3) });
    }
    if (this.particles.length > 500) this.particles.splice(0, this.particles.length - 500);
  }

  private updateFx(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.9;
      p.vy *= 0.9;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.y -= 0.02;
      p.life--;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    for (const s of this.slashes) s.life--;
    this.slashes = this.slashes.filter((s) => s.life > 0);
    for (const c of this.corpses) c.life--;
    this.corpses = this.corpses.filter((c) => c.life > 0);
    if (this.banner && --this.banner.life <= 0) this.banner = null;
    // a dodge roll kicks up dust
    const p = this.game.map.player;
    if (p.isRolling() && this.game.frameCount() % 2 === 0) {
      const pc = this.pc();
      this.particles.push({ x: pc.x, y: pc.y + 0.4, vx: (this.rng() - 0.5) * 0.03, vy: -0.01, life: 16, max: 16, color: '#d8ccb0', size: 3 });
    }
  }

  /** Forget everything (new map, new game). */
  reset(): void {
    this.active = false;
    this.onEnd = null;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.popups = [];
    this.corpses = [];
    this.pickups = [];
    this.slashes = [];
    this.banner = null;
    this.deadEnemies = [];
  }

  // --- drawing ----------------------------------------------------------------------

  private spriteScale(e: ActEnemy, img: Drawable | null): number {
    if (!img) return 1;
    const target = e.kind === 'boss' ? 96 : 46;
    return Math.min(1, target / Math.max(img.width, img.height));
  }

  /** World-space layer drawn by the map view (cam = camera offset in pixels). */
  drawWorld(ctx: CanvasRenderingContext2D, cam: { x: number; y: number }): void {
    const g = this.game;
    const sx = (x: number) => Math.round(x * T - cam.x);
    const sy = (y: number) => Math.round(y * T - cam.y);
    ctx.save();
    for (const c of this.corpses) {
      if (!c.img) continue;
      ctx.globalAlpha = Math.min(0.55, c.life / 120);
      const w = c.img.width * c.scale;
      const h = c.img.height * c.scale;
      ctx.save();
      ctx.translate(sx(c.x), sy(c.y) + 6);
      ctx.scale(c.flip ? -1 : 1, 0.45);
      ctx.filter = 'brightness(0.35) saturate(0.6)';
      ctx.drawImage(c.img, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const k of this.pickups) {
      const bob = Math.sin((g.frameCount() + k.x * 50) / 8) * 2;
      if (k.life < 120 && Math.floor(k.life / 6) % 2) continue;
      ctx.fillStyle = k.kind === 'hp' ? '#ff4d6a' : '#4da6ff';
      const x = sx(k.x);
      const y = sy(k.y) + bob;
      ctx.beginPath();
      if (k.kind === 'hp') {
        ctx.arc(x - 3, y - 2, 4, 0, TAU);
        ctx.arc(x + 3, y - 2, 4, 0, TAU);
        ctx.moveTo(x - 7, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x + 7, y);
      } else {
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 7);
        ctx.lineTo(x - 5, y);
      }
      ctx.fill();
    }
    for (const e of this.enemies) this.drawEnemy(ctx, e, sx(e.x), sy(e.y));
    // the player's weapon
    if (g.map.player.freeMode() && (this.active || this.input.mouseSeen || this.input.isFiring())) this.drawWeapon(ctx, sx, sy);
    for (const s of this.slashes) {
      ctx.save();
      ctx.globalAlpha = s.life / 10;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6 * (s.life / 10) + 2;
      ctx.beginPath();
      ctx.arc(sx(s.x), sy(s.y), s.reach * T * (1.1 - s.life / 40), s.angle - s.arc / 2, s.angle + s.arc / 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      const x = sx(b.x);
      const y = sy(b.y);
      const r = b.r * T;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.8, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (!b.enemy && !b.big) {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - b.vx * T * 1.5, y - b.vy * T * 1.5);
        ctx.stroke();
      }
    }
    for (const p of this.particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx(p.x) - p.size / 2, sy(p.y) - p.size / 2, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 15);
      drawText(ctx, p.text, sx(p.x), sy(p.y), { size: p.big ? 22 : 16, align: 'center', bold: true, color: p.color });
    }
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: ActEnemy, x: number, y: number): void {
    const g = this.game;
    if (e.spawn > 0) {
      const t = e.spawn / 36;
      ctx.save();
      ctx.strokeStyle = '#c86bff';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - t * 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y + 8, 22 * (1 - t) + 6, 9 * (1 - t) + 3, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const img = g.images.enemy(e.data.battler, e.data.hue);
    const s = this.spriteScale(e, img);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + e.r * T * 0.8, e.r * T * 1.1, e.r * T * 0.45, 0, 0, TAU);
    ctx.fill();
    if (img) {
      const w = img.width * s;
      const h = img.height * s;
      const wobble = e.phase === 'windup' ? Math.sin(g.frameCount() * 1.5) * 2 : 0;
      ctx.translate(x + wobble, y + e.r * T * 0.8);
      ctx.scale(e.facing < 0 ? -1 : 1, 1);
      if (e.flash > 0) ctx.filter = 'brightness(4)';
      else if (e.phase === 'windup') ctx.filter = 'brightness(1.6) saturate(1.5)';
      ctx.drawImage(img, -w / 2, -h, w, h);
    }
    ctx.restore();
    if (e.battler.hpRate() < 1 && e.kind !== 'boss') {
      const w = 30;
      ctx.fillStyle = '#000a';
      ctx.fillRect(x - w / 2 - 1, y - e.r * T - 22, w + 2, 5);
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(x - w / 2, y - e.r * T - 21, w * e.battler.hpRate(), 3);
    }
  }

  private drawWeapon(ctx: CanvasRenderingContext2D, sx: (x: number) => number, sy: (y: number) => number): void {
    const actor = this.fighter();
    if (!actor || this.game.map.player.transparent) return;
    const w = weaponProfile(actor.weapon());
    const pc = this.pc();
    const x = sx(pc.x);
    const y = sy(pc.y) + 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.aim);
    ctx.translate(10 - this.recoil, 0);
    if (Math.cos(this.aim) < 0) ctx.scale(1, -1);
    switch (w.kind) {
      case 'bow':
        ctx.strokeStyle = '#8a5a2b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 9, -1.2, 1.2);
        ctx.stroke();
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(-1.2) * 9, Math.sin(-1.2) * 9);
        ctx.lineTo(Math.cos(1.2) * 9, Math.sin(1.2) * 9);
        ctx.stroke();
        break;
      case 'staff':
        ctx.fillStyle = '#7a4a22';
        ctx.fillRect(-2, -2, 18, 4);
        ctx.fillStyle = '#9fd8ff';
        ctx.beginPath();
        ctx.arc(18, 0, 4, 0, TAU);
        ctx.fill();
        break;
      case 'knife':
        ctx.fillStyle = '#ccd';
        ctx.fillRect(2, -1.5, 9, 3);
        ctx.fillStyle = '#553';
        ctx.fillRect(-2, -2, 4, 4);
        break;
      case 'fist':
        break;
      default:
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(-3, -2, 6, 4);
        ctx.fillStyle = '#dfe6f0';
        ctx.fillRect(3, -2, w.kind === 'spear' ? 22 : 16, 4);
    }
    ctx.restore();
  }

  /** Screen-space HUD. */
  drawHud(ctx: CanvasRenderingContext2D): void {
    const g = this.game;
    const W = g.width;
    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${(this.hurtFlash / 12) * 0.25})`;
      ctx.fillRect(0, 0, W, g.height);
    }
    const player = g.map.player;
    const free = player.freeMode();
    if (free && (this.active || g.input.isFiring())) {
      const actor = this.fighter();
      if (actor) {
        const x = 12;
        const y = 12;
        ctx.fillStyle = 'rgba(10,12,24,0.7)';
        ctx.fillRect(x - 4, y - 4, 196, 48);
        drawText(ctx, actor.name, x, y + 9, { size: 15, bold: true });
        drawText(ctx, `Lv ${actor.level}`, x + 186, y + 9, { size: 13, align: 'right', color: '#bcd' });
        ctx.fillStyle = '#300';
        ctx.fillRect(x, y + 20, 186, 9);
        ctx.fillStyle = actor.hpRate() < 0.3 ? '#ff3b3b' : '#ff5a5a';
        ctx.fillRect(x, y + 20, 186 * actor.hpRate(), 9);
        drawText(ctx, `${actor.hp}/${actor.mhp}`, x + 93, y + 25, { size: 11, align: 'center', bold: true });
        ctx.fillStyle = '#012';
        ctx.fillRect(x, y + 32, 186, 6);
        ctx.fillStyle = '#4da6ff';
        ctx.fillRect(x, y + 32, 186 * actor.mpRate(), 6);
      }
    }
    if (this.active && this.bossName) {
      const boss = this.enemies.find((e) => e.kind === 'boss');
      if (boss) {
        const w = Math.min(420, W - 120);
        const x = (W - w) / 2;
        const by = g.height - 26;
        drawText(ctx, this.bossName, W / 2, by - 12, { size: 16, bold: true, align: 'center', color: '#ffd0d0' });
        ctx.fillStyle = '#000b';
        ctx.fillRect(x - 2, by - 2, w + 4, 12);
        ctx.fillStyle = '#d82a2a';
        ctx.fillRect(x, by, w * boss.battler.hpRate(), 8);
      }
    } else if (this.active) {
      drawText(ctx, `Enemies: ${this.enemies.length}`, W - 14, 22, { size: 15, bold: true, align: 'right', color: '#ffc0c0' });
      if (this.canEscape) drawText(ctx, 'Run far away to escape', W - 14, 42, { size: 12, align: 'right', color: '#aab' });
    }
    if (this.banner) {
      const a = Math.min(1, this.banner.life / 20);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, g.height * 0.32, W, 70);
      drawText(ctx, this.banner.text, W / 2, g.height * 0.32 + 26, { size: 30, bold: true, align: 'center', color: '#ffe066' });
      drawText(ctx, this.banner.sub, W / 2, g.height * 0.32 + 54, { size: 15, align: 'center', maxWidth: W - 40 });
      ctx.restore();
    }
    // crosshair
    if (free && g.input.mouseSeen && !g.input.padAim) {
      const { x, y } = g.input.pointer;
      ctx.save();
      ctx.strokeStyle = this.active ? '#ff6b6b' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, TAU);
      ctx.moveTo(x - 12, y);
      ctx.lineTo(x - 4, y);
      ctx.moveTo(x + 4, y);
      ctx.lineTo(x + 12, y);
      ctx.moveTo(x, y - 12);
      ctx.lineTo(x, y - 4);
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y + 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** Is the player currently invulnerable (blinks)? */
  isPlayerBlinking(): boolean {
    return this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0;
  }
}
