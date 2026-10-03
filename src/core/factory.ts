/** Factories for fresh, valid data objects. */

import type {
  Actor,
  ActorClass,
  Armor,
  AudioRef,
  CommonEvent,
  Condition,
  Damage,
  Enemy,
  EventCommand,
  EventCommandType,
  EventPage,
  GameMap,
  Item,
  MapEvent,
  MoveRoute,
  ParamArray,
  Skill,
  State,
  SystemSettings,
  Terms,
  Troop,
  ValueSource,
  Weapon,
} from './types';
import { LAYER_COUNT } from './tiles';

export function audio(name: string, volume = 90, pitch = 100): AudioRef {
  return { name, volume, pitch };
}

export function constant(value: number): ValueSource {
  return { kind: 'constant', value };
}

export function emptyRoute(): MoveRoute {
  return { commands: [], repeat: true, skippable: true, wait: false };
}

export function createPage(): EventPage {
  return {
    conditions: [],
    graphic: { kind: 'none' },
    moveType: 'fixed',
    moveRoute: emptyRoute(),
    moveSpeed: 3,
    moveFrequency: 3,
    walkAnime: true,
    stepAnime: false,
    directionFix: false,
    through: false,
    priority: 'same',
    trigger: 'action',
    commands: [],
  };
}

export function createEvent(id: number, x: number, y: number): MapEvent {
  return { id, name: `EV${String(id).padStart(3, '0')}`, x, y, pages: [createPage()], note: '' };
}

export function createMap(id: number, name: string, width = 20, height = 15, tilesetId = 1): GameMap {
  const size = width * height;
  return {
    id,
    name,
    displayName: '',
    parentId: 0,
    order: id,
    expanded: true,
    width,
    height,
    tilesetId,
    layers: Array.from({ length: LAYER_COUNT }, () => new Array<number>(size).fill(0)),
    regions: new Array<number>(size).fill(0),
    events: [],
    bgm: null,
    bgs: null,
    battleback: 'builtin:grassland',
    encounters: [],
    encounterSteps: 30,
    disableDash: false,
    bgColor: '#000000',
    note: '',
  };
}

/** Resize a map, keeping existing tiles anchored at the top-left. */
export function resizeMapData(map: GameMap, width: number, height: number): void {
  const resizeLayer = (src: number[]) => {
    const out = new Array<number>(width * height).fill(0);
    for (let y = 0; y < Math.min(height, map.height); y++) {
      for (let x = 0; x < Math.min(width, map.width); x++) {
        out[y * width + x] = src[y * map.width + x] ?? 0;
      }
    }
    return out;
  };
  map.layers = map.layers.map(resizeLayer);
  map.regions = resizeLayer(map.regions);
  map.events = map.events.filter((ev) => ev.x < width && ev.y < height);
  map.width = width;
  map.height = height;
}

export function params(mhp: number, mmp: number, atk: number, def: number, mat: number, mdf: number, agi: number, luk: number): ParamArray {
  return [mhp, mmp, atk, def, mat, mdf, agi, luk];
}

export function createActor(id: number): Actor {
  return {
    id,
    name: 'New Actor',
    nickname: '',
    classId: 1,
    initialLevel: 1,
    maxLevel: 99,
    character: { sheet: 'builtin:villager', index: 0 },
    face: null,
    equips: [0, 0, 0, 0, 0],
    traits: [],
    profile: '',
    note: '',
  };
}

export function createClass(id: number): ActorClass {
  return {
    id,
    name: 'New Class',
    exp: { basis: 15, extra: 15, accel: 2.2 },
    params: [
      { base: 400, max: 6000, growth: 1 },
      { base: 60, max: 1200, growth: 1 },
      { base: 16, max: 250, growth: 1 },
      { base: 16, max: 250, growth: 1 },
      { base: 16, max: 250, growth: 1 },
      { base: 16, max: 250, growth: 1 },
      { base: 16, max: 250, growth: 1 },
      { base: 16, max: 250, growth: 1 },
    ],
    learnings: [],
    skillTypes: [1],
    weaponTypes: [],
    armorTypes: [],
    traits: [],
    note: '',
  };
}

export function createDamage(): Damage {
  return { type: 'none', elementId: 0, formula: '0', variance: 20, critical: false };
}

export function createSkill(id: number): Skill {
  return {
    id,
    name: 'New Skill',
    description: '',
    icon: 0,
    stypeId: 1,
    mpCost: 0,
    message: '%1 uses %2!',
    scope: 'enemy',
    occasion: 'battle',
    speed: 0,
    successRate: 100,
    repeats: 1,
    hitType: 'certain',
    animation: '',
    damage: createDamage(),
    effects: [],
    note: '',
  };
}

export function createItem(id: number): Item {
  return {
    id,
    name: 'New Item',
    description: '',
    icon: 1,
    itype: 'regular',
    price: 10,
    consumable: true,
    scope: 'ally',
    occasion: 'always',
    speed: 0,
    successRate: 100,
    repeats: 1,
    hitType: 'certain',
    animation: 'heal',
    damage: createDamage(),
    effects: [],
    note: '',
  };
}

export function createWeapon(id: number): Weapon {
  return {
    id,
    name: 'New Weapon',
    description: '',
    icon: 16,
    wtypeId: 1,
    price: 100,
    params: params(0, 0, 10, 0, 0, 0, 0, 0),
    traits: [{ kind: 'attackElement', elementId: 1 }],
    animation: 'slash',
    note: '',
  };
}

export function createArmor(id: number): Armor {
  return {
    id,
    name: 'New Armor',
    description: '',
    icon: 28,
    atypeId: 1,
    slot: 3,
    price: 100,
    params: params(0, 0, 0, 5, 0, 0, 0, 0),
    traits: [],
    note: '',
  };
}

export function createEnemy(id: number): Enemy {
  return {
    id,
    name: 'New Enemy',
    battler: 'builtin:slime',
    hue: 0,
    params: params(100, 0, 12, 8, 8, 8, 8, 8),
    exp: 5,
    gold: 5,
    drops: [],
    actions: [{ skillId: 1, rating: 5, condition: 'always', param1: 0, param2: 0 }],
    traits: [],
    note: '',
  };
}

export function createTroop(id: number): Troop {
  return { id, name: 'New Troop', members: [] };
}

export function createState(id: number): State {
  return {
    id,
    name: 'New State',
    icon: 0,
    restriction: 'none',
    priority: 50,
    removeAtBattleEnd: true,
    autoRemoval: 'turnEnd',
    minTurns: 3,
    maxTurns: 5,
    removeByDamage: false,
    damageRemovalChance: 100,
    removeByWalking: false,
    stepsToRemove: 100,
    messageActor: '%1 is affected!',
    messageEnemy: '%1 is affected!',
    messageStay: '',
    messageRemove: '%1 recovers.',
    color: '',
    traits: [],
    note: '',
  };
}

export function createCommonEvent(id: number): CommonEvent {
  return { id, name: 'New Common Event', trigger: 'none', switchId: 1, commands: [] };
}

export function defaultTerms(): Terms {
  return {
    level: 'Level',
    levelA: 'Lv',
    hp: 'HP',
    hpA: 'HP',
    mp: 'MP',
    mpA: 'MP',
    exp: 'EXP',
    expA: 'EXP',
    params: ['Max HP', 'Max MP', 'Attack', 'Defense', 'M.Attack', 'M.Defense', 'Agility', 'Luck'],
    fight: 'Fight',
    escape: 'Escape',
    attack: 'Attack',
    guard: 'Guard',
    item: 'Item',
    skill: 'Skill',
    equip: 'Equip',
    status: 'Status',
    save: 'Save',
    gameEnd: 'Game End',
    weapon: 'Weapon',
    armor: 'Armor',
    keyItem: 'Key Item',
    newGame: 'New Game',
    continue: 'Continue',
    options: 'Options',
    toTitle: 'To Title',
    cancel: 'Cancel',
    buy: 'Buy',
    sell: 'Sell',
    possession: 'Owned',
    equipSlots: ['Weapon', 'Shield', 'Head', 'Body', 'Accessory'],
  };
}

export function defaultSystem(): SystemSettings {
  const se = (name: string, volume = 80) => audio(`builtin:${name}`, volume);
  return {
    gameTitle: 'My Adventure',
    currency: 'G',
    screenWidth: 640,
    screenHeight: 480,
    startMapId: 1,
    startX: 0,
    startY: 0,
    startDirection: 2,
    party: [1],
    startGold: 0,
    windowColor: '#1d2b5c',
    windowOpacity: 220,
    fontSize: 20,
    titleBackground: 'builtin:castle',
    showTitleText: true,
    titleBgm: audio('builtin:title', 70),
    battleBgm: audio('builtin:battle', 70),
    victoryMe: audio('builtin:victory', 70),
    defeatMe: audio('builtin:gameover', 70),
    gameOverMe: audio('builtin:gameover', 70),
    sounds: {
      cursor: se('cursor', 60),
      ok: se('ok', 70),
      cancel: se('cancel', 70),
      buzzer: se('buzzer', 70),
      equip: se('equip'),
      save: se('save'),
      load: se('load'),
      battleStart: se('battleStart'),
      escape: se('escape'),
      enemyAttack: se('slash'),
      enemyDamage: se('hit'),
      enemyCollapse: se('enemyDie'),
      actorDamage: se('damage'),
      actorCollapse: se('collapse'),
      recovery: se('heal'),
      miss: se('miss'),
      evasion: se('evade'),
      useItem: se('item'),
      useSkill: se('magic'),
      shop: se('coin'),
      levelUp: se('powerUp'),
    },
    switches: Array.from({ length: 20 }, () => ''),
    variables: Array.from({ length: 20 }, () => ''),
    elements: ['Physical', 'Fire', 'Ice', 'Thunder', 'Water', 'Earth', 'Wind', 'Light', 'Darkness'],
    skillTypes: ['Magic', 'Special'],
    weaponTypes: ['Sword', 'Axe', 'Dagger', 'Spear', 'Bow', 'Staff', 'Mace'],
    armorTypes: ['General', 'Light Armor', 'Heavy Armor', 'Robe', 'Small Shield', 'Large Shield'],
    terms: defaultTerms(),
    followers: true,
    alwaysDash: false,
    attackSkillId: 1,
    guardSkillId: 2,
    menu: { item: true, skill: true, equip: true, status: true, save: true },
    combatMode: 'action',
  };
}

export function defaultCondition(): Condition {
  return { kind: 'switch', id: 1, value: true };
}

/** A new command of the given type with sensible defaults. */
export function createCommand(type: EventCommandType): EventCommand {
  switch (type) {
    case 'showText':
      return { type, face: null, speaker: '', text: '', position: 'bottom', background: 'window' };
    case 'showChoices':
      return { type, choices: ['Yes', 'No'], branches: [[], []], cancel: 1, cancelBranch: [], defaultIndex: 0 };
    case 'inputNumber':
      return { type, variableId: 1, digits: 2 };
    case 'comment':
      return { type, text: '' };
    case 'conditional':
      return { type, condition: defaultCondition(), then: [], else: [] };
    case 'loop':
      return { type, body: [] };
    case 'breakLoop':
    case 'exitEvent':
    case 'eraseEvent':
    case 'fadeOut':
    case 'fadeIn':
    case 'openMenu':
    case 'openSave':
    case 'gameOver':
    case 'returnToTitle':
      return { type } as EventCommand;
    case 'callCommonEvent':
      return { type, commonEventId: 1 };
    case 'label':
      return { type, name: 'Label' };
    case 'jumpToLabel':
      return { type, name: 'Label' };
    case 'controlSwitches':
      return { type, from: 1, to: 1, value: 'on' };
    case 'controlVariables':
      return { type, from: 1, to: 1, op: 'set', operand: constant(0) };
    case 'controlSelfSwitch':
      return { type, letter: 'A', value: true };
    case 'controlTimer':
      return { type, action: 'start', seconds: 60 };
    case 'changeGold':
      return { type, op: '+', operand: constant(100) };
    case 'changeItems':
      return { type, itemKind: 'item', id: 1, op: '+', operand: constant(1) };
    case 'changePartyMember':
      return { type, actorId: 1, op: 'add', initialize: false };
    case 'changeHp':
      return { type, actorId: 0, op: '+', operand: constant(100), allowDeath: false };
    case 'changeMp':
      return { type, actorId: 0, op: '+', operand: constant(50) };
    case 'changeState':
      return { type, actorId: 0, op: 'add', stateId: 1 };
    case 'recoverAll':
      return { type, actorId: 0 };
    case 'changeExp':
      return { type, actorId: 0, op: '+', operand: constant(100), showLevelUp: true };
    case 'changeLevel':
      return { type, actorId: 0, op: '+', operand: constant(1), showLevelUp: true };
    case 'changeSkill':
      return { type, actorId: 1, op: 'learn', skillId: 1 };
    case 'changeEquipment':
      return { type, actorId: 1, slot: 0, itemId: 0 };
    case 'changeName':
      return { type, actorId: 1, name: '' };
    case 'changeActorGraphic':
      return { type, actorId: 1, character: { sheet: 'builtin:hero', index: 0 }, face: { sheet: 'builtin:hero', index: 0 } };
    case 'nameInput':
      return { type, actorId: 1, maxLength: 8 };
    case 'transferPlayer':
      return { type, mapId: 1, x: 0, y: 0, direction: 0, fade: 'black' };
    case 'setEventLocation':
      return { type, eventId: 0, x: 0, y: 0, direction: 0 };
    case 'setMoveRoute':
      return { type, target: -1, route: { commands: [], repeat: false, skippable: true, wait: true } };
    case 'changeTransparency':
      return { type, transparent: false };
    case 'changeFollowers':
      return { type, visible: true };
    case 'showAnimation':
      return { type, target: 0, animation: 'sparkle', wait: true };
    case 'showBalloon':
      return { type, target: 0, balloon: 'exclamation', wait: true };
    case 'showPicture':
      return { type, pictureId: 1, image: '', x: 320, y: 240, origin: 'center', scale: 100, opacity: 255 };
    case 'movePicture':
      return { type, pictureId: 1, x: 320, y: 240, scale: 100, opacity: 255, duration: 60, wait: true };
    case 'erasePicture':
      return { type, pictureId: 1 };
    case 'wait':
      return { type, frames: 60 };
    case 'tintScreen':
      return { type, tone: [0, 0, 0, 0], duration: 60, wait: true };
    case 'flashScreen':
      return { type, color: [255, 255, 255, 170], duration: 30, wait: true };
    case 'shakeScreen':
      return { type, power: 5, speed: 5, duration: 30, wait: true };
    case 'setWeather':
      return { type, weather: 'rain', power: 5, duration: 60, wait: false };
    case 'playBgm':
      return { type, audio: audio('builtin:town', 70) };
    case 'fadeOutBgm':
      return { type, seconds: 2 };
    case 'playBgs':
      return { type, audio: audio('builtin:rain', 60) };
    case 'playMe':
      return { type, audio: audio('builtin:itemGet', 80) };
    case 'playSe':
      return { type, audio: audio('builtin:ok', 80) };
    case 'battle':
      return { type, troopId: 1, canEscape: true, canLose: false, winBranch: [], escapeBranch: [], loseBranch: [] };
    case 'shop':
      return { type, goods: [], purchaseOnly: false };
    case 'changeAccess':
      return { type, access: 'save', enabled: true };
    case 'script':
      return { type, script: '' };
  }
}
