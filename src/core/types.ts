/**
 * RPG Forge project data model.
 *
 * Everything a game is made of lives in one JSON-serialisable `Project`
 * object: maps, events, the database (actors, skills, items, ...), system
 * settings and user-imported assets. The editor edits it; the engine plays it.
 */

/** Numpad-style directions, as in classic RPG makers: 2 down, 4 left, 6 right, 8 up. */
export type Direction = 2 | 4 | 6 | 8;

/** Image/audio references are strings: `builtin:<key>` or `asset:<assetId>`. */
export type ResourceRef = string;

export interface CharacterRef {
  /** `builtin:<name>` or `asset:<id>` */
  sheet: ResourceRef;
  /** Character index on multi-character sheets (0-7). 0 for single sheets. */
  index: number;
}

export interface FaceRef {
  sheet: ResourceRef;
  /** Face index on the sheet (builtin faces: 0 normal, 1 happy, 2 sad, 3 angry). */
  index: number;
}

export interface AudioRef {
  name: ResourceRef;
  /** 0-100 */
  volume: number;
  /** 50-150, percent */
  pitch: number;
}

// ---------------------------------------------------------------------------
// Tilesets & maps
// ---------------------------------------------------------------------------

export interface TileSheet {
  image: ResourceRef;
  /** Source size of one tile in the image, in pixels. */
  tileSize: number;
}

export type AutotileType = 'floor' | 'wall';

export interface AutotileDef {
  name: string;
  image: ResourceRef;
  tileSize: number;
  /** Position of the block's top-left corner, in tiles. */
  x: number;
  y: number;
  /** floor: 2x3 tile block (RPG Maker A2 layout); wall: 2x2 block (A3 layout). */
  type: AutotileType;
  /** Number of animation frames laid out horizontally, each 2 tiles wide. */
  frames: number;
}

export interface Tileset {
  id: number;
  name: string;
  sheets: TileSheet[];
  autotiles: AutotileDef[];
  /** Tile flags keyed by tile id (see tiles.ts for the bit layout). Missing = 0 (passable). */
  flags: Record<number, number>;
  note: string;
}

export interface Encounter {
  troopId: number;
  weight: number;
  /** Region ids where this encounter can happen. Empty = anywhere on the map. */
  regions: number[];
}

export interface GameMap {
  id: number;
  name: string;
  /** Shown briefly on screen when the player enters the map. Empty = not shown. */
  displayName: string;
  parentId: number;
  order: number;
  expanded: boolean;
  width: number;
  height: number;
  tilesetId: number;
  /** LAYER_COUNT layers of width*height tile ids (row-major). */
  layers: number[][];
  /** width*height region ids (0 = none). */
  regions: number[];
  events: MapEvent[];
  bgm: AudioRef | null;
  bgs: AudioRef | null;
  battleback: ResourceRef;
  encounters: Encounter[];
  /** Average number of steps between random encounters. */
  encounterSteps: number;
  disableDash: boolean;
  /** Colour drawn behind the map (visible where layer 1 is empty). */
  bgColor: string;
  note: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SelfSwitchLetter = 'A' | 'B' | 'C' | 'D';
export type CompareOp = '==' | '!=' | '>=' | '<=' | '>' | '<';
export type InputButton = 'ok' | 'cancel' | 'shift' | 'up' | 'down' | 'left' | 'right';

export type GameDataKind =
  | 'gold'
  | 'steps'
  | 'playtime'
  | 'partySize'
  | 'mapId'
  | 'timer'
  | 'saveCount'
  | 'battleCount'
  | 'item'
  | 'weapon'
  | 'armor'
  | 'actor'
  | 'character'
  | 'lastChoice';

export type ActorDataParam =
  | 'level'
  | 'exp'
  | 'hp'
  | 'mp'
  | 'mhp'
  | 'mmp'
  | 'atk'
  | 'def'
  | 'mat'
  | 'mdf'
  | 'agi'
  | 'luk';

export type CharacterDataParam = 'x' | 'y' | 'direction' | 'regionId' | 'terrainTag';

export type ValueSource =
  | { kind: 'constant'; value: number }
  | { kind: 'variable'; id: number }
  | { kind: 'random'; min: number; max: number }
  | { kind: 'gameData'; data: GameDataKind; id: number; param: string }
  | { kind: 'script'; script: string };

export type ActorCheck = 'inParty' | 'name' | 'skill' | 'weapon' | 'armor' | 'state';

export type Condition =
  | { kind: 'switch'; id: number; value: boolean }
  | { kind: 'variable'; id: number; op: CompareOp; operand: ValueSource }
  | { kind: 'selfSwitch'; letter: SelfSwitchLetter; value: boolean }
  | { kind: 'timer'; op: '>=' | '<='; seconds: number }
  | { kind: 'actor'; actorId: number; check: ActorCheck; name: string; refId: number }
  | { kind: 'character'; target: number; direction: Direction }
  | { kind: 'gold'; op: '>=' | '<=' | '<'; value: number }
  | { kind: 'item'; itemId: number }
  | { kind: 'weapon'; weaponId: number; includeEquip: boolean }
  | { kind: 'armor'; armorId: number; includeEquip: boolean }
  | { kind: 'button'; button: InputButton }
  | { kind: 'script'; script: string };

export type MoveCode =
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'moveUp'
  | 'moveLowerLeft'
  | 'moveLowerRight'
  | 'moveUpperLeft'
  | 'moveUpperRight'
  | 'moveRandom'
  | 'moveToward'
  | 'moveAway'
  | 'moveForward'
  | 'moveBackward'
  | 'turnDown'
  | 'turnLeft'
  | 'turnRight'
  | 'turnUp'
  | 'turn90R'
  | 'turn90L'
  | 'turn180'
  | 'turnRandom'
  | 'turnToward'
  | 'turnAway'
  | 'walkAnimeOn'
  | 'walkAnimeOff'
  | 'stepAnimeOn'
  | 'stepAnimeOff'
  | 'dirFixOn'
  | 'dirFixOff'
  | 'throughOn'
  | 'throughOff'
  | 'transparentOn'
  | 'transparentOff';

export type MoveCommand =
  | { code: MoveCode }
  | { code: 'jump'; x: number; y: number }
  | { code: 'wait'; frames: number }
  | { code: 'switchOn' | 'switchOff'; id: number }
  | { code: 'speed'; value: number }
  | { code: 'frequency'; value: number }
  | { code: 'graphic'; sheet: ResourceRef; index: number }
  | { code: 'opacity'; value: number }
  | { code: 'se'; audio: AudioRef }
  | { code: 'script'; script: string };

export interface MoveRoute {
  commands: MoveCommand[];
  repeat: boolean;
  /** Skip a step that can't be performed instead of waiting until it can. */
  skippable: boolean;
  /** The event waits for the route to finish before continuing. */
  wait: boolean;
}

export type EventTrigger = 'action' | 'playerTouch' | 'eventTouch' | 'autorun' | 'parallel';
export type EventPriority = 'below' | 'same' | 'above';
export type MoveType = 'fixed' | 'random' | 'approach' | 'custom';

export type EventGraphic =
  | { kind: 'none' }
  | { kind: 'character'; sheet: ResourceRef; index: number; direction: Direction; pattern: number }
  | { kind: 'tile'; tileId: number };

export interface EventPage {
  /** All conditions must hold for the page to be active. */
  conditions: Condition[];
  graphic: EventGraphic;
  moveType: MoveType;
  moveRoute: MoveRoute;
  /** 1 (slowest) - 6 (fastest), 4 = normal walking speed */
  moveSpeed: number;
  /** 1 (lowest) - 5 (highest) */
  moveFrequency: number;
  walkAnime: boolean;
  stepAnime: boolean;
  directionFix: boolean;
  through: boolean;
  priority: EventPriority;
  trigger: EventTrigger;
  commands: EventCommand[];
}

export interface MapEvent {
  id: number;
  name: string;
  x: number;
  y: number;
  pages: EventPage[];
  note: string;
}

export type BalloonType =
  | 'exclamation'
  | 'question'
  | 'music'
  | 'heart'
  | 'anger'
  | 'sweat'
  | 'frustration'
  | 'silence'
  | 'light'
  | 'zzz';

export type WeatherType = 'none' | 'rain' | 'storm' | 'snow';
export type ItemKind = 'item' | 'weapon' | 'armor';
export type VariableOp = 'set' | 'add' | 'sub' | 'mul' | 'div' | 'mod';

export interface ShopGood {
  kind: ItemKind;
  id: number;
  /** null = use the database price */
  price: number | null;
}

/** Target of character commands: -1 player, 0 this event, >0 event id. */
export type CharacterTarget = number;

export type EventCommand =
  // Messages
  | {
      type: 'showText';
      face: FaceRef | null;
      speaker: string;
      text: string;
      position: 'top' | 'middle' | 'bottom';
      background: 'window' | 'dim' | 'transparent';
    }
  | {
      type: 'showChoices';
      choices: string[];
      branches: EventCommand[][];
      /** -1 cannot cancel, -2 run the cancel branch, >=0 acts as that choice */
      cancel: number;
      cancelBranch: EventCommand[];
      defaultIndex: number;
    }
  | { type: 'inputNumber'; variableId: number; digits: number }
  | { type: 'comment'; text: string }
  // Flow control
  | { type: 'conditional'; condition: Condition; then: EventCommand[]; else: EventCommand[] | null }
  | { type: 'loop'; body: EventCommand[] }
  | { type: 'breakLoop' }
  | { type: 'exitEvent' }
  | { type: 'callCommonEvent'; commonEventId: number }
  | { type: 'label'; name: string }
  | { type: 'jumpToLabel'; name: string }
  // Game progression
  | { type: 'controlSwitches'; from: number; to: number; value: 'on' | 'off' | 'toggle' }
  | { type: 'controlVariables'; from: number; to: number; op: VariableOp; operand: ValueSource }
  | { type: 'controlSelfSwitch'; letter: SelfSwitchLetter; value: boolean }
  | { type: 'controlTimer'; action: 'start' | 'stop'; seconds: number }
  // Party
  | { type: 'changeGold'; op: '+' | '-'; operand: ValueSource }
  | { type: 'changeItems'; itemKind: ItemKind; id: number; op: '+' | '-'; operand: ValueSource }
  | { type: 'changePartyMember'; actorId: number; op: 'add' | 'remove'; initialize: boolean }
  // Actors (actorId 0 = entire party)
  | { type: 'changeHp'; actorId: number; op: '+' | '-'; operand: ValueSource; allowDeath: boolean }
  | { type: 'changeMp'; actorId: number; op: '+' | '-'; operand: ValueSource }
  | { type: 'changeState'; actorId: number; op: 'add' | 'remove'; stateId: number }
  | { type: 'recoverAll'; actorId: number }
  | { type: 'changeExp'; actorId: number; op: '+' | '-'; operand: ValueSource; showLevelUp: boolean }
  | { type: 'changeLevel'; actorId: number; op: '+' | '-'; operand: ValueSource; showLevelUp: boolean }
  | { type: 'changeSkill'; actorId: number; op: 'learn' | 'forget'; skillId: number }
  | { type: 'changeEquipment'; actorId: number; slot: number; itemId: number }
  | { type: 'changeName'; actorId: number; name: string }
  | { type: 'changeActorGraphic'; actorId: number; character: CharacterRef; face: FaceRef | null }
  | { type: 'nameInput'; actorId: number; maxLength: number }
  // Movement
  | {
      type: 'transferPlayer';
      mapId: number;
      x: number;
      y: number;
      /** 0 = keep current direction */
      direction: Direction | 0;
      fade: 'black' | 'white' | 'none';
    }
  | { type: 'setEventLocation'; eventId: number; x: number; y: number; direction: Direction | 0 }
  | { type: 'setMoveRoute'; target: CharacterTarget; route: MoveRoute }
  // Character
  | { type: 'changeTransparency'; transparent: boolean }
  | { type: 'changeFollowers'; visible: boolean }
  | { type: 'showAnimation'; target: CharacterTarget; animation: string; wait: boolean }
  | { type: 'showBalloon'; target: CharacterTarget; balloon: BalloonType; wait: boolean }
  | { type: 'eraseEvent' }
  // Pictures
  | {
      type: 'showPicture';
      pictureId: number;
      image: ResourceRef;
      x: number;
      y: number;
      origin: 'topLeft' | 'center';
      scale: number;
      opacity: number;
    }
  | {
      type: 'movePicture';
      pictureId: number;
      x: number;
      y: number;
      scale: number;
      opacity: number;
      duration: number;
      wait: boolean;
    }
  | { type: 'erasePicture'; pictureId: number }
  // Timing
  | { type: 'wait'; frames: number }
  // Screen
  | { type: 'fadeOut' }
  | { type: 'fadeIn' }
  | { type: 'tintScreen'; tone: [number, number, number, number]; duration: number; wait: boolean }
  | { type: 'flashScreen'; color: [number, number, number, number]; duration: number; wait: boolean }
  | { type: 'shakeScreen'; power: number; speed: number; duration: number; wait: boolean }
  | { type: 'setWeather'; weather: WeatherType; power: number; duration: number; wait: boolean }
  // Audio
  | { type: 'playBgm'; audio: AudioRef | null }
  | { type: 'fadeOutBgm'; seconds: number }
  | { type: 'playBgs'; audio: AudioRef | null }
  | { type: 'playMe'; audio: AudioRef }
  | { type: 'playSe'; audio: AudioRef }
  // Scene control
  | {
      type: 'battle';
      /** 0 = random encounter from the current map */
      troopId: number;
      canEscape: boolean;
      canLose: boolean;
      winBranch: EventCommand[];
      escapeBranch: EventCommand[];
      loseBranch: EventCommand[];
    }
  | { type: 'shop'; goods: ShopGood[]; purchaseOnly: boolean }
  | { type: 'openMenu' }
  | { type: 'openSave' }
  | { type: 'gameOver' }
  | { type: 'returnToTitle' }
  // System
  | { type: 'changeAccess'; access: 'save' | 'menu' | 'encounter'; enabled: boolean }
  // Advanced
  | { type: 'script'; script: string };

export type EventCommandType = EventCommand['type'];

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/** mhp, mmp, atk, def, mat, mdf, agi, luk */
export type ParamArray = [number, number, number, number, number, number, number, number];

export type XParam = 'hit' | 'eva' | 'cri' | 'hrg' | 'mrg';

export type PartyAbility =
  | 'encounterHalf'
  | 'encounterNone'
  | 'goldDouble'
  | 'dropDouble'
  | 'cancelSurprise'
  | 'raisePreemptive';

export type Trait =
  | { kind: 'elementRate'; elementId: number; value: number }
  | { kind: 'stateRate'; stateId: number; value: number }
  | { kind: 'stateResist'; stateId: number }
  | { kind: 'paramRate'; param: number; value: number }
  | { kind: 'xparam'; xparam: XParam; value: number }
  | { kind: 'attackElement'; elementId: number }
  | { kind: 'attackState'; stateId: number; value: number }
  | { kind: 'addSkill'; skillId: number }
  | { kind: 'sealSkillType'; stypeId: number }
  | { kind: 'partyAbility'; ability: PartyAbility };

export interface Actor {
  id: number;
  name: string;
  nickname: string;
  classId: number;
  initialLevel: number;
  maxLevel: number;
  character: CharacterRef;
  face: FaceRef | null;
  /** [weapon, shield, head, body, accessory] item ids, 0 = empty */
  equips: number[];
  traits: Trait[];
  profile: string;
  note: string;
}

export interface ParamCurve {
  /** Value at level 1 */
  base: number;
  /** Value at level 99 */
  max: number;
  /** Curve exponent: 1 linear, <1 grows early, >1 grows late */
  growth: number;
}

export interface Learning {
  level: number;
  skillId: number;
}

export interface ActorClass {
  id: number;
  name: string;
  exp: { basis: number; extra: number; accel: number };
  params: ParamCurve[];
  learnings: Learning[];
  /** Skill type ids that appear as battle commands. */
  skillTypes: number[];
  /** Equippable weapon type ids. */
  weaponTypes: number[];
  /** Equippable armor type ids. */
  armorTypes: number[];
  traits: Trait[];
  note: string;
}

export type Scope =
  | 'none'
  | 'enemy'
  | 'allEnemies'
  | 'randomEnemy'
  | 'ally'
  | 'allAllies'
  | 'deadAlly'
  | 'allDeadAllies'
  | 'user';

export type Occasion = 'always' | 'battle' | 'menu' | 'never';
export type HitType = 'certain' | 'physical' | 'magical';
export type DamageType = 'none' | 'hpDamage' | 'mpDamage' | 'hpRecover' | 'mpRecover' | 'hpDrain' | 'mpDrain';

export interface Damage {
  type: DamageType;
  /** -1 = normal attack (weapon element), 0 = none, >0 element id */
  elementId: number;
  /** JavaScript expression. a = user, b = target, v = variables. */
  formula: string;
  /** percent */
  variance: number;
  critical: boolean;
}

export type Effect =
  | { kind: 'recoverHp'; percent: number; flat: number }
  | { kind: 'recoverMp'; percent: number; flat: number }
  /** stateId 0 = the user's normal attack states */
  | { kind: 'addState'; stateId: number; chance: number }
  | { kind: 'removeState'; stateId: number; chance: number }
  | { kind: 'addBuff'; param: number; turns: number }
  | { kind: 'addDebuff'; param: number; turns: number }
  | { kind: 'growth'; param: number; value: number }
  | { kind: 'learnSkill'; skillId: number }
  | { kind: 'commonEvent'; commonEventId: number };

export interface UsableBase {
  id: number;
  name: string;
  description: string;
  icon: number;
  scope: Scope;
  occasion: Occasion;
  speed: number;
  /** percent */
  successRate: number;
  repeats: number;
  hitType: HitType;
  /** builtin animation key, '' = none, 'attack' = the weapon's animation */
  animation: string;
  damage: Damage;
  effects: Effect[];
  note: string;
}

export interface Skill extends UsableBase {
  /** 0 = none (only usable via Attack/Guard commands or enemies) */
  stypeId: number;
  mpCost: number;
  /** Battle log text. %1 = user name, %2 = skill name */
  message: string;
}

export interface Item extends UsableBase {
  itype: 'regular' | 'key';
  price: number;
  consumable: boolean;
}

export interface Weapon {
  id: number;
  name: string;
  description: string;
  icon: number;
  wtypeId: number;
  price: number;
  params: ParamArray;
  traits: Trait[];
  animation: string;
  note: string;
}

export interface Armor {
  id: number;
  name: string;
  description: string;
  icon: number;
  atypeId: number;
  /** Equipment slot index: 1 shield, 2 head, 3 body, 4 accessory */
  slot: number;
  price: number;
  params: ParamArray;
  traits: Trait[];
  note: string;
}

export interface Drop {
  kind: ItemKind;
  id: number;
  /** Drop chance is 1/denominator */
  denominator: number;
}

export type EnemyActionCondition = 'always' | 'turn' | 'hp' | 'mp' | 'state' | 'partyLevel' | 'switch';

export interface EnemyAction {
  skillId: number;
  /** 1-9, higher = chosen more often */
  rating: number;
  condition: EnemyActionCondition;
  param1: number;
  param2: number;
}

export interface Enemy {
  id: number;
  name: string;
  battler: ResourceRef;
  /** Hue rotation in degrees (0-359) */
  hue: number;
  params: ParamArray;
  exp: number;
  gold: number;
  drops: Drop[];
  actions: EnemyAction[];
  traits: Trait[];
  note: string;
}

export interface TroopMember {
  enemyId: number;
  /** Position on the 640x480 battle screen (bottom-centre of the battler). */
  x: number;
  y: number;
  hidden: boolean;
}

export interface Troop {
  id: number;
  name: string;
  members: TroopMember[];
}

export type StateRestriction = 'none' | 'attackEnemy' | 'attackAnyone' | 'attackAlly' | 'cannotMove';

export interface State {
  id: number;
  name: string;
  icon: number;
  restriction: StateRestriction;
  priority: number;
  removeAtBattleEnd: boolean;
  autoRemoval: 'none' | 'actionEnd' | 'turnEnd';
  minTurns: number;
  maxTurns: number;
  removeByDamage: boolean;
  /** percent */
  damageRemovalChance: number;
  removeByWalking: boolean;
  stepsToRemove: number;
  /** %1 = target name */
  messageActor: string;
  messageEnemy: string;
  messageStay: string;
  messageRemove: string;
  /** CSS colour used to tint affected battlers ('' = none) */
  color: string;
  traits: Trait[];
  note: string;
}

export interface CommonEvent {
  id: number;
  name: string;
  trigger: 'none' | 'autorun' | 'parallel';
  /** The switch that must be ON for autorun/parallel common events. */
  switchId: number;
  commands: EventCommand[];
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export type SystemSound =
  | 'cursor'
  | 'ok'
  | 'cancel'
  | 'buzzer'
  | 'equip'
  | 'save'
  | 'load'
  | 'battleStart'
  | 'escape'
  | 'enemyAttack'
  | 'enemyDamage'
  | 'enemyCollapse'
  | 'actorDamage'
  | 'actorCollapse'
  | 'recovery'
  | 'miss'
  | 'evasion'
  | 'useItem'
  | 'useSkill'
  | 'shop'
  | 'levelUp';

export interface Terms {
  level: string;
  levelA: string;
  hp: string;
  hpA: string;
  mp: string;
  mpA: string;
  exp: string;
  expA: string;
  params: string[];
  fight: string;
  escape: string;
  attack: string;
  guard: string;
  item: string;
  skill: string;
  equip: string;
  status: string;
  save: string;
  gameEnd: string;
  weapon: string;
  armor: string;
  keyItem: string;
  newGame: string;
  continue: string;
  options: string;
  toTitle: string;
  cancel: string;
  buy: string;
  sell: string;
  possession: string;
  equipSlots: string[];
}

export interface SystemSettings {
  gameTitle: string;
  currency: string;
  screenWidth: number;
  screenHeight: number;
  startMapId: number;
  startX: number;
  startY: number;
  startDirection: Direction;
  party: number[];
  startGold: number;
  /** Base colour of message/menu windows. */
  windowColor: string;
  /** 0-255 */
  windowOpacity: number;
  fontSize: number;
  titleBackground: ResourceRef;
  showTitleText: boolean;
  titleBgm: AudioRef | null;
  battleBgm: AudioRef | null;
  victoryMe: AudioRef | null;
  defeatMe: AudioRef | null;
  gameOverMe: AudioRef | null;
  sounds: Record<SystemSound, AudioRef | null>;
  switches: string[];
  variables: string[];
  elements: string[];
  skillTypes: string[];
  weaponTypes: string[];
  armorTypes: string[];
  terms: Terms;
  /** Show party members following the player on the map. */
  followers: boolean;
  /** Run without holding Shift. */
  alwaysDash: boolean;
  /** Skill used by the Attack command. */
  attackSkillId: number;
  /** Skill used by the Guard command. */
  guardSkillId: number;
  menu: { item: boolean; skill: boolean; equip: boolean; status: boolean; save: boolean };
  /**
   * 'action': free movement and real-time shooter combat on the map (mouse aim).
   * 'turn': classic tile movement and turn-based side-view battles.
   */
  combatMode: 'action' | 'turn';
}

// ---------------------------------------------------------------------------
// Assets & project
// ---------------------------------------------------------------------------

export type AssetKind =
  | 'tileset'
  | 'character'
  | 'face'
  | 'enemy'
  | 'battleback'
  | 'picture'
  | 'title'
  | 'audio';

export interface Asset {
  id: string;
  name: string;
  kind: AssetKind;
  /** data: URL of the file contents */
  dataUrl: string;
  /**
   * Characters: 'single' = one character (3x4 frames), 'multi' = 8 characters (12x8 frames).
   * Faces: 'single' = one face, 'multi' = 4x2 faces.
   */
  layout?: 'single' | 'multi';
}

export interface Project {
  format: 'rpgforge-project';
  schema: number;
  id: string;
  system: SystemSettings;
  maps: GameMap[];
  tilesets: Tileset[];
  actors: Actor[];
  classes: ActorClass[];
  skills: Skill[];
  items: Item[];
  weapons: Weapon[];
  armors: Armor[];
  enemies: Enemy[];
  troops: Troop[];
  states: State[];
  commonEvents: CommonEvent[];
  assets: Asset[];
}

/** Keys of the project that hold lists of database entries with numeric ids. */
export type DatabaseKey =
  | 'actors'
  | 'classes'
  | 'skills'
  | 'items'
  | 'weapons'
  | 'armors'
  | 'enemies'
  | 'troops'
  | 'states'
  | 'commonEvents'
  | 'tilesets';
