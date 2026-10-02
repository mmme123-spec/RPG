/** Event editor modal: pages, conditions, graphic, movement and the command list. */

import { useEffect, useState } from 'react';
import type { EventCommand, EventCommandType, EventPage, MapEvent } from '../../core/types';
import { createCommand, createPage, defaultCondition } from '../../core/factory';
import { CharacterPicker, Check, Field, Modal, Row, Select, TextInput } from '../components/fields';
import { useEditor } from '../store/store';
import { COMMAND_GROUPS, COMMAND_LABEL, flatten, resolveList, type ListPath } from './commands';
import { CommandForm, ConditionEditor, MoveRouteEditor } from './CommandForms';

let clipboard: EventCommand[] | null = null;

/** Commands that open a form immediately when inserted (those with nothing to edit don't). */
const NO_FORM = new Set<EventCommandType>([
  'exitEvent',
  'gameOver',
  'returnToTitle',
  'openMenu',
  'openSave',
  'eraseEvent',
  'recoverAll',
  'breakLoop',
  'loop',
  'fadeOut',
  'fadeIn',
]);

export function EventEditor(props: { mapId: number; eventId: number; onClose: () => void }) {
  const exists = useEditor((s) => !!s.project?.maps.find((m) => m.id === props.mapId)?.events.some((e) => e.id === props.eventId));
  return exists ? <EventEditorInner {...props} /> : null;
}

function EventEditorInner({ mapId, eventId, onClose }: { mapId: number; eventId: number; onClose: () => void }) {
  const project = useEditor((s) => s.project)!;
  const update = useEditor((s) => s.update);
  const ev = project.maps.find((m) => m.id === mapId)!.events.find((e) => e.id === eventId)!;
  const [pageIdx, setPageIdx] = useState(0);

  const page = ev.pages[Math.min(pageIdx, ev.pages.length - 1)];
  const pi = ev.pages.indexOf(page);

  const setEv = (fn: (e: MapEvent) => void, coalesce = true) =>
    update(
      'Edit event',
      (p) => {
        const e = p.maps.find((m) => m.id === mapId)?.events.find((x) => x.id === eventId);
        if (e) fn(e);
      },
      coalesce,
    );
  const setPage = (fn: (pg: EventPage) => void, coalesce = true) => setEv((e) => fn(e.pages[pi]), coalesce);

  const g = page.graphic;
  return (
    <Modal title={`Event ${String(ev.id).padStart(3, '0')} — (${ev.x}, ${ev.y})`} onClose={onClose} wide>
      <div className="event-head">
        <Field label="Name">
          <TextInput value={ev.name} onChange={(v) => setEv((e) => (e.name = v))} />
        </Field>
        <Field label="Note">
          <TextInput value={ev.note} onChange={(v) => setEv((e) => (e.note = v))} />
        </Field>
        <div className="page-actions">
          <button
            onClick={() => {
              setEv((e) => e.pages.push(createPage()), false);
              setPageIdx(ev.pages.length);
            }}
          >
            New page
          </button>
          <button
            onClick={() => {
              setEv((e) => e.pages.splice(pi + 1, 0, structuredClone(e.pages[pi])), false);
              setPageIdx(pi + 1);
            }}
          >
            Copy page
          </button>
          <button
            disabled={ev.pages.length <= 1}
            onClick={() => {
              setEv((e) => e.pages.splice(pi, 1), false);
              setPageIdx(Math.max(0, pi - 1));
            }}
          >
            Delete page
          </button>
        </div>
      </div>
      <div className="page-tabs">
        {ev.pages.map((_, i) => (
          <button key={i} className={i === pi ? 'sel' : ''} onClick={() => setPageIdx(i)}>
            {i + 1}
          </button>
        ))}
        <span className="hint">The highest-numbered page whose conditions are met is active.</span>
      </div>
      <div className="event-body">
        <div className="event-side">
          <fieldset>
            <legend>Conditions</legend>
            {page.conditions.map((c, i) => (
              <Row key={i}>
                <ConditionEditor value={c} onChange={(v) => setPage((pg) => void (pg.conditions[i] = v))} />
                <button onClick={() => setPage((pg) => void pg.conditions.splice(i, 1), false)}>✕</button>
              </Row>
            ))}
            <button onClick={() => setPage((pg) => void pg.conditions.push(defaultCondition()), false)}>＋ Condition</button>
          </fieldset>
          <fieldset>
            <legend>Graphic</legend>
            <Select
              value={g.kind}
              options={[
                ['none', '(None)'],
                ['character', 'Character'],
                ['tile', 'Tile'],
              ]}
              onChange={(k) =>
                setPage((pg) => {
                  if (k === 'none') pg.graphic = { kind: 'none' };
                  else if (k === 'character') pg.graphic = { kind: 'character', sheet: 'builtin:villager', index: 0, direction: 2, pattern: 1 };
                  else pg.graphic = { kind: 'tile', tileId: useEditor.getState().brush.tiles[0]?.[0] || 1 };
                }, false)
              }
            />
            {g.kind === 'character' && (
              <>
                <CharacterPicker
                  value={{ sheet: g.sheet, index: g.index }}
                  onChange={(v) => v && setPage((pg) => void (pg.graphic = { ...g, sheet: v.sheet, index: v.index }), false)}
                />
                <Field label="Direction">
                  <Select
                    value={g.direction}
                    options={[
                      [2, 'Down'],
                      [4, 'Left'],
                      [6, 'Right'],
                      [8, 'Up'],
                    ]}
                    onChange={(d) => setPage((pg) => void (pg.graphic = { ...g, direction: d }))}
                  />
                </Field>
              </>
            )}
            {g.kind === 'tile' && (
              <Row>
                <span>Tile #{g.tileId}</span>
                <button onClick={() => setPage((pg) => void (pg.graphic = { kind: 'tile', tileId: useEditor.getState().brush.tiles[0]?.[0] || 1 }), false)}>
                  Use palette selection
                </button>
              </Row>
            )}
          </fieldset>
          <fieldset>
            <legend>Autonomous movement</legend>
            <Field label="Type">
              <Select
                value={page.moveType}
                options={[
                  ['fixed', 'Fixed'],
                  ['random', 'Random'],
                  ['approach', 'Approach player'],
                  ['custom', 'Custom route'],
                ]}
                onChange={(v) => setPage((pg) => void (pg.moveType = v))}
              />
            </Field>
            <Row>
              <Field label="Speed">
                <Select
                  value={page.moveSpeed}
                  options={[1, 2, 3, 4, 5, 6].map((n): [number, string] => [
                    n,
                    ['1: Slowest', '2: Slower', '3: Slow', '4: Normal', '5: Fast', '6: Fastest'][n - 1],
                  ])}
                  onChange={(v) => setPage((pg) => void (pg.moveSpeed = v))}
                />
              </Field>
              <Field label="Frequency">
                <Select
                  value={page.moveFrequency}
                  options={[1, 2, 3, 4, 5].map((n): [number, string] => [n, ['1: Lowest', '2: Lower', '3: Normal', '4: Higher', '5: Highest'][n - 1]])}
                  onChange={(v) => setPage((pg) => void (pg.moveFrequency = v))}
                />
              </Field>
            </Row>
            {page.moveType === 'custom' && (
              <MoveRouteEditor value={page.moveRoute} showWait={false} onChange={(r) => setPage((pg) => void (pg.moveRoute = r))} />
            )}
          </fieldset>
          <fieldset>
            <legend>Options</legend>
            <Check label="Walking animation" value={page.walkAnime} onChange={(v) => setPage((pg) => void (pg.walkAnime = v))} />
            <Check label="Stepping animation" value={page.stepAnime} onChange={(v) => setPage((pg) => void (pg.stepAnime = v))} />
            <Check label="Direction fix" value={page.directionFix} onChange={(v) => setPage((pg) => void (pg.directionFix = v))} />
            <Check label="Through" value={page.through} onChange={(v) => setPage((pg) => void (pg.through = v))} />
          </fieldset>
          <Row>
            <Field label="Priority">
              <Select
                value={page.priority}
                options={[
                  ['below', 'Below characters'],
                  ['same', 'Same as characters'],
                  ['above', 'Above characters'],
                ]}
                onChange={(v) => setPage((pg) => void (pg.priority = v))}
              />
            </Field>
            <Field label="Trigger">
              <Select
                value={page.trigger}
                options={[
                  ['action', 'Action button'],
                  ['playerTouch', 'Player touch'],
                  ['eventTouch', 'Event touch'],
                  ['autorun', 'Autorun'],
                  ['parallel', 'Parallel'],
                ]}
                onChange={(v) => setPage((pg) => void (pg.trigger = v))}
              />
            </Field>
          </Row>
        </div>
        <CommandList commands={page.commands} edit={(fn) => setPage((pg) => fn(pg.commands), false)} />
      </div>
    </Modal>
  );
}

/** Editable, nested command list (used by map events and common events). */
export function CommandList({ commands, edit }: { commands: EventCommand[]; edit: (fn: (list: EventCommand[]) => void) => void }) {
  const project = useEditor((s) => s.project)!;
  const [sel, setSel] = useState<number | null>(null);
  const [picker, setPicker] = useState<{ path: ListPath; index: number } | null>(null);
  const [editing, setEditing] = useState<{ path: ListPath; index: number; cmd: EventCommand; isNew: boolean } | null>(null);
  const rows = flatten(commands, project);
  const selRow = sel !== null ? rows[sel] : null;

  const insert = (path: ListPath, index: number, cmds: EventCommand[]) => edit((l) => void resolveList(l, path).splice(index, 0, ...structuredClone(cmds)));
  const remove = (path: ListPath, index: number) => edit((l) => void resolveList(l, path).splice(index, 1));
  const replace = (path: ListPath, index: number, c: EventCommand) => edit((l) => void (resolveList(l, path)[index] = c));
  const cmdAt = (path: ListPath, index: number) => resolveList(commands, path)[index];

  const startInsert = (path: ListPath, index: number) => setPicker({ path, index });
  const chooseType = (t: EventCommandType) => {
    if (!picker) return;
    const cmd = createCommand(t);
    setPicker(null);
    if (NO_FORM.has(t)) insert(picker.path, picker.index, [cmd]);
    else setEditing({ ...picker, cmd, isNew: true });
  };
  const editRow = (i: number) => {
    const r = rows[i];
    if (!r) return;
    if (r.kind === 'end') return startInsert(r.path, r.index);
    if (r.kind === 'command') {
      const c = cmdAt(r.path, r.index);
      if (!NO_FORM.has(c.type)) setEditing({ path: r.path, index: r.index, cmd: structuredClone(c), isNew: false });
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || picker || sel === null || (e.target as HTMLElement).closest('input,textarea,select')) return;
      const r = rows[sel];
      if (!r) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Delete' && r.kind === 'command') {
        e.preventDefault();
        remove(r.path, r.index);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        editRow(sel);
      } else if (mod && e.key === 'c' && r.kind === 'command') {
        clipboard = [structuredClone(cmdAt(r.path, r.index))];
        useEditor.getState().notify('Command copied');
      } else if (mod && e.key === 'x' && r.kind === 'command') {
        clipboard = [structuredClone(cmdAt(r.path, r.index))];
        remove(r.path, r.index);
      } else if (mod && e.key === 'v' && clipboard && r.kind !== 'label') {
        e.preventDefault();
        insert(r.path, r.index, clipboard);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel(Math.min(rows.length - 1, sel + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel(Math.max(0, sel - 1));
      } else return;
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <>
      <div className="event-commands">
        <div className="cmd-toolbar">
          <b>Contents</b>
          <span className="hint">Double-click ◆ to add · Enter edit · Del delete · Ctrl+C/X/V</span>
          <button disabled={!selRow || selRow.kind === 'label'} onClick={() => selRow && startInsert(selRow.path, selRow.index)}>
            Insert
          </button>
          <button disabled={!selRow || selRow.kind !== 'command'} onClick={() => sel !== null && editRow(sel)}>
            Edit
          </button>
          <button disabled={!selRow || selRow.kind !== 'command'} onClick={() => selRow && remove(selRow.path, selRow.index)}>
            Delete
          </button>
        </div>
        <div className="cmd-list" tabIndex={0}>
          {rows.map((r, i) => (
            <div
              key={i}
              className={`cmd-row ${r.kind}${i === sel ? ' sel' : ''}`}
              style={{ paddingLeft: 8 + r.depth * 18, color: r.color }}
              onClick={() => setSel(i)}
              onDoubleClick={() => editRow(i)}
            >
              {r.text}
            </div>
          ))}
        </div>
      </div>
      {picker && <CommandPicker onPick={chooseType} onClose={() => setPicker(null)} />}
      {editing && (
        <CommandDialog
          cmd={editing.cmd}
          onCancel={() => setEditing(null)}
          onOk={(c) => {
            if (editing.isNew) insert(editing.path, editing.index, [c]);
            else replace(editing.path, editing.index, c);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CommandPicker({ onPick, onClose }: { onPick: (t: EventCommandType) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const groups = COMMAND_GROUPS.map((g) => ({ ...g, items: g.items.filter(([, l]) => l.toLowerCase().includes(q.toLowerCase())) })).filter(
    (g) => g.items.length,
  );
  return (
    <Modal title="Insert command" onClose={onClose} wide>
      <input
        className="search"
        autoFocus
        placeholder="Search commands…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && groups[0] && onPick(groups[0].items[0][0])}
      />
      <div className="cmd-groups">
        {groups.map((g) => (
          <div key={g.name} className="cmd-group">
            <h4>{g.name}</h4>
            {g.items.map(([t, label]) => (
              <button key={t} onClick={() => onPick(t)}>
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function CommandDialog({ cmd, onOk, onCancel }: { cmd: EventCommand; onOk: (c: EventCommand) => void; onCancel: () => void }) {
  const [c, setC] = useState(cmd);
  return (
    <Modal
      title={COMMAND_LABEL[c.type] ?? c.type}
      onClose={onCancel}
      footer={
        <>
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" onClick={() => onOk(c)}>
            OK
          </button>
        </>
      }
    >
      <CommandForm c={c} on={setC} />
    </Modal>
  );
}
