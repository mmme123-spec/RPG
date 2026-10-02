/**
 * Built-in icon set: 64 icons drawn at 16x16 and scaled 2x, laid out in a
 * 16-column sheet. Indices match BUILTIN_ICONS.
 */

import { BUILTIN_ICONS, ICON_COLUMNS } from '../core/builtins';
import { P, mix, shade } from './color';
import { Pix } from './pixel';

const S = 16;
const OL = '#1c1626';

type IconFn = (p: Pix) => void;

function potion(liquid: string): IconFn {
  return (p) => {
    p.rect(6, 1, 4, 2, P.b3);
    p.hline(6, 9, 1, P.b4);
    p.rect(6, 3, 4, 3, '#d0e0f0');
    p.circle(8, 10, 5, '#d0e0f0');
    p.circle(8, 10.5, 4.2, liquid);
    p.rect(5, 8, 7, 1, mix(liquid, '#ffffff', 0.25));
    p.ellipse(9.5, 12, 2.2, 1.6, shade(liquid, -0.3));
    p.set(6, 9, '#ffffff');
    p.set(6, 10, '#ffffff');
    p.set(7, 4, '#ffffff');
  };
}

function gem(c: string): IconFn {
  return (p) => {
    p.poly(
      [
        [4, 6],
        [6, 3],
        [10, 3],
        [12, 6],
        [8, 13],
      ],
      c,
    );
    p.poly(
      [
        [4, 6],
        [12, 6],
        [8, 13],
      ],
      shade(c, -0.25),
    );
    p.poly(
      [
        [6, 6],
        [10, 6],
        [8, 12],
      ],
      c,
    );
    p.hline(6, 9, 4, mix(c, '#ffffff', 0.5));
    p.set(6, 5, '#ffffff');
  };
}

/** A blade pointing to the top-right with the hilt at the bottom-left. */
function blade(len: number, width: number, guard: number): IconFn {
  return (p) => {
    const gx = 4.5;
    const gy = 11.5;
    p.thickLine(gx + 1, gy - 1, gx + len, gy - len, width / 2, P.k4);
    p.line(gx + 1, gy - 2, gx + len - 1, gy - len, P.k6);
    p.thickLine(gx - guard / 2, gy - guard / 2, gx + guard / 2, gy + guard / 2, 0.7, P.y2);
    p.thickLine(gx - 0.5, gy + 0.5, gx - 2.5, gy + 2.5, 0.6, P.b3);
    p.circle(gx - 3, gy + 3, 1, P.y2);
  };
}

function shaft(p: Pix, x0: number, y0: number, x1: number, y1: number): void {
  p.thickLine(x0, y0, x1, y1, 0.6, P.b3);
  p.line(x0, y0 - 1, x1, y1 - 1, P.b4);
}

function arrow(up: boolean): IconFn {
  return (p) => {
    const c = up ? '#40d060' : '#e04848';
    if (up) {
      p.poly(
        [
          [12, 7],
          [16, 11],
          [8, 11],
        ],
        c,
      );
      p.rect(11, 11, 3, 4, c);
    } else {
      p.poly(
        [
          [12, 15],
          [16, 11],
          [8, 11],
        ],
        c,
      );
      p.rect(11, 7, 3, 4, c);
    }
  };
}

const ICONS: IconFn[] = [];

const def = (name: string, fn: IconFn) => {
  const idx = BUILTIN_ICONS.indexOf(name);
  if (idx < 0) throw new Error(`Unknown icon ${name}`);
  ICONS[idx] = fn;
};

def('None', () => {});
def('Red Potion', potion(P.r3));
def('Blue Potion', potion(P.u3));
def('Green Potion', potion(P.g4));
def('Elixir', potion(P.y2));
def('Herb', (p) => {
  p.thickLine(8, 14, 8, 8, 0.5, P.g1);
  p.ellipse(5, 7, 3, 2, P.g3);
  p.ellipse(11, 7, 3, 2, P.g3);
  p.ellipse(8, 4, 2, 3, P.g4);
  p.line(3, 7, 7, 7, P.g2);
  p.line(9, 7, 13, 7, P.g2);
  p.set(8, 2, P.g5);
});
def('Bread', (p) => {
  p.ellipse(8, 9, 6.5, 4.5, P.b4);
  p.ellipse(7.5, 8, 5.5, 3, P.b5);
  for (const x of [5, 8, 11]) p.line(x, 6, x - 1, 9, P.b3);
});
def('Feather', (p) => {
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    p.ellipse(4 + t * 9, 13 - t * 10, 2.4 - t * 0.8, 1.4, mix(P.o2, P.r3, t));
  }
  p.line(2, 15, 13, 3, P.y3);
});
def('Scroll', (p) => {
  p.rect(3, 4, 10, 8, P.s4);
  p.rect(2, 3, 2, 10, P.s2);
  p.rect(12, 3, 2, 10, P.s2);
  for (const y of [6, 8, 10]) p.hline(5, 10, y, P.s1);
  p.set(8, 8, P.r2);
});
def('Book', (p) => {
  p.rect(3, 2, 10, 12, P.r2);
  p.rect(3, 2, 2, 12, P.r1);
  p.rect(12, 3, 1, 10, P.s4);
  p.rect(6, 5, 5, 3, P.y2);
  p.hline(3, 12, 13, P.r1);
});
def('Key', (p) => {
  p.circle(5, 5, 3.5, P.y2);
  p.circle(5, 5, 1.5, '#00000000');
  p.clear(5, 5);
  p.clear(4, 5);
  p.clear(5, 4);
  p.clear(4, 4);
  p.thickLine(7, 7, 13, 13, 0.7, P.y2);
  p.rect(10, 12, 2, 2, P.y2);
  p.rect(12, 10, 2, 2, P.y2);
  p.set(3, 3, P.y4);
});
def('Ruby', gem(P.r3));
def('Sapphire', gem(P.u3));
def('Gold Bag', (p) => {
  p.ellipse(8, 10, 5.5, 4.5, P.s1);
  p.poly(
    [
      [6, 6],
      [10, 6],
      [11, 3],
      [5, 3],
    ],
    P.s1,
  );
  p.hline(6, 10, 6, P.b2);
  p.circle(8, 10, 2.2, P.y2);
  p.set(8, 10, P.y4);
});
def('Letter', (p) => {
  p.rect(2, 4, 12, 9, P.white);
  p.line(2, 4, 8, 9, P.k3);
  p.line(13, 4, 8, 9, P.k3);
  p.circle(8, 9, 1.3, P.r2);
});
def('Bomb', (p) => {
  p.circle(7, 10, 5, P.k1);
  p.set(5, 8, P.k4);
  p.set(5, 7, P.k3);
  p.rect(9, 4, 2, 2, P.k3);
  p.line(10, 4, 12, 2, P.b4);
  p.set(13, 1, P.y3);
  p.set(12, 1, P.o3);
  p.set(13, 2, P.o3);
});
def('Sword', blade(10, 2.2, 6));
def('Greatsword', blade(11, 3.6, 7));
def('Dagger', blade(7, 2, 4));
def('Axe', (p) => {
  shaft(p, 3, 14, 11, 4);
  p.poly(
    [
      [9, 2],
      [14, 4],
      [15, 9],
      [11, 8],
    ],
    P.k4,
  );
  p.line(14, 4, 15, 8, P.k6);
});
def('Spear', (p) => {
  shaft(p, 2, 15, 12, 4);
  p.poly(
    [
      [11, 4],
      [15, 0],
      [13, 6],
    ],
    P.k5,
  );
  p.poly(
    [
      [10, 6],
      [14, 1],
      [12, 4],
    ],
    P.k4,
  );
  p.line(10, 4, 12, 6, P.r2);
});
def('Bow', (p) => {
  for (let a = -70; a <= 70; a += 5) {
    const r = (a * Math.PI) / 180;
    p.thickLine(4 + Math.cos(r) * 6, 8 + Math.sin(r) * 6.5, 4 + Math.cos(r) * 6, 8 + Math.sin(r) * 6.5, 0.6, P.b3);
  }
  p.vline(6, 2, 14, P.k5);
  p.line(3, 8, 13, 8, P.b4);
  p.poly(
    [
      [13, 6],
      [15, 8],
      [13, 10],
    ],
    P.k4,
  );
});
def('Staff', (p) => {
  shaft(p, 3, 15, 10, 5);
  p.circle(11, 4, 3, P.p2);
  p.circle(10.5, 3.5, 1.6, P.p4);
  p.set(10, 3, '#ffffff');
});
def('Mace', (p) => {
  shaft(p, 3, 15, 9, 7);
  p.circle(10.5, 5.5, 3.5, P.k3);
  p.set(9, 4, P.k5);
  for (const [x, y] of [
    [10, 1],
    [15, 5],
    [10, 10],
    [6, 5],
    [14, 2],
    [14, 9],
  ]) p.set(x, y, P.k4);
});
def('Buckler', (p) => {
  p.circle(8, 8, 6, P.b3);
  p.circle(8, 8, 4.5, P.b4);
  p.circle(8, 8, 1.8, P.k4);
  p.set(7, 7, P.k6);
  p.set(5, 5, P.b5);
});
def('Shield', (p) => {
  p.poly(
    [
      [2, 2],
      [14, 2],
      [14, 8],
      [8, 15],
      [2, 8],
    ],
    P.u2,
  );
  p.poly(
    [
      [3, 3],
      [8, 3],
      [8, 13],
      [3, 8],
    ],
    P.u3,
  );
  p.vline(8, 3, 13, P.y2);
  p.hline(3, 13, 6, P.y2);
});
def('Helmet', (p) => {
  p.ellipse(8, 8, 6, 6, P.k4);
  p.rect(2, 8, 12, 5, P.k4);
  p.rect(4, 9, 8, 2, P.k1);
  p.rect(7, 9, 2, 5, P.k4);
  p.ellipse(6, 5, 2, 1.5, P.k6);
  p.vline(8, 1, 5, P.r2);
});
def('Hat', (p) => {
  p.poly(
    [
      [8, 1],
      [12, 11],
      [4, 11],
    ],
    P.p2,
  );
  p.ellipse(8, 12, 7, 2, P.p1);
  p.hline(5, 11, 10, P.y2);
  p.set(8, 1, P.y3);
});
def('Armor', (p) => {
  p.poly(
    [
      [3, 3],
      [6, 2],
      [8, 4],
      [10, 2],
      [13, 3],
      [14, 7],
      [12, 8],
      [12, 14],
      [4, 14],
      [4, 8],
      [2, 7],
    ],
    P.k4,
  );
  p.line(8, 5, 8, 13, P.k3);
  p.line(5, 6, 6, 12, P.k6);
  p.hline(4, 12, 11, P.b3);
});
def('Robe', (p) => {
  p.poly(
    [
      [5, 2],
      [11, 2],
      [14, 14],
      [2, 14],
    ],
    P.u2,
  );
  p.poly(
    [
      [6, 2],
      [8, 6],
      [10, 2],
    ],
    P.s4,
  );
  p.vline(8, 6, 14, P.y2);
  p.line(5, 4, 3, 13, P.u3);
});
def('Ring', (p) => {
  p.circle(8, 10, 4.5, P.y2);
  p.circle(8, 10, 2.5, '#00000000');
  for (let y = 8; y <= 12; y++) for (let x = 6; x <= 10; x++) if (Math.hypot(x + 0.5 - 8, y + 0.5 - 10) < 2.6) p.clear(x, y);
  p.poly(
    [
      [6, 5],
      [8, 2],
      [10, 5],
      [8, 7],
    ],
    P.r3,
  );
  p.set(7, 4, '#ffffff');
});
def('Amulet', (p) => {
  for (let a = 200; a <= 340; a += 8) {
    const r = (a * Math.PI) / 180;
    p.set(8 + Math.cos(r) * 6, 6 + Math.sin(r) * -5, P.y1);
  }
  p.line(2, 6, 7, 11, P.y1);
  p.line(14, 6, 9, 11, P.y1);
  p.circle(8, 11.5, 3, P.y2);
  p.circle(8, 11.5, 1.8, P.g3);
  p.set(7, 11, '#ffffff');
});
def('Boots', (p) => {
  p.rect(4, 2, 5, 10, P.b3);
  p.rect(4, 10, 10, 4, P.b3);
  p.hline(4, 13, 13, P.b1);
  p.vline(5, 2, 11, P.b4);
  p.hline(4, 8, 3, P.b2);
});
def('Gloves', (p) => {
  p.rect(4, 6, 8, 7, P.b4);
  for (let i = 0; i < 4; i++) p.rect(4 + i * 2, 3, 2, 4, P.b4);
  p.rect(12, 7, 2, 3, P.b4);
  p.rect(4, 12, 8, 3, P.b2);
  p.vline(5, 3, 12, P.b5);
});
def('Fire', (p) => {
  p.poly(
    [
      [3, 14],
      [3, 8],
      [6, 3],
      [7, 7],
      [10, 1],
      [13, 7],
      [13, 14],
    ],
    P.o2,
  );
  p.poly(
    [
      [5, 14],
      [6, 9],
      [8, 11],
      [10, 6],
      [11, 14],
    ],
    P.o3,
  );
  p.poly(
    [
      [7, 14],
      [8, 11],
      [9, 14],
    ],
    P.y4,
  );
});
def('Ice', (p) => {
  const c = '#8ad8ff';
  p.thickLine(8, 1, 8, 15, 0.7, c);
  p.thickLine(2, 4, 14, 12, 0.7, c);
  p.thickLine(2, 12, 14, 4, 0.7, c);
  p.circle(8, 8, 2, '#ffffff');
  for (const [x, y] of [
    [8, 1],
    [8, 15],
    [2, 4],
    [14, 12],
    [2, 12],
    [14, 4],
  ]) p.set(x, y, '#ffffff');
});
def('Thunder', (p) => {
  p.poly(
    [
      [9, 0],
      [3, 9],
      [7, 9],
      [5, 16],
      [13, 6],
      [9, 6],
      [11, 0],
    ],
    P.y3,
  );
  p.line(8, 2, 5, 8, P.y4);
});
def('Wind', (p) => {
  const c = '#9ae8c0';
  for (const [y, len] of [
    [4, 9],
    [8, 12],
    [12, 8],
  ]) {
    p.hline(2, 2 + len, y, c);
    p.set(3 + len, y - 1, c);
    p.set(4 + len, y - 2, c);
    p.set(3 + len, y - 3, c);
  }
});
def('Earth', (p) => {
  p.poly(
    [
      [1, 14],
      [4, 6],
      [8, 9],
      [11, 3],
      [15, 14],
    ],
    '#a0784a',
  );
  p.poly(
    [
      [4, 6],
      [6, 14],
      [1, 14],
    ],
    '#c89a60',
  );
  p.line(11, 3, 9, 14, '#7a5430');
});
def('Water', (p) => {
  p.circle(8, 10, 4.5, P.w3);
  p.poly(
    [
      [4, 9],
      [8, 1],
      [12, 9],
    ],
    P.w3,
  );
  p.ellipse(9.5, 11.5, 2, 1.5, P.w2);
  p.set(6, 9, '#ffffff');
  p.set(6, 10, '#ffffff');
});
def('Light', (p) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.line(8, 8, 8 + Math.cos(a) * 7, 8 + Math.sin(a) * 7, P.y3);
  }
  p.circle(8, 8, 3.5, P.y4);
  p.circle(8, 8, 2, '#ffffff');
});
def('Dark', (p) => {
  p.circle(8, 8, 6, P.p0);
  p.circle(9, 7, 4, P.p1);
  p.circle(10, 6, 1.5, P.p3);
  p.set(4, 11, P.p3);
  p.set(12, 12, P.p2);
});
def('Heal', (p) => {
  p.circle(5.5, 6, 3.2, P.r3);
  p.circle(10.5, 6, 3.2, P.r3);
  p.poly(
    [
      [2.5, 7],
      [13.5, 7],
      [8, 14],
    ],
    P.r3,
  );
  p.set(4, 5, '#ffc0c0');
  p.set(13, 1, '#ffffff');
  p.set(14, 2, P.y4);
  p.set(1, 12, P.y4);
});
def('Cure', (p) => {
  p.rect(6, 2, 4, 12, P.g4);
  p.rect(2, 6, 12, 4, P.g4);
  p.rect(7, 3, 1, 10, P.g5);
  p.rect(3, 7, 10, 1, P.g5);
});
def('Star', (p) => {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 7 : 3;
    pts.push([8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]);
  }
  p.poly(pts, P.y2);
  p.set(7, 6, P.y4);
  p.set(6, 7, P.y4);
});
def('Skull', (p) => {
  p.ellipse(8, 7, 5.5, 5, P.k6);
  p.rect(5, 10, 6, 4, P.k6);
  p.rect(5, 6, 2, 3, OL);
  p.rect(9, 6, 2, 3, OL);
  p.set(8, 10, OL);
  p.vline(7, 12, 13, P.k3);
  p.vline(9, 12, 13, P.k3);
});
def('Poison', (p) => {
  p.circle(6, 10, 4, P.p2);
  p.circle(11, 7, 3, P.p3);
  p.circle(9, 3, 2, P.p2);
  p.set(5, 8, P.p4);
  p.set(10, 6, P.p4);
  p.set(8, 2, P.p4);
});
def('Sleep', (p) => {
  const z = (x: number, y: number, s: number) => {
    p.hline(x, x + s, y, P.u4);
    p.line(x + s, y, x, y + s, P.u4);
    p.hline(x, x + s, y + s, P.u4);
  };
  z(2, 8, 5);
  z(8, 3, 4);
  z(12, 0, 2);
});
def('Paralysis', (p) => {
  p.poly(
    [
      [7, 1],
      [3, 8],
      [7, 8],
      [5, 15],
      [12, 6],
      [8, 6],
      [10, 1],
    ],
    '#f0e040',
  );
  p.set(13, 2, '#ffffff');
  p.set(2, 13, '#ffffff');
});
def('Silence', (p) => {
  p.ellipse(8, 8, 6, 4.5, P.white);
  p.poly(
    [
      [4, 11],
      [3, 15],
      [7, 12],
    ],
    P.white,
  );
  p.line(4, 5, 12, 11, P.r2);
  p.line(4, 11, 12, 5, P.r2);
});
def('Blind', (p) => {
  p.ellipse(8, 8, 6.5, 4, P.white);
  p.circle(8, 8, 2.5, P.u2);
  p.circle(8, 8, 1, OL);
  p.thickLine(2, 14, 14, 2, 0.6, '#404040');
});
def('Confusion', (p) => {
  for (let i = 0; i < 40; i++) {
    const a = i * 0.45;
    const r = 0.5 + i * 0.16;
    p.set(8 + Math.cos(a) * r, 8 + Math.sin(a) * r, i % 2 ? P.y3 : P.o3);
  }
});
const composed = (base: string, up: boolean): IconFn => (p) => {
  ICONS[BUILTIN_ICONS.indexOf(base)](p);
  arrow(up)(p);
};
def('Attack Up', composed('Sword', true));
def('Defense Up', composed('Shield', true));
def('Speed Up', composed('Boots', true));
def('Attack Down', composed('Sword', false));
def('Defense Down', composed('Shield', false));
def('Guard', (p) => {
  ICONS[BUILTIN_ICONS.indexOf('Shield')](p);
  p.set(13, 1, '#ffffff');
  p.set(12, 2, P.y4);
});
def('Fist', (p) => {
  p.rect(3, 5, 10, 8, P.s4);
  for (let i = 0; i < 4; i++) p.rect(3 + i * 2.5, 4, 2, 3, mix(P.s4, '#e8b088', 0.4));
  p.rect(2, 8, 3, 3, mix(P.s4, '#e8b088', 0.5));
  p.rect(4, 12, 8, 3, P.r2);
});
def('Run', (p) => {
  ICONS[BUILTIN_ICONS.indexOf('Boots')](p);
  p.hline(0, 2, 6, P.k5);
  p.hline(0, 3, 9, P.k5);
  p.hline(0, 2, 12, P.k5);
});
def('Chest', (p) => {
  p.rect(2, 7, 12, 7, P.b3);
  p.rect(2, 4, 12, 4, P.b4);
  p.ellipse(8, 4, 6, 1.6, P.b4);
  p.hline(2, 13, 7, P.y2);
  p.vline(4, 3, 13, P.y2);
  p.vline(11, 3, 13, P.y2);
  p.rect(7, 7, 2, 3, P.y3);
});
def('Map', (p) => {
  p.poly(
    [
      [1, 3],
      [5, 2],
      [10, 4],
      [15, 3],
      [15, 13],
      [10, 14],
      [5, 12],
      [1, 13],
    ],
    P.s3,
  );
  p.vline(5, 2, 12, P.s1);
  p.vline(10, 4, 14, P.s1);
  p.line(3, 6, 8, 9, P.r2);
  p.line(8, 9, 12, 7, P.r2);
  p.set(12, 7, P.r3);
});
def('Tent', (p) => {
  p.poly(
    [
      [1, 14],
      [8, 2],
      [15, 14],
    ],
    P.g3,
  );
  p.poly(
    [
      [6, 14],
      [8, 8],
      [10, 14],
    ],
    P.g1,
  );
  p.line(8, 2, 1, 14, P.g4);
});
def('Music', (p) => {
  p.circle(5, 12, 2.5, P.p3);
  p.circle(12, 10, 2.5, P.p3);
  p.vline(7, 3, 12, P.p3);
  p.vline(14, 2, 10, P.p3);
  p.thickLine(7, 3, 14, 2, 0.6, P.p3);
});

export function generateIconSheet(): HTMLCanvasElement {
  const count = BUILTIN_ICONS.length;
  const rows = Math.ceil(count / ICON_COLUMNS);
  const p = new Pix(ICON_COLUMNS * S, rows * S);
  for (let i = 0; i < count; i++) {
    const fn = ICONS[i];
    if (!fn) continue;
    const layer = new Pix(S + 2, S + 2);
    const inner = new Pix(S, S);
    fn(inner);
    layer.blit(inner, 1, 1);
    if (i !== 0) layer.outline(OL);
    p.blit(layer.crop(1, 1, S, S), (i % ICON_COLUMNS) * S, Math.floor(i / ICON_COLUMNS) * S);
  }
  return p.toCanvas(2);
}

export const ICON_FN_COUNT = () => ICONS.filter(Boolean).length;
