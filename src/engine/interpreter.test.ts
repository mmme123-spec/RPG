import { describe, expect, it } from 'vitest';
import type { EventCommand } from '../core/types';
import { createCommand, constant } from '../core/factory';
import { createEmptyProject } from '../core/project';
import { Interpreter } from './interpreter';
import { makeTestHost } from './testing';

function run(commands: EventCommand[], setup?: (h: ReturnType<typeof makeTestHost>) => void) {
  const project = createEmptyProject();
  const host = makeTestHost(project);
  host.map.setup(1);
  setup?.(host);
  const it = new Interpreter(host, 1);
  it.setup(commands, 0);
  return { host, it };
}

const setVar = (id: number, value: number): EventCommand => ({ type: 'controlVariables', from: id, to: id, op: 'set', operand: constant(value) });

describe('Interpreter', () => {
  it('controls switches and variables', () => {
    const { host, it } = run([
      { type: 'controlSwitches', from: 1, to: 3, value: 'on' },
      { type: 'controlSwitches', from: 2, to: 2, value: 'toggle' },
      setVar(1, 10),
      { type: 'controlVariables', from: 1, to: 1, op: 'mul', operand: constant(3) },
      { type: 'controlVariables', from: 1, to: 1, op: 'sub', operand: constant(5) },
      { type: 'controlVariables', from: 2, to: 2, op: 'set', operand: { kind: 'variable', id: 1 } },
      { type: 'controlVariables', from: 2, to: 2, op: 'mod', operand: constant(7) },
    ]);
    it.update();
    expect(it.isRunning()).toBe(false);
    expect(host.state.getSwitch(1)).toBe(true);
    expect(host.state.getSwitch(2)).toBe(false);
    expect(host.state.getSwitch(3)).toBe(true);
    expect(host.state.getVariable(1)).toBe(25);
    expect(host.state.getVariable(2)).toBe(4);
  });

  it('runs conditional branches', () => {
    const { host, it } = run([
      setVar(1, 5),
      {
        type: 'conditional',
        condition: { kind: 'variable', id: 1, op: '>=', operand: constant(5) },
        then: [setVar(2, 1)],
        else: [setVar(2, 2)],
      },
      {
        type: 'conditional',
        condition: { kind: 'switch', id: 1, value: true },
        then: [setVar(3, 1)],
        else: [setVar(3, 2)],
      },
    ]);
    it.update();
    expect(host.state.getVariable(2)).toBe(1);
    expect(host.state.getVariable(3)).toBe(2);
  });

  it('loops until break', () => {
    const { host, it } = run([
      {
        type: 'loop',
        body: [
          { type: 'controlVariables', from: 1, to: 1, op: 'add', operand: constant(1) },
          {
            type: 'conditional',
            condition: { kind: 'variable', id: 1, op: '>=', operand: constant(10) },
            then: [{ type: 'breakLoop' }],
            else: null,
          },
        ],
      },
      setVar(2, 99),
    ]);
    it.update();
    expect(host.state.getVariable(1)).toBe(10);
    expect(host.state.getVariable(2)).toBe(99);
    expect(it.isRunning()).toBe(false);
  });

  it('jumps to labels, including into nested lists', () => {
    const { host, it } = run([
      { type: 'jumpToLabel', name: 'skip' },
      setVar(1, 1),
      {
        type: 'conditional',
        condition: { kind: 'switch', id: 5, value: true },
        then: [{ type: 'label', name: 'skip' }, setVar(2, 2)],
        else: null,
      },
      setVar(3, 3),
    ]);
    it.update();
    expect(host.state.getVariable(1)).toBe(0);
    expect(host.state.getVariable(2)).toBe(2);
    expect(host.state.getVariable(3)).toBe(3);
  });

  it('waits for messages and handles choices', () => {
    const choices = createCommand('showChoices') as Extract<EventCommand, { type: 'showChoices' }>;
    choices.choices = ['Red', 'Blue'];
    choices.branches = [[setVar(1, 1)], [setVar(1, 2)]];
    const text = { ...(createCommand('showText') as Extract<EventCommand, { type: 'showText' }>), text: 'Pick a colour' };
    const { host, it } = run([text, choices, setVar(2, 7)]);
    it.update();
    expect(host.message.isBusy()).toBe(true);
    expect(host.message.text?.text).toBe('Pick a colour');
    expect(host.message.choices?.items).toEqual(['Red', 'Blue']);
    it.update();
    expect(host.state.getVariable(2)).toBe(0);
    host.message.finish(1);
    it.update();
    expect(host.state.getVariable(1)).toBe(2);
    expect(host.state.getVariable(2)).toBe(7);
    expect(it.isRunning()).toBe(false);
  });

  it('runs the cancel branch for cancelled choices', () => {
    const choices = createCommand('showChoices') as Extract<EventCommand, { type: 'showChoices' }>;
    choices.cancel = -2;
    choices.cancelBranch = [setVar(1, 9)];
    const { host, it } = run([choices]);
    it.update();
    host.message.finish(-2);
    it.update();
    expect(host.state.getVariable(1)).toBe(9);
  });

  it('waits a number of frames', () => {
    const { host, it } = run([{ type: 'wait', frames: 3 }, setVar(1, 1)]);
    it.update();
    expect(host.state.getVariable(1)).toBe(0);
    it.update();
    it.update();
    it.update();
    expect(host.state.getVariable(1)).toBe(1);
  });

  it('changes gold, items and party members', () => {
    const { host, it } = run([
      { type: 'changeGold', op: '+', operand: constant(250) },
      { type: 'changeGold', op: '-', operand: constant(50) },
      { type: 'changeItems', itemKind: 'item', id: 1, op: '+', operand: constant(3) },
      { type: 'changePartyMember', actorId: 2, op: 'add', initialize: true },
    ]);
    it.update();
    expect(host.state.gold).toBe(200);
    expect(host.state.numItems('item', 1)).toBe(3);
    expect(host.state.party).toEqual([1, 2]);
  });

  it('calls common events and branches on battle results', () => {
    const { host, it } = run(
      [
        { type: 'callCommonEvent', commonEventId: 99 },
        {
          type: 'battle',
          troopId: 1,
          canEscape: true,
          canLose: true,
          winBranch: [setVar(1, 1)],
          escapeBranch: [setVar(1, 2)],
          loseBranch: [setVar(1, 3)],
        },
      ],
      (h) => {
        h.data.commonEvents.set(99, { id: 99, name: 'x', trigger: 'none', switchId: 1, commands: [setVar(5, 5)] });
        h.battleResult = 'escape';
      },
    );
    it.update();
    it.update();
    expect(host.state.getVariable(5)).toBe(5);
    expect(host.state.getVariable(1)).toBe(2);
  });

  it('levels actors up with changeExp', () => {
    const { host, it } = run([{ type: 'changeLevel', actorId: 1, op: '+', operand: constant(4), showLevelUp: true }]);
    it.update();
    const leon = host.state.actor(1)!;
    expect(leon.level).toBe(5);
    expect(host.message.text?.text).toContain('Leon is now Level 5!');
    expect(host.message.text?.text).toContain('learned Power Strike');
  });
});
