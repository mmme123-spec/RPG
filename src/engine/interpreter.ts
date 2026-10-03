/**
 * Executes event command lists. Commands are stored as a tree (branches hold
 * child lists), so the interpreter keeps a stack of frames: one per list
 * currently being executed.
 */

import type { EventCommand, ShopGood } from '../core/types';
import { evaluateCondition, evaluateValue } from './conditions';
import type { EngineHost } from './host';
import type { Character } from './map/character';
import type { GameActor, LevelChange } from './state/actor';

interface Frame {
  list: EventCommand[];
  index: number;
  loop: boolean;
}

type WaitMode =
  | 'none'
  | 'message'
  | 'transfer'
  | 'route'
  | 'animation'
  | 'balloon'
  | 'fade'
  | 'scene'
  | 'picture';

/** Child command lists of a command, with a flag telling whether they loop. */
export function childLists(c: EventCommand): [EventCommand[], boolean][] {
  switch (c.type) {
    case 'conditional':
      return c.else ? [[c.then, false], [c.else, false]] : [[c.then, false]];
    case 'loop':
      return [[c.body, true]];
    case 'showChoices':
      return [...c.branches.map((b): [EventCommand[], boolean] => [b, false]), [c.cancelBranch, false]];
    case 'battle':
      return [
        [c.winBranch, false],
        [c.escapeBranch, false],
        [c.loseBranch, false],
      ];
    default:
      return [];
  }
}

function findLabel(list: EventCommand[], name: string, loop: boolean): Frame[] | null {
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c.type === 'label' && c.name === name) return [{ list, index: i + 1, loop }];
    for (const [child, isLoop] of childLists(c)) {
      const sub = findLabel(child, name, isLoop);
      if (sub) return [{ list, index: i + 1, loop }, ...sub];
    }
  }
  return null;
}

const MAX_COMMANDS_PER_FRAME = 5000;

export class Interpreter {
  readonly host: EngineHost;
  mapId: number;
  eventId = 0;
  readonly depth: number;
  private frames: Frame[] = [];
  private root: EventCommand[] = [];
  private child: Interpreter | null = null;
  private waitCount = 0;
  private waitMode: WaitMode = 'none';
  private waitTarget: Character | null = null;
  private waitPicture = 0;
  /** Called when the interpreter finishes (used to unlock events). */
  onFinish: ((eventId: number) => void) | null = null;

  constructor(host: EngineHost, mapId: number, depth = 0) {
    this.host = host;
    this.mapId = mapId;
    this.depth = depth;
  }

  setup(list: EventCommand[], eventId: number): void {
    this.clear();
    this.root = list;
    this.eventId = eventId;
    this.mapId = this.host.map?.mapId ?? this.mapId;
    this.frames = [{ list, index: 0, loop: false }];
  }

  clear(): void {
    this.frames = [];
    this.child = null;
    this.waitCount = 0;
    this.waitMode = 'none';
    this.waitTarget = null;
  }

  isRunning(): boolean {
    return this.frames.length > 0;
  }

  update(): void {
    let steps = 0;
    while (this.isRunning()) {
      if (this.updateChild() || this.updateWait()) return;
      if (++steps > MAX_COMMANDS_PER_FRAME) return;
      if (!this.executeNext()) return;
    }
  }

  private finish(): void {
    const id = this.eventId;
    this.frames = [];
    this.child = null;
    this.onFinish?.(id);
  }

  private updateChild(): boolean {
    if (!this.child) return false;
    this.child.update();
    if (this.child.isRunning()) return true;
    this.child = null;
    return false;
  }

  private updateWait(): boolean {
    if (this.waitCount > 0) {
      this.waitCount--;
      return true;
    }
    const h = this.host;
    let waiting = false;
    switch (this.waitMode) {
      case 'none':
        return false;
      case 'message':
        waiting = h.message.isBusy();
        break;
      case 'transfer':
        waiting = h.isTransferring();
        break;
      case 'route':
        waiting = !!this.waitTarget?.moveRouteForcing;
        break;
      case 'animation':
        waiting = !!this.waitTarget && h.isAnimationPlaying(this.waitTarget);
        break;
      case 'balloon':
        waiting = !!this.waitTarget?.isBalloonPlaying();
        break;
      case 'fade':
        waiting = h.screen.isFading();
        break;
      case 'scene':
        waiting = h.isSceneBusy() || !!h.combatActive?.();
        break;
      case 'picture':
        waiting = h.screen.isPictureMoving(this.waitPicture);
        break;
    }
    if (!waiting) {
      this.waitMode = 'none';
      this.waitTarget = null;
    }
    return waiting;
  }

  private executeNext(): boolean {
    const f = this.frames[this.frames.length - 1];
    if (f.index >= f.list.length) {
      if (f.loop) {
        f.index = 0;
        // a loop that contains nothing that waits yields once per pass to avoid freezing
        return f.list.length > 0;
      }
      this.frames.pop();
      if (!this.isRunning()) this.finish();
      return true;
    }
    const cmd = f.list[f.index++];
    return this.execute(cmd, f);
  }

  private push(list: EventCommand[], loop = false): void {
    if (list.length > 0 || loop) this.frames.push({ list, index: 0, loop });
  }

  private wait(mode: WaitMode, target: Character | null = null): false {
    this.waitMode = mode;
    this.waitTarget = target;
    return false;
  }

  private ctx() {
    return { host: this.host, mapId: this.mapId, eventId: this.eventId };
  }

  private character(target: number): Character | null {
    const map = this.host.map;
    if (!map) return null;
    // events of the map this interpreter started on are gone after a transfer
    if (target >= 0 && map.mapId !== this.mapId) return null;
    return map.character(target, this.eventId);
  }

  private actors(actorId: number): GameActor[] {
    const st = this.host.state;
    if (actorId === 0) return st.members();
    const a = st.actor(actorId);
    return a ? [a] : [];
  }

  private levelMessages(actor: GameActor, change: LevelChange): string[] {
    const lines: string[] = [];
    const t = this.host.data.system.terms;
    if (change.newLevel > change.oldLevel) lines.push(`${actor.name} is now ${t.level} ${change.newLevel}!`);
    for (const id of change.learned) {
      const s = this.host.data.skills.get(id);
      if (s) lines.push(`${actor.name} learned ${s.name}!`);
    }
    return lines;
  }

  private showLines(lines: string[]): boolean {
    if (lines.length === 0) return true;
    this.host.message.show({ face: null, speaker: '', text: lines.join('\n'), position: 'bottom', background: 'window' });
    return this.wait('message');
  }

  private execute(cmd: EventCommand, f: Frame): boolean {
    const h = this.host;
    const st = h.state;
    switch (cmd.type) {
      // --- messages -----------------------------------------------------------
      case 'showText': {
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        const req = { face: cmd.face, speaker: cmd.speaker, text: cmd.text, position: cmd.position, background: cmd.background };
        const next = f.list[f.index];
        if (next?.type === 'showChoices') {
          f.index++;
          this.startChoices(next, req);
        } else if (next?.type === 'inputNumber') {
          f.index++;
          this.startNumber(next.variableId, next.digits, req);
        } else {
          h.message.show(req);
        }
        return this.wait('message');
      }
      case 'showChoices':
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        this.startChoices(cmd, null);
        return this.wait('message');
      case 'inputNumber':
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        this.startNumber(cmd.variableId, cmd.digits, null);
        return this.wait('message');
      case 'comment':
      case 'label':
        return true;

      // --- flow control -----------------------------------------------------------
      case 'conditional':
        if (evaluateCondition(cmd.condition, this.ctx())) this.push(cmd.then);
        else if (cmd.else) this.push(cmd.else);
        return true;
      case 'loop':
        this.push(cmd.body, true);
        return true;
      case 'breakLoop':
        while (this.frames.length > 0) {
          const top = this.frames.pop()!;
          if (top.loop) break;
        }
        if (!this.isRunning()) this.finish();
        return true;
      case 'exitEvent':
        this.finish();
        return true;
      case 'callCommonEvent': {
        const ce = h.data.commonEvents.get(cmd.commonEventId);
        if (ce && this.depth < 100) {
          this.child = new Interpreter(h, this.mapId, this.depth + 1);
          this.child.setup(ce.commands, this.eventId);
        }
        return true;
      }
      case 'jumpToLabel': {
        const path = findLabel(this.root, cmd.name, false);
        if (path) this.frames = path;
        return true;
      }

      // --- game progression ----------------------------------------------------
      case 'controlSwitches':
        for (let id = Math.min(cmd.from, cmd.to); id <= Math.max(cmd.from, cmd.to); id++) {
          st.setSwitch(id, cmd.value === 'toggle' ? !st.getSwitch(id) : cmd.value === 'on');
        }
        return true;
      case 'controlVariables': {
        const value = evaluateValue(cmd.operand, this.ctx());
        for (let id = Math.min(cmd.from, cmd.to); id <= Math.max(cmd.from, cmd.to); id++) {
          const old = st.getVariable(id);
          let v = old;
          switch (cmd.op) {
            case 'set':
              v = value;
              break;
            case 'add':
              v = old + value;
              break;
            case 'sub':
              v = old - value;
              break;
            case 'mul':
              v = old * value;
              break;
            case 'div':
              v = value !== 0 ? Math.trunc(old / value) : old;
              break;
            case 'mod':
              v = value !== 0 ? old % value : old;
              break;
          }
          st.setVariable(id, v);
        }
        return true;
      }
      case 'controlSelfSwitch':
        if (this.eventId > 0) st.setSelfSwitch(this.mapId, this.eventId, cmd.letter, cmd.value);
        return true;
      case 'controlTimer':
        if (cmd.action === 'start') st.timer = { working: true, frames: Math.max(0, cmd.seconds) * 60 };
        else st.timer.working = false;
        st.touch();
        return true;

      // --- party --------------------------------------------------------------------
      case 'changeGold': {
        const v = evaluateValue(cmd.operand, this.ctx());
        st.gainGold(cmd.op === '+' ? v : -v);
        return true;
      }
      case 'changeItems': {
        const v = evaluateValue(cmd.operand, this.ctx());
        st.gainItem(cmd.itemKind, cmd.id, cmd.op === '+' ? v : -v);
        return true;
      }
      case 'changePartyMember':
        if (cmd.op === 'add') st.addActor(cmd.actorId, cmd.initialize);
        else st.removeActor(cmd.actorId);
        h.map?.player.refreshGraphic();
        return true;

      // --- actors -------------------------------------------------------------------
      case 'changeHp': {
        const v = evaluateValue(cmd.operand, this.ctx());
        for (const a of this.actors(cmd.actorId)) {
          if (!a.isAlive()) continue;
          let delta = cmd.op === '+' ? v : -v;
          if (!cmd.allowDeath && a.hp + delta <= 0) delta = 1 - a.hp;
          a.gainHp(delta);
        }
        st.touch();
        if (cmd.allowDeath && st.isAllDead()) {
          h.requestGameOver();
          return this.wait('scene');
        }
        return true;
      }
      case 'changeMp': {
        const v = evaluateValue(cmd.operand, this.ctx());
        for (const a of this.actors(cmd.actorId)) if (a.isAlive()) a.gainMp(cmd.op === '+' ? v : -v);
        st.touch();
        return true;
      }
      case 'changeState':
        for (const a of this.actors(cmd.actorId)) {
          if (cmd.op === 'add') a.addState(cmd.stateId, h.rng);
          else a.removeState(cmd.stateId);
        }
        st.touch();
        if (st.isAllDead()) {
          h.requestGameOver();
          return this.wait('scene');
        }
        return true;
      case 'recoverAll':
        for (const a of this.actors(cmd.actorId)) a.recoverAll();
        st.touch();
        return true;
      case 'changeExp':
      case 'changeLevel': {
        const v = evaluateValue(cmd.operand, this.ctx());
        const lines: string[] = [];
        for (const a of this.actors(cmd.actorId)) {
          const delta = cmd.op === '+' ? v : -v;
          const change = cmd.type === 'changeExp' ? a.gainExp(delta) : a.changeLevel(a.level + delta);
          if (cmd.showLevelUp) lines.push(...this.levelMessages(a, change));
        }
        st.touch();
        return this.showLines(lines);
      }
      case 'changeSkill':
        for (const a of this.actors(cmd.actorId)) {
          if (cmd.op === 'learn') a.learnSkill(cmd.skillId);
          else a.forgetSkill(cmd.skillId);
        }
        st.touch();
        return true;
      case 'changeEquipment': {
        const a = st.actor(cmd.actorId);
        if (a) st.forceEquip(a, cmd.slot, cmd.itemId);
        return true;
      }
      case 'changeName': {
        const a = st.actor(cmd.actorId);
        if (a) a.name = cmd.name;
        st.touch();
        return true;
      }
      case 'changeActorGraphic': {
        const a = st.actor(cmd.actorId);
        if (a) {
          a.character = { ...cmd.character };
          a.face = cmd.face ? { ...cmd.face } : null;
        }
        h.map?.player.refreshGraphic();
        return true;
      }
      case 'nameInput':
        h.requestNameInput(cmd.actorId, cmd.maxLength, () => {});
        return this.wait('scene');

      // --- movement -----------------------------------------------------------------
      case 'transferPlayer':
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        h.requestTransfer(cmd.mapId, cmd.x, cmd.y, cmd.direction, cmd.fade);
        return this.wait('transfer');
      case 'setEventLocation': {
        const c = this.character(cmd.eventId);
        if (c) {
          c.setPosition(cmd.x, cmd.y);
          if (cmd.direction) c.setDirection(cmd.direction);
        }
        return true;
      }
      case 'setMoveRoute': {
        const c = this.character(cmd.target);
        if (!c) return true;
        c.forceMoveRoute(cmd.route);
        if (cmd.route.wait) return this.wait('route', c);
        return true;
      }

      // --- character ----------------------------------------------------------------
      case 'changeTransparency':
        if (h.map) h.map.player.transparent = cmd.transparent;
        return true;
      case 'changeFollowers':
        if (h.map) h.map.player.followersVisible = cmd.visible;
        return true;
      case 'showAnimation': {
        const c = this.character(cmd.target);
        if (!c) return true;
        h.showAnimation(c, cmd.animation);
        return cmd.wait ? this.wait('animation', c) : true;
      }
      case 'showBalloon': {
        const c = this.character(cmd.target);
        if (!c) return true;
        h.startBalloon(c, cmd.balloon);
        return cmd.wait ? this.wait('balloon', c) : true;
      }
      case 'eraseEvent':
        if (this.eventId > 0 && h.map?.mapId === this.mapId) h.map.event(this.eventId)?.erase();
        return true;

      // --- pictures -------------------------------------------------------------------
      case 'showPicture':
        h.screen.showPicture(cmd.pictureId, cmd.image, cmd.x, cmd.y, cmd.origin, cmd.scale, cmd.opacity);
        return true;
      case 'movePicture':
        h.screen.movePicture(cmd.pictureId, cmd.x, cmd.y, cmd.scale, cmd.opacity, cmd.duration);
        if (cmd.wait && cmd.duration > 0) {
          this.waitPicture = cmd.pictureId;
          return this.wait('picture');
        }
        return true;
      case 'erasePicture':
        h.screen.erasePicture(cmd.pictureId);
        return true;

      // --- timing & screen ---------------------------------------------------------
      case 'wait':
        this.waitCount = Math.max(0, cmd.frames);
        return true;
      case 'fadeOut':
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        h.screen.startFadeOut(30);
        return this.wait('fade');
      case 'fadeIn':
        if (h.message.isBusy()) {
          f.index--;
          return false;
        }
        h.screen.startFadeIn(30);
        return this.wait('fade');
      case 'tintScreen':
        h.screen.startTint(cmd.tone, cmd.duration);
        if (cmd.wait) this.waitCount = cmd.duration;
        return true;
      case 'flashScreen':
        h.screen.startFlash(cmd.color, cmd.duration);
        if (cmd.wait) this.waitCount = cmd.duration;
        return true;
      case 'shakeScreen':
        h.screen.startShake(cmd.power, cmd.speed, cmd.duration);
        if (cmd.wait) this.waitCount = cmd.duration;
        return true;
      case 'setWeather':
        h.screen.changeWeather(cmd.weather, cmd.power, cmd.duration);
        if (cmd.wait) this.waitCount = cmd.duration;
        return true;

      // --- audio --------------------------------------------------------------------
      case 'playBgm':
        h.audio.playBgm(cmd.audio);
        return true;
      case 'fadeOutBgm':
        h.audio.fadeOutBgm(cmd.seconds);
        return true;
      case 'playBgs':
        h.audio.playBgs(cmd.audio);
        return true;
      case 'playMe':
        h.audio.playMe(cmd.audio);
        return true;
      case 'playSe':
        h.audio.playSe(cmd.audio);
        return true;

      // --- scenes -------------------------------------------------------------------
      case 'battle': {
        const troopId = cmd.troopId || (h.map ? h.map.pickEncounterTroop(h.map.player.x, h.map.player.y) : 0);
        if (!troopId || !h.data.troops.has(troopId)) return true;
        h.requestBattle(troopId, cmd.canEscape, cmd.canLose, (result) => {
          if (result === 'win') this.push(cmd.winBranch);
          else if (result === 'escape') this.push(cmd.escapeBranch);
          else this.push(cmd.loseBranch);
        });
        return this.wait('scene');
      }
      case 'shop':
        h.requestShop(cmd.goods as ShopGood[], cmd.purchaseOnly, () => {});
        return this.wait('scene');
      case 'openMenu':
        h.requestMenu();
        return this.wait('scene');
      case 'openSave':
        h.requestSave(() => {});
        return this.wait('scene');
      case 'gameOver':
        h.requestGameOver();
        return this.wait('scene');
      case 'returnToTitle':
        h.requestTitle();
        return this.wait('scene');

      // --- system ------------------------------------------------------------------
      case 'changeAccess':
        if (cmd.access === 'save') st.saveEnabled = cmd.enabled;
        else if (cmd.access === 'menu') st.menuEnabled = cmd.enabled;
        else st.encounterEnabled = cmd.enabled;
        st.touch();
        return true;
      case 'script':
        h.runScript(cmd.script, this);
        return true;
    }
  }

  private startChoices(cmd: Extract<EventCommand, { type: 'showChoices' }>, text: Parameters<EngineHost['message']['show']>[0]): void {
    this.host.message.show(
      text,
      { choices: { items: cmd.choices, defaultIndex: cmd.defaultIndex, cancel: cmd.cancel } },
      (result) => {
        if (result === -2) {
          this.host.state.lastChoice = -1;
          this.push(cmd.cancelBranch);
        } else if (result >= 0 && result < cmd.branches.length) {
          this.host.state.lastChoice = result;
          this.push(cmd.branches[result]);
        }
      },
    );
  }

  private startNumber(variableId: number, digits: number, text: Parameters<EngineHost['message']['show']>[0]): void {
    const st = this.host.state;
    this.host.message.show(text, { number: { digits, initial: st.getVariable(variableId) } }, (value) => {
      st.setVariable(variableId, value);
    });
  }
}
