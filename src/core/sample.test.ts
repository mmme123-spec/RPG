import { describe, expect, it } from 'vitest';
import type { EventCommand } from './types';
import { createSampleProject } from './sample';
import { normalizeProject } from './project';

function* walk(list: EventCommand[]): Generator<EventCommand> {
  for (const c of list) {
    yield c;
    if (c.type === 'conditional') {
      yield* walk(c.then);
      if (c.else) yield* walk(c.else);
    } else if (c.type === 'showChoices') {
      for (const b of c.branches) yield* walk(b);
      yield* walk(c.cancelBranch);
    } else if (c.type === 'loop') yield* walk(c.body);
    else if (c.type === 'battle') {
      yield* walk(c.winBranch);
      yield* walk(c.escapeBranch);
      yield* walk(c.loseBranch);
    }
  }
}

describe('sample project', () => {
  const p = createSampleProject();

  it('survives normalisation and JSON round trips', () => {
    expect(normalizeProject(JSON.parse(JSON.stringify(p))).maps.length).toBe(p.maps.length);
  });

  it('places the player and every event inside its map', () => {
    const start = p.maps.find((m) => m.id === p.system.startMapId)!;
    expect(p.system.startX).toBeLessThan(start.width);
    for (const m of p.maps) {
      for (const e of m.events) {
        expect(e.x, `${m.name}/${e.name}`).toBeLessThan(m.width);
        expect(e.y, `${m.name}/${e.name}`).toBeLessThan(m.height);
      }
      expect(new Set(m.events.map((e) => e.id)).size).toBe(m.events.length);
    }
  });

  it('only references things that exist', () => {
    for (const m of p.maps)
      for (const e of m.events)
        for (const pg of e.pages)
          for (const c of walk(pg.commands)) {
            const where = `${m.name}/${e.name}: ${c.type}`;
            if (c.type === 'transferPlayer') {
              const t = p.maps.find((x) => x.id === c.mapId);
              expect(t, where).toBeDefined();
              expect(c.x, where).toBeLessThan(t!.width);
              expect(c.y, where).toBeLessThan(t!.height);
              // arriving on a touch-transfer would bounce the player straight back
              expect(t!.events.some((v) => v.x === c.x && v.y === c.y && v.pages[0].trigger === 'playerTouch'), where).toBe(false);
            }
            if (c.type === 'battle') expect(p.troops.some((t) => t.id === c.troopId), where).toBe(true);
            if (c.type === 'changeItems' && c.itemKind === 'item') expect(p.items.some((i) => i.id === c.id), where).toBe(true);
            if (c.type === 'changePartyMember') expect(p.actors.some((a) => a.id === c.actorId), where).toBe(true);
          }
    for (const m of p.maps) for (const enc of m.encounters) expect(p.troops.some((t) => t.id === enc.troopId)).toBe(true);
  });
});
