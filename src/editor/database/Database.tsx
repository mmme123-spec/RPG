/** Database editor: actors, classes, skills, items, equipment, enemies, troops, states, common events, tilesets, system. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Actor, ActorClass, Armor, CommonEvent, Damage, DatabaseKey, Effect, Enemy, Item, Project, Skill, State, Tileset, Trait, Troop, UsableBase, Weapon } from '../../core/types';
import { createActor, createArmor, createClass, createCommonEvent, createEnemy, createItem, createSkill, createState, createTroop, createWeapon } from '../../core/factory';
import { createStandardTileset, BUILTIN_ANIMATIONS, BUILTIN_ENEMIES } from '../../core/builtins';
import { nextId } from '../../core/util';
import { CharacterPicker, Check, FacePicker, Field, IconPicker, IconView, IdSelect, Modal, NumberInput, Row, Select, SwitchSelect, TextArea, TextInput } from '../components/fields';
import { getImages } from '../components/images';
import { useEditor } from '../store/store';
import { CommandList } from '../events/EventEditor';
import { TilesetEditor } from './TilesetEditor';
import { SystemEditor, AssetsEditor } from './SystemEditor';

const PARAMS = ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'];

type Entry = { id: number; name: string };

const TABS: { key: DatabaseKey | 'system' | 'assets'; label: string; create?: (id: number) => Entry }[] = [
  { key: 'actors', label: 'Actors', create: createActor },
  { key: 'classes', label: 'Classes', create: createClass },
  { key: 'skills', label: 'Skills', create: createSkill },
  { key: 'items', label: 'Items', create: createItem },
  { key: 'weapons', label: 'Weapons', create: createWeapon },
  { key: 'armors', label: 'Armors', create: createArmor },
  { key: 'enemies', label: 'Enemies', create: createEnemy },
  { key: 'troops', label: 'Troops', create: createTroop },
  { key: 'states', label: 'States', create: createState },
  { key: 'commonEvents', label: 'Common Events', create: createCommonEvent },
  { key: 'tilesets', label: 'Tilesets', create: (id) => ({ ...createStandardTileset(), id, name: 'New tileset' }) },
  { key: 'system', label: 'System' },
  { key: 'assets', label: 'Assets' },
];

export function DatabaseDialog({ tab, onClose }: { tab?: string; onClose: () => void }) {
  const [cur, setCur] = useState(tab && TABS.some((t) => t.key === tab) ? tab : 'actors');
  const t = TABS.find((x) => x.key === cur)!;
  return (
    <Modal title="Database" onClose={onClose} wide>
      <div className="db">
        <div className="db-tabs">
          {TABS.map((x) => (
            <button key={x.key} className={x.key === cur ? 'sel' : ''} onClick={() => setCur(x.key)}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="db-main">{t.key === 'system' ? <SystemEditor /> : t.key === 'assets' ? <AssetsEditor /> : <ListEditor key={t.key} dbKey={t.key} create={t.create!} />}</div>
      </div>
    </Modal>
  );
}

function ListEditor({ dbKey, create }: { dbKey: DatabaseKey; create: (id: number) => Entry }) {
  const project = useEditor((s) => s.project)!;
  const update = useEditor((s) => s.update);
  const list = project[dbKey] as Entry[];
  const [selId, setSelId] = useState(list[0]?.id ?? 0);
  const [filter, setFilter] = useState('');
  const entry = list.find((e) => e.id === selId) ?? list[0];

  const add = () => {
    const id = nextId(list);
    update('Add entry', (p) => void (p[dbKey] as Entry[]).push(create(id)));
    setSelId(id);
  };
  const copy = () => {
    if (!entry) return;
    const id = nextId(list);
    update('Copy entry', (p) => void (p[dbKey] as Entry[]).push({ ...structuredClone(entry), id, name: `${entry.name} (copy)` }));
    setSelId(id);
  };
  const del = () => {
    if (!entry || list.length <= 1 || !window.confirm(`Delete "${entry.name}"? References to it will point to nothing.`)) return;
    update('Delete entry', (p) => void ((p[dbKey] as Entry[]).splice((p[dbKey] as Entry[]).findIndex((e) => e.id === entry.id), 1)));
    setSelId(list.find((e) => e.id !== entry.id)!.id);
  };
  const set = (fn: (e: any) => void) =>
    update(
      `Edit ${dbKey}`,
      (p) => {
        const e = (p[dbKey] as Entry[]).find((x) => x.id === entry.id);
        if (e) fn(e);
      },
      true,
    );

  return (
    <div className="db-split">
      <div className="db-list">
        <input className="search" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="db-items">
          {list
            .filter((e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()))
            .map((e) => (
              <div key={e.id} className={`db-item${e.id === entry?.id ? ' sel' : ''}`} onClick={() => setSelId(e.id)}>
                {'icon' in e && <IconView index={(e as { icon: number }).icon} size={16} />}
                <span className="db-id">{String(e.id).padStart(3, '0')}</span> {e.name}
              </div>
            ))}
        </div>
        <Row>
          <button onClick={add}>＋ New</button>
          <button onClick={copy}>Copy</button>
          <button className="danger" onClick={del} disabled={list.length <= 1}>
            Delete
          </button>
        </Row>
      </div>
      <div className="db-detail" key={entry?.id}>
        {entry && <Detail dbKey={dbKey} e={entry} set={set} project={project} />}
      </div>
    </div>
  );
}

function Detail({ dbKey, e, set, project }: { dbKey: DatabaseKey; e: Entry; set: (fn: (e: any) => void) => void; project: Project }) {
  switch (dbKey) {
    case 'actors':
      return <ActorForm a={e as Actor} set={set} p={project} />;
    case 'classes':
      return <ClassForm c={e as ActorClass} set={set} p={project} />;
    case 'skills':
      return <SkillForm s={e as Skill} set={set} p={project} />;
    case 'items':
      return <ItemForm s={e as Item} set={set} p={project} />;
    case 'weapons':
      return <WeaponForm w={e as Weapon} set={set} p={project} />;
    case 'armors':
      return <ArmorForm a={e as Armor} set={set} p={project} />;
    case 'enemies':
      return <EnemyForm en={e as Enemy} set={set} p={project} />;
    case 'troops':
      return <TroopForm t={e as Troop} set={set} p={project} />;
    case 'states':
      return <StateForm s={e as State} set={set} p={project} />;
    case 'commonEvents':
      return <CommonEventForm c={e as CommonEvent} set={set} />;
    case 'tilesets':
      return <TilesetEditor t={e as Tileset} set={set} />;
  }
}

type Setter<T> = (fn: (e: T) => void) => void;
const names = (l: string[]) => l.map((n, i): [number, string] => [i + 1, n || `#${i + 1}`]).slice(0, Math.max(1, l.length));

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

function NameRow({ e, set, children }: { e: { name: string }; set: Setter<any>; children?: ReactNode }) {
  return (
    <div className="form-grid">
      <Field label="Name">
        <TextInput value={e.name} onChange={(v) => set((x) => (x.name = v))} />
      </Field>
      {children}
    </div>
  );
}

function ParamsEditor({ value, onChange, signed }: { value: number[]; onChange: (i: number, v: number) => void; signed?: boolean }) {
  return (
    <div className="params-grid">
      {PARAMS.map((label, i) => (
        <Field key={i} label={label}>
          <NumberInput value={value[i]} min={signed ? -9999 : 0} max={99999} onChange={(v) => onChange(i, v)} />
        </Field>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Traits & effects
// ---------------------------------------------------------------------------

const TRAIT_KINDS: [Trait['kind'], string][] = [
  ['elementRate', 'Element rate'],
  ['stateRate', 'State rate'],
  ['stateResist', 'State resist'],
  ['paramRate', 'Parameter rate'],
  ['xparam', 'Ex-parameter'],
  ['attackElement', 'Attack element'],
  ['attackState', 'Attack state'],
  ['addSkill', 'Add skill'],
  ['sealSkillType', 'Seal skill type'],
  ['partyAbility', 'Party ability'],
];

function newTrait(kind: Trait['kind']): Trait {
  switch (kind) {
    case 'elementRate':
      return { kind, elementId: 1, value: 1 };
    case 'stateRate':
      return { kind, stateId: 1, value: 1 };
    case 'stateResist':
      return { kind, stateId: 1 };
    case 'paramRate':
      return { kind, param: 0, value: 1 };
    case 'xparam':
      return { kind, xparam: 'hit', value: 0.05 };
    case 'attackElement':
      return { kind, elementId: 1 };
    case 'attackState':
      return { kind, stateId: 1, value: 0.1 };
    case 'addSkill':
      return { kind, skillId: 1 };
    case 'sealSkillType':
      return { kind, stypeId: 1 };
    case 'partyAbility':
      return { kind, ability: 'encounterHalf' };
  }
}

function Pct({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <label className="mini">
      <NumberInput value={Math.round(value * 100)} min={-1000} max={1000} onChange={(v) => onChange(v / 100)} /> %
    </label>
  );
}

export function TraitsEditor({ traits, set }: { traits: Trait[]; set: (fn: (t: Trait[]) => void) => void }) {
  const p = useEditor((s) => s.project)!;
  const s = p.system;
  return (
    <Section title="Traits">
      {traits.map((t, i) => {
        const upd = (patch: Partial<Trait>) => set((l) => void Object.assign(l[i], patch));
        return (
          <Row key={i}>
            <Select value={t.kind} options={TRAIT_KINDS} onChange={(k) => set((l) => void (l[i] = newTrait(k)))} />
            {(t.kind === 'elementRate' || t.kind === 'attackElement') && <Select value={t.elementId} options={names(s.elements)} onChange={(v) => upd({ elementId: v })} />}
            {(t.kind === 'stateRate' || t.kind === 'stateResist' || t.kind === 'attackState') && <IdSelect value={t.stateId} list={p.states} onChange={(v) => upd({ stateId: v })} />}
            {t.kind === 'paramRate' && <Select value={t.param} options={PARAMS.map((n, j): [number, string] => [j, n])} onChange={(v) => upd({ param: v })} />}
            {t.kind === 'xparam' && (
              <Select
                value={t.xparam}
                options={[
                  ['hit', 'Hit rate'],
                  ['eva', 'Evasion'],
                  ['cri', 'Critical rate'],
                  ['hrg', 'HP regen'],
                  ['mrg', 'MP regen'],
                ]}
                onChange={(v) => upd({ xparam: v })}
              />
            )}
            {t.kind === 'addSkill' && <IdSelect value={t.skillId} list={p.skills} onChange={(v) => upd({ skillId: v })} />}
            {t.kind === 'sealSkillType' && <Select value={t.stypeId} options={names(s.skillTypes)} onChange={(v) => upd({ stypeId: v })} />}
            {t.kind === 'partyAbility' && (
              <Select
                value={t.ability}
                options={[
                  ['encounterHalf', 'Encounter half'],
                  ['encounterNone', 'Encounter none'],
                  ['goldDouble', 'Gold double'],
                  ['dropDouble', 'Drop double'],
                  ['cancelSurprise', 'Cancel surprise'],
                  ['raisePreemptive', 'Raise preemptive'],
                ]}
                onChange={(v) => upd({ ability: v })}
              />
            )}
            {'value' in t && <Pct value={t.value} onChange={(v) => upd({ value: v } as Partial<Trait>)} />}
            <button onClick={() => set((l) => void l.splice(i, 1))}>✕</button>
          </Row>
        );
      })}
      <button onClick={() => set((l) => void l.push(newTrait('elementRate')))}>＋ Trait</button>
    </Section>
  );
}

const EFFECT_KINDS: [Effect['kind'], string][] = [
  ['recoverHp', 'Recover HP'],
  ['recoverMp', 'Recover MP'],
  ['addState', 'Add state'],
  ['removeState', 'Remove state'],
  ['addBuff', 'Add buff'],
  ['addDebuff', 'Add debuff'],
  ['growth', 'Grow parameter'],
  ['learnSkill', 'Learn skill'],
  ['commonEvent', 'Common event'],
];

function newEffect(kind: Effect['kind']): Effect {
  switch (kind) {
    case 'recoverHp':
    case 'recoverMp':
      return { kind, percent: 0, flat: 100 };
    case 'addState':
    case 'removeState':
      return { kind, stateId: 1, chance: 100 };
    case 'addBuff':
    case 'addDebuff':
      return { kind, param: 2, turns: 3 };
    case 'growth':
      return { kind, param: 0, value: 10 };
    case 'learnSkill':
      return { kind, skillId: 1 };
    case 'commonEvent':
      return { kind, commonEventId: 1 };
  }
}

function EffectsEditor({ effects, set }: { effects: Effect[]; set: (fn: (l: Effect[]) => void) => void }) {
  const p = useEditor((s) => s.project)!;
  return (
    <Section title="Effects">
      {effects.map((ef, i) => {
        const upd = (patch: Record<string, number>) => set((l) => void Object.assign(l[i], patch));
        return (
          <Row key={i}>
            <Select value={ef.kind} options={EFFECT_KINDS} onChange={(k) => set((l) => void (l[i] = newEffect(k)))} />
            {(ef.kind === 'recoverHp' || ef.kind === 'recoverMp') && (
              <>
                <label className="mini">
                  <NumberInput value={ef.percent} min={0} max={100} onChange={(v) => upd({ percent: v })} />% +
                </label>
                <NumberInput value={ef.flat} min={0} max={9999} onChange={(v) => upd({ flat: v })} />
              </>
            )}
            {(ef.kind === 'addState' || ef.kind === 'removeState') && (
              <>
                <IdSelect value={ef.stateId} list={ef.kind === 'addState' ? [{ id: 0, name: 'Normal attack' }, ...p.states] : p.states} onChange={(v) => upd({ stateId: v })} />
                <label className="mini">
                  <NumberInput value={ef.chance} min={0} max={100} onChange={(v) => upd({ chance: v })} />%
                </label>
              </>
            )}
            {(ef.kind === 'addBuff' || ef.kind === 'addDebuff' || ef.kind === 'growth') && <Select value={ef.param} options={PARAMS.map((n, j): [number, string] => [j, n])} onChange={(v) => upd({ param: v })} />}
            {(ef.kind === 'addBuff' || ef.kind === 'addDebuff') && (
              <label className="mini">
                <NumberInput value={ef.turns} min={1} max={99} onChange={(v) => upd({ turns: v })} /> turns
              </label>
            )}
            {ef.kind === 'growth' && <NumberInput value={ef.value} min={-999} max={999} onChange={(v) => upd({ value: v })} />}
            {ef.kind === 'learnSkill' && <IdSelect value={ef.skillId} list={p.skills} onChange={(v) => upd({ skillId: v })} />}
            {ef.kind === 'commonEvent' && <IdSelect value={ef.commonEventId} list={p.commonEvents} onChange={(v) => upd({ commonEventId: v })} />}
            <button onClick={() => set((l) => void l.splice(i, 1))}>✕</button>
          </Row>
        );
      })}
      <button onClick={() => set((l) => void l.push(newEffect('recoverHp')))}>＋ Effect</button>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

function ActorForm({ a, set, p }: { a: Actor; set: Setter<Actor>; p: Project }) {
  const slots = p.system.terms.equipSlots;
  return (
    <>
      <NameRow e={a} set={set}>
        <Field label="Nickname">
          <TextInput value={a.nickname} onChange={(v) => set((x) => (x.nickname = v))} />
        </Field>
        <Field label="Class">
          <IdSelect value={a.classId} list={p.classes} onChange={(v) => set((x) => (x.classId = v))} />
        </Field>
        <Field label="Initial level">
          <NumberInput value={a.initialLevel} min={1} max={99} onChange={(v) => set((x) => (x.initialLevel = v))} />
        </Field>
        <Field label="Max level">
          <NumberInput value={a.maxLevel} min={1} max={99} onChange={(v) => set((x) => (x.maxLevel = v))} />
        </Field>
      </NameRow>
      <Row>
        <Field label="Map sprite">
          <CharacterPicker value={a.character} onChange={(v) => v && set((x) => (x.character = v))} />
        </Field>
        <Field label="Face">
          <FacePicker value={a.face} onChange={(v) => set((x) => (x.face = v))} />
        </Field>
      </Row>
      <Field label="Profile" wide>
        <TextArea rows={2} value={a.profile} onChange={(v) => set((x) => (x.profile = v))} />
      </Field>
      <Section title="Initial equipment">
        <div className="form-grid">
          {slots.map((label, i) => (
            <Field key={i} label={label}>
              {i === 0 ? (
                <IdSelect value={a.equips[i] ?? 0} list={p.weapons} none="(none)" onChange={(v) => set((x) => (x.equips[i] = v))} />
              ) : (
                <IdSelect value={a.equips[i] ?? 0} list={p.armors.filter((ar) => ar.slot === i)} none="(none)" onChange={(v) => set((x) => (x.equips[i] = v))} />
              )}
            </Field>
          ))}
        </div>
      </Section>
      <TraitsEditor traits={a.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={a} set={set} />
    </>
  );
}

function NoteField({ e, set }: { e: { note: string }; set: Setter<any> }) {
  return (
    <Field label="Note" wide>
      <TextArea rows={2} value={e.note} onChange={(v) => set((x) => (x.note = v))} />
    </Field>
  );
}

function curveValue(c: { base: number; max: number; growth: number }, lv: number) {
  return Math.round(c.base + (c.max - c.base) * Math.pow((lv - 1) / 98, c.growth));
}

function CurveGraph({ c, color }: { c: { base: number; max: number; growth: number }; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 120, 50);
    ctx.fillStyle = color;
    for (let lv = 1; lv <= 99; lv += 2) {
      const h = (curveValue(c, lv) / Math.max(1, c.max)) * 48;
      ctx.fillRect(((lv - 1) / 98) * 118, 50 - h, 2, h);
    }
  });
  return <canvas ref={ref} width={120} height={50} className="curve" />;
}

function ClassForm({ c, set, p }: { c: ActorClass; set: Setter<ActorClass>; p: Project }) {
  const colors = ['#e66', '#69f', '#fa4', '#8c6', '#c6f', '#6cc', '#5d5', '#dd5'];
  const toggle = (arr: number[], id: number) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id].sort((a, b) => a - b));
  const typeChecks = (label: string, list: string[], key: 'skillTypes' | 'weaponTypes' | 'armorTypes') => (
    <Section title={label}>
      <div className="checks">
        {list.map((n, i) => (
          <Check key={i} label={n} value={c[key].includes(i + 1)} onChange={() => set((x) => (x[key] = toggle(x[key], i + 1)))} />
        ))}
      </div>
    </Section>
  );
  return (
    <>
      <NameRow e={c} set={set}>
        <Field label="EXP curve (basis / extra / accel)">
          <Row>
            <NumberInput value={c.exp.basis} min={1} max={100} onChange={(v) => set((x) => (x.exp.basis = v))} />
            <NumberInput value={c.exp.extra} min={0} max={100} onChange={(v) => set((x) => (x.exp.extra = v))} />
            <NumberInput value={c.exp.accel} min={1} max={50} onChange={(v) => set((x) => (x.exp.accel = v))} />
          </Row>
        </Field>
      </NameRow>
      <Section title="Parameter curves (Lv 1 → Lv 99, growth exponent)">
        <div className="curves">
          {c.params.map((pc, i) => (
            <div key={i} className="curve-row">
              <b>{PARAMS[i]}</b>
              <NumberInput value={pc.base} min={1} max={99999} onChange={(v) => set((x) => (x.params[i].base = v))} />
              <NumberInput value={pc.max} min={1} max={99999} onChange={(v) => set((x) => (x.params[i].max = v))} />
              <NumberInput value={pc.growth} min={0.2} max={3} step={0.05} onChange={(v) => set((x) => (x.params[i].growth = v))} />
              <CurveGraph c={pc} color={colors[i]} />
              <span className="hint">Lv10: {curveValue(pc, 10)}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Skills to learn">
        {c.learnings.map((l, i) => (
          <Row key={i}>
            <label className="mini">
              Lv <NumberInput value={l.level} min={1} max={99} onChange={(v) => set((x) => (x.learnings[i].level = v))} />
            </label>
            <IdSelect value={l.skillId} list={p.skills} onChange={(v) => set((x) => (x.learnings[i].skillId = v))} />
            <button onClick={() => set((x) => void x.learnings.splice(i, 1))}>✕</button>
          </Row>
        ))}
        <button onClick={() => set((x) => void x.learnings.push({ level: 1, skillId: p.skills[0]?.id ?? 1 }))}>＋ Learning</button>
      </Section>
      {typeChecks('Skill types', p.system.skillTypes, 'skillTypes')}
      {typeChecks('Equippable weapon types', p.system.weaponTypes, 'weaponTypes')}
      {typeChecks('Equippable armor types', p.system.armorTypes, 'armorTypes')}
      <TraitsEditor traits={c.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={c} set={set} />
    </>
  );
}

function AnimationSelect({ value, onChange, allowAttack }: { value: string; onChange: (v: string) => void; allowAttack?: boolean }) {
  return <Select value={value} options={[['', '(None)'], ...(allowAttack ? [['attack', 'Normal attack'] as [string, string]] : []), ...BUILTIN_ANIMATIONS.map((a): [string, string] => [a.key, a.label])]} onChange={onChange} />;
}

function UsableFields({ u, set, p }: { u: UsableBase; set: Setter<UsableBase>; p: Project }) {
  const d = u.damage;
  const setD = (fn: (d: Damage) => void) => set((x) => fn(x.damage));
  return (
    <>
      <div className="form-grid">
        <Field label="Icon">
          <IconPicker value={u.icon} onChange={(v) => set((x) => (x.icon = v))} />
        </Field>
        <Field label="Description" wide>
          <TextInput value={u.description} onChange={(v) => set((x) => (x.description = v))} />
        </Field>
        <Field label="Scope">
          <Select
            value={u.scope}
            options={[
              ['none', 'None'],
              ['enemy', '1 Enemy'],
              ['allEnemies', 'All enemies'],
              ['randomEnemy', 'Random enemy'],
              ['ally', '1 Ally'],
              ['allAllies', 'All allies'],
              ['deadAlly', '1 Ally (dead)'],
              ['allDeadAllies', 'All allies (dead)'],
              ['user', 'The user'],
            ]}
            onChange={(v) => set((x) => (x.scope = v))}
          />
        </Field>
        <Field label="Occasion">
          <Select
            value={u.occasion}
            options={[
              ['always', 'Always'],
              ['battle', 'Battle screen'],
              ['menu', 'Menu screen'],
              ['never', 'Never'],
            ]}
            onChange={(v) => set((x) => (x.occasion = v))}
          />
        </Field>
        <Field label="Speed">
          <NumberInput value={u.speed} min={-2000} max={2000} onChange={(v) => set((x) => (x.speed = v))} />
        </Field>
        <Field label="Success %">
          <NumberInput value={u.successRate} min={0} max={100} onChange={(v) => set((x) => (x.successRate = v))} />
        </Field>
        <Field label="Repeats">
          <NumberInput value={u.repeats} min={1} max={9} onChange={(v) => set((x) => (x.repeats = v))} />
        </Field>
        <Field label="Hit type">
          <Select
            value={u.hitType}
            options={[
              ['certain', 'Certain hit'],
              ['physical', 'Physical attack'],
              ['magical', 'Magical attack'],
            ]}
            onChange={(v) => set((x) => (x.hitType = v))}
          />
        </Field>
        <Field label="Animation">
          <AnimationSelect value={u.animation} allowAttack onChange={(v) => set((x) => (x.animation = v))} />
        </Field>
      </div>
      <Section title="Damage">
        <div className="form-grid">
          <Field label="Type">
            <Select
              value={d.type}
              options={[
                ['none', 'None'],
                ['hpDamage', 'HP damage'],
                ['mpDamage', 'MP damage'],
                ['hpRecover', 'HP recover'],
                ['mpRecover', 'MP recover'],
                ['hpDrain', 'HP drain'],
                ['mpDrain', 'MP drain'],
              ]}
              onChange={(v) => setD((x) => (x.type = v))}
            />
          </Field>
          <Field label="Element">
            <Select value={d.elementId} options={[[-1, 'Normal attack'], [0, 'None'], ...names(p.system.elements)]} onChange={(v) => setD((x) => (x.elementId = v))} />
          </Field>
          <Field label="Formula (a = user, b = target, v = variables)" wide>
            <TextInput value={d.formula} onChange={(v) => setD((x) => (x.formula = v))} />
          </Field>
          <Field label="Variance %">
            <NumberInput value={d.variance} min={0} max={100} onChange={(v) => setD((x) => (x.variance = v))} />
          </Field>
          <Check label="Critical hits" value={d.critical} onChange={(v) => setD((x) => (x.critical = v))} />
        </div>
      </Section>
      <EffectsEditor effects={u.effects} set={(fn) => set((x) => fn(x.effects))} />
    </>
  );
}

function SkillForm({ s, set, p }: { s: Skill; set: Setter<Skill>; p: Project }) {
  return (
    <>
      <NameRow e={s} set={set}>
        <Field label="Skill type">
          <Select value={s.stypeId} options={[[0, 'None'], ...names(p.system.skillTypes)]} onChange={(v) => set((x) => (x.stypeId = v))} />
        </Field>
        <Field label="MP cost">
          <NumberInput value={s.mpCost} min={0} max={9999} onChange={(v) => set((x) => (x.mpCost = v))} />
        </Field>
        <Field label="Message (%1 user, %2 skill)" wide>
          <TextInput value={s.message} onChange={(v) => set((x) => (x.message = v))} />
        </Field>
      </NameRow>
      <UsableFields u={s} set={set as Setter<UsableBase>} p={p} />
      <NoteField e={s} set={set} />
    </>
  );
}

function ItemForm({ s, set, p }: { s: Item; set: Setter<Item>; p: Project }) {
  return (
    <>
      <NameRow e={s} set={set}>
        <Field label="Item type">
          <Select
            value={s.itype}
            options={[
              ['regular', 'Regular item'],
              ['key', 'Key item'],
            ]}
            onChange={(v) => set((x) => (x.itype = v))}
          />
        </Field>
        <Field label="Price">
          <NumberInput value={s.price} min={0} max={999999} onChange={(v) => set((x) => (x.price = v))} />
        </Field>
        <Check label="Consumable" value={s.consumable} onChange={(v) => set((x) => (x.consumable = v))} />
      </NameRow>
      <UsableFields u={s} set={set as Setter<UsableBase>} p={p} />
      <NoteField e={s} set={set} />
    </>
  );
}

function WeaponForm({ w, set, p }: { w: Weapon; set: Setter<Weapon>; p: Project }) {
  return (
    <>
      <NameRow e={w} set={set}>
        <Field label="Icon">
          <IconPicker value={w.icon} onChange={(v) => set((x) => (x.icon = v))} />
        </Field>
        <Field label="Weapon type">
          <Select value={w.wtypeId} options={names(p.system.weaponTypes)} onChange={(v) => set((x) => (x.wtypeId = v))} />
        </Field>
        <Field label="Price">
          <NumberInput value={w.price} min={0} max={999999} onChange={(v) => set((x) => (x.price = v))} />
        </Field>
        <Field label="Attack animation">
          <AnimationSelect value={w.animation} onChange={(v) => set((x) => (x.animation = v))} />
        </Field>
        <Field label="Description" wide>
          <TextInput value={w.description} onChange={(v) => set((x) => (x.description = v))} />
        </Field>
      </NameRow>
      <Section title="Parameter changes">
        <ParamsEditor value={w.params} signed onChange={(i, v) => set((x) => (x.params[i] = v))} />
      </Section>
      <TraitsEditor traits={w.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={w} set={set} />
    </>
  );
}

function ArmorForm({ a, set, p }: { a: Armor; set: Setter<Armor>; p: Project }) {
  return (
    <>
      <NameRow e={a} set={set}>
        <Field label="Icon">
          <IconPicker value={a.icon} onChange={(v) => set((x) => (x.icon = v))} />
        </Field>
        <Field label="Armor type">
          <Select value={a.atypeId} options={names(p.system.armorTypes)} onChange={(v) => set((x) => (x.atypeId = v))} />
        </Field>
        <Field label="Equip slot">
          <Select value={a.slot} options={p.system.terms.equipSlots.slice(1).map((n, i): [number, string] => [i + 1, n])} onChange={(v) => set((x) => (x.slot = v))} />
        </Field>
        <Field label="Price">
          <NumberInput value={a.price} min={0} max={999999} onChange={(v) => set((x) => (x.price = v))} />
        </Field>
        <Field label="Description" wide>
          <TextInput value={a.description} onChange={(v) => set((x) => (x.description = v))} />
        </Field>
      </NameRow>
      <Section title="Parameter changes">
        <ParamsEditor value={a.params} signed onChange={(i, v) => set((x) => (x.params[i] = v))} />
      </Section>
      <TraitsEditor traits={a.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={a} set={set} />
    </>
  );
}

function EnemyImage({ battler, hue, max = 160 }: { battler: string; hue: number; max?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const img = getImages().enemy(battler, hue);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!img) return;
    const s = Math.min(2, max / Math.max(img.width, img.height));
    ctx.drawImage(img, (c.width - img.width * s) / 2, c.height - img.height * s, img.width * s, img.height * s);
  });
  return <canvas ref={ref} width={max} height={max} className="pixel" />;
}

function battlerOptions(p: Project): [string, string][] {
  return [...BUILTIN_ENEMIES.map((e): [string, string] => [`builtin:${e.key}`, e.label]), ...p.assets.filter((a) => a.kind === 'enemy').map((a): [string, string] => [`asset:${a.id}`, a.name])];
}

function EnemyForm({ en, set, p }: { en: Enemy; set: Setter<Enemy>; p: Project }) {
  const dropList = (k: string) => (k === 'weapon' ? p.weapons : k === 'armor' ? p.armors : p.items);
  return (
    <>
      <div className="enemy-top">
        <div>
          <NameRow e={en} set={set}>
            <Field label="Graphic">
              <Select value={en.battler} options={battlerOptions(p)} onChange={(v) => set((x) => (x.battler = v))} />
            </Field>
            <Field label={`Hue (${en.hue}°)`}>
              <input type="range" min={0} max={359} value={en.hue} onChange={(e) => set((x) => (x.hue = Number(e.target.value)))} />
            </Field>
            <Field label="EXP">
              <NumberInput value={en.exp} min={0} max={999999} onChange={(v) => set((x) => (x.exp = v))} />
            </Field>
            <Field label="Gold">
              <NumberInput value={en.gold} min={0} max={999999} onChange={(v) => set((x) => (x.gold = v))} />
            </Field>
          </NameRow>
          <ParamsEditor value={en.params} onChange={(i, v) => set((x) => (x.params[i] = v))} />
        </div>
        <EnemyImage battler={en.battler} hue={en.hue} />
      </div>
      <Section title="Drop items">
        {en.drops.map((d, i) => (
          <Row key={i}>
            <Select
              value={d.kind}
              options={[
                ['item', 'Item'],
                ['weapon', 'Weapon'],
                ['armor', 'Armor'],
              ]}
              onChange={(v) => set((x) => void (x.drops[i] = { ...x.drops[i], kind: v, id: dropList(v)[0]?.id ?? 1 }))}
            />
            <IdSelect value={d.id} list={dropList(d.kind)} onChange={(v) => set((x) => (x.drops[i].id = v))} />
            <label className="mini">
              1 / <NumberInput value={d.denominator} min={1} max={1000} onChange={(v) => set((x) => (x.drops[i].denominator = v))} />
            </label>
            <button onClick={() => set((x) => void x.drops.splice(i, 1))}>✕</button>
          </Row>
        ))}
        <button onClick={() => set((x) => void x.drops.push({ kind: 'item', id: p.items[0]?.id ?? 1, denominator: 4 }))}>＋ Drop</button>
      </Section>
      <Section title="Action patterns">
        {en.actions.map((a, i) => (
          <Row key={i}>
            <IdSelect value={a.skillId} list={p.skills} onChange={(v) => set((x) => (x.actions[i].skillId = v))} />
            <label className="mini">
              rating <NumberInput value={a.rating} min={1} max={9} onChange={(v) => set((x) => (x.actions[i].rating = v))} />
            </label>
            <Select
              value={a.condition}
              options={[
                ['always', 'Always'],
                ['turn', 'Turn (a + b·X)'],
                ['hp', 'HP % between'],
                ['mp', 'MP % between'],
                ['state', 'Has state'],
                ['partyLevel', 'Party level ≥'],
                ['switch', 'Switch ON'],
              ]}
              onChange={(v) => set((x) => (x.actions[i].condition = v))}
            />
            {a.condition !== 'always' && <NumberInput value={a.param1} min={0} max={9999} onChange={(v) => set((x) => (x.actions[i].param1 = v))} />}
            {(a.condition === 'turn' || a.condition === 'hp' || a.condition === 'mp') && <NumberInput value={a.param2} min={0} max={9999} onChange={(v) => set((x) => (x.actions[i].param2 = v))} />}
            <button onClick={() => set((x) => void x.actions.splice(i, 1))}>✕</button>
          </Row>
        ))}
        <button onClick={() => set((x) => void x.actions.push({ skillId: 1, rating: 5, condition: 'always', param1: 0, param2: 0 }))}>＋ Action</button>
      </Section>
      <TraitsEditor traits={en.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={en} set={set} />
    </>
  );
}

function TroopForm({ t, set, p }: { t: Troop; set: Setter<Troop>; p: Project }) {
  const [drag, setDrag] = useState<number | null>(null);
  const [add, setAdd] = useState(p.enemies[0]?.id ?? 1);
  const ref = useRef<HTMLDivElement>(null);
  const W = 640,
    H = 480,
    S = 0.75;
  const autoName = () => {
    const counts = new Map<string, number>();
    for (const m of t.members) {
      const n = p.enemies.find((e) => e.id === m.enemyId)?.name ?? '?';
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return [...counts].map(([n, c]) => (c > 1 ? `${n}*${c}` : n)).join(', ');
  };
  const arrange = () =>
    set((x) => {
      const n = x.members.length;
      x.members.forEach((m, i) => {
        m.x = Math.round((W * (i + 1)) / (n + 1));
        m.y = 300 + (i % 2) * 30;
      });
    });
  return (
    <>
      <NameRow e={t} set={set}>
        <Field label=" ">
          <button onClick={() => set((x) => (x.name = autoName()))}>Auto-name</button>
        </Field>
      </NameRow>
      <Row>
        <IdSelect value={add} list={p.enemies} onChange={setAdd} />
        <button disabled={t.members.length >= 8} onClick={() => set((x) => void x.members.push({ enemyId: add, x: W / 2, y: 320, hidden: false }))}>
          ＋ Add enemy
        </button>
        <button onClick={arrange}>Arrange</button>
        <button onClick={() => set((x) => void (x.members = []))}>Clear</button>
      </Row>
      <div
        ref={ref}
        className="troop-stage"
        style={{ width: W * S, height: H * S }}
        onPointerMove={(e) => {
          if (drag === null || !ref.current) return;
          const r = ref.current.getBoundingClientRect();
          const x = Math.round(Math.max(0, Math.min(W, (e.clientX - r.left) / S)));
          const y = Math.round(Math.max(40, Math.min(H, (e.clientY - r.top) / S)));
          set((tr) => void Object.assign(tr.members[drag], { x, y }));
        }}
        onPointerUp={() => setDrag(null)}
      >
        {t.members.map((m, i) => {
          const en = p.enemies.find((e) => e.id === m.enemyId);
          return (
            <div
              key={i}
              className={`troop-member${m.hidden ? ' hidden' : ''}`}
              style={{ left: m.x * S, top: m.y * S }}
              onPointerDown={(e) => {
                e.preventDefault();
                setDrag(i);
              }}
              onDoubleClick={() => set((x) => void (x.members[i].hidden = !x.members[i].hidden))}
              onContextMenu={(e) => {
                e.preventDefault();
                set((x) => void x.members.splice(i, 1));
              }}
              title={`${en?.name ?? '?'} — drag to move, double-click: toggle "appear halfway", right-click: remove`}
            >
              {en && <EnemyImage battler={en.battler} hue={en.hue} max={120} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

function StateForm({ s, set }: { s: State; set: Setter<State>; p: Project }) {
  return (
    <>
      <NameRow e={s} set={set}>
        <Field label="Icon">
          <IconPicker value={s.icon} onChange={(v) => set((x) => (x.icon = v))} />
        </Field>
        <Field label="Restriction">
          <Select
            value={s.restriction}
            options={[
              ['none', 'None'],
              ['attackEnemy', 'Attack an enemy'],
              ['attackAnyone', 'Attack anyone'],
              ['attackAlly', 'Attack an ally'],
              ['cannotMove', 'Cannot move'],
            ]}
            onChange={(v) => set((x) => (x.restriction = v))}
          />
        </Field>
        <Field label="Priority">
          <NumberInput value={s.priority} min={0} max={100} onChange={(v) => set((x) => (x.priority = v))} />
        </Field>
        <Field label="Tint colour">
          <Row>
            <input type="color" value={s.color || '#000000'} onChange={(e) => set((x) => (x.color = e.target.value))} />
            <button onClick={() => set((x) => (x.color = ''))}>None</button>
          </Row>
        </Field>
      </NameRow>
      <Section title="Removal conditions">
        <Check label="Remove at battle end" value={s.removeAtBattleEnd} onChange={(v) => set((x) => (x.removeAtBattleEnd = v))} />
        <Row>
          <Field label="Auto-removal timing">
            <Select
              value={s.autoRemoval}
              options={[
                ['none', 'None'],
                ['actionEnd', 'Action end'],
                ['turnEnd', 'Turn end'],
              ]}
              onChange={(v) => set((x) => (x.autoRemoval = v))}
            />
          </Field>
          <Field label="Duration in turns (min – max)">
            <Row>
              <NumberInput value={s.minTurns} min={1} max={99} onChange={(v) => set((x) => (x.minTurns = v))} />
              <NumberInput value={s.maxTurns} min={1} max={99} onChange={(v) => set((x) => (x.maxTurns = v))} />
            </Row>
          </Field>
        </Row>
        <Row>
          <Check label="Remove by damage" value={s.removeByDamage} onChange={(v) => set((x) => (x.removeByDamage = v))} />
          <label className="mini">
            <NumberInput value={s.damageRemovalChance} min={0} max={100} onChange={(v) => set((x) => (x.damageRemovalChance = v))} />%
          </label>
        </Row>
        <Row>
          <Check label="Remove by walking" value={s.removeByWalking} onChange={(v) => set((x) => (x.removeByWalking = v))} />
          <label className="mini">
            <NumberInput value={s.stepsToRemove} min={1} max={9999} onChange={(v) => set((x) => (x.stepsToRemove = v))} /> steps
          </label>
        </Row>
      </Section>
      <Section title="Messages (%1 = target name)">
        <div className="form-grid">
          <Field label="When an actor is inflicted">
            <TextInput value={s.messageActor} onChange={(v) => set((x) => (x.messageActor = v))} />
          </Field>
          <Field label="When an enemy is inflicted">
            <TextInput value={s.messageEnemy} onChange={(v) => set((x) => (x.messageEnemy = v))} />
          </Field>
          <Field label="While the state persists">
            <TextInput value={s.messageStay} onChange={(v) => set((x) => (x.messageStay = v))} />
          </Field>
          <Field label="When the state is removed">
            <TextInput value={s.messageRemove} onChange={(v) => set((x) => (x.messageRemove = v))} />
          </Field>
        </div>
      </Section>
      <TraitsEditor traits={s.traits} set={(fn) => set((x) => fn(x.traits))} />
      <NoteField e={s} set={set} />
    </>
  );
}

function CommonEventForm({ c, set }: { c: CommonEvent; set: Setter<CommonEvent> }) {
  return (
    <>
      <NameRow e={c} set={set}>
        <Field label="Trigger">
          <Select
            value={c.trigger}
            options={[
              ['none', 'None (called from events)'],
              ['autorun', 'Autorun'],
              ['parallel', 'Parallel'],
            ]}
            onChange={(v) => set((x) => (x.trigger = v))}
          />
        </Field>
        {c.trigger !== 'none' && (
          <Field label="Condition switch">
            <SwitchSelect value={c.switchId} onChange={(v) => set((x) => (x.switchId = v))} />
          </Field>
        )}
      </NameRow>
      <div className="ce-commands">
        <CommandList commands={c.commands} edit={(fn) => set((x) => fn(x.commands))} />
      </div>
    </>
  );
}

