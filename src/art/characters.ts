/**
 * Built-in character sprite sheets. Each sheet is one character with
 * 3 walking frames x 4 directions (down, left, right, up), 16x24 art pixels
 * per frame, scaled 2x (32x48 per frame).
 *
 * Humanoids are assembled from layered ASCII templates (body, outfit, hair,
 * headgear, beard) that are recoloured per character, then outlined.
 */

import { P, mix, shade } from './color';
import { Pix } from './pixel';

const FW = 16;
const FH = 24;

type Dir = 'down' | 'left' | 'up';
type Rows = string[];

function check(rows: Rows, name: string): Rows {
  for (const r of rows) if (r.length !== FW) throw new Error(`template ${name}: row "${r}" has length ${r.length}`);
  return rows;
}

// ---------------------------------------------------------------------------
// Templates. Keys: s skin, z skin shadow, e eye, c/d clothes, t trim, p/q pants,
// b boots, h/g/l hair, m/n/a metal, k/K accessory, y gold, r gem.
// ---------------------------------------------------------------------------

const HEAD: Record<Dir, Rows> = {
  down: check(
    [
      '................',
      '................',
      '.....ssssss.....',
      '....ssssssss....',
      '...ssssssssss...',
      '...ssssssssss...',
      '...ssessssess...',
      '...ssessssess...',
      '...ssssssssss...',
      '...zssssssssz...',
      '....zzzzzzzz....',
    ],
    'head-down',
  ),
  left: check(
    [
      '................',
      '................',
      '.....ssssss.....',
      '....ssssssss....',
      '...ssssssssss...',
      '...ssssssssss...',
      '...sessssssss...',
      '..ssessssssss...',
      '...ssssssssss...',
      '...zssssssssz...',
      '....zzzzzzzz....',
    ],
    'head-left',
  ),
  up: check(
    [
      '................',
      '................',
      '.....ssssss.....',
      '....ssssssss....',
      '...ssssssssss...',
      '...ssssssssss...',
      '...ssssssssss...',
      '...ssssssssss...',
      '...ssssssssss...',
      '...zssssssssz...',
      '....zzzzzzzz....',
    ],
    'head-up',
  ),
};

type Outfit = 'tunic' | 'dress' | 'robe' | 'armor';

/** Body rows 11..22 for each outfit, direction and frame (0 step, 1 stand, 2 step). */
const BODY: Record<Outfit, Record<Dir, Rows[]>> = {
  tunic: {
    down: [
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....bbb..qqq....',
        '...bbbb..bbb....',
        '.........bbbb...',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....qqq..qqq....',
        '....bbb..bbb....',
        '...bbbb..bbbb...',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....qqq..bbb....',
        '....bbb..bbbb...',
        '...bbbb.........',
      ],
    ],
    left: [
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '....cdcdccc.....',
        '....stttttt.....',
        '.....cccccc.....',
        '.....dddddd.....',
        '.....pp..pp.....',
        '....pp....pp....',
        '....qq....qq....',
        '...bbb....bb....',
        '...bbb.....bb...',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '.....ccdccc.....',
        '.....tstttt.....',
        '.....cccccc.....',
        '.....dddddd.....',
        '......pppp......',
        '......pppp......',
        '......qqqq......',
        '......bbbb......',
        '.....bbbbb......',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....cccdcc.....',
        '.....cccdcdc....',
        '.....tttttts....',
        '.....cccccc.....',
        '.....dddddd.....',
        '.....qq..pp.....',
        '....qq....pp....',
        '....qq....qq....',
        '...bbb....bb....',
        '...bbb.....bb...',
      ],
    ],
    up: [
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....bbb..qqq....',
        '...bbbb..bbb....',
        '.........bbbb...',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....qqq..qqq....',
        '....bbb..bbb....',
        '...bbbb..bbbb...',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...stttttttts...',
        '....cccccccc....',
        '....dddddddd....',
        '....ppp..ppp....',
        '....ppp..ppp....',
        '....qqq..bbb....',
        '....bbb..bbbb...',
        '...bbbb.........',
      ],
    ],
  },
  dress: {
    down: [
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '....bbb.........',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '....bbb..bbb....',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '.........bbb....',
      ],
    ],
    left: [
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '....csdcccc.....',
        '.....tttttt.....',
        '....cccccccc....',
        '....cccccccc....',
        '...ccccccccc....',
        '...ddddddddd....',
        '.....ss..ss.....',
        '....bb....bb....',
        '...bbb..........',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '.....csdccc.....',
        '.....tttttt.....',
        '....cccccccc....',
        '....cccccccc....',
        '...ccccccccc....',
        '...ddddddddd....',
        '......ssss......',
        '......bbbb......',
        '.....bbbbb......',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....cccdcc.....',
        '.....cccdcsc....',
        '.....tttttt.....',
        '....cccccccc....',
        '....cccccccc....',
        '...ccccccccc....',
        '...ddddddddd....',
        '.....ss..ss.....',
        '....bb....bb....',
        '..........bbb...',
      ],
    ],
    up: [
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '....bbb.........',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '....bbb..bbb....',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....tttttttt....',
        '...cccccccccc...',
        '...cccccccccc...',
        '..cccccccccccc..',
        '..dddddddddddd..',
        '.....ss..ss.....',
        '.....bb..bb.....',
        '.........bbb....',
      ],
    ],
  },
  robe: {
    down: [
      [
        '....cccttccc....',
        '...ccccttcccc...',
        '...cdccttccdc...',
        '...cdccttccdc...',
        '...sdccttccds...',
        '....cccttccc....',
        '....cccttccc....',
        '...ccccttcccc...',
        '...ccccttcccc...',
        '...ddddttdddd...',
        '...dddddddddd...',
        '....bb..........',
      ],
      [
        '....cccttccc....',
        '...ccccttcccc...',
        '...cdccttccdc...',
        '...cdccttccdc...',
        '...sdccttccds...',
        '....cccttccc....',
        '....cccttccc....',
        '...ccccttcccc...',
        '...ccccttcccc...',
        '...ddddttdddd...',
        '...dddddddddd...',
        '....bb....bb....',
      ],
      [
        '....cccttccc....',
        '...ccccttcccc...',
        '...cdccttccdc...',
        '...cdccttccdc...',
        '...sdccttccds...',
        '....cccttccc....',
        '....cccttccc....',
        '...ccccttcccc...',
        '...ccccttcccc...',
        '...ddddttdddd...',
        '...dddddddddd...',
        '..........bb....',
      ],
    ],
    left: [
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '....cdcdccc.....',
        '....sccdccc.....',
        '.....cccccc.....',
        '.....cccccc.....',
        '....ccccccc.....',
        '....ccccccc.....',
        '....ddddddd.....',
        '....ddddddd.....',
        '...bbb.....b....',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....ccdccc.....',
        '.....ccdccc.....',
        '.....csdccc.....',
        '.....cccccc.....',
        '.....cccccc.....',
        '....ccccccc.....',
        '....ccccccc.....',
        '....ddddddd.....',
        '....ddddddd.....',
        '....bbb.........',
      ],
      [
        '.....cccccc.....',
        '.....cccccc.....',
        '.....cccdcc.....',
        '.....cccdcdc....',
        '.....cccdcs.....',
        '.....cccccc.....',
        '.....cccccc.....',
        '....ccccccc.....',
        '....ccccccc.....',
        '....ddddddd.....',
        '....ddddddd.....',
        '.....bbb........',
      ],
    ],
    up: [
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....cccccccc....',
        '....cccccccc....',
        '...cccccccccc...',
        '...cccccccccc...',
        '...dddddddddd...',
        '...dddddddddd...',
        '....bb..........',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....cccccccc....',
        '....cccccccc....',
        '...cccccccccc...',
        '...cccccccccc...',
        '...dddddddddd...',
        '...dddddddddd...',
        '....bb....bb....',
      ],
      [
        '....cccccccc....',
        '...cccccccccc...',
        '...cdccccccdc...',
        '...cdccccccdc...',
        '...sdccccccds...',
        '....cccccccc....',
        '....cccccccc....',
        '...cccccccccc...',
        '...cccccccccc...',
        '...dddddddddd...',
        '...dddddddddd...',
        '..........bb....',
      ],
    ],
  },
  armor: {
    down: [],
    left: [],
    up: [],
  },
};

// Armour = tunic with shoulder plates.
function withPauldrons(rows: Rows, dir: Dir): Rows {
  const out = [...rows];
  if (dir === 'left') {
    out[0] = '.....aacccc.....';
    out[1] = '....aaaccccc....';
  } else {
    out[0] = '...aaccccccaa...';
    out[1] = '..aaaccccccaaa..';
  }
  return check(out, `armor-${dir}`);
}
for (const dir of ['down', 'left', 'up'] as Dir[]) {
  BODY.armor[dir] = BODY.tunic[dir].map((rows) => withPauldrons(rows, dir));
}

type HairStyle = 'short' | 'long' | 'spiky' | 'bald' | 'bun' | 'ponytail' | 'none';

const HAIR: Record<Exclude<HairStyle, 'none'>, Record<Dir, Rows>> = {
  short: {
    down: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhllhhhhhhh..',
      '..hhllhhhhhhhh..',
      '..hhhh.hh.hhhh..',
      '..hhh......hhh..',
      '..hh........hh..',
      '..h..........h..',
    ],
    left: [
      '................',
      '.....hhhhhh.....',
      '....hhhhhllhh...',
      '...hhhhhllhhhh..',
      '..hhhhhhhhhhhh..',
      '..hh..hhhhhhhh..',
      '..h.....hhhhhh..',
      '........ghhhhh..',
      '.........ghhhh..',
      '..........ggg...',
    ],
    up: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhhhllhhhhh..',
      '..hhhhllhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....gggggggg....',
    ],
  },
  long: {
    down: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhllhhhhhhh..',
      '..hhllhhhhhhhh..',
      '..hhh.hhhh.hhh..',
      '..hhh......hhh..',
      '..hh........hh..',
      '..hh........hh..',
      '..hh........hh..',
      '..hh........hh..',
      '..hh........hh..',
      '..hg........gh..',
      '..gg........gg..',
    ],
    left: [
      '................',
      '.....hhhhhh.....',
      '....hhhhhllhh...',
      '...hhhhhllhhhh..',
      '..hhhhhhhhhhhh..',
      '..hh..hhhhhhhh..',
      '..h.....hhhhhh..',
      '........hhhhhh..',
      '........hhhhhh..',
      '........hhhhhh..',
      '.........hhhhh..',
      '.........hhhhh..',
      '.........hhhhg..',
      '..........gggg..',
    ],
    up: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhhhllhhhhh..',
      '..hhhhllhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...gggggggggg...',
    ],
  },
  spiky: {
    down: [
      '................',
      '..h..h.hh.h..h..',
      '..hhhhhhhhhhhh..',
      '.hhhhllhhhhhhhh.',
      '..hhllhhhhhhhh..',
      '..hhhh.hh.hhhh..',
      '..hhh......hhh..',
      '.hh..........hh.',
    ],
    left: [
      '................',
      '....h.hh.hh.h...',
      '...hhhhhhllhhh..',
      '..hhhhhhllhhhhh.',
      '..hhhhhhhhhhhhh.',
      '..hh..hhhhhhhhh.',
      '..h.....hhhhhhh.',
      '........ghhhhh..',
      '.........ghhhh..',
      '..........ggg...',
    ],
    up: [
      '................',
      '..h..h.hh.h..h..',
      '..hhhhhhhhhhhh..',
      '.hhhhhllhhhhhhh.',
      '..hhhhllhhhhhh..',
      '..hhhhhhhhhhhh..',
      '.hhhhhhhhhhhhhh.',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....gggggggg....',
    ],
  },
  bald: {
    down: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '..h..........h..',
      '..hh........hh..',
      '..hh........hh..',
      '..h..........h..',
    ],
    left: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '.........hhhh...',
      '........hhhhh...',
      '........hhhhhh..',
      '.........hhhhh..',
      '..........hhh...',
    ],
    up: [
      '................',
      '................',
      '................',
      '................',
      '................',
      '..h..........h..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....gggggggg....',
    ],
  },
  bun: {
    down: [
      '................',
      '......hhhh......',
      '....hhhllhhh....',
      '..hhhhhhhhhhhh..',
      '..hhllhhhhhhhh..',
      '..hhh.hhhh.hhh..',
      '..hh........hh..',
      '..h..........h..',
    ],
    left: [
      '................',
      '.........hhh....',
      '....hhhhhhhhh...',
      '...hhhhhhhllhh..',
      '..hhhhhhhhhhhh..',
      '..hh..hhhhhhhh..',
      '..h.....hhhhhh..',
      '........hhhhhh..',
      '.........hhhh...',
    ],
    up: [
      '................',
      '......hhhh......',
      '....hhhllhhh....',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....gggggggg....',
    ],
  },
  ponytail: {
    down: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhllhhhhhhh..',
      '..hhllhhhhhhhh..',
      '..hhhh.hh.hhhh..',
      '..hhh......hhh..',
      '..hh........hh..',
      '..h..........h..',
    ],
    left: [
      '................',
      '.....hhhhhh.....',
      '....hhhhhllhh...',
      '...hhhhhllhhhh..',
      '..hhhhhhhhhhhhh.',
      '..hh..hhhhhhhhh.',
      '..h.....hhhhhhh.',
      '........ghhhh.h.',
      '.........ghh..h.',
      '..........g...h.',
      '.............g..',
    ],
    up: [
      '................',
      '.....hhhhhh.....',
      '...hhhhhhhhhh...',
      '..hhhhhllhhhhh..',
      '..hhhhllhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....gghhhggg....',
      '......hhhh......',
      '.......hh.......',
      '.......gg.......',
    ],
  },
};

type Headgear = 'none' | 'hood' | 'helmet' | 'crown' | 'tiara' | 'cap' | 'bandana' | 'horns';

const HEADGEAR: Record<Exclude<Headgear, 'none'>, Record<Dir, Rows>> = {
  hood: {
    down: [
      '................',
      '.....cccccc.....',
      '...cccccccccc...',
      '..cccccccccccc..',
      '..cccddddddccc..',
      '..ccd......dcc..',
      '..cc........cc..',
      '..cc........cc..',
      '..cc........cc..',
      '..ccc......ccc..',
      '...cc......cc...',
    ],
    left: [
      '................',
      '.....cccccc.....',
      '....cccccccccc..',
      '...ccccccccccc..',
      '..cccddddccccc..',
      '..cd.....ccccc..',
      '..c......ccccc..',
      '..c......ccccc..',
      '.........ccccc..',
      '.........ccccc..',
      '........cccccc..',
    ],
    up: [
      '................',
      '.....cccccc.....',
      '...cccccccccc...',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '..cccccccccccc..',
      '...cccccccccc...',
    ],
  },
  helmet: {
    down: [
      '................',
      '.....mmmmmm.....',
      '...mmaammmmmm...',
      '..mmaammmmmmmm..',
      '..mmmmmmmmmmmm..',
      '..nnnnnnnnnnnn..',
      '..mm........mm..',
      '..mm........mm..',
      '..mn........nm..',
    ],
    left: [
      '................',
      '.....mmmmmm.....',
      '....mmaammmmm...',
      '...mmaammmmmmm..',
      '..mmmmmmmmmmmm..',
      '..nnnnnnnnnnnn..',
      '..m.....mmmmmm..',
      '........mmmmmm..',
      '.........nnnnn..',
    ],
    up: [
      '................',
      '.....mmmmmm.....',
      '...mmmmmmmmmm...',
      '..mmmaammmmmmm..',
      '..mmmmmmmmmmmm..',
      '..mmmmmmmmmmmm..',
      '..mmmmmmmmmmmm..',
      '..mmmmmmmmmmmm..',
      '..nnnnnnnnnnnn..',
      '...nnnnnnnnnn...',
    ],
  },
  crown: {
    down: ['................', '....y.yyyy.y....', '....yyyyyyyy....', '....yyryyryy....'],
    left: ['................', '.....y.yy.y.y...', '.....yyyyyyyy...', '.....yryyyryy...'],
    up: ['................', '....y.yyyy.y....', '....yyyyyyyy....', '....yyryyryy....'],
  },
  tiara: {
    down: ['................', '................', '................', '....yyyrryyy....'],
    left: ['................', '................', '................', '...yyyyyr.......'],
    up: ['................', '................', '................', '....yyyyyyyy....'],
  },
  cap: {
    down: ['................', '.....kkkkkk.....', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '..KKKKKKKKKKKK..'],
    left: ['................', '.....kkkkkk.....', '....kkkkkkkkk...', '...kkkkkkkkkkk..', '.KKKKKKKKKKKKK..'],
    up: ['................', '.....kkkkkk.....', '...kkkkkkkkkk...', '..kkkkkkkkkkkk..', '..kkkkkkkkkkkk..'],
  },
  bandana: {
    down: ['................', '................', '................', '................', '..kkkkkkkkkkkk..'],
    left: [
      '................',
      '................',
      '................',
      '................',
      '..kkkkkkkkkkkkk.',
      '.............kk.',
      '..............k.',
    ],
    up: ['................', '................', '................', '................', '..kkkkkkkkkkkk..', '......kKKk......'],
  },
  horns: {
    down: ['.y............y.', '.yy..........yy.', '..yy........yy..', '...y........y...'],
    left: ['..........y.....', '.........yy.....', '........yy......', '................'],
    up: ['.y............y.', '.yy..........yy.', '..yy........yy..', '...y........y...'],
  },
};

const BEARD: Record<Dir, Rows> = {
  down: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '...h........h...',
    '...hh......hh...',
    '....hhhhhhhh....',
    '.....hhhhhh.....',
    '......hhhh......',
  ],
  left: [
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '..hh............',
    '..hhhh..........',
    '...hhhh.........',
    '...hhhh.........',
    '....hh..........',
  ],
  up: [],
};

const EARS: Record<Dir, Rows> = {
  down: ['', '', '', '', '', '.s............s.', '.ss..........ss.', '..s..........s..'],
  left: ['', '', '', '', '', '..........ss....', '..........sss...', '...........s....'],
  up: ['', '', '', '', '', '.s............s.', '.ss..........ss.', '..s..........s..'],
};

// ---------------------------------------------------------------------------
// Character specs
// ---------------------------------------------------------------------------

export interface HumanSpec {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  boots: string;
  trim: string;
  outfit: Outfit;
  headgear?: Headgear;
  /** Colour of caps/bandanas/capes */
  accessory?: string;
  metal?: string;
  beard?: boolean;
  ears?: boolean;
  cape?: string;
  eye?: string;
}

const SKIN = { light: '#f6d2b0', fair: '#efc39c', tan: '#d69a6e', dark: '#9a6440', green: '#8ac060', bone: '#e8e2d0', pale: '#dce4ec' };
const HAIR_C = {
  brown: '#7a4a28',
  dark: '#3a2a26',
  blond: '#e8c060',
  red: '#c8442c',
  white: '#e8e8f0',
  gray: '#a0a4b0',
  black: '#26222e',
  blue: '#4a6ad0',
  pink: '#e888b0',
  silver: '#c8d0e0',
};

export const HUMAN_SPECS: Record<string, HumanSpec> = {
  hero: { skin: SKIN.fair, hair: HAIR_C.brown, hairStyle: 'spiky', top: '#3060c0', bottom: '#5a4030', boots: '#4a3020', trim: '#c89a30', outfit: 'tunic', cape: '#b02830' },
  heroine: { skin: SKIN.light, hair: HAIR_C.red, hairStyle: 'ponytail', top: '#38a050', bottom: '#e8d8b0', boots: '#6a4028', trim: '#e0b040', outfit: 'tunic' },
  mage: { skin: SKIN.fair, hair: HAIR_C.blond, hairStyle: 'short', top: '#6a3aa8', bottom: '#4a2a70', boots: '#3a2a3a', trim: '#e0c050', outfit: 'robe', headgear: 'hood' },
  knight: { skin: SKIN.fair, hair: HAIR_C.dark, hairStyle: 'short', top: '#a8b0c0', bottom: '#5a6070', boots: '#4a505c', trim: '#7a4a28', outfit: 'armor', headgear: 'helmet', metal: '#a8b0c0' },
  priest: { skin: SKIN.light, hair: HAIR_C.blond, hairStyle: 'long', top: '#f0f0f8', bottom: '#d0d0e0', boots: '#a08060', trim: '#d8b040', outfit: 'robe' },
  thief: { skin: SKIN.tan, hair: HAIR_C.black, hairStyle: 'short', top: '#3a5a3a', bottom: '#3a3a40', boots: '#2a2420', trim: '#8a6a3a', outfit: 'tunic', headgear: 'bandana', accessory: '#b03030' },
  villager: { skin: SKIN.fair, hair: HAIR_C.brown, hairStyle: 'short', top: '#c8a060', bottom: '#5a6a8a', boots: '#5a3a24', trim: '#6a4a2a', outfit: 'tunic' },
  villagerF: { skin: SKIN.light, hair: HAIR_C.brown, hairStyle: 'long', top: '#d06a6a', bottom: '#f0e0c8', boots: '#6a4028', trim: '#f0f0f0', outfit: 'dress' },
  oldMan: { skin: SKIN.fair, hair: HAIR_C.white, hairStyle: 'bald', top: '#7a6a5a', bottom: '#5a4a3a', boots: '#4a3a2a', trim: '#4a3a2a', outfit: 'robe', beard: true },
  oldWoman: { skin: SKIN.fair, hair: HAIR_C.gray, hairStyle: 'bun', top: '#8a5a8a', bottom: '#6a4a6a', boots: '#4a3a3a', trim: '#e0d0e0', outfit: 'dress' },
  boy: { skin: SKIN.tan, hair: HAIR_C.black, hairStyle: 'short', top: '#e08a30', bottom: '#3a5aa0', boots: '#5a3a24', trim: '#5a3a24', outfit: 'tunic', headgear: 'cap', accessory: '#3a8ac8' },
  girl: { skin: SKIN.light, hair: HAIR_C.blond, hairStyle: 'ponytail', top: '#e888b0', bottom: '#f8f0f0', boots: '#a05070', trim: '#ffffff', outfit: 'dress' },
  merchant: { skin: SKIN.fair, hair: HAIR_C.brown, hairStyle: 'short', top: '#4a8a5a', bottom: '#6a5a3a', boots: '#4a3a24', trim: '#e0c050', outfit: 'robe', headgear: 'cap', accessory: '#c8a040', beard: true },
  guard: { skin: SKIN.tan, hair: HAIR_C.dark, hairStyle: 'short', top: '#8a92a4', bottom: '#3a4a7a', boots: '#3a3a44', trim: '#c03030', outfit: 'armor', headgear: 'helmet', metal: '#8a92a4' },
  king: { skin: SKIN.fair, hair: HAIR_C.white, hairStyle: 'short', top: '#b02830', bottom: '#802028', boots: '#4a2a20', trim: '#f0d060', outfit: 'robe', headgear: 'crown', beard: true, cape: '#702060' },
  princess: { skin: SKIN.light, hair: HAIR_C.blond, hairStyle: 'long', top: '#f090c0', bottom: '#f8d0e8', boots: '#c06090', trim: '#ffe080', outfit: 'dress', headgear: 'tiara' },
  sage: { skin: SKIN.fair, hair: HAIR_C.silver, hairStyle: 'long', top: '#2a4a8a', bottom: '#1a3060', boots: '#2a2a3a', trim: '#c8d8f0', outfit: 'robe', beard: true },
  blacksmith: { skin: SKIN.tan, hair: HAIR_C.red, hairStyle: 'bald', top: '#5a4a40', bottom: '#3a3030', boots: '#2a2420', trim: '#8a5a30', outfit: 'tunic', beard: true },
  innkeeper: { skin: SKIN.light, hair: HAIR_C.brown, hairStyle: 'bun', top: '#f0f0f0', bottom: '#5a7aa8', boots: '#5a3a24', trim: '#c84040', outfit: 'dress' },
  darkLord: { skin: SKIN.pale, hair: HAIR_C.black, hairStyle: 'long', top: '#2a1a3a', bottom: '#1a1020', boots: '#141018', trim: '#c02040', outfit: 'robe', headgear: 'horns', cape: '#4a0a1a', eye: '#e02020' },
  skeleton: { skin: SKIN.bone, hair: SKIN.bone, hairStyle: 'none', top: '#c8c2b0', bottom: '#a8a290', boots: '#8a8474', trim: '#6a6458', outfit: 'tunic', eye: '#2a1a1a' },
  goblin: { skin: SKIN.green, hair: '#4a3a2a', hairStyle: 'none', top: '#7a5a3a', bottom: '#5a4028', boots: '#3a2a1a', trim: '#3a2a1a', outfit: 'tunic', ears: true, eye: '#f0d020' },
};

function paletteFor(spec: HumanSpec): Record<string, string> {
  const metal = spec.metal ?? '#a0a8b8';
  const acc = spec.accessory ?? spec.trim;
  return {
    s: spec.skin,
    z: shade(spec.skin, -0.18),
    e: spec.eye ?? '#2a2030',
    c: spec.top,
    d: shade(spec.top, -0.28),
    t: spec.trim,
    p: spec.bottom,
    q: shade(spec.bottom, -0.25),
    b: spec.boots,
    h: spec.hair,
    g: shade(spec.hair, -0.3),
    l: mix(spec.hair, '#ffffff', 0.35),
    m: metal,
    n: shade(metal, -0.35),
    a: mix(metal, '#ffffff', 0.45),
    k: acc,
    K: shade(acc, -0.3),
    y: '#f0c840',
    r: '#e03050',
  };
}

function overlay(p: Pix, rows: Rows, pal: Record<string, string>, ox: number, oy: number, flip: boolean, startRow = 0): void {
  rows.forEach((row, y) => {
    if (!row) return;
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const c = pal[ch];
      if (!c) continue;
      p.set(ox + (flip ? FW - 1 - x : x), oy + startRow + y, c);
    }
  });
}

function capeRows(dir: Dir, front: boolean): Rows {
  if (dir === 'up' && front) {
    return [
      '...kkkkkkkkkk...',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..kkkkkkkkkkkk..',
      '..KKKKKKKKKKKK..',
    ];
  }
  if (dir === 'down' && !front) {
    return [
      '................',
      '..k..........k..',
      '..k..........k..',
      '..k..........k..',
      '..kk........kk..',
      '..kk........kk..',
      '..kk........kk..',
      '..kk........kk..',
      '..KK........KK..',
    ];
  }
  if (dir === 'left' && !front) {
    return [
      '..........k.....',
      '..........kk....',
      '..........kkk...',
      '..........kkk...',
      '..........kkkk..',
      '..........kkkk..',
      '..........kkkk..',
      '..........kkkk..',
      '..........KKKK..',
    ];
  }
  return [];
}

/** Draw one humanoid frame into p at (ox, oy). */
function drawHumanFrame(p: Pix, spec: HumanSpec, dir: Dir, frame: number, ox: number, oy: number, flip: boolean): void {
  const pal = paletteFor(spec);
  const capePal = { ...pal, k: spec.cape ?? pal.k, K: shade(spec.cape ?? pal.k, -0.3) };
  const layer = new Pix(FW, FH);
  // the head bobs down one pixel on stepping frames
  const hy = frame === 1 ? 0 : 1;
  if (spec.cape) overlay(layer, capeRows(dir, false), capePal, 0, 0, false, 11);
  overlay(layer, HEAD[dir], pal, 0, hy, false);
  if (spec.ears) overlay(layer, EARS[dir], pal, 0, hy, false);
  overlay(layer, BODY[spec.outfit][dir][frame], pal, 0, 0, false, 11);
  if (spec.cape) overlay(layer, capeRows(dir, true), capePal, 0, 0, false, 11);
  if (spec.beard) overlay(layer, BEARD[dir], pal, 0, hy, false);
  const covered = spec.headgear === 'hood' || spec.headgear === 'helmet';
  if (spec.hairStyle !== 'none' && !covered) {
    overlay(layer, HAIR[spec.hairStyle][dir], pal, 0, hy, false);
  } else if (covered && dir === 'down' && spec.hairStyle !== 'none' && spec.hairStyle !== 'bald') {
    // a few strands of hair peek out from under hoods and helmets
    overlay(layer, ['', '', '', '', '', '....hh....hh....'], pal, 0, hy, false);
  }
  if (spec.headgear && spec.headgear !== 'none') overlay(layer, HEADGEAR[spec.headgear][dir], pal, 0, hy, false);
  layer.outline('#1c1626');
  p.blit(layer, ox, oy, flip);
}

/** Sheet layout: rows down, left, right, up; columns frame 0..2. */
function humanSheet(spec: HumanSpec): HTMLCanvasElement {
  const p = new Pix(FW * 3, FH * 4);
  const rows: [Dir, boolean][] = [
    ['down', false],
    ['left', false],
    ['left', true],
    ['up', false],
  ];
  rows.forEach(([dir, flip], r) => {
    for (let f = 0; f < 3; f++) drawHumanFrame(p, spec, dir, f, f * FW, r * FH, flip);
  });
  return p.toCanvas(2);
}

// ---------------------------------------------------------------------------
// Creatures and objects (procedural)
// ---------------------------------------------------------------------------

type FrameFn = (p: Pix, dir: Dir, frame: number, flip: boolean) => void;

function proceduralSheet(fn: FrameFn, outline = true): HTMLCanvasElement {
  const p = new Pix(FW * 3, FH * 4);
  const rows: [Dir, boolean][] = [
    ['down', false],
    ['left', false],
    ['left', true],
    ['up', false],
  ];
  rows.forEach(([dir, flip], r) => {
    for (let f = 0; f < 3; f++) {
      const layer = new Pix(FW, FH);
      fn(layer, dir, f, flip);
      if (outline) layer.outline('#1c1626');
      p.blit(flip ? layer.flipped() : layer, f * FW, r * FH);
    }
  });
  return p.toCanvas(2);
}

/** Sheets whose four rows are animation stages instead of directions. */
function stagedSheet(fn: (p: Pix, stage: number, frame: number) => void, outline = true): HTMLCanvasElement {
  const p = new Pix(FW * 3, FH * 4);
  for (let r = 0; r < 4; r++) {
    for (let f = 0; f < 3; f++) {
      const layer = new Pix(FW, FH);
      fn(layer, r, f);
      if (outline) layer.outline('#1c1626');
      p.blit(layer, f * FW, r * FH);
    }
  }
  return p.toCanvas(2);
}

const slime: FrameFn = (p, dir, frame) => {
  const squash = [1.15, 1, 0.88][frame];
  const rx = 6 * squash;
  const ry = 5 / squash;
  const cy = 22 - ry;
  p.ellipse(7.5, cy, rx, ry, '#3a8ae0');
  p.ellipse(7.5, cy - 0.5, rx - 1, ry - 1, '#5aa8f0');
  p.poly(
    [
      [5.5, cy - ry + 1.5],
      [7.5, cy - ry - 2.5],
      [9.5, cy - ry + 1.5],
    ],
    '#5aa8f0',
  );
  p.set(5, Math.round(cy - ry + 2), '#c8e8ff');
  p.set(4, Math.round(cy - ry + 3), '#c8e8ff');
  if (dir === 'down') {
    p.rect(5, Math.round(cy), 1, 2, '#1c1626');
    p.rect(10, Math.round(cy), 1, 2, '#1c1626');
  } else if (dir === 'left') {
    p.rect(3, Math.round(cy), 1, 2, '#1c1626');
  }
};

const bat: FrameFn = (p, dir, frame) => {
  const cy = 12 + [0, 1, 0][frame];
  const wingY = [-4, 0, 3][frame];
  const body = '#5a3a6a';
  const wing = '#7a4a8a';
  p.ellipse(7.5, cy, 3, 3, body);
  p.poly(
    [
      [5, cy - 1],
      [0, cy + wingY - 2],
      [1, cy + wingY + 2],
      [3, cy + 1],
    ],
    wing,
  );
  p.poly(
    [
      [10, cy - 1],
      [15, cy + wingY - 2],
      [14, cy + wingY + 2],
      [12, cy + 1],
    ],
    wing,
  );
  p.set(5, cy - 3, body);
  p.set(10, cy - 3, body);
  if (dir !== 'up') {
    p.set(dir === 'left' ? 5 : 6, cy, '#ff4040');
    if (dir === 'down') p.set(9, cy, '#ff4040');
  }
  // shadow on the ground
  for (let x = 5; x <= 10; x++) p.blend(x, 21, '#00000040');
};

const ghost: FrameFn = (p, dir, frame) => {
  const top = 7 + [0, 1, 2][frame];
  const c = '#e8ecf8';
  p.ellipse(7.5, top + 5, 5.5, 5.5, c);
  p.rect(2, top + 5, 11, 7, c);
  for (let x = 2; x < 13; x++) {
    const wave = Math.round(Math.sin((x + frame * 2) * 1.2) * 1.2);
    p.vline(x, top + 12, top + 12 + wave, c);
  }
  p.rect(9, top + 3, 3, 9, '#c8d0e8');
  if (dir === 'down') {
    p.rect(5, top + 4, 2, 3, '#2a2040');
    p.rect(9, top + 4, 2, 3, '#2a2040');
    p.rect(7, top + 8, 2, 1, '#2a2040');
  } else if (dir === 'left') {
    p.rect(3, top + 4, 2, 3, '#2a2040');
  }
};

function quadruped(body: string, dark: string, light: string, kind: 'cat' | 'dog'): FrameFn {
  return (p, dir, frame) => {
    const legOff = [1, 0, -1][frame];
    if (dir === 'left') {
      p.ellipse(8, 17, 5, 3, body);
      p.circle(3.5, 13.5, 3, body);
      p.set(2, 13, '#1c1626');
      p.set(1, 15, dark);
      if (kind === 'cat') {
        p.set(2, 10, body);
        p.set(5, 10, body);
      } else {
        p.rect(4, 11, 2, 3, dark);
      }
      p.rect(4 + legOff, 19, 1, 3, dark);
      p.rect(6 - legOff, 19, 1, 3, body);
      p.rect(10 + legOff, 19, 1, 3, dark);
      p.rect(12 - legOff, 19, 1, 3, body);
      p.line(13, 16, 15, kind === 'cat' ? 11 : 14, body);
      p.set(8, 15, light);
    } else {
      p.ellipse(7.5, 18, 4, 3.5, body);
      p.circle(7.5, 13, 3.5, body);
      if (kind === 'cat') {
        p.set(4, 9, body);
        p.set(11, 9, body);
        p.set(4, 10, body);
        p.set(11, 10, body);
      } else {
        p.rect(3, 11, 2, 4, dark);
        p.rect(11, 11, 2, 4, dark);
      }
      if (dir === 'down') {
        p.set(6, 13, '#1c1626');
        p.set(9, 13, '#1c1626');
        p.set(7, 15, kind === 'cat' ? '#e07080' : '#1c1626');
        p.set(8, 15, kind === 'cat' ? '#e07080' : '#1c1626');
      } else {
        p.line(7, 19, 7 + legOff, 23, body);
      }
      p.rect(5, 20 + (frame === 0 ? -1 : 0), 2, 2, dark);
      p.rect(9, 20 + (frame === 2 ? -1 : 0), 2, 2, dark);
    }
  };
}

const chicken: FrameFn = (p, dir, frame) => {
  const bob = frame === 1 ? 0 : 1;
  if (dir === 'left') {
    p.ellipse(8.5, 17 + bob, 4.5, 3.5, P.white);
    p.circle(5, 12 + bob, 2.5, P.white);
    p.set(2, 12 + bob, P.o3);
    p.set(5, 9 + bob, P.r3);
    p.set(4, 12 + bob, '#1c1626');
    p.set(5, 15 + bob, P.r3);
    p.poly(
      [
        [12, 15 + bob],
        [15, 12 + bob],
        [13, 17 + bob],
      ],
      '#e8e8f0',
    );
  } else {
    p.ellipse(7.5, 17 + bob, 4, 3.5, P.white);
    p.circle(7.5, 12 + bob, 2.5, P.white);
    p.set(7, 9 + bob, P.r3);
    p.set(8, 9 + bob, P.r3);
    if (dir === 'down') {
      p.set(6, 12 + bob, '#1c1626');
      p.set(9, 12 + bob, '#1c1626');
      p.set(7, 13 + bob, P.o3);
      p.set(8, 13 + bob, P.o3);
    }
  }
  p.vline(6, 20 + bob, 22, P.o2);
  p.vline(9, 20 + bob, 22, P.o2);
};

function chestStage(color: string, trim: string) {
  return (p: Pix, stage: number) => {
    const y0 = 11;
    // base
    p.rect(2, y0 + 5, 12, 7, color);
    p.hline(2, 13, y0 + 11, shade(color, -0.35));
    p.vline(2, y0 + 5, y0 + 11, shade(color, 0.2));
    p.rect(2, y0 + 5, 12, 1, trim);
    p.rect(7, y0 + 5, 2, 3, trim);
    if (stage === 0) {
      p.rect(2, y0, 12, 5, shade(color, 0.12));
      p.ellipse(8, y0 + 1, 6, 2, shade(color, 0.12));
      p.hline(2, 13, y0 + 4, trim);
      p.vline(4, y0 - 1, y0 + 4, trim);
      p.vline(11, y0 - 1, y0 + 4, trim);
      p.rect(7, y0 + 3, 2, 3, P.y3);
      p.set(7, y0 + 5, '#1c1626');
    } else {
      // The lid swings back on a hinge at the rear edge of the box top; the
      // more it opens, the more of the dark interior and the lid's inner side show.
      const interiorTop = [0, 3, 2, 1][stage];
      p.rect(2, y0 + interiorTop, 12, 5 - interiorTop, '#1a120c');
      if (stage === 3) {
        p.set(6, y0 + 3, P.y3);
        p.set(9, y0 + 2, P.y4);
        p.set(10, y0 + 3, P.y3);
      }
      const lidTop = [0, -1, -4, -6][stage];
      const lidBottom = y0 + interiorTop;
      const inner = stage >= 2 ? shade(color, -0.25) : shade(color, 0.12);
      p.rect(2, y0 + lidTop, 12, lidBottom - (y0 + lidTop), inner);
      p.hline(2, 13, y0 + lidTop, trim);
      p.vline(4, y0 + lidTop, lidBottom - 1, trim);
      p.vline(11, y0 + lidTop, lidBottom - 1, trim);
    }
  };
}

const doorStage = (p: Pix, stage: number) => {
  // frame
  p.rect(1, 4, 14, 20, '#3a2418');
  p.rect(2, 5, 12, 19, P.black);
  const w = [12, 8, 4, 0][stage];
  if (w > 0) {
    p.rect(2, 5, w, 19, P.b3);
    for (let x = 4; x < 2 + w; x += 3) p.vline(x, 5, 23, P.b2);
    p.hline(2, 1 + w, 8, P.b2);
    p.hline(2, 1 + w, 18, P.b2);
    if (stage === 0) p.set(11, 14, P.y2);
  }
};

const crystalFrame = (p: Pix, _stage: number, frame: number) => {
  const bob = [0, -1, 0][frame];
  const cy = 10 + bob;
  p.poly(
    [
      [8, cy - 7],
      [13, cy],
      [8, cy + 8],
      [3, cy],
    ],
    '#4ac0f0',
  );
  p.poly(
    [
      [8, cy - 7],
      [8, cy + 8],
      [3, cy],
    ],
    '#8ae0ff',
  );
  p.line(8, cy - 5, 5, cy, P.white);
  for (let x = 5; x <= 11; x++) p.blend(x, 22, '#00000050');
  if (frame === 1) {
    p.set(12, cy - 6, P.white);
    p.set(3, cy + 5, P.white);
  }
};

const fireFrame = (p: Pix, _stage: number, frame: number) => {
  const sway = [-1, 0, 1][frame];
  p.poly(
    [
      [3, 22],
      [6 + sway, 10],
      [8 + sway, 13],
      [10 + sway, 7],
      [13, 22],
    ],
    P.o2,
  );
  p.poly(
    [
      [5, 22],
      [8 + sway, 13],
      [11, 22],
    ],
    P.o3,
  );
  p.poly(
    [
      [6, 22],
      [8, 17 - frame],
      [10, 22],
    ],
    P.y4,
  );
};

const leverStage = (p: Pix, stage: number) => {
  p.rect(4, 18, 8, 4, P.k2);
  p.hline(4, 11, 18, P.k4);
  const angle = [-0.8, -0.3, 0.8, 0.8][stage];
  const x1 = 8 + Math.sin(angle) * 8;
  const y1 = 18 - Math.cos(angle) * 8;
  p.thickLine(8, 18, x1, y1, 0.5, P.b3);
  p.circle(x1, y1, 1.5, stage >= 2 ? P.g4 : P.r3);
};

const boulderFrame: FrameFn = (p) => {
  p.circle(7.5, 15.5, 6.5, P.k3);
  p.circle(6.5, 14.5, 4.5, P.k4);
  p.set(5, 12, P.k5);
  p.set(6, 12, P.k5);
  p.line(9, 14, 11, 18, P.k2);
};

const sparkleFrame = (p: Pix, _stage: number, frame: number) => {
  const r = [1, 3, 2][frame];
  const c = P.white;
  p.hline(8 - r, 8 + r, 15, c);
  p.vline(8, 15 - r, 15 + r, c);
  p.set(8, 15, P.y3);
  if (frame === 1) {
    p.set(6, 13, P.y4);
    p.set(10, 17, P.y4);
  }
};

// ---------------------------------------------------------------------------

const SPECIAL: Record<string, () => HTMLCanvasElement> = {
  slime: () => proceduralSheet(slime),
  bat: () => proceduralSheet(bat),
  ghost: () => proceduralSheet(ghost),
  skeleton: () => humanSheet(HUMAN_SPECS.skeleton),
  goblin: () => humanSheet(HUMAN_SPECS.goblin),
  cat: () => proceduralSheet(quadruped('#e0a050', '#a06830', '#f8d090', 'cat')),
  dog: () => proceduralSheet(quadruped('#c89060', '#7a5030', '#e8c090', 'dog')),
  chicken: () => proceduralSheet(chicken),
  chest: () => stagedSheet(chestStage('#a0602c', '#e0b040')),
  door: () => stagedSheet(doorStage),
  crystal: () => stagedSheet(crystalFrame),
  fire: () => stagedSheet(fireFrame, false),
  lever: () => stagedSheet(leverStage),
  boulder: () => proceduralSheet(boulderFrame),
  sparkle: () => stagedSheet(sparkleFrame, false),
};

export function generateCharacterSheet(key: string): HTMLCanvasElement | null {
  const special = SPECIAL[key];
  if (special) return special();
  const spec = HUMAN_SPECS[key];
  if (spec) return humanSheet(spec);
  return null;
}
