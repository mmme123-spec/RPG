/** Evaluation of event conditions and value sources. */

import type { CompareOp, Condition, ValueSource } from '../core/types';
import type { EngineHost } from './host';

export interface EvalContext {
  host: EngineHost;
  mapId: number;
  eventId: number;
}

export function compare(a: number, op: CompareOp | '>=' | '<=' | '<', b: number): boolean {
  switch (op) {
    case '==':
      return a === b;
    case '!=':
      return a !== b;
    case '>=':
      return a >= b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '<':
      return a < b;
  }
}

export function evaluateValue(v: ValueSource, ctx: EvalContext): number {
  const { state } = ctx.host;
  switch (v.kind) {
    case 'constant':
      return v.value;
    case 'variable':
      return state.getVariable(v.id);
    case 'random': {
      const lo = Math.min(v.min, v.max);
      const hi = Math.max(v.min, v.max);
      return lo + Math.floor(ctx.host.rng() * (hi - lo + 1));
    }
    case 'script': {
      const r = Number(ctx.host.runScript(v.script));
      return Number.isFinite(r) ? r : 0;
    }
    case 'gameData':
      return gameData(v.data, v.id, v.param, ctx);
  }
}

function gameData(data: string, id: number, param: string, ctx: EvalContext): number {
  const { state, map } = ctx.host;
  switch (data) {
    case 'gold':
      return state.gold;
    case 'steps':
      return state.steps;
    case 'playtime':
      return Math.floor(state.playFrames / 60);
    case 'partySize':
      return state.party.length;
    case 'mapId':
      return ctx.host.map?.mapId ?? 0;
    case 'timer':
      return Math.ceil(state.timer.frames / 60);
    case 'saveCount':
      return state.saveCount;
    case 'battleCount':
      return state.battleCount;
    case 'lastChoice':
      return state.lastChoice;
    case 'item':
      return state.numItems('item', id);
    case 'weapon':
      return state.numItems('weapon', id);
    case 'armor':
      return state.numItems('armor', id);
    case 'actor': {
      const a = state.actor(id);
      if (!a) return 0;
      switch (param) {
        case 'level':
          return a.level;
        case 'exp':
          return a.exp;
        case 'hp':
          return a.hp;
        case 'mp':
          return a.mp;
        case 'mhp':
          return a.mhp;
        case 'mmp':
          return a.mmp;
        case 'atk':
          return a.atk;
        case 'def':
          return a.def;
        case 'mat':
          return a.mat;
        case 'mdf':
          return a.mdf;
        case 'agi':
          return a.agi;
        case 'luk':
          return a.luk;
        default:
          return 0;
      }
    }
    case 'character': {
      const c = map?.character(id, ctx.eventId);
      if (!c) return 0;
      switch (param) {
        case 'x':
          return c.x;
        case 'y':
          return c.y;
        case 'direction':
          return c.direction;
        case 'regionId':
          return map.regionId(c.x, c.y);
        case 'terrainTag':
          return map.terrainTag(c.x, c.y);
        default:
          return 0;
      }
    }
    default:
      return 0;
  }
}

export function evaluateCondition(c: Condition, ctx: EvalContext): boolean {
  const { state, input, map } = ctx.host;
  switch (c.kind) {
    case 'switch':
      return state.getSwitch(c.id) === c.value;
    case 'variable':
      return compare(state.getVariable(c.id), c.op, evaluateValue(c.operand, ctx));
    case 'selfSwitch':
      return state.getSelfSwitch(ctx.mapId, ctx.eventId, c.letter) === c.value;
    case 'timer': {
      const secs = Math.ceil(state.timer.frames / 60);
      return state.timer.working && compare(secs, c.op, c.seconds);
    }
    case 'actor': {
      const a = state.actor(c.actorId);
      if (!a) return false;
      switch (c.check) {
        case 'inParty':
          return state.party.includes(c.actorId);
        case 'name':
          return a.name === c.name;
        case 'skill':
          return a.hasSkill(c.refId);
        case 'weapon':
          return a.equips[0] === c.refId;
        case 'armor':
          return a.equips.slice(1).includes(c.refId);
        case 'state':
          return a.hasState(c.refId);
      }
      return false;
    }
    case 'character': {
      const ch = map?.character(c.target, ctx.eventId);
      return !!ch && ch.direction === c.direction;
    }
    case 'gold':
      return compare(state.gold, c.op, c.value);
    case 'item':
      return state.hasItem('item', c.itemId);
    case 'weapon':
      return state.hasItem('weapon', c.weaponId, c.includeEquip);
    case 'armor':
      return state.hasItem('armor', c.armorId, c.includeEquip);
    case 'button':
      return input.isPressed(c.button);
    case 'script':
      return !!ctx.host.runScript(c.script);
  }
}
