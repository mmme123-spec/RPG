/** Forms for editing event commands, conditions, values and move routes. */

import { useEffect, useRef } from 'react';
import { TileRenderer } from '../../render/tilemap';
import { getImages } from '../components/images';
import type { CompareOp, Condition, Direction, EventCommand, MoveCode, MoveCommand, MoveRoute, ValueSource } from '../../core/types';
import { BUILTIN_ANIMATIONS, BUILTIN_ENEMIES, BUILTIN_TITLES } from '../../core/builtins';
import { AudioPicker, CharacterPicker, Check, FacePicker, Field, IdSelect, NumberInput, Row, Select, SwitchSelect, TextArea, TextInput } from '../components/fields';
import { useEditor } from '../store/store';
import { describeMove } from './commands';

type Cmd<T extends EventCommand['type']> = Extract<EventCommand, { type: T }>;

const DIRS: [number, string][] = [
  [2, 'Down'],
  [4, 'Left'],
  [6, 'Right'],
  [8, 'Up'],
];

function useP() {
  return useEditor((s) => s.project)!;
}

export function ValueEditor({ value, onChange, constantOnly }: { value: ValueSource; onChange: (v: ValueSource) => void; constantOnly?: boolean }) {
  const p = useP();
  const kinds: [ValueSource['kind'], string][] = constantOnly
    ? [
        ['constant', 'Constant'],
        ['variable', 'Variable'],
      ]
    : [
        ['constant', 'Constant'],
        ['variable', 'Variable'],
        ['random', 'Random'],
        ['gameData', 'Game data'],
        ['script', 'Script'],
      ];
  const setKind = (k: ValueSource['kind']) => {
    if (k === 'constant') onChange({ kind: 'constant', value: 0 });
    else if (k === 'variable') onChange({ kind: 'variable', id: 1 });
    else if (k === 'random') onChange({ kind: 'random', min: 0, max: 10 });
    else if (k === 'script') onChange({ kind: 'script', script: '0' });
    else onChange({ kind: 'gameData', data: 'gold', id: 0, param: '' });
  };
  return (
    <Row>
      <Select value={value.kind} options={kinds} onChange={setKind} />
      {value.kind === 'constant' && <NumberInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} />}
      {value.kind === 'variable' && <SwitchSelect variables value={value.id} onChange={(id) => onChange({ ...value, id })} />}
      {value.kind === 'random' && (
        <>
          <NumberInput value={value.min} onChange={(v) => onChange({ ...value, min: v })} />
          <span>to</span>
          <NumberInput value={value.max} onChange={(v) => onChange({ ...value, max: v })} />
        </>
      )}
      {value.kind === 'script' && <TextInput value={value.script} onChange={(script) => onChange({ ...value, script })} />}
      {value.kind === 'gameData' && (
        <>
          <Select
            value={value.data}
            options={(['gold', 'steps', 'playtime', 'partySize', 'mapId', 'timer', 'saveCount', 'battleCount', 'lastChoice', 'item', 'weapon', 'armor', 'actor', 'character'] as const).map((d) => [d, d])}
            onChange={(data) => onChange({ ...value, data, id: data === 'character' ? -1 : 1, param: data === 'actor' ? 'level' : data === 'character' ? 'x' : '' })}
          />
          {value.data === 'item' && <IdSelect value={value.id} list={p.items} onChange={(id) => onChange({ ...value, id })} />}
          {value.data === 'weapon' && <IdSelect value={value.id} list={p.weapons} onChange={(id) => onChange({ ...value, id })} />}
          {value.data === 'armor' && <IdSelect value={value.id} list={p.armors} onChange={(id) => onChange({ ...value, id })} />}
          {value.data === 'actor' && (
            <>
              <IdSelect value={value.id} list={p.actors} onChange={(id) => onChange({ ...value, id })} />
              <Select value={value.param} options={['level', 'exp', 'hp', 'mp', 'mhp', 'mmp', 'atk', 'def', 'mat', 'mdf', 'agi', 'luk'].map((x) => [x, x])} onChange={(param) => onChange({ ...value, param })} />
            </>
          )}
          {value.data === 'character' && (
            <>
              <TargetSelect value={value.id} onChange={(id) => onChange({ ...value, id })} />
              <Select value={value.param} options={['x', 'y', 'direction', 'regionId', 'terrainTag'].map((x) => [x, x])} onChange={(param) => onChange({ ...value, param })} />
            </>
          )}
        </>
      )}
    </Row>
  );
}

export function TargetSelect({ value, onChange, noPlayer }: { value: number; onChange: (v: number) => void; noPlayer?: boolean }) {
  const map = useEditor((s) => s.project!.maps.find((m) => m.id === (s.dialog.kind === 'event' ? s.dialog.mapId : s.mapId)));
  const opts: [number, string][] = [...(noPlayer ? [] : [[-1, 'Player'] as [number, string]]), [0, 'This event'], ...(map?.events ?? []).map((e): [number, string] => [e.id, `${e.id}: ${e.name}`])];
  return <Select value={value} options={opts} onChange={onChange} />;
}

export function ConditionEditor({ value, onChange }: { value: Condition; onChange: (c: Condition) => void }) {
  const p = useP();
  const kinds: [Condition['kind'], string][] = [
    ['switch', 'Switch'],
    ['variable', 'Variable'],
    ['selfSwitch', 'Self switch'],
    ['item', 'Has item'],
    ['weapon', 'Has weapon'],
    ['armor', 'Has armor'],
    ['gold', 'Gold'],
    ['actor', 'Actor'],
    ['character', 'Facing'],
    ['timer', 'Timer'],
    ['button', 'Button held'],
    ['script', 'Script'],
  ];
  const defaults: Record<Condition['kind'], Condition> = {
    switch: { kind: 'switch', id: 1, value: true },
    variable: { kind: 'variable', id: 1, op: '>=', operand: { kind: 'constant', value: 1 } },
    selfSwitch: { kind: 'selfSwitch', letter: 'A', value: true },
    item: { kind: 'item', itemId: 1 },
    weapon: { kind: 'weapon', weaponId: 1, includeEquip: true },
    armor: { kind: 'armor', armorId: 1, includeEquip: true },
    gold: { kind: 'gold', op: '>=', value: 100 },
    actor: { kind: 'actor', actorId: 1, check: 'inParty', name: '', refId: 1 },
    character: { kind: 'character', target: -1, direction: 2 },
    timer: { kind: 'timer', op: '<=', seconds: 0 },
    button: { kind: 'button', button: 'ok' },
    script: { kind: 'script', script: 'true' },
  };
  const c = value;
  return (
    <Row>
      <Select value={c.kind} options={kinds} onChange={(k) => onChange(defaults[k])} />
      {c.kind === 'switch' && (
        <>
          <SwitchSelect value={c.id} onChange={(id) => onChange({ ...c, id })} />
          <Select value={c.value ? 1 : 0} options={[[1, 'is ON'], [0, 'is OFF']]} onChange={(v) => onChange({ ...c, value: v === 1 })} />
        </>
      )}
      {c.kind === 'variable' && (
        <>
          <SwitchSelect variables value={c.id} onChange={(id) => onChange({ ...c, id })} />
          <Select value={c.op} options={(['==', '!=', '>=', '<=', '>', '<'] as CompareOp[]).map((o) => [o, o])} onChange={(op) => onChange({ ...c, op })} />
          <ValueEditor value={c.operand} constantOnly onChange={(operand) => onChange({ ...c, operand })} />
        </>
      )}
      {c.kind === 'selfSwitch' && (
        <>
          <Select value={c.letter} options={(['A', 'B', 'C', 'D'] as const).map((l) => [l, l])} onChange={(letter) => onChange({ ...c, letter })} />
          <Select value={c.value ? 1 : 0} options={[[1, 'is ON'], [0, 'is OFF']]} onChange={(v) => onChange({ ...c, value: v === 1 })} />
        </>
      )}
      {c.kind === 'item' && <IdSelect value={c.itemId} list={p.items} onChange={(itemId) => onChange({ ...c, itemId })} />}
      {c.kind === 'weapon' && <IdSelect value={c.weaponId} list={p.weapons} onChange={(weaponId) => onChange({ ...c, weaponId })} />}
      {c.kind === 'armor' && <IdSelect value={c.armorId} list={p.armors} onChange={(armorId) => onChange({ ...c, armorId })} />}
      {c.kind === 'gold' && (
        <>
          <Select value={c.op} options={[['>=', '≥'], ['<=', '≤'], ['<', '<']] as [typeof c.op, string][]} onChange={(op) => onChange({ ...c, op })} />
          <NumberInput value={c.value} onChange={(v) => onChange({ ...c, value: v })} />
        </>
      )}
      {c.kind === 'actor' && (
        <>
          <IdSelect value={c.actorId} list={p.actors} onChange={(actorId) => onChange({ ...c, actorId })} />
          <Select value={c.check} options={[['inParty', 'is in party'], ['name', 'name is'], ['skill', 'knows skill'], ['weapon', 'has weapon'], ['armor', 'has armor'], ['state', 'has state']]} onChange={(check) => onChange({ ...c, check })} />
          {c.check === 'name' && <TextInput value={c.name} onChange={(name) => onChange({ ...c, name })} />}
          {c.check === 'skill' && <IdSelect value={c.refId} list={p.skills} onChange={(refId) => onChange({ ...c, refId })} />}
          {c.check === 'weapon' && <IdSelect value={c.refId} list={p.weapons} onChange={(refId) => onChange({ ...c, refId })} />}
          {c.check === 'armor' && <IdSelect value={c.refId} list={p.armors} onChange={(refId) => onChange({ ...c, refId })} />}
          {c.check === 'state' && <IdSelect value={c.refId} list={p.states} onChange={(refId) => onChange({ ...c, refId })} />}
        </>
      )}
      {c.kind === 'character' && (
        <>
          <TargetSelect value={c.target} onChange={(target) => onChange({ ...c, target })} />
          <Select value={c.direction} options={DIRS as [Direction, string][]} onChange={(direction) => onChange({ ...c, direction })} />
        </>
      )}
      {c.kind === 'timer' && (
        <>
          <Select value={c.op} options={[['>=', '≥'], ['<=', '≤']] as [typeof c.op, string][]} onChange={(op) => onChange({ ...c, op })} />
          <NumberInput value={c.seconds} min={0} onChange={(seconds) => onChange({ ...c, seconds })} />s
        </>
      )}
      {c.kind === 'button' && <Select value={c.button} options={(['ok', 'cancel', 'shift', 'up', 'down', 'left', 'right'] as const).map((b) => [b, b])} onChange={(button) => onChange({ ...c, button })} />}
      {c.kind === 'script' && <TextInput value={c.script} onChange={(script) => onChange({ ...c, script })} />}
    </Row>
  );
}

const MOVE_BUTTONS: [MoveCode | 'jump' | 'wait' | 'speed' | 'switchOn' | 'switchOff' | 'opacity', string][] = [
  ['moveDown', '↓ Move'],
  ['moveLeft', '← Move'],
  ['moveRight', '→ Move'],
  ['moveUp', '↑ Move'],
  ['moveRandom', 'Random'],
  ['moveToward', 'Toward player'],
  ['moveAway', 'Away'],
  ['moveForward', 'Forward'],
  ['moveBackward', 'Backward'],
  ['jump', 'Jump'],
  ['wait', 'Wait'],
  ['turnDown', 'Turn ↓'],
  ['turnLeft', 'Turn ←'],
  ['turnRight', 'Turn →'],
  ['turnUp', 'Turn ↑'],
  ['turnToward', 'Face player'],
  ['turnAway', 'Turn away'],
  ['turn180', 'Turn 180°'],
  ['turnRandom', 'Turn random'],
  ['speed', 'Speed'],
  ['switchOn', 'Switch ON'],
  ['switchOff', 'Switch OFF'],
  ['throughOn', 'Through ON'],
  ['throughOff', 'Through OFF'],
  ['transparentOn', 'Invisible'],
  ['transparentOff', 'Visible'],
  ['dirFixOn', 'Dir fix ON'],
  ['dirFixOff', 'Dir fix OFF'],
  ['walkAnimeOff', 'Walk anim OFF'],
  ['walkAnimeOn', 'Walk anim ON'],
  ['opacity', 'Opacity'],
];

export function MoveRouteEditor({ value, onChange, showWait = true }: { value: MoveRoute; onChange: (r: MoveRoute) => void; showWait?: boolean }) {
  const add = (code: (typeof MOVE_BUTTONS)[number][0]) => {
    let m: MoveCommand;
    if (code === 'jump') m = { code, x: 0, y: -1 };
    else if (code === 'wait') m = { code, frames: 30 };
    else if (code === 'speed') m = { code, value: 4 };
    else if (code === 'opacity') m = { code, value: 128 };
    else if (code === 'switchOn' || code === 'switchOff') m = { code, id: 1 };
    else m = { code };
    onChange({ ...value, commands: [...value.commands, m] });
  };
  const edit = (i: number, m: MoveCommand) => onChange({ ...value, commands: value.commands.map((c, k) => (k === i ? m : c)) });
  return (
    <div className="move-route">
      <div className="route-list">
        {value.commands.map((m, i) => (
          <div key={i} className="route-item">
            <span>{describeMove(m)}</span>
            {m.code === 'jump' && (
              <>
                <NumberInput value={m.x} onChange={(x) => edit(i, { ...m, x })} />
                <NumberInput value={m.y} onChange={(y) => edit(i, { ...m, y })} />
              </>
            )}
            {(m.code === 'wait' && <NumberInput value={m.frames} min={1} onChange={(frames) => edit(i, { ...m, frames })} />) || null}
            {(m.code === 'speed' || m.code === 'opacity') && <NumberInput value={m.value} onChange={(v) => edit(i, { ...m, value: v })} />}
            {(m.code === 'switchOn' || m.code === 'switchOff') && <SwitchSelect value={m.id} onChange={(id) => edit(i, { ...m, id })} />}
            <button onClick={() => onChange({ ...value, commands: value.commands.filter((_, k) => k !== i) })}>✕</button>
          </div>
        ))}
        {value.commands.length === 0 && <div className="hint">Click buttons on the right to add steps.</div>}
      </div>
      <div className="route-buttons">
        {MOVE_BUTTONS.map(([code, label]) => (
          <button key={code} onClick={() => add(code)}>
            {label}
          </button>
        ))}
      </div>
      <Row>
        <Check label="Repeat" value={value.repeat} onChange={(repeat) => onChange({ ...value, repeat })} />
        <Check label="Skip if blocked" value={value.skippable} onChange={(skippable) => onChange({ ...value, skippable })} />
        {showWait && <Check label="Wait for completion" value={value.wait} onChange={(wait) => onChange({ ...value, wait })} />}
      </Row>
    </div>
  );
}

function ActorSelect({ value, onChange, allowParty }: { value: number; onChange: (v: number) => void; allowParty?: boolean }) {
  const p = useP();
  return <IdSelect value={value} list={p.actors} onChange={onChange} none={allowParty ? 'Entire party' : undefined} />;
}

function OpRow({ op, operand, onOp, onOperand }: { op: '+' | '-'; operand: ValueSource; onOp: (o: '+' | '-') => void; onOperand: (v: ValueSource) => void }) {
  return (
    <Row>
      <Select value={op} options={[['+', 'Increase'], ['-', 'Decrease']]} onChange={onOp} />
      <ValueEditor value={operand} constantOnly onChange={onOperand} />
    </Row>
  );
}

/** Form body for one command. `c` is a working copy; call `on` with the updated command. */
export function CommandForm({ c, on }: { c: EventCommand; on: (c: EventCommand) => void }) {
  const p = useP();
  const set = <T extends EventCommand>(patch: Partial<T>) => on({ ...c, ...patch } as EventCommand);
  switch (c.type) {
    case 'showText':
      return (
        <div className="form-grid">
          <Field label="Face">
            <FacePicker value={c.face} onChange={(face) => set({ face })} />
          </Field>
          <Field label="Speaker name">
            <TextInput value={c.speaker} onChange={(speaker) => set({ speaker })} />
          </Field>
          <Field label="Text (\V[n] variable, \N[n] actor, \C[n] colour, \I[n] icon, \G currency, \. \| waits)" wide>
            <TextArea rows={5} value={c.text} onChange={(text) => set({ text })} />
          </Field>
          <Field label="Position">
            <Select value={c.position} options={[['bottom', 'Bottom'], ['middle', 'Middle'], ['top', 'Top']]} onChange={(position) => set({ position })} />
          </Field>
          <Field label="Background">
            <Select value={c.background} options={[['window', 'Window'], ['dim', 'Dim'], ['transparent', 'Transparent']]} onChange={(background) => set({ background })} />
          </Field>
        </div>
      );
    case 'showChoices': {
      const cc = c as Cmd<'showChoices'>;
      return (
        <div>
          {cc.choices.map((ch, i) => (
            <Row key={i}>
              <TextInput value={ch} onChange={(v) => set({ choices: cc.choices.map((x, k) => (k === i ? v : x)) })} />
              <button
                disabled={cc.choices.length <= 1}
                onClick={() => set({ choices: cc.choices.filter((_, k) => k !== i), branches: cc.branches.filter((_, k) => k !== i) })}
              >
                ✕
              </button>
            </Row>
          ))}
          {cc.choices.length < 6 && <button onClick={() => set({ choices: [...cc.choices, `Choice ${cc.choices.length + 1}`], branches: [...cc.branches, []] })}>＋ Add choice</button>}
          <Field label="When cancelled">
            <Select value={cc.cancel} options={[[-1, 'Disallow'], [-2, 'Separate branch'], ...cc.choices.map((ch, i): [number, string] => [i, `Same as "${ch}"`])]} onChange={(cancel) => set({ cancel })} />
          </Field>
          <Field label="Default choice">
            <Select value={cc.defaultIndex} options={cc.choices.map((ch, i): [number, string] => [i, ch])} onChange={(defaultIndex) => set({ defaultIndex })} />
          </Field>
        </div>
      );
    }
    case 'inputNumber':
      return (
        <Row>
          <Field label="Store in variable">
            <SwitchSelect variables value={c.variableId} onChange={(variableId) => set({ variableId })} />
          </Field>
          <Field label="Digits">
            <NumberInput value={c.digits} min={1} max={8} onChange={(digits) => set({ digits })} />
          </Field>
        </Row>
      );
    case 'comment':
      return <TextArea value={c.text} onChange={(text) => set({ text })} />;
    case 'conditional':
      return (
        <div>
          <ConditionEditor value={c.condition} onChange={(condition) => set({ condition })} />
          <Check label='Include "Else" branch' value={c.else !== null} onChange={(v) => set({ else: v ? (c.else ?? []) : null })} />
        </div>
      );
    case 'callCommonEvent':
      return <IdSelect value={c.commonEventId} list={p.commonEvents} onChange={(commonEventId) => set({ commonEventId })} />;
    case 'label':
    case 'jumpToLabel':
      return <TextInput value={c.name} onChange={(name) => set({ name })} />;
    case 'wait':
      return (
        <Field label="Frames (60 = 1 second)">
          <NumberInput value={c.frames} min={1} max={9999} onChange={(frames) => set({ frames })} />
        </Field>
      );
    case 'controlSwitches':
      return (
        <Row>
          <SwitchSelect value={c.from} onChange={(from) => set({ from, to: Math.max(from, c.to === c.from ? from : c.to) })} />
          <span>to</span>
          <SwitchSelect value={c.to} onChange={(to) => set({ to })} />
          <Select value={c.value} options={[['on', 'ON'], ['off', 'OFF'], ['toggle', 'Toggle']]} onChange={(value) => set({ value })} />
        </Row>
      );
    case 'controlVariables':
      return (
        <div>
          <Row>
            <SwitchSelect variables value={c.from} onChange={(from) => set({ from, to: c.to === c.from ? from : Math.max(from, c.to) })} />
            <span>to</span>
            <SwitchSelect variables value={c.to} onChange={(to) => set({ to })} />
          </Row>
          <Row>
            <Select value={c.op} options={[['set', 'Set ='], ['add', 'Add +='], ['sub', 'Sub -='], ['mul', 'Mul *='], ['div', 'Div /='], ['mod', 'Mod %=']]} onChange={(op) => set({ op })} />
            <ValueEditor value={c.operand} onChange={(operand) => set({ operand })} />
          </Row>
        </div>
      );
    case 'controlSelfSwitch':
      return (
        <Row>
          <Select value={c.letter} options={(['A', 'B', 'C', 'D'] as const).map((l) => [l, l])} onChange={(letter) => set({ letter })} />
          <Select value={c.value ? 1 : 0} options={[[1, 'ON'], [0, 'OFF']]} onChange={(v) => set({ value: v === 1 })} />
        </Row>
      );
    case 'controlTimer':
      return (
        <Row>
          <Select value={c.action} options={[['start', 'Start'], ['stop', 'Stop']]} onChange={(action) => set({ action })} />
          {c.action === 'start' && <NumberInput value={c.seconds} min={1} onChange={(seconds) => set({ seconds })} />}
        </Row>
      );
    case 'changeAccess':
      return (
        <Row>
          <Select value={c.access} options={[['save', 'Save'], ['menu', 'Menu'], ['encounter', 'Encounters']]} onChange={(access) => set({ access })} />
          <Select value={c.enabled ? 1 : 0} options={[[1, 'Enable'], [0, 'Disable']]} onChange={(v) => set({ enabled: v === 1 })} />
        </Row>
      );
    case 'changeGold':
      return <OpRow op={c.op} operand={c.operand} onOp={(op) => set({ op })} onOperand={(operand) => set({ operand })} />;
    case 'changeItems': {
      const list = c.itemKind === 'item' ? p.items : c.itemKind === 'weapon' ? p.weapons : p.armors;
      return (
        <div>
          <Row>
            <Select value={c.itemKind} options={[['item', 'Item'], ['weapon', 'Weapon'], ['armor', 'Armor']]} onChange={(itemKind) => set({ itemKind, id: 1 })} />
            <IdSelect value={c.id} list={list} onChange={(id) => set({ id })} />
          </Row>
          <OpRow op={c.op} operand={c.operand} onOp={(op) => set({ op })} onOperand={(operand) => set({ operand })} />
        </div>
      );
    }
    case 'changePartyMember':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <Select value={c.op} options={[['add', 'Add'], ['remove', 'Remove']]} onChange={(op) => set({ op })} />
          <Check label="Initialize" value={c.initialize} onChange={(initialize) => set({ initialize })} />
        </Row>
      );
    case 'changeHp':
    case 'changeMp':
    case 'changeExp':
    case 'changeLevel':
      return (
        <div>
          <ActorSelect allowParty value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <OpRow op={c.op} operand={c.operand} onOp={(op) => set({ op })} onOperand={(operand) => set({ operand })} />
          {c.type === 'changeHp' && <Check label="Allow knockout" value={c.allowDeath} onChange={(allowDeath) => set({ allowDeath })} />}
          {(c.type === 'changeExp' || c.type === 'changeLevel') && <Check label="Show level up" value={c.showLevelUp} onChange={(showLevelUp) => set({ showLevelUp })} />}
        </div>
      );
    case 'changeState':
      return (
        <Row>
          <ActorSelect allowParty value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <Select value={c.op} options={[['add', 'Add'], ['remove', 'Remove']]} onChange={(op) => set({ op })} />
          <IdSelect value={c.stateId} list={p.states} onChange={(stateId) => set({ stateId })} />
        </Row>
      );
    case 'recoverAll':
      return <ActorSelect allowParty value={c.actorId} onChange={(actorId) => set({ actorId })} />;
    case 'changeSkill':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <Select value={c.op} options={[['learn', 'Learn'], ['forget', 'Forget']]} onChange={(op) => set({ op })} />
          <IdSelect value={c.skillId} list={p.skills} onChange={(skillId) => set({ skillId })} />
        </Row>
      );
    case 'changeEquipment':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <Select value={c.slot} options={p.system.terms.equipSlots.map((s, i): [number, string] => [i, s])} onChange={(slot) => set({ slot, itemId: 0 })} />
          <IdSelect value={c.itemId} list={c.slot === 0 ? p.weapons : p.armors.filter((a) => a.slot === c.slot)} none="(none)" onChange={(itemId) => set({ itemId })} />
        </Row>
      );
    case 'changeName':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <TextInput value={c.name} onChange={(name) => set({ name })} />
        </Row>
      );
    case 'changeActorGraphic':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <CharacterPicker value={c.character} onChange={(character) => character && set({ character })} />
          <FacePicker value={c.face} onChange={(face) => set({ face })} />
        </Row>
      );
    case 'nameInput':
      return (
        <Row>
          <ActorSelect value={c.actorId} onChange={(actorId) => set({ actorId })} />
          <Field label="Max length">
            <NumberInput value={c.maxLength} min={1} max={16} onChange={(maxLength) => set({ maxLength })} />
          </Field>
        </Row>
      );
    case 'transferPlayer':
      return <LocationForm mapId={c.mapId} x={c.x} y={c.y} onChange={(mapId, x, y) => set({ mapId, x, y })} extra={
        <Row>
          <Field label="Direction">
            <Select value={c.direction} options={[[0, 'Retain'], ...DIRS] as [0 | Direction, string][]} onChange={(direction) => set({ direction })} />
          </Field>
          <Field label="Fade">
            <Select value={c.fade} options={[['black', 'Black'], ['white', 'White'], ['none', 'None']]} onChange={(fade) => set({ fade })} />
          </Field>
        </Row>
      } />;
    case 'setEventLocation':
      return (
        <div>
          <TargetSelect noPlayer value={c.eventId} onChange={(eventId) => set({ eventId })} />
          <Row>
            X <NumberInput value={c.x} min={0} onChange={(x) => set({ x })} /> Y <NumberInput value={c.y} min={0} onChange={(y) => set({ y })} />
            <Select value={c.direction} options={[[0, 'Retain'], ...DIRS] as [0 | Direction, string][]} onChange={(direction) => set({ direction })} />
          </Row>
        </div>
      );
    case 'setMoveRoute':
      return (
        <div>
          <Field label="Character">
            <TargetSelect value={c.target} onChange={(target) => set({ target })} />
          </Field>
          <MoveRouteEditor value={c.route} onChange={(route) => set({ route })} />
        </div>
      );
    case 'changeTransparency':
      return <Check label="Player is transparent" value={c.transparent} onChange={(transparent) => set({ transparent })} />;
    case 'changeFollowers':
      return <Check label="Followers visible" value={c.visible} onChange={(visible) => set({ visible })} />;
    case 'showAnimation':
      return (
        <Row>
          <TargetSelect value={c.target} onChange={(target) => set({ target })} />
          <Select value={c.animation} options={BUILTIN_ANIMATIONS.map((a): [string, string] => [a.key, a.label])} onChange={(animation) => set({ animation })} />
          <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
        </Row>
      );
    case 'showBalloon':
      return (
        <Row>
          <TargetSelect value={c.target} onChange={(target) => set({ target })} />
          <Select value={c.balloon} options={(['exclamation', 'question', 'music', 'heart', 'anger', 'sweat', 'frustration', 'silence', 'light', 'zzz'] as const).map((b) => [b, b])} onChange={(balloon) => set({ balloon })} />
          <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
        </Row>
      );
    case 'showPicture':
      return (
        <div className="form-grid">
          <Field label="Picture #">
            <NumberInput value={c.pictureId} min={1} max={50} onChange={(pictureId) => set({ pictureId })} />
          </Field>
          <Field label="Image">
            <Select
              value={c.image}
              options={[['', '(choose)'], ...p.assets.filter((a) => a.kind !== 'audio').map((a): [string, string] => [`asset:${a.id}`, a.name]), ...BUILTIN_ENEMIES.map((e): [string, string] => [`builtin:${e.key}`, `Enemy: ${e.label}`]), ...BUILTIN_TITLES.map((e): [string, string] => [`builtin:${e.key}`, `Scene: ${e.label}`])]}
              onChange={(image) => set({ image })}
            />
          </Field>
          <Field label="Position X / Y">
            <Row>
              <NumberInput value={c.x} onChange={(x) => set({ x })} />
              <NumberInput value={c.y} onChange={(y) => set({ y })} />
            </Row>
          </Field>
          <Field label="Origin">
            <Select value={c.origin} options={[['center', 'Center'], ['topLeft', 'Top left']]} onChange={(origin) => set({ origin })} />
          </Field>
          <Field label="Scale %">
            <NumberInput value={c.scale} min={1} onChange={(scale) => set({ scale })} />
          </Field>
          <Field label="Opacity">
            <NumberInput value={c.opacity} min={0} max={255} onChange={(opacity) => set({ opacity })} />
          </Field>
        </div>
      );
    case 'movePicture':
      return (
        <div className="form-grid">
          <Field label="Picture #">
            <NumberInput value={c.pictureId} min={1} onChange={(pictureId) => set({ pictureId })} />
          </Field>
          <Field label="X / Y">
            <Row>
              <NumberInput value={c.x} onChange={(x) => set({ x })} />
              <NumberInput value={c.y} onChange={(y) => set({ y })} />
            </Row>
          </Field>
          <Field label="Scale %">
            <NumberInput value={c.scale} onChange={(scale) => set({ scale })} />
          </Field>
          <Field label="Opacity">
            <NumberInput value={c.opacity} min={0} max={255} onChange={(opacity) => set({ opacity })} />
          </Field>
          <Field label="Duration (frames)">
            <NumberInput value={c.duration} min={0} onChange={(duration) => set({ duration })} />
          </Field>
          <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
        </div>
      );
    case 'erasePicture':
      return <NumberInput value={c.pictureId} min={1} onChange={(pictureId) => set({ pictureId })} />;
    case 'tintScreen':
    case 'flashScreen': {
      const arr = c.type === 'tintScreen' ? c.tone : c.color;
      const labels = c.type === 'tintScreen' ? ['Red', 'Green', 'Blue', 'Gray'] : ['Red', 'Green', 'Blue', 'Strength'];
      const key = c.type === 'tintScreen' ? 'tone' : 'color';
      return (
        <div>
          {c.type === 'tintScreen' && (
            <Row>
              {[
                ['Normal', [0, 0, 0, 0]],
                ['Dark', [-68, -68, -68, 0]],
                ['Night', [-68, -68, 0, 68]],
                ['Sunset', [68, -34, -34, 0]],
                ['Sepia', [34, -34, -68, 170]],
              ].map(([n, t]) => (
                <button key={n as string} onClick={() => set({ tone: t as [number, number, number, number] })}>
                  {n as string}
                </button>
              ))}
            </Row>
          )}
          {arr.map((v, i) => (
            <Row key={i}>
              <span className="mini-label">{labels[i]}</span>
              <input type="range" min={c.type === 'tintScreen' && i < 3 ? -255 : 0} max={255} value={v} onChange={(e) => set({ [key]: arr.map((x, k) => (k === i ? Number(e.target.value) : x)) } as never)} />
              <span>{v}</span>
            </Row>
          ))}
          <Row>
            Duration <NumberInput value={c.duration} min={1} onChange={(duration) => set({ duration })} /> <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
          </Row>
        </div>
      );
    }
    case 'shakeScreen':
      return (
        <Row>
          Power <NumberInput value={c.power} min={1} max={9} onChange={(power) => set({ power })} /> Speed <NumberInput value={c.speed} min={1} max={9} onChange={(speed) => set({ speed })} /> Frames <NumberInput value={c.duration} min={1} onChange={(duration) => set({ duration })} />
          <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
        </Row>
      );
    case 'setWeather':
      return (
        <Row>
          <Select value={c.weather} options={[['none', 'None'], ['rain', 'Rain'], ['storm', 'Storm'], ['snow', 'Snow']]} onChange={(weather) => set({ weather })} />
          Power <NumberInput value={c.power} min={1} max={9} onChange={(power) => set({ power })} /> Frames <NumberInput value={c.duration} min={0} onChange={(duration) => set({ duration })} />
          <Check label="Wait" value={c.wait} onChange={(wait) => set({ wait })} />
        </Row>
      );
    case 'playBgm':
      return <AudioPicker kind="bgm" value={c.audio} onChange={(audio) => set({ audio })} />;
    case 'playBgs':
      return <AudioPicker kind="bgs" value={c.audio} onChange={(audio) => set({ audio })} />;
    case 'playMe':
      return <AudioPicker kind="me" allowNone={false} value={c.audio} onChange={(audio) => audio && set({ audio })} />;
    case 'playSe':
      return <AudioPicker kind="se" allowNone={false} value={c.audio} onChange={(audio) => audio && set({ audio })} />;
    case 'fadeOutBgm':
      return (
        <Row>
          Seconds <NumberInput value={c.seconds} min={0} max={60} onChange={(seconds) => set({ seconds })} />
        </Row>
      );
    case 'battle':
      return (
        <div>
          <IdSelect value={c.troopId} list={p.troops} none="Random encounter (map)" onChange={(troopId) => set({ troopId })} />
          <Check label="Can escape" value={c.canEscape} onChange={(canEscape) => set({ canEscape })} />
          <Check label="Continue if defeated" value={c.canLose} onChange={(canLose) => set({ canLose })} />
        </div>
      );
    case 'shop':
      return (
        <div>
          {c.goods.map((g, i) => {
            const list = g.kind === 'item' ? p.items : g.kind === 'weapon' ? p.weapons : p.armors;
            const upd = (patch: Partial<typeof g>) => set({ goods: c.goods.map((x, k) => (k === i ? { ...x, ...patch } : x)) });
            return (
              <Row key={i}>
                <Select value={g.kind} options={[['item', 'Item'], ['weapon', 'Weapon'], ['armor', 'Armor']]} onChange={(kind) => upd({ kind, id: 1 })} />
                <IdSelect value={g.id} list={list} onChange={(id) => upd({ id })} />
                <Check label="Custom price" value={g.price !== null} onChange={(v) => upd({ price: v ? (list.find((x) => x.id === g.id)?.price ?? 0) : null })} />
                {g.price !== null && <NumberInput value={g.price} min={0} onChange={(price) => upd({ price })} />}
                <button onClick={() => set({ goods: c.goods.filter((_, k) => k !== i) })}>✕</button>
              </Row>
            );
          })}
          <button onClick={() => set({ goods: [...c.goods, { kind: 'item', id: 1, price: null }] })}>＋ Add goods</button>
          <Check label="Purchase only" value={c.purchaseOnly} onChange={(purchaseOnly) => set({ purchaseOnly })} />
        </div>
      );
    case 'script':
      return (
        <div>
          <p className="hint">JavaScript. Available: game, state, map, player, data, $gameVariables, $gameSwitches, $gameParty, $gamePlayer, $gameMap.</p>
          <TextArea rows={8} value={c.script} onChange={(script) => set({ script })} />
        </div>
      );
    default:
      return <p className="hint">This command has no settings.</p>;
  }
}

/** Map + x/y picker with a clickable mini map. */
export function LocationForm({ mapId, x, y, onChange, extra }: { mapId: number; x: number; y: number; onChange: (mapId: number, x: number, y: number) => void; extra?: React.ReactNode }) {
  const p = useP();
  const map = p.maps.find((m) => m.id === mapId);
  return (
    <div>
      <Row>
        <IdSelect value={mapId} list={p.maps} onChange={(m) => onChange(m, 0, 0)} />
        X <NumberInput value={x} min={0} max={(map?.width ?? 1) - 1} onChange={(v) => onChange(mapId, v, y)} />
        Y <NumberInput value={y} min={0} max={(map?.height ?? 1) - 1} onChange={(v) => onChange(mapId, x, v)} />
      </Row>
      {map && <MiniMap mapId={mapId} x={x} y={y} onPick={(px, py) => onChange(mapId, px, py)} />}
      {extra}
    </div>
  );
}


export function MiniMap({ mapId, x, y, onPick }: { mapId: number; x: number; y: number; onPick: (x: number, y: number) => void }) {
  const p = useP();
  const map = p.maps.find((m) => m.id === mapId)!;
  const ref = useRef<HTMLCanvasElement>(null);
  const cell = Math.max(4, Math.min(16, Math.floor(480 / Math.max(map.width, map.height))));
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = map.width * cell;
    c.height = map.height * cell;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const ts = p.tilesets.find((t) => t.id === map.tilesetId) ?? p.tilesets[0];
    const tr = new TileRenderer(getImages(), ts);
    for (let l = 0; l < 4; l++) tr.drawLayer(ctx, map, l, 0, 0, map.width, map.height, 0, 0, 0, 'all', cell);
    ctx.strokeStyle = '#ff3b30';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
  });
  return (
    <div className="minimap">
      <canvas
        ref={ref}
        className="pixel"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const sx = e.currentTarget.width / r.width;
          onPick(Math.floor(((e.clientX - r.left) * sx) / cell), Math.floor(((e.clientY - r.top) * sx) / cell));
        }}
      />
    </div>
  );
}

