import { describe, expect, it } from 'vitest';
import { builtinTileId } from '../../core/builtins';
import { createCommand, createEvent } from '../../core/factory';
import { createEmptyProject } from '../../core/project';
import type { EventCommand } from '../../core/types';
import { makeTestHost } from '../testing';

function world() {
  const project = createEmptyProject();
  project.system.combatMode = 'turn';
  const map = project.maps[0];
  // a tree trunk at (5,5): impassable
  map.layers[2][5 * map.width + 5] = builtinTileId('treeBottom');
  // tree top at (5,4): star tile, passable
  map.layers[2][4 * map.width + 5] = builtinTileId('treeTop');
  // water at (8,8) with a bridge above it at (8,9)
  map.layers[0][8 * map.width + 8] = builtinTileId('water');
  map.layers[0][9 * map.width + 8] = builtinTileId('water');
  map.layers[1][9 * map.width + 8] = builtinTileId('bridgeV');
  return project;
}

describe('passability', () => {
  it('uses the topmost non-star tile', () => {
    const host = makeTestHost(world());
    host.map.setup(1);
    const m = host.map;
    expect(m.isPassable(5, 5, 2)).toBe(false);
    expect(m.isPassable(5, 4, 2)).toBe(true);
    expect(m.isPassable(8, 8, 2)).toBe(false);
    expect(m.isPassable(8, 9, 2)).toBe(true);
    expect(m.isPassable(1, 1, 2)).toBe(true);
  });
});

describe('player movement', () => {
  it('walks between tiles and is blocked by obstacles', () => {
    const host = makeTestHost(world());
    host.map.setup(1);
    const p = host.map.player;
    p.locate(5, 7);
    host.input.dir = 8;
    host.step(1);
    expect(p.y).toBe(6);
    host.step(40);
    // (5,5) is a trunk: the player stops at (5,6)
    expect(p.y).toBe(6);
    expect(p.direction).toBe(8);
    host.input.dir = 0;
    host.step(5);
    expect(p.realY).toBe(6);
  });

  it('triggers action events in front of the player', () => {
    const project = world();
    const ev = createEvent(1, 3, 2);
    ev.pages[0].commands = [{ type: 'controlVariables', from: 1, to: 1, op: 'set', operand: { kind: 'constant', value: 42 } }];
    project.maps[0].events.push(ev);
    const host = makeTestHost(project);
    host.map.setup(1);
    const p = host.map.player;
    p.locate(3, 3);
    p.setDirection(8);
    host.input.triggered.add('ok');
    host.step(1);
    host.input.triggered.clear();
    host.step(1);
    expect(host.state.getVariable(1)).toBe(42);
  });

  it('switches event pages by condition and self switches', () => {
    const project = world();
    const ev = createEvent(1, 3, 2);
    const p1 = ev.pages[0];
    p1.commands = [{ type: 'controlSelfSwitch', letter: 'A', value: true }];
    const p2 = structuredClone(p1);
    p2.conditions = [{ kind: 'selfSwitch', letter: 'A', value: true }];
    p2.commands = [];
    p2.graphic = { kind: 'character', sheet: 'builtin:chest', index: 0, direction: 8, pattern: 1 };
    ev.pages.push(p2);
    project.maps[0].events.push(ev);
    const host = makeTestHost(project);
    host.map.setup(1);
    const gev = host.map.event(1)!;
    expect(gev.pageIndex).toBe(0);
    host.map.player.locate(3, 3);
    host.map.player.setDirection(8);
    host.input.triggered.add('ok');
    host.step(1);
    host.input.triggered.clear();
    host.step(2);
    expect(host.state.getSelfSwitch(1, 1, 'A')).toBe(true);
    expect(gev.pageIndex).toBe(1);
    expect(gev.direction).toBe(8);
  });

  it('runs autorun events and transfers the player', () => {
    const project = world();
    project.maps.push({ ...structuredClone(project.maps[0]), id: 2, name: 'Second', events: [] });
    const ev = createEvent(1, 0, 0);
    const transfer = createCommand('transferPlayer') as Extract<EventCommand, { type: 'transferPlayer' }>;
    transfer.mapId = 2;
    transfer.x = 4;
    transfer.y = 6;
    ev.pages[0].trigger = 'autorun';
    ev.pages[0].commands = [transfer];
    project.maps[0].events.push(ev);
    const host = makeTestHost(project);
    host.map.setup(1);
    host.step(3);
    expect(host.map.mapId).toBe(2);
    expect(host.map.player.x).toBe(4);
    expect(host.map.player.y).toBe(6);
  });

  it('moves events along forced move routes', () => {
    const project = world();
    const ev = createEvent(1, 10, 10);
    ev.pages[0].graphic = { kind: 'character', sheet: 'builtin:villager', index: 0, direction: 2, pattern: 1 };
    ev.pages[0].trigger = 'autorun';
    ev.pages[0].commands = [
      {
        type: 'setMoveRoute',
        target: 0,
        route: { commands: [{ code: 'moveLeft' }, { code: 'moveLeft' }, { code: 'turnDown' }], repeat: false, skippable: false, wait: true },
      },
      { type: 'eraseEvent' },
    ];
    project.maps[0].events.push(ev);
    const host = makeTestHost(project);
    host.map.setup(1);
    host.map.player.locate(0, 0);
    host.step(120);
    const gev = host.map.event(1)!;
    expect(gev.x).toBe(8);
    expect(gev.erased).toBe(true);
  });
});
