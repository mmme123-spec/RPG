/**
 * The sample game "The Ember Crystal": a small but complete adventure that
 * shows off maps, events, shops, an inn, a party member joining, random
 * encounters, treasure chests and a boss fight.
 */

import type { AudioRef, Condition, Direction, EventCommand, EventPage, GameMap, MapEvent, Project } from './types';
import { builtinTileId } from './builtins';
import { createEvent, createMap, createPage } from './factory';
import { createBlankProject } from './project';
import { mulberry32 } from './util';

// --- switches -------------------------------------------------------------
const SW_INTRO = 1;
const SW_QUEST = 2;
const SW_MIRA = 3;
const SW_BOSS = 4;

// --- map ids --------------------------------------------------------------
const VILLAGE = 1;
const ELDER = 2;
const INN = 3;
const FIELD = 4;
const CAVE = 5;

const bgm = (name: string, volume = 70): AudioRef => ({ name: `builtin:${name}`, volume, pitch: 100 });
const se = (name: string): AudioRef => ({ name: `builtin:${name}`, volume: 80, pitch: 100 });

// --- map painting helpers ---------------------------------------------------

class Painter {
  constructor(readonly map: GameMap) {}
  set(layer: number, x: number, y: number, key: string | 0): void {
    const m = this.map;
    if (x < 0 || y < 0 || x >= m.width || y >= m.height) return;
    m.layers[layer][y * m.width + x] = key === 0 ? 0 : builtinTileId(key);
  }
  get(layer: number, x: number, y: number): number {
    return this.map.layers[layer][y * this.map.width + x] ?? 0;
  }
  rect(layer: number, x: number, y: number, w: number, h: number, key: string | 0): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(layer, i, j, key);
  }
  /** Two-tile tall object: base at (x, y), top drawn above characters at (x, y-1). */
  tall(x: number, y: number, top: string, bottom: string): void {
    this.set(2, x, y, bottom);
    this.set(3, x, y - 1, top);
  }
  tree(x: number, y: number, kind: 'tree' | 'pine' = 'tree'): void {
    this.tall(x, y, `${kind}Top`, `${kind}Bottom`);
  }
  region(x: number, y: number, w: number, h: number, id: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.map.regions[j * this.map.width + i] = id;
  }
}

/** A house front: two roof rows above a wall row with windows and a door. */
function house(p: Painter, x: number, y: number, w: number, doorX: number, roof: 'roofRed' | 'roofBlue'): void {
  p.rect(0, x, y, w, 2, roof);
  p.rect(0, x, y + 2, w, 1, 'houseWall');
  for (let i = x + 1; i < x + w - 1; i += 2) if (i !== doorX && i !== doorX - 1 && i !== doorX + 1) p.set(1, i, y + 2, 'window');
  p.set(1, doorX, y + 2, 'door');
  p.set(1, x + w - 2, y - 1, 0);
  p.set(3, x + w - 2, y - 1, 'chimney');
}

/** An interior room surrounded by a wall-top border, with a wall face along the top. */
function room(p: Painter, w: number, h: number, floor: string, wall: string): void {
  p.rect(0, 0, 0, w, h, 'wallTop');
  p.rect(0, 1, 1, w - 2, 2, wall);
  p.rect(0, 1, 3, w - 2, h - 4, floor);
}

// --- event helpers ----------------------------------------------------------

type Cmd = EventCommand;

const say = (speaker: string, text: string, face?: string, faceIndex = 0): Cmd => ({
  type: 'showText',
  face: face ? { sheet: `builtin:${face}`, index: faceIndex } : null,
  speaker,
  text,
  position: 'bottom',
  background: 'window',
});
const narrate = (text: string): Cmd => ({ type: 'showText', face: null, speaker: '', text, position: 'middle', background: 'dim' });
const sw = (id: number, value: 'on' | 'off' = 'on'): Cmd => ({ type: 'controlSwitches', from: id, to: id, value });
const selfSw = (letter: 'A' | 'B' = 'A', value = true): Cmd => ({ type: 'controlSelfSwitch', letter, value });
const gold = (n: number): Cmd => ({ type: 'changeGold', op: n >= 0 ? '+' : '-', operand: { kind: 'constant', value: Math.abs(n) } });
const giveItem = (id: number, n = 1, itemKind: 'item' | 'weapon' | 'armor' = 'item'): Cmd => ({ type: 'changeItems', itemKind, id, op: '+', operand: { kind: 'constant', value: n } });
const transfer = (mapId: number, x: number, y: number, direction: Direction | 0 = 0): Cmd => ({ type: 'transferPlayer', mapId, x, y, direction, fade: 'black' });
const playSe = (name: string): Cmd => ({ type: 'playSe', audio: se(name) });
const ifCond = (condition: Condition, then: Cmd[], otherwise: Cmd[] | null = null): Cmd => ({ type: 'conditional', condition, then, else: otherwise });
const choices = (list: [string, Cmd[]][], cancel = list.length - 1): Cmd => ({
  type: 'showChoices',
  choices: list.map((c) => c[0]),
  branches: list.map((c) => c[1]),
  cancel,
  cancelBranch: [],
  defaultIndex: 0,
});

function page(o: Partial<EventPage> & { sprite?: string; dir?: Direction }): EventPage {
  const pg = createPage();
  const { sprite, dir, ...rest } = o;
  if (sprite) pg.graphic = { kind: 'character', sheet: `builtin:${sprite}`, index: 0, direction: dir ?? 2, pattern: 1 };
  Object.assign(pg, rest);
  return pg;
}

function event(map: GameMap, name: string, x: number, y: number, pages: EventPage[]): MapEvent {
  const ev = createEvent(map.events.length + 1, x, y);
  ev.name = name;
  ev.pages = pages;
  map.events.push(ev);
  return ev;
}

function npc(map: GameMap, name: string, x: number, y: number, sprite: string, commands: Cmd[], moveType: EventPage['moveType'] = 'random'): MapEvent {
  return event(map, name, x, y, [page({ sprite, moveType, moveFrequency: 3, commands })]);
}

/** A touch-triggered transfer (doors, map edges). */
function door(map: GameMap, x: number, y: number, to: [number, number, number, Direction], sound = true): MapEvent {
  return event(map, 'Door', x, y, [
    page({ trigger: 'playerTouch', priority: 'below', commands: [...(sound ? [playSe('door')] : []), transfer(to[0], to[1], to[2], to[3])] }),
  ]);
}

function chest(map: GameMap, x: number, y: number, give: Cmd, label: string): MapEvent {
  const open = page({ sprite: 'chest', dir: 8, directionFix: true, conditions: [{ kind: 'selfSwitch', letter: 'A', value: true }] });
  const closed = page({
    sprite: 'chest',
    dir: 2,
    directionFix: true,
    stepAnime: false,
    walkAnime: false,
    commands: [
      playSe('chest'),
      { type: 'setMoveRoute', target: 0, route: { commands: [{ code: 'dirFixOff' }, { code: 'turnLeft' }, { code: 'wait', frames: 3 }, { code: 'turnRight' }, { code: 'wait', frames: 3 }, { code: 'turnUp' }], repeat: false, skippable: false, wait: true } } as Cmd,
      give,
      say('', `Found \\C[6]${label}\\C[0]!`),
      selfSw('A'),
    ],
  });
  return event(map, 'Chest', x, y, [closed, open]);
}

// --- maps -------------------------------------------------------------------

function buildVillage(): GameMap {
  const m = createMap(VILLAGE, 'Willowbrook', 30, 22, 1);
  m.displayName = 'Willowbrook Village';
  m.bgm = bgm('town');
  m.battleback = 'builtin:grassland';
  const p = new Painter(m);
  p.rect(0, 0, 0, 30, 22, 'grass');
  // main road
  p.rect(0, 2, 11, 26, 2, 'cobble');
  p.rect(0, 14, 11, 2, 11, 'cobble');
  // border trees with a gap in the south
  for (let x = 0; x < 30; x++) {
    p.tree(x, 1, x % 2 ? 'pine' : 'tree');
    if (x < 13 || x > 16) p.tree(x, 21, x % 2 ? 'tree' : 'pine');
  }
  for (let y = 2; y < 21; y++) {
    p.tree(0, y, y % 2 ? 'tree' : 'pine');
    p.tree(29, y, y % 2 ? 'pine' : 'tree');
  }
  // Elder's house and the inn
  house(p, 3, 4, 7, 6, 'roofRed');
  p.rect(0, 6, 7, 1, 4, 'cobble');
  house(p, 19, 4, 8, 23, 'roofBlue');
  p.rect(0, 23, 7, 1, 4, 'cobble');
  p.set(2, 25, 7, 'signInn');
  // market stall
  p.rect(2, 5, 15, 4, 1, 'counter');
  p.set(2, 4, 15, 'signItem');
  p.set(2, 9, 14, 'barrel');
  p.set(2, 9, 15, 'crate');
  p.set(2, 4, 14, 'barrel');
  // pond with a bridge-less shore
  p.rect(0, 20, 15, 6, 4, 'water');
  p.set(1, 21, 16, 'lilyPad');
  p.set(1, 24, 17, 'lilyPad');
  // decoration
  const rng = mulberry32(7);
  const flowers = ['flowersRed', 'flowersYellow', 'flowersBlue', 'grassTuft'];
  for (let i = 0; i < 40; i++) {
    const x = 2 + Math.floor(rng() * 26);
    const y = 3 + Math.floor(rng() * 17);
    if (p.get(0, x, y) === builtinTileId('grass') && !p.get(1, x, y) && !p.get(2, x, y)) p.set(1, x, y, flowers[i % 4]);
  }
  for (const x of [11, 18]) p.tall(x, 10, 'lampTop', 'lampBottom');
  p.tall(12, 15, 'wellTL', 'wellBL');
  p.tall(13, 15, 'wellTR', 'wellBR');
  p.set(2, 17, 18, 'signpost');
  p.rect(2, 2, 18, 5, 1, 'fenceH');
  p.rect(0, 2, 19, 5, 1, 'farmland');

  // --- events ---
  door(m, 6, 6, [ELDER, 6, 8, 8]);
  door(m, 23, 6, [INN, 7, 8, 8]);
  // intro cut-scene
  event(m, 'Intro', 0, 0, [
    page({
      trigger: 'autorun',
      commands: [
        { type: 'fadeOut' },
        narrate('For a hundred years the \\C[2]Ember Crystal\\C[0] kept the valley of Willowbrook warm and green.'),
        narrate('But last night a knight clad in black armour stole it away...'),
        { type: 'fadeIn' },
        { type: 'showBalloon', target: -1, balloon: 'exclamation', wait: true },
        say('Leon', 'Huh?! Is it already morning? It feels so cold...\nI should go and see the \\C[6]Elder\\C[0].', 'hero', 2),
        sw(SW_INTRO),
      ],
    }),
    page({ conditions: [{ kind: 'switch', id: SW_INTRO, value: true }] }),
  ]);
  // village gate: blocks until the quest is accepted
  const gateBlock = (): Cmd[] => [
    say('Guard', 'Halt! Monsters are roaming the fields since the crystal vanished.\nSpeak with the Elder before you go out there.', 'guard'),
    { type: 'setMoveRoute', target: -1, route: { commands: [{ code: 'moveUp' }], repeat: false, skippable: true, wait: true } } as Cmd,
  ];
  for (const x of [14, 15]) {
    event(m, 'Gate', x, 21, [
      page({ trigger: 'playerTouch', priority: 'below', commands: gateBlock() }),
      page({ trigger: 'playerTouch', priority: 'below', conditions: [{ kind: 'switch', id: SW_QUEST, value: true }], commands: [transfer(FIELD, 20, 1, 2)] }),
    ]);
  }
  npc(m, 'Guard', 16, 20, 'guard', [say('Guard', 'The Shadow Cave lies east of Greenfield. Be careful out there.', 'guard')], 'fixed');
  npc(
    m,
    'Merchant',
    6,
    14,
    'merchant',
    [
      say('Merchant', 'Welcome! Fine goods for brave adventurers!', 'merchant', 1),
      {
        type: 'shop',
        purchaseOnly: false,
        goods: [
          { kind: 'item', id: 1, price: null },
          { kind: 'item', id: 3, price: null },
          { kind: 'item', id: 4, price: null },
          { kind: 'item', id: 6, price: null },
          { kind: 'weapon', id: 2, price: null },
          { kind: 'weapon', id: 10, price: null },
          { kind: 'armor', id: 1, price: null },
          { kind: 'armor', id: 3, price: null },
          { kind: 'armor', id: 7, price: null },
        ],
      },
    ],
    'fixed',
  );
  npc(m, 'Girl', 10, 17, 'girl', [say('Lily', 'Brrr... my flowers are freezing! I hope someone brings the crystal back soon.', 'girl', 2)]);
  npc(m, 'Old man', 21, 12, 'oldMan', [
    ifCond(
      { kind: 'switch', id: SW_BOSS, value: true },
      [say('Old Man', "You brought warmth back to the valley. I'll tell my grandchildren about you!", 'oldMan', 1)],
      [say('Old Man', 'Slimes are weak, but bats come in pairs. Keep a \\C[3]Potion\\C[0] handy, youngster.', 'oldMan')],
    ),
  ]);
  event(m, 'Cat', 13, 18, [page({ sprite: 'cat', moveType: 'random', moveFrequency: 4, moveSpeed: 3, commands: [say('', 'Meow!'), { type: 'showBalloon', target: 0, balloon: 'heart', wait: true }] })]);
  event(m, 'Sign', 17, 18, [page({ commands: [say('', '↓ Greenfield\n→ Willowbrook Inn')] })]);
  event(m, 'Well', 12, 15, [page({ commands: [say('', 'The water at the bottom has a thin layer of ice on it.')] })]);
  return m;
}

function buildElderHouse(): GameMap {
  const m = createMap(ELDER, "Elder's House", 13, 10, 1);
  m.displayName = '';
  m.bgm = bgm('town', 55);
  const p = new Painter(m);
  room(p, 13, 10, 'woodFloor', 'woodWall');
  p.rect(0, 5, 6, 3, 3, 'carpetRed');
  p.set(0, 6, 9, 'carpetRed');
  p.tall(2, 3, 'bookshelfTop', 'bookshelfBottom');
  p.tall(3, 3, 'bookshelfTop', 'bookshelfBottom');
  p.tall(10, 4, 'bedTop', 'bedBottom');
  p.set(2, 6, 4, 'table');
  p.set(2, 5, 4, 'chairRight');
  p.set(2, 7, 4, 'chairLeft');
  p.tall(8, 3, 'clockTop', 'clockBottom');
  p.set(2, 1, 8, 'plant');
  p.set(2, 11, 8, 'pot');
  p.set(1, 5, 1, 'painting');
  p.set(1, 9, 2, 'windowIn');
  door(m, 6, 9, [VILLAGE, 6, 7, 2]);

  event(m, 'Elder', 6, 5, [
    page({
      sprite: 'sage',
      commands: [
        say('Elder', 'Leon, thank goodness you are here. The Ember Crystal has been stolen!', 'sage', 2),
        say('Elder', 'A \\C[2]Dark Knight\\C[0] carried it into the \\C[6]Shadow Cave\\C[0], east of Greenfield.\nWithout it the valley will freeze before the month is out.', 'sage', 2),
        choices([
          ['I will bring it back!', [say('Elder', 'Brave lad! Take these, and may the light guide you.', 'sage', 1), giveItem(1, 3), gold(200), playSe('itemGet'), say('', 'Received \\C[6]3 Potions\\C[0] and \\C[6]200 G\\C[0]!'), sw(SW_QUEST)]],
          ['Let me think about it...', [say('Elder', 'Please hurry. There is no one else I can ask.', 'sage', 2)]],
        ]),
      ],
    }),
    page({
      sprite: 'sage',
      conditions: [{ kind: 'switch', id: SW_QUEST, value: true }],
      commands: [say('Elder', 'The Shadow Cave lies east of Greenfield. Rest at the inn before you go!', 'sage')],
    }),
    page({
      sprite: 'sage',
      conditions: [{ kind: 'item', itemId: 11 }],
      commands: [
        say('Elder', 'Is that... the Ember Crystal! You did it, Leon!', 'sage', 1),
        { type: 'changeItems', itemKind: 'item', id: 11, op: '-', operand: { kind: 'constant', value: 1 } },
        { type: 'playMe', audio: bgm('victory', 80) },
        { type: 'flashScreen', color: [255, 200, 120, 200], duration: 40, wait: true },
        say('Elder', 'Warmth is already returning to the valley. Willowbrook owes you everything.', 'sage', 1),
        { type: 'fadeOut' },
        narrate('And so spring returned to Willowbrook.\n\n\\C[6]THE END\\C[0]\n\nThank you for playing!'),
        { type: 'returnToTitle' },
      ],
    }),
  ]);
  npc(m, 'Wife', 3, 7, 'oldWoman', [say('Martha', "My husband worries so. Here, have a warm cup of tea... oh, it's gone cold too.", 'oldWoman', 2)]);
  return m;
}

function buildInn(): GameMap {
  const m = createMap(INN, 'Inn', 15, 10, 1);
  m.displayName = '';
  m.bgm = bgm('town', 55);
  const p = new Painter(m);
  room(p, 15, 10, 'woodFloor', 'woodWall');
  p.rect(0, 6, 5, 3, 5, 'carpetBlue');
  p.rect(2, 2, 4, 5, 1, 'counter');
  p.tall(1, 3, 'bookshelfTop', 'bookshelfBottom');
  p.tall(10, 4, 'bedTop', 'bedBottom');
  p.tall(12, 4, 'bedTop', 'bedBottom');
  p.tall(10, 7, 'bedTop', 'bedBottom');
  p.tall(12, 7, 'bedTop', 'bedBottom');
  p.tall(9, 3, 'fireplaceTL', 'fireplaceBL');
  p.set(1, 4, 1, 'painting');
  p.set(2, 1, 8, 'plant');
  p.set(2, 2, 7, 'table');
  p.set(2, 3, 7, 'chairLeft');
  door(m, 7, 9, [VILLAGE, 23, 7, 2]);

  event(m, 'Innkeeper', 4, 3, [
    page({
      sprite: 'innkeeper',
      moveType: 'fixed',
      commands: [
        say('Innkeeper', 'Welcome to the Willow Inn! A warm bed is \\C[6]20 G\\C[0] a night. Will you stay?', 'innkeeper', 1),
        choices([
          [
            'Stay (20 G)',
            [
              ifCond(
                { kind: 'gold', op: '>=', value: 20 },
                [
                  gold(-20),
                  say('Innkeeper', 'Sleep well!', 'innkeeper', 1),
                  { type: 'fadeOut' },
                  { type: 'playMe', audio: bgm('inn', 80) },
                  { type: 'wait', frames: 150 },
                  { type: 'recoverAll', actorId: 0 },
                  { type: 'fadeIn' },
                  say('Innkeeper', 'Good morning! Come back any time.', 'innkeeper', 1),
                ],
                [say('Innkeeper', "Oh dear, you don't have enough money.", 'innkeeper', 2)],
              ),
            ],
          ],
          ['No thanks', [say('Innkeeper', 'Come again!', 'innkeeper')]],
        ]),
      ],
    }),
  ]);
  npc(m, 'Traveler', 7, 6, 'knight', [say('Traveler', 'Fire magic works wonders on the undead in that cave. Just saying.', 'knight')]);
  event(m, 'Save', 12, 5, [page({ sprite: 'crystal', stepAnime: true, priority: 'same', commands: [say('', 'A faint warmth glows within the crystal. Save your progress?'), choices([['Save', [{ type: 'openSave' }]], ['Cancel', []]])] })]);
  return m;
}

function buildField(): GameMap {
  const W = 40,
    H = 26;
  const m = createMap(FIELD, 'Greenfield', W, H, 1);
  m.displayName = 'Greenfield';
  m.bgm = bgm('field');
  m.battleback = 'builtin:grassland';
  m.encounterSteps = 28;
  m.encounters = [
    { troopId: 1, weight: 10, regions: [] },
    { troopId: 2, weight: 6, regions: [] },
    { troopId: 3, weight: 6, regions: [] },
    { troopId: 4, weight: 4, regions: [2] },
    { troopId: 5, weight: 3, regions: [2] },
  ];
  const p = new Painter(m);
  p.rect(0, 0, 0, W, H, 'grass');
  const rng = mulberry32(42);
  // forest floor patches & tall grass
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(rng() * (W - 8)),
      y = Math.floor(rng() * (H - 6));
    p.rect(0, x, y, 3 + Math.floor(rng() * 5), 2 + Math.floor(rng() * 4), i % 2 ? 'darkGrass' : 'tallGrass');
  }
  // dirt path from the north gate to the cave in the east
  for (let y = 0; y <= 12; y++) p.rect(0, 20, y, 2, 1, 'dirt');
  for (let x = 20; x < W; x++) p.rect(0, x, 12, 1, 2, 'dirt');
  // river with a bridge
  for (let y = 0; y < H; y++) p.rect(0, 30 + Math.round(Math.sin(y / 3) * 1.5), y, 2, 1, 'water');
  for (let x = 28; x < 34; x++) for (let y = 12; y < 14; y++) if (p.get(0, x, y) === builtinTileId('water')) p.set(1, x, y, 'bridgeH');
  // the east bank is wilder
  p.region(32, 0, W - 32, H, 2);
  // trees
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rng() * W),
      y = 1 + Math.floor(rng() * (H - 1));
    const t = p.get(0, x, y);
    if (t === builtinTileId('dirt') || t === builtinTileId('water') || p.get(0, x, y - 1) === builtinTileId('dirt') || p.get(2, x, y) || p.get(3, x, y)) continue;
    if (Math.abs(x - 20) < 3 && y < 3) continue;
    p.tree(x, y, rng() < 0.4 ? 'pine' : 'tree');
  }
  for (let i = 0; i < 30; i++) {
    const x = Math.floor(rng() * W),
      y = Math.floor(rng() * H);
    if (p.get(0, x, y) === builtinTileId('grass') && !p.get(2, x, y) && !p.get(1, x, y)) p.set(1, x, y, ['flowersYellow', 'grassTuft', 'pebbles', 'flowersBlue'][i % 4]);
  }
  for (const [x, y] of [
    [24, 18],
    [10, 20],
    [36, 4],
  ])
    p.set(2, x, y, 'rock');
  p.set(2, 22, 11, 'signpost');
  // cave mouth at the east end of the path
  p.rect(0, W - 3, 9, 3, 3, 'cliff');
  p.rect(2, W - 3, 9, 3, 3, 0);
  p.rect(3, W - 3, 8, 3, 1, 0);
  p.set(1, W - 2, 11, 'caveEntrance');
  p.rect(0, W - 3, 12, 3, 2, 'dirt');

  for (const x of [20, 21]) door(m, x, 0, [VILLAGE, 14 + (x - 20), 20, 8], false);
  door(m, W - 2, 11, [CAVE, 3, 20, 8], false);
  event(m, 'Sign', 22, 11, [page({ commands: [say('', '↑ Willowbrook\n→ Shadow Cave  \\C[2](Danger!)\\C[0]')] })]);
  // Mira joins
  event(m, 'Mira', 25, 14, [
    page({
      sprite: 'mage',
      dir: 4,
      commands: [
        { type: 'showBalloon', target: 0, balloon: 'exclamation', wait: true },
        say('Mira', "You're heading to the Shadow Cave? So am I! I've been tracking that Dark Knight for weeks.", 'mage'),
        say('Leon', 'Then we should go together.', 'hero', 1),
        say('Mira', "Ha! I like you. I'm \\C[4]Mira\\C[0] — leave the fireballs to me.", 'mage', 1),
        { type: 'changePartyMember', actorId: 2, op: 'add', initialize: true },
        { type: 'playMe', audio: bgm('itemGet', 80) },
        say('', '\\C[4]Mira\\C[0] joined the party!'),
        sw(SW_MIRA),
      ],
    }),
    page({ conditions: [{ kind: 'switch', id: SW_MIRA, value: true }] }),
  ]);
  chest(m, 6, 4, giveItem(2), 'Hi-Potion');
  chest(m, 36, 22, gold(150), '150 G');
  return m;
}

function buildCave(): GameMap {
  const W = 30,
    H = 24;
  const m = createMap(CAVE, 'Shadow Cave', W, H, 1);
  m.displayName = 'Shadow Cave';
  m.bgm = bgm('dungeon');
  m.battleback = 'builtin:cave';
  m.encounterSteps = 24;
  m.encounters = [
    { troopId: 3, weight: 6, regions: [] },
    { troopId: 8, weight: 5, regions: [] },
    { troopId: 10, weight: 5, regions: [] },
    { troopId: 11, weight: 4, regions: [] },
    { troopId: 9, weight: 3, regions: [] },
  ];
  const p = new Painter(m);
  p.rect(0, 0, 0, W, H, 'caveTop');
  const floor = (x: number, y: number, w: number, h: number) => p.rect(0, x, y, w, h, 'caveFloor');
  floor(2, 17, 6, 5); // entrance hall
  floor(4, 11, 2, 6); // north corridor
  floor(2, 6, 8, 5); // west chamber
  floor(8, 18, 12, 2); // east tunnel
  floor(17, 12, 3, 6); // up to the middle
  floor(13, 9, 9, 4); // middle hall
  floor(21, 10, 5, 2); // to the boss room
  floor(19, 2, 9, 7); // boss chamber
  floor(24, 9, 2, 1);
  floor(22, 19, 6, 3); // treasure nook
  floor(20, 18, 2, 2);
  // wall faces under the ceiling
  const top = builtinTileId('caveTop');
  const fl = builtinTileId('caveFloor');
  for (let y = H - 1; y >= 1; y--)
    for (let x = 0; x < W; x++) if (p.get(0, x, y) === fl && p.get(0, x, y - 1) === top) p.set(0, x, y - 1, 'caveWall');
  // decoration
  for (const [x, y] of [
    [3, 6],
    [8, 6],
    [14, 9],
    [20, 9],
    [21, 2],
    [26, 2],
  ])
    p.set(1, x, y - 1 >= 0 ? y - 1 : y, 'torch');
  for (const [x, y, k] of [
    [7, 20, 'stalagmite'],
    [3, 9, 'bones'],
    [15, 11, 'crystal'],
    [27, 21, 'skull'],
    [9, 9, 'stalagmite'],
    [25, 7, 'bones'],
    [13, 12, 'mushrooms'],
  ] as [number, number, string][])
    p.set(2, x, y, k);
  p.set(1, 23, 4, 'magicCircle');

  m.bgColor = '#05040a';
  door(m, 3, 21, [FIELD, 37, 13, 2], false);

  chest(m, 3, 7, giveItem(6), 'Phoenix Feather');
  chest(m, 26, 20, giveItem(9, 2), '2 Fire Bombs');
  chest(m, 9, 7, giveItem(3, 2), '2 Ethers');
  event(m, 'Save Crystal', 15, 10, [page({ sprite: 'crystal', stepAnime: true, commands: [say('', 'The crystal hums softly. Your wounds heal.'), { type: 'recoverAll', actorId: 0 }, playSe('heal'), choices([['Save', [{ type: 'openSave' }]], ['Cancel', []]])] })]);

  // boss
  event(m, 'Dark Knight', 23, 3, [
    page({
      sprite: 'knight',
      dir: 2,
      priority: 'same',
      trigger: 'action',
      commands: [
        { type: 'playBgm', audio: null },
        say('Dark Knight', 'So the village sent a child to fetch its precious crystal.', 'darkLord'),
        say('Leon', 'Give it back! The whole valley is freezing because of you!', 'hero', 3),
        say('Dark Knight', 'Then come and take it — if you can!', 'darkLord', 3),
        { type: 'shakeScreen', power: 5, speed: 6, duration: 30, wait: true },
        {
          type: 'battle',
          troopId: 12,
          canEscape: false,
          canLose: false,
          winBranch: [
            say('Dark Knight', 'Impossible... defeated by...', 'darkLord', 2),
            { type: 'flashScreen', color: [255, 255, 255, 255], duration: 30, wait: true },
            giveItem(11),
            { type: 'playMe', audio: bgm('itemGet', 80) },
            say('', 'Recovered the \\C[2]Ember Crystal\\C[0]!'),
            sw(SW_BOSS),
            say('Leon', "Let's take it back to the Elder!", 'hero', 1),
          ],
          escapeBranch: [],
          loseBranch: [],
        },
        { type: 'playBgm', audio: bgm('dungeon') },
      ],
    }),
    page({ conditions: [{ kind: 'switch', id: SW_BOSS, value: true }] }),
  ]);
  return m;
}

export function createSampleProject(): Project {
  const p = createBlankProject('The Ember Crystal');
  p.maps = [buildVillage(), buildElderHouse(), buildInn(), buildField(), buildCave()];
  p.maps[1].parentId = VILLAGE;
  p.maps[2].parentId = VILLAGE;
  p.system.startMapId = VILLAGE;
  p.system.startX = 14;
  p.system.startY = 12;
  p.system.startDirection = 2;
  p.system.party = [1];
  p.system.startGold = 50;
  p.system.titleBackground = 'builtin:castle';
  p.system.switches[SW_INTRO - 1] = 'Intro done';
  p.system.switches[SW_QUEST - 1] = 'Quest accepted';
  p.system.switches[SW_MIRA - 1] = 'Mira joined';
  p.system.switches[SW_BOSS - 1] = 'Dark Knight defeated';
  return p;
}
