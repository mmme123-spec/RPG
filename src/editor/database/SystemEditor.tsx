/** System settings, terms, type lists and the asset manager. */

import { useState } from 'react';
import type { Asset, AssetKind, SystemSettings, SystemSound, Terms } from '../../core/types';
import { BUILTIN_TITLES } from '../../core/builtins';
import { randomId } from '../../core/util';
import { AudioPicker, Check, Field, IdSelect, NumberInput, Row, Select, TextInput } from '../components/fields';
import { useEditor } from '../store/store';
import { LocationForm } from '../events/CommandForms';

function useSys() {
  const sys = useEditor((s) => s.project!.system);
  const update = useEditor((s) => s.update);
  const set = (fn: (s: SystemSettings) => void) => update('System settings', (p) => fn(p.system), true);
  return [sys, set] as const;
}

const SOUNDS: [SystemSound, string][] = [
  ['cursor', 'Cursor'],
  ['ok', 'OK'],
  ['cancel', 'Cancel'],
  ['buzzer', 'Buzzer'],
  ['equip', 'Equip'],
  ['save', 'Save'],
  ['load', 'Load'],
  ['battleStart', 'Battle start'],
  ['escape', 'Escape'],
  ['enemyAttack', 'Enemy attack'],
  ['enemyDamage', 'Enemy damage'],
  ['enemyCollapse', 'Enemy collapse'],
  ['actorDamage', 'Actor damage'],
  ['actorCollapse', 'Actor collapse'],
  ['recovery', 'Recovery'],
  ['miss', 'Miss'],
  ['evasion', 'Evasion'],
  ['useItem', 'Use item'],
  ['useSkill', 'Use skill'],
  ['shop', 'Shop'],
  ['levelUp', 'Level up'],
];

export function SystemEditor() {
  const [sys, set] = useSys();
  const project = useEditor((s) => s.project)!;
  const [sub, setSub] = useState<'general' | 'audio' | 'terms' | 'types'>('general');
  return (
    <div className="system-editor">
      <div className="page-tabs">
        {(
          [
            ['general', 'General'],
            ['audio', 'Music & sounds'],
            ['terms', 'Terms'],
            ['types', 'Types & names'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} className={sub === k ? 'sel' : ''} onClick={() => setSub(k)}>
            {l}
          </button>
        ))}
      </div>
      {sub === 'general' && (
        <>
          <div className="form-grid">
            <Field label="Game title">
              <TextInput value={sys.gameTitle} onChange={(v) => set((s) => (s.gameTitle = v))} />
            </Field>
            <Field label="Currency">
              <TextInput value={sys.currency} onChange={(v) => set((s) => (s.currency = v))} />
            </Field>
            <Field label="Starting gold">
              <NumberInput value={sys.startGold} min={0} max={9999999} onChange={(v) => set((s) => (s.startGold = v))} />
            </Field>
            <Field label="Title screen">
              <Select
                value={sys.titleBackground}
                options={[...BUILTIN_TITLES.map((t): [string, string] => [`builtin:${t.key}`, t.label]), ...project.assets.filter((a) => a.kind === 'title').map((a): [string, string] => [`asset:${a.id}`, a.name])]}
                onChange={(v) => set((s) => (s.titleBackground = v))}
              />
            </Field>
            <Check label="Draw game title on title screen" value={sys.showTitleText} onChange={(v) => set((s) => (s.showTitleText = v))} />
            <Field label="Window colour">
              <input type="color" value={sys.windowColor} onChange={(e) => set((s) => (s.windowColor = e.target.value))} />
            </Field>
            <Field label="Window opacity">
              <input type="range" min={0} max={255} value={sys.windowOpacity} onChange={(e) => set((s) => (s.windowOpacity = Number(e.target.value)))} />
            </Field>
            <Check label="Show party followers" value={sys.followers} onChange={(v) => set((s) => (s.followers = v))} />
            <Check label="Always dash" value={sys.alwaysDash} onChange={(v) => set((s) => (s.alwaysDash = v))} />
            <Field label="Attack command skill">
              <IdSelect value={sys.attackSkillId} list={project.skills} onChange={(v) => set((s) => (s.attackSkillId = v))} />
            </Field>
            <Field label="Guard command skill">
              <IdSelect value={sys.guardSkillId} list={project.skills} onChange={(v) => set((s) => (s.guardSkillId = v))} />
            </Field>
          </div>
          <fieldset>
            <legend>Starting party</legend>
            {sys.party.map((id, i) => (
              <Row key={i}>
                <IdSelect value={id} list={project.actors} onChange={(v) => set((s) => (s.party[i] = v))} />
                <button onClick={() => set((s) => void s.party.splice(i, 1))}>✕</button>
              </Row>
            ))}
            <button disabled={sys.party.length >= 4} onClick={() => set((s) => void s.party.push(project.actors[0]?.id ?? 1))}>
              ＋ Member
            </button>
          </fieldset>
          <fieldset>
            <legend>Player start position</legend>
            <LocationForm
              mapId={sys.startMapId}
              x={sys.startX}
              y={sys.startY}
              onChange={(m, x, y) =>
                set((s) => {
                  s.startMapId = m;
                  s.startX = x;
                  s.startY = y;
                })
              }
            />
          </fieldset>
          <fieldset>
            <legend>Menu commands</legend>
            <div className="checks">
              {(['item', 'skill', 'equip', 'status', 'save'] as const).map((k) => (
                <Check key={k} label={k[0].toUpperCase() + k.slice(1)} value={sys.menu[k]} onChange={(v) => set((s) => (s.menu[k] = v))} />
              ))}
            </div>
          </fieldset>
        </>
      )}
      {sub === 'audio' && (
        <div className="form-grid">
          <Field label="Title music">
            <AudioPicker kind="bgm" value={sys.titleBgm} onChange={(v) => set((s) => (s.titleBgm = v))} />
          </Field>
          <Field label="Battle music">
            <AudioPicker kind="bgm" value={sys.battleBgm} onChange={(v) => set((s) => (s.battleBgm = v))} />
          </Field>
          <Field label="Victory ME">
            <AudioPicker kind="me" value={sys.victoryMe} onChange={(v) => set((s) => (s.victoryMe = v))} />
          </Field>
          <Field label="Defeat ME">
            <AudioPicker kind="me" value={sys.defeatMe} onChange={(v) => set((s) => (s.defeatMe = v))} />
          </Field>
          <Field label="Game over ME">
            <AudioPicker kind="me" value={sys.gameOverMe} onChange={(v) => set((s) => (s.gameOverMe = v))} />
          </Field>
          {SOUNDS.map(([k, l]) => (
            <Field key={k} label={l}>
              <AudioPicker kind="se" value={sys.sounds[k]} onChange={(v) => set((s) => (s.sounds[k] = v))} />
            </Field>
          ))}
        </div>
      )}
      {sub === 'terms' && <TermsEditor terms={sys.terms} set={(fn) => set((s) => fn(s.terms))} />}
      {sub === 'types' && (
        <div className="types-grid">
          <NameList title="Elements" list={sys.elements} set={(fn) => set((s) => fn(s.elements))} />
          <NameList title="Skill types" list={sys.skillTypes} set={(fn) => set((s) => fn(s.skillTypes))} />
          <NameList title="Weapon types" list={sys.weaponTypes} set={(fn) => set((s) => fn(s.weaponTypes))} />
          <NameList title="Armor types" list={sys.armorTypes} set={(fn) => set((s) => fn(s.armorTypes))} />
          <NameList title="Switches" list={sys.switches} set={(fn) => set((s) => fn(s.switches))} numbered />
          <NameList title="Variables" list={sys.variables} set={(fn) => set((s) => fn(s.variables))} numbered />
        </div>
      )}
    </div>
  );
}

function NameList({ title, list, set, numbered }: { title: string; list: string[]; set: (fn: (l: string[]) => void) => void; numbered?: boolean }) {
  return (
    <fieldset className="name-list">
      <legend>
        {title} ({list.length})
      </legend>
      <div className="name-list-scroll">
        {list.map((n, i) => (
          <Row key={i}>
            <span className="db-id">{String(i + 1).padStart(numbered ? 4 : 2, '0')}</span>
            <TextInput value={n} onChange={(v) => set((l) => void (l[i] = v))} />
          </Row>
        ))}
      </div>
      <Row>
        <button onClick={() => set((l) => void l.push(''))}>＋</button>
        <button disabled={list.length <= 1} onClick={() => set((l) => void l.pop())}>
          −
        </button>
      </Row>
    </fieldset>
  );
}

function TermsEditor({ terms, set }: { terms: Terms; set: (fn: (t: Terms) => void) => void }) {
  const keys = Object.keys(terms).filter((k) => typeof terms[k as keyof Terms] === 'string') as (keyof Terms)[];
  return (
    <>
      <div className="form-grid terms">
        {keys.map((k) => (
          <Field key={k} label={k}>
            <TextInput value={terms[k] as string} onChange={(v) => set((t) => void ((t as unknown as Record<string, string>)[k] = v))} />
          </Field>
        ))}
      </div>
      <fieldset>
        <legend>Parameters</legend>
        <div className="form-grid">
          {terms.params.map((n, i) => (
            <TextInput key={i} value={n} onChange={(v) => set((t) => void (t.params[i] = v))} />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Equipment slots</legend>
        <div className="form-grid">
          {terms.equipSlots.map((n, i) => (
            <TextInput key={i} value={n} onChange={(v) => set((t) => void (t.equipSlots[i] = v))} />
          ))}
        </div>
      </fieldset>
    </>
  );
}

const KINDS: [AssetKind, string, string][] = [
  ['tileset', 'Tileset sheet', 'A grid of tiles. Add it as a sheet in Database → Tilesets.'],
  ['character', 'Character sprite', '3 columns × 4 rows (down, left, right, up), or 12×8 for 8 characters.'],
  ['face', 'Face', 'A single portrait, or a 4×2 grid of portraits.'],
  ['enemy', 'Enemy battler', 'A single image with a transparent background.'],
  ['battleback', 'Battle background', 'Shown behind battles; stretched to the screen.'],
  ['picture', 'Picture', 'Shown with the Show Picture command.'],
  ['title', 'Title screen', 'Background for the title screen.'],
  ['audio', 'Audio (BGM / SE)', 'mp3, ogg or wav. Usable anywhere audio can be chosen.'],
];

export function AssetsEditor() {
  const assets = useEditor((s) => s.project!.assets);
  const update = useEditor((s) => s.update);
  const [kind, setKind] = useState<AssetKind>('character');
  const [layout, setLayout] = useState<'single' | 'multi'>('single');
  const total = assets.reduce((n, a) => n + a.dataUrl.length, 0);

  const upload = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const reader = new FileReader();
      reader.onload = () => {
        const asset: Asset = { id: randomId(), name: file.name.replace(/\.[^.]+$/, ''), kind, dataUrl: String(reader.result) };
        if (kind === 'character' || kind === 'face') asset.layout = layout;
        update('Import asset', (p) => void p.assets.push(asset));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="assets">
      <fieldset>
        <legend>Import</legend>
        <Row>
          <Select value={kind} options={KINDS.map(([k, l]): [AssetKind, string] => [k, l])} onChange={setKind} />
          {(kind === 'character' || kind === 'face') && (
            <Select
              value={layout}
              options={[
                ['single', 'Single'],
                ['multi', kind === 'character' ? '8 characters' : '8 faces'],
              ]}
              onChange={setLayout}
            />
          )}
          <label className="button">
            Choose files…
            <input type="file" multiple hidden accept={kind === 'audio' ? 'audio/*' : 'image/*'} onChange={(e) => (upload(e.target.files), (e.target.value = ''))} />
          </label>
        </Row>
        <p className="hint">{KINDS.find((k) => k[0] === kind)![2]} Files are embedded in the project.</p>
      </fieldset>
      <p className="hint">
        {assets.length} assets · {(total / 1024 / 1024).toFixed(2)} MB embedded
      </p>
      <div className="asset-grid">
        {assets.map((a, i) => (
          <div key={a.id} className="asset-card">
            {a.kind === 'audio' ? <audio controls src={a.dataUrl} /> : <img src={a.dataUrl} alt={a.name} className="pixel" />}
            <TextInput value={a.name} onChange={(v) => update('Rename asset', (p) => void (p.assets[i].name = v), true)} />
            <span className="hint">{KINDS.find((k) => k[0] === a.kind)?.[1]}</span>
            <button className="danger" onClick={() => window.confirm(`Delete asset "${a.name}"?`) && update('Delete asset', (p) => void p.assets.splice(i, 1))}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
