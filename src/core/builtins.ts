/**
 * Catalogue of the built-in resources ("RTP"). All built-in graphics and
 * sounds are generated procedurally at runtime; this module only lists their
 * names and metadata so data files can reference them without loading art.
 */

import type { AutotileDef, AutotileType, Tileset } from './types';
import { TF, autotileId, normalTileId } from './tiles';

const B = TF.BLOCK_ALL;
const S = TF.STAR;

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export interface BuiltinAutotile {
  key: string;
  label: string;
  type: AutotileType;
  frames: number;
  flags: number;
}

export const BUILTIN_AUTOTILES: BuiltinAutotile[] = [
  { key: 'grass', label: 'Grass', type: 'floor', frames: 1, flags: 0 },
  { key: 'darkGrass', label: 'Forest Floor', type: 'floor', frames: 1, flags: 0 },
  { key: 'dirt', label: 'Dirt', type: 'floor', frames: 1, flags: 0 },
  { key: 'sand', label: 'Sand', type: 'floor', frames: 1, flags: 0 },
  { key: 'snow', label: 'Snow', type: 'floor', frames: 1, flags: 0 },
  { key: 'cobble', label: 'Cobblestone', type: 'floor', frames: 1, flags: 0 },
  { key: 'water', label: 'Water', type: 'floor', frames: 3, flags: B },
  { key: 'deepWater', label: 'Deep Water', type: 'floor', frames: 3, flags: B },
  { key: 'lava', label: 'Lava', type: 'floor', frames: 3, flags: TF.DAMAGE },
  { key: 'swamp', label: 'Poison Swamp', type: 'floor', frames: 3, flags: TF.DAMAGE | TF.BUSH },
  { key: 'tallGrass', label: 'Tall Grass', type: 'floor', frames: 1, flags: TF.BUSH },
  { key: 'woodFloor', label: 'Wood Floor', type: 'floor', frames: 1, flags: 0 },
  { key: 'stoneFloor', label: 'Stone Floor', type: 'floor', frames: 1, flags: 0 },
  { key: 'carpetRed', label: 'Red Carpet', type: 'floor', frames: 1, flags: 0 },
  { key: 'carpetBlue', label: 'Blue Carpet', type: 'floor', frames: 1, flags: 0 },
  { key: 'caveFloor', label: 'Cave Floor', type: 'floor', frames: 1, flags: 0 },
  { key: 'wallTop', label: 'Wall Top', type: 'floor', frames: 1, flags: B },
  { key: 'caveTop', label: 'Cave Ceiling', type: 'floor', frames: 1, flags: B },
  { key: 'stoneWall', label: 'Stone Wall', type: 'wall', frames: 1, flags: B },
  { key: 'brickWall', label: 'Brick Wall', type: 'wall', frames: 1, flags: B },
  { key: 'woodWall', label: 'Wood Wall', type: 'wall', frames: 1, flags: B },
  { key: 'caveWall', label: 'Cave Wall', type: 'wall', frames: 1, flags: B },
  { key: 'houseWall', label: 'House Wall', type: 'wall', frames: 1, flags: B },
  { key: 'roofRed', label: 'Red Roof', type: 'wall', frames: 1, flags: B },
  { key: 'roofBlue', label: 'Blue Roof', type: 'wall', frames: 1, flags: B },
  { key: 'cliff', label: 'Cliff', type: 'wall', frames: 1, flags: B },
  { key: 'hedge', label: 'Hedge', type: 'floor', frames: 1, flags: B },
  { key: 'farmland', label: 'Farmland', type: 'floor', frames: 1, flags: 0 },
  { key: 'ice', label: 'Ice', type: 'floor', frames: 1, flags: 0 },
  { key: 'marble', label: 'Marble Floor', type: 'floor', frames: 1, flags: 0 },
  { key: 'shallowWater', label: 'Shallow Water', type: 'floor', frames: 3, flags: TF.BUSH },
];

export interface BuiltinTile {
  key: string;
  label: string;
  flags: number;
}

const t = (key: string, label: string, flags = 0): BuiltinTile => ({ key, label, flags });

/** Outdoor sheet, 8 columns, row-major. */
export const OUTDOOR_TILES: BuiltinTile[] = [
  // row 0
  t('flowersRed', 'Red Flowers'),
  t('flowersYellow', 'Yellow Flowers'),
  t('flowersBlue', 'Blue Flowers'),
  t('grassTuft', 'Grass Tuft'),
  t('pebbles', 'Pebbles'),
  t('smallRock', 'Small Rock'),
  t('mushrooms', 'Mushrooms'),
  t('lilyPad', 'Lily Pad', S),
  // row 1
  t('treeTop', 'Tree (top)', S),
  t('pineTop', 'Pine (top)', S),
  t('deadTreeTop', 'Dead Tree (top)', S),
  t('palmTop', 'Palm (top)', S),
  t('bigTreeTL', 'Big Tree TL', S),
  t('bigTreeTR', 'Big Tree TR', S),
  t('boulderTL', 'Boulder TL', B),
  t('boulderTR', 'Boulder TR', B),
  // row 2
  t('treeBottom', 'Tree (trunk)', B),
  t('pineBottom', 'Pine (trunk)', B),
  t('deadTreeBottom', 'Dead Tree (trunk)', B),
  t('palmBottom', 'Palm (trunk)', B),
  t('bigTreeBL', 'Big Tree BL', B),
  t('bigTreeBR', 'Big Tree BR', B),
  t('boulderBL', 'Boulder BL', B),
  t('boulderBR', 'Boulder BR', B),
  // row 3
  t('bush', 'Bush', B),
  t('stump', 'Stump', B),
  t('log', 'Log', B),
  t('cactus', 'Cactus', B),
  t('rock', 'Rock', B),
  t('sunflower', 'Sunflower', B),
  t('signpost', 'Signpost', B),
  t('haystack', 'Haystack', B),
  // row 4
  t('fenceH', 'Fence ─', B),
  t('fenceV', 'Fence │', B),
  t('fenceTL', 'Fence ┌', B),
  t('fenceTR', 'Fence ┐', B),
  t('fenceBL', 'Fence └', B),
  t('fenceBR', 'Fence ┘', B),
  t('fencePost', 'Fence Post', B),
  t('woodPile', 'Wood Pile', B),
  // row 5
  t('lampTop', 'Lamp (top)', S),
  t('wellTL', 'Well TL', S),
  t('wellTR', 'Well TR', S),
  t('statueTop', 'Statue (top)', S),
  t('barrel', 'Barrel', B),
  t('crate', 'Crate', B),
  t('pot', 'Pot', B),
  t('flowerPot', 'Flower Pot', B),
  // row 6
  t('lampBottom', 'Lamp (post)', B),
  t('wellBL', 'Well BL', B),
  t('wellBR', 'Well BR', B),
  t('statueBottom', 'Statue (base)', B),
  t('bench', 'Bench', B),
  t('campfire', 'Campfire', B),
  t('grave', 'Grave', B),
  t('mailbox', 'Mailbox', B),
  // row 7
  t('door', 'Door'),
  t('doubleDoorL', 'Double Door L'),
  t('doubleDoorR', 'Double Door R'),
  t('window', 'Window', B),
  t('signInn', 'Inn Sign', B),
  t('signItem', 'Item Shop Sign', B),
  t('signWeapon', 'Weapon Shop Sign', B),
  t('signArmor', 'Armor Shop Sign', B),
  // row 8
  t('bridgeH', 'Bridge ─'),
  t('bridgeV', 'Bridge │'),
  t('stairs', 'Stone Stairs'),
  t('ladder', 'Ladder', TF.LADDER),
  t('caveEntrance', 'Cave Entrance'),
  t('steppingStones', 'Stepping Stones'),
  t('chimney', 'Chimney', B),
  t('woodSign', 'Wooden Board', B),
];

/** Indoor & dungeon sheet, 8 columns, row-major. */
export const INDOOR_TILES: BuiltinTile[] = [
  // row 0
  t('table', 'Table', B),
  t('chairDown', 'Chair ↓', B),
  t('chairUp', 'Chair ↑', B),
  t('chairLeft', 'Chair ←', B),
  t('chairRight', 'Chair →', B),
  t('stool', 'Stool', B),
  t('counter', 'Counter', B | TF.COUNTER),
  t('counterV', 'Counter │', B | TF.COUNTER),
  // row 1
  t('bedTop', 'Bed (head)', B),
  t('bookshelfTop', 'Bookshelf (top)', B),
  t('wardrobeTop', 'Wardrobe (top)', B),
  t('clockTop', 'Clock (top)', B),
  t('fireplaceTL', 'Fireplace TL', B),
  t('fireplaceTR', 'Fireplace TR', B),
  t('throneTop', 'Throne (top)', B),
  t('pillarTop', 'Pillar (top)', S),
  // row 2
  t('bedBottom', 'Bed (foot)', B),
  t('bookshelfBottom', 'Bookshelf (base)', B),
  t('wardrobeBottom', 'Wardrobe (base)', B),
  t('clockBottom', 'Clock (base)', B),
  t('fireplaceBL', 'Fireplace BL', B),
  t('fireplaceBR', 'Fireplace BR', B),
  t('throneBottom', 'Throne (seat)', B),
  t('pillarBottom', 'Pillar (base)', B),
  // row 3
  t('shelfPotions', 'Potion Shelf', B),
  t('shelfWeapons', 'Weapon Rack', B),
  t('shelfArmor', 'Armor Stand', B),
  t('drawer', 'Drawer', B),
  t('plant', 'Plant', B),
  t('vase', 'Vase', B),
  t('candle', 'Candle Stand', B),
  t('sacks', 'Sacks', B),
  // row 4
  t('stairsUp', 'Stairs Up'),
  t('stairsDown', 'Stairs Down'),
  t('painting', 'Painting', B),
  t('windowIn', 'Window', B),
  t('bannerRed', 'Red Banner', B),
  t('bannerBlue', 'Blue Banner', B),
  t('torch', 'Wall Torch', B),
  t('wallShield', 'Wall Shield', B),
  // row 5
  t('stalagmite', 'Stalagmite', B),
  t('crystal', 'Crystal', B),
  t('bones', 'Bones'),
  t('skull', 'Skull'),
  t('cobweb', 'Cobweb', S),
  t('spikes', 'Spikes', TF.DAMAGE),
  t('magicCircle', 'Magic Circle'),
  t('lever', 'Lever', B),
  // row 6
  t('altar', 'Altar', B),
  t('cauldron', 'Cauldron', B),
  t('anvil', 'Anvil', B),
  t('potsCluster', 'Pots', B),
  t('rubble', 'Rubble', B),
  t('hole', 'Hole'),
  t('basin', 'Water Basin', B),
  t('rug', 'Rug'),
];

export const BUILTIN_SHEET_COLUMNS = 8;
export const OUTDOOR_SHEET = 'builtin:outdoor';
export const INDOOR_SHEET = 'builtin:indoor';
export const AUTOTILE_SHEET = 'builtin:autotiles';
/** Width of the autotile sheet in tiles; blocks are packed left to right. */
export const AUTOTILE_SHEET_COLUMNS = 16;

/** Layout of the built-in autotile blocks on the autotile sheet. */
export function builtinAutotileLayout(): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let x = 0;
  let y = 0;
  for (const a of BUILTIN_AUTOTILES) {
    const w = 2 * a.frames;
    if (x + w > AUTOTILE_SHEET_COLUMNS) {
      x = 0;
      y += 3;
    }
    out.push({ x, y });
    x += w;
  }
  return out;
}

export function autotileSheetRows(): number {
  const layout = builtinAutotileLayout();
  return Math.max(...layout.map((p) => p.y)) + 3;
}

const tileIdMaps = (() => {
  const auto = new Map<string, number>();
  BUILTIN_AUTOTILES.forEach((a, i) => auto.set(a.key, autotileId(i)));
  const out = new Map<string, number>();
  OUTDOOR_TILES.forEach((tt, i) => out.set(tt.key, normalTileId(0, i)));
  INDOOR_TILES.forEach((tt, i) => out.set(tt.key, normalTileId(1, i)));
  return { auto, out };
})();

/** Tile id of a built-in tile or autotile by key (in the standard tileset). */
export function builtinTileId(key: string): number {
  const id = tileIdMaps.auto.get(key) ?? tileIdMaps.out.get(key);
  if (id === undefined) throw new Error(`Unknown builtin tile: ${key}`);
  return id;
}

/** The standard tileset that ships with every project. */
export function createStandardTileset(id = 1): Tileset {
  const layout = builtinAutotileLayout();
  const autotiles: AutotileDef[] = BUILTIN_AUTOTILES.map((a, i) => ({
    name: a.label,
    image: AUTOTILE_SHEET,
    tileSize: 32,
    x: layout[i].x,
    y: layout[i].y,
    type: a.type,
    frames: a.frames,
  }));
  const flags: Record<number, number> = {};
  BUILTIN_AUTOTILES.forEach((a, i) => {
    if (a.flags) flags[autotileId(i)] = a.flags;
  });
  OUTDOOR_TILES.forEach((tt, i) => {
    if (tt.flags) flags[normalTileId(0, i)] = tt.flags;
  });
  INDOOR_TILES.forEach((tt, i) => {
    if (tt.flags) flags[normalTileId(1, i)] = tt.flags;
  });
  return {
    id,
    name: 'Standard',
    sheets: [
      { image: OUTDOOR_SHEET, tileSize: 32 },
      { image: INDOOR_SHEET, tileSize: 32 },
    ],
    autotiles,
    flags,
    note: 'Built-in procedurally generated tileset.',
  };
}

// ---------------------------------------------------------------------------
// Characters, faces, enemies, backgrounds, animations, icons, audio
// ---------------------------------------------------------------------------

export interface BuiltinEntry {
  key: string;
  label: string;
}

const e = (key: string, label: string): BuiltinEntry => ({ key, label });

/** Built-in character sheets (each a single 3x4-frame character). */
export const BUILTIN_CHARACTERS: BuiltinEntry[] = [
  e('hero', 'Hero'),
  e('heroine', 'Heroine'),
  e('mage', 'Mage'),
  e('knight', 'Knight'),
  e('priest', 'Priestess'),
  e('thief', 'Thief'),
  e('villager', 'Villager'),
  e('villagerF', 'Villager (F)'),
  e('oldMan', 'Old Man'),
  e('oldWoman', 'Old Woman'),
  e('boy', 'Boy'),
  e('girl', 'Girl'),
  e('merchant', 'Merchant'),
  e('guard', 'Guard'),
  e('king', 'King'),
  e('princess', 'Princess'),
  e('sage', 'Sage'),
  e('blacksmith', 'Blacksmith'),
  e('innkeeper', 'Innkeeper'),
  e('darkLord', 'Dark Lord'),
  e('slime', 'Slime'),
  e('bat', 'Bat'),
  e('skeleton', 'Skeleton'),
  e('ghost', 'Ghost'),
  e('goblin', 'Goblin'),
  e('cat', 'Cat'),
  e('dog', 'Dog'),
  e('chicken', 'Chicken'),
  e('chest', 'Treasure Chest'),
  e('door', 'Door'),
  e('crystal', 'Save Crystal'),
  e('fire', 'Fire'),
  e('lever', 'Lever'),
  e('boulder', 'Boulder'),
  e('sparkle', 'Sparkle'),
];

/** Characters that have matching built-in face portraits. */
export const BUILTIN_FACES: BuiltinEntry[] = BUILTIN_CHARACTERS.slice(0, 20);

export const FACE_EXPRESSIONS = ['Normal', 'Happy', 'Sad', 'Angry'];

export const BUILTIN_ENEMIES: BuiltinEntry[] = [
  e('slime', 'Slime'),
  e('bat', 'Bat'),
  e('goblin', 'Goblin'),
  e('wolf', 'Wolf'),
  e('snake', 'Snake'),
  e('mushroom', 'Fungoid'),
  e('skeleton', 'Skeleton'),
  e('ghost', 'Ghost'),
  e('spider', 'Spider'),
  e('orc', 'Orc'),
  e('plant', 'Man-eater Plant'),
  e('imp', 'Imp'),
  e('golem', 'Golem'),
  e('darkKnight', 'Dark Knight'),
  e('wizard', 'Dark Wizard'),
  e('dragon', 'Dragon'),
  e('demonLord', 'Demon Lord'),
];

export const BUILTIN_BATTLEBACKS: BuiltinEntry[] = [
  e('grassland', 'Grassland'),
  e('forest', 'Forest'),
  e('cave', 'Cave'),
  e('dungeon', 'Dungeon'),
  e('desert', 'Desert'),
  e('snowfield', 'Snowfield'),
  e('castle', 'Castle Hall'),
  e('volcano', 'Volcano'),
];

export const BUILTIN_TITLES: BuiltinEntry[] = [
  e('castle', 'Castle at Dusk'),
  e('field', 'Green Fields'),
  e('night', 'Starry Night'),
];

export const BUILTIN_ANIMATIONS: BuiltinEntry[] = [
  e('hit', 'Hit'),
  e('slash', 'Slash'),
  e('pierce', 'Pierce'),
  e('claw', 'Claw'),
  e('blunt', 'Blunt'),
  e('fire', 'Fire'),
  e('ice', 'Ice'),
  e('thunder', 'Thunder'),
  e('wind', 'Wind'),
  e('earth', 'Earth'),
  e('water', 'Water'),
  e('light', 'Holy Light'),
  e('dark', 'Darkness'),
  e('heal', 'Heal'),
  e('cure', 'Cure'),
  e('buff', 'Power Up'),
  e('debuff', 'Power Down'),
  e('poison', 'Poison'),
  e('sleep', 'Sleep'),
  e('explosion', 'Explosion'),
  e('sparkle', 'Sparkle'),
];

export const BUILTIN_ICONS: string[] = [
  'None',
  'Red Potion',
  'Blue Potion',
  'Green Potion',
  'Elixir',
  'Herb',
  'Bread',
  'Feather',
  'Scroll',
  'Book',
  'Key',
  'Ruby',
  'Sapphire',
  'Gold Bag',
  'Letter',
  'Bomb',
  'Sword',
  'Greatsword',
  'Dagger',
  'Axe',
  'Spear',
  'Bow',
  'Staff',
  'Mace',
  'Buckler',
  'Shield',
  'Helmet',
  'Hat',
  'Armor',
  'Robe',
  'Ring',
  'Amulet',
  'Boots',
  'Gloves',
  'Fire',
  'Ice',
  'Thunder',
  'Wind',
  'Earth',
  'Water',
  'Light',
  'Dark',
  'Heal',
  'Cure',
  'Star',
  'Skull',
  'Poison',
  'Sleep',
  'Paralysis',
  'Silence',
  'Blind',
  'Confusion',
  'Attack Up',
  'Defense Up',
  'Speed Up',
  'Attack Down',
  'Defense Down',
  'Guard',
  'Fist',
  'Run',
  'Chest',
  'Map',
  'Tent',
  'Music',
];

export const ICON_SIZE = 32;
export const ICON_COLUMNS = 16;

export const BUILTIN_BGM: BuiltinEntry[] = [
  e('title', 'Title Theme'),
  e('town', 'Peaceful Town'),
  e('field', 'Open Field'),
  e('dungeon', 'Dark Dungeon'),
  e('castle', 'Royal Castle'),
  e('battle', 'Battle!'),
  e('boss', 'Boss Battle'),
  e('sad', 'Sorrow'),
];

export const BUILTIN_ME: BuiltinEntry[] = [
  e('victory', 'Victory Fanfare'),
  e('gameover', 'Game Over'),
  e('inn', 'Inn Rest'),
  e('itemGet', 'Item Get'),
  e('levelUp', 'Level Up'),
];

export const BUILTIN_BGS: BuiltinEntry[] = [e('rain', 'Rain'), e('wind', 'Wind'), e('river', 'River')];

export const BUILTIN_SE: BuiltinEntry[] = [
  e('cursor', 'Cursor'),
  e('ok', 'OK'),
  e('cancel', 'Cancel'),
  e('buzzer', 'Buzzer'),
  e('equip', 'Equip'),
  e('save', 'Save'),
  e('load', 'Load'),
  e('battleStart', 'Battle Start'),
  e('escape', 'Escape'),
  e('slash', 'Slash'),
  e('hit', 'Hit'),
  e('enemyDie', 'Enemy Collapse'),
  e('damage', 'Damage'),
  e('collapse', 'Collapse'),
  e('heal', 'Heal'),
  e('miss', 'Miss'),
  e('evade', 'Evade'),
  e('item', 'Use Item'),
  e('magic', 'Magic'),
  e('fire', 'Fire'),
  e('ice', 'Ice'),
  e('thunder', 'Thunder'),
  e('door', 'Door'),
  e('chest', 'Chest'),
  e('coin', 'Coin'),
  e('jump', 'Jump'),
  e('bell', 'Bell'),
  e('explosion', 'Explosion'),
  e('powerUp', 'Power Up'),
  e('stairs', 'Stairs'),
  e('switch', 'Switch'),
  e('bite', 'Bite'),
];
