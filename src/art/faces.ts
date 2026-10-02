/**
 * Built-in face portraits (48x48 art, scaled 2x), four expressions per
 * character: normal, happy, sad, angry. Generated from the same colour
 * specs as the map sprites so faces and sprites match.
 */

import { HUMAN_SPECS, type HumanSpec } from './characters';
import { P, mix, shade } from './color';
import { Pix } from './pixel';

const S = 48;

type Expression = 0 | 1 | 2 | 3;

function eyeColorFor(spec: HumanSpec): string {
  if (spec.eye) return spec.eye;
  const h = spec.hair.toLowerCase();
  if (h === '#e8c060' || h === '#c8d0e0' || h === '#e888b0') return '#3a7ad0';
  if (h === '#c8442c') return '#3a9a5a';
  if (h === '#26222e' || h === '#3a2a26') return '#5a3a2a';
  return '#6a4a2a';
}

function drawFace(p: Pix, spec: HumanSpec, expr: Expression): void {
  const skin = spec.skin;
  const skinD = shade(skin, -0.16);
  const skinL = mix(skin, '#ffffff', 0.25);
  const hair = spec.hair;
  const hairD = shade(hair, -0.3);
  const hairL = mix(hair, '#ffffff', 0.35);
  const top = spec.top;
  const topD = shade(top, -0.3);
  const ink = '#2a1e2e';
  const hood = spec.headgear === 'hood';
  const helmet = spec.headgear === 'helmet';
  const metal = spec.metal ?? '#a0a8b8';

  // --- behind the head -----------------------------------------------------
  if (hood) {
    p.ellipse(24, 23, 18, 19, topD);
    p.rect(6, 23, 36, 25, topD);
  }
  if (!hood && !helmet) {
    if (spec.hairStyle === 'long') {
      p.ellipse(24, 20, 15, 14, hairD);
      p.rect(9, 20, 30, 24, hairD);
    } else if (spec.hairStyle === 'ponytail') {
      p.ellipse(39, 26, 4, 10, hairD);
    } else if (spec.hairStyle === 'bun') {
      p.circle(24, 6, 6, hairD);
    }
  }
  if (spec.cape) {
    p.poly(
      [
        [4, 48],
        [8, 36],
        [40, 36],
        [44, 48],
      ],
      spec.cape,
    );
  }

  // --- shoulders and neck --------------------------------------------------
  p.poly(
    [
      [6, 48],
      [9, 40],
      [16, 37],
      [32, 37],
      [39, 40],
      [42, 48],
    ],
    spec.outfit === 'armor' ? metal : top,
  );
  if (spec.outfit === 'armor') {
    p.ellipse(10, 42, 6, 4, mix(metal, '#ffffff', 0.3));
    p.ellipse(38, 42, 6, 4, shade(metal, -0.2));
  }
  p.rect(20, 30, 8, 9, skinD);
  p.poly(
    [
      [18, 37],
      [24, 44],
      [30, 37],
    ],
    spec.outfit === 'armor' ? shade(metal, -0.3) : spec.trim,
  );
  p.poly(
    [
      [20, 37],
      [24, 41],
      [28, 37],
    ],
    skinD,
  );
  if (spec.ears) {
    p.poly(
      [
        [12, 20],
        [3, 14],
        [12, 26],
      ],
      skin,
    );
    p.poly(
      [
        [36, 20],
        [45, 14],
        [36, 26],
      ],
      skin,
    );
  }

  // --- head ----------------------------------------------------------------
  p.ellipse(12.5, 23, 2.5, 3.5, skinD);
  p.ellipse(35.5, 23, 2.5, 3.5, skinD);
  p.ellipse(24, 20, 12, 13, skin);
  p.poly(
    [
      [12.5, 21],
      [35.5, 21],
      [31, 31],
      [26, 35],
      [22, 35],
      [17, 31],
    ],
    skin,
  );
  // jaw shading
  p.poly(
    [
      [31, 24],
      [35, 22],
      [31, 31],
      [26, 35],
      [25, 34],
      [29, 30],
    ],
    skinD,
  );
  p.set(17, 26, skinL);
  p.set(16, 25, skinL);

  // --- eyes ----------------------------------------------------------------
  const iris = eyeColorFor(spec);
  const eye = (cx: number, mirror: boolean) => {
    const y = 23;
    if (expr === 1) {
      // happy: closed arcs
      p.hline(cx - 2, cx + 2, y, ink);
      p.set(cx - 3, y + 1, ink);
      p.set(cx + 3, y + 1, ink);
      return;
    }
    const lidDrop = expr === 2 ? 1 : expr === 3 ? 1 : 0;
    p.ellipse(cx, y + 0.5, 3, 2.6, '#ffffff');
    p.ellipse(cx + (mirror ? -0.4 : 0.4), y + 0.8, 2, 2.4, iris);
    p.rect(cx + (mirror ? -1 : 0), y, 1, 2, ink);
    p.set(cx + (mirror ? 0 : -1), y - 1, '#ffffff');
    // upper lid
    p.hline(cx - 3, cx + 3, y - 2 + lidDrop, ink);
    if (lidDrop) p.hline(cx - 2, cx + 2, y - 1 + lidDrop, skinD);
    p.set(mirror ? cx - 4 : cx + 4, y - 1, ink);
  };
  if (spec.hairStyle === 'none' && !spec.eye) {
    eye(19, false);
    eye(29, true);
  } else if (spec.eye && (spec.skin === '#e8e2d0' || spec.skin === '#dce4ec')) {
    // glowing / hollow eyes
    p.ellipse(19, 23.5, 3, 2.5, ink);
    p.ellipse(29, 23.5, 3, 2.5, ink);
    p.set(19, 23, spec.eye);
    p.set(29, 23, spec.eye);
  } else {
    eye(19, false);
    eye(29, true);
  }

  // --- brows ---------------------------------------------------------------
  const brow = shade(hair, -0.2);
  if (expr === 2) {
    p.line(16, 19, 21, 18, brow);
    p.line(27, 18, 32, 19, brow);
  } else if (expr === 3) {
    p.line(16, 17, 21, 19, brow);
    p.line(27, 19, 32, 17, brow);
  } else {
    p.line(16, 18, 21, 18, brow);
    p.line(27, 18, 32, 18, brow);
  }

  // --- nose & mouth --------------------------------------------------------
  p.set(24, 27, skinD);
  p.set(25, 28, skinD);
  const mouthC = '#9a4040';
  if (expr === 1) {
    p.poly(
      [
        [20, 30],
        [28, 30],
        [26, 33],
        [22, 33],
      ],
      '#6a2028',
    );
    p.hline(22, 26, 32, '#e07070');
    p.hline(20, 28, 30, ink);
    p.set(16, 28, '#f0a0a0');
    p.set(17, 28, '#f0a0a0');
    p.set(31, 28, '#f0a0a0');
    p.set(32, 28, '#f0a0a0');
  } else if (expr === 2) {
    p.hline(22, 26, 31, mouthC);
    p.set(21, 32, mouthC);
    p.set(27, 32, mouthC);
    p.set(31, 26, '#a0d0ff');
    p.set(31, 27, '#a0d0ff');
  } else if (expr === 3) {
    p.rect(21, 30, 7, 2, '#5a1a20');
    p.hline(22, 26, 30, '#ffffff');
    p.set(20, 31, mouthC);
    p.set(28, 31, mouthC);
  } else {
    p.hline(22, 26, 31, mouthC);
  }

  // --- beard ---------------------------------------------------------------
  if (spec.beard) {
    p.poly(
      [
        [13, 24],
        [17, 32],
        [21, 33],
        [27, 33],
        [31, 32],
        [35, 24],
        [35, 30],
        [30, 38],
        [24, 41],
        [18, 38],
        [13, 30],
      ],
      hair,
    );
    p.line(19, 36, 24, 39, hairD);
    p.line(29, 36, 24, 39, hairD);
    p.hline(21, 27, 30, hairD);
    p.hline(22, 26, 32, expr === 1 ? '#6a2028' : mouthC);
  }

  // --- hair in front ---------------------------------------------------------
  if (!hood && !helmet && spec.hairStyle !== 'none') {
    if (spec.hairStyle === 'bald') {
      p.ellipse(12, 19, 3, 5, hair);
      p.ellipse(36, 19, 3, 5, hair);
      p.set(20, 10, skinL);
      p.set(21, 9, skinL);
    } else {
      p.ellipse(24, 13, 13.5, 8.5, hair);
      p.rect(11, 12, 3, 12, hair);
      p.rect(34, 12, 3, 12, hair);
      // bangs
      const tips: [number, number][] = [
        [14, 19],
        [18, 17],
        [22, 19],
        [27, 17],
        [31, 18],
        [35, 20],
      ];
      let px = 11;
      for (const [tx, ty] of tips) {
        p.poly(
          [
            [px, 12],
            [tx, ty],
            [tx + 4, 12],
          ],
          hair,
        );
        px = tx;
      }
      p.poly(
        [
          [16, 8],
          [24, 6],
          [21, 10],
        ],
        hairL,
      );
      p.line(15, 11, 19, 9, hairL);
      if (spec.hairStyle === 'spiky') {
        const spikes: [number, number, number, number, number, number][] = [
          [12, 10, 7, 2, 17, 7],
          [18, 6, 20, 0, 25, 6],
          [24, 5, 30, 0, 31, 7],
          [30, 7, 39, 4, 36, 12],
          [11, 14, 5, 12, 12, 18],
        ];
        for (const [a, b, c, d, e, f] of spikes) {
          p.poly(
            [
              [a, b],
              [c, d],
              [e, f],
            ],
            hair,
          );
        }
      }
      if (spec.hairStyle === 'long') {
        p.rect(9, 18, 4, 22, hair);
        p.rect(35, 18, 4, 22, hair);
        p.vline(10, 20, 38, hairL);
        p.vline(38, 20, 38, hairD);
      }
    }
  }

  // --- headgear ----------------------------------------------------------------
  switch (spec.headgear) {
    case 'hood':
      p.poly(
        [
          [8, 26],
          [9, 12],
          [16, 5],
          [24, 3],
          [32, 5],
          [39, 12],
          [40, 26],
          [36, 26],
          [35, 15],
          [29, 11],
          [24, 10],
          [19, 11],
          [13, 15],
          [12, 26],
        ],
        top,
      );
      p.line(13, 15, 19, 11, mix(top, '#ffffff', 0.25));
      break;
    case 'helmet':
      p.ellipse(24, 14, 14, 11, metal);
      p.rect(10, 14, 28, 4, metal);
      p.rect(10, 17, 28, 2, shade(metal, -0.35));
      p.rect(10, 18, 4, 12, metal);
      p.rect(34, 18, 4, 12, metal);
      p.ellipse(18, 9, 4, 2.5, mix(metal, '#ffffff', 0.5));
      p.rect(23, 4, 2, 13, shade(metal, -0.25));
      break;
    case 'crown':
      p.poly(
        [
          [14, 10],
          [15, 2],
          [19, 6],
          [24, 0],
          [29, 6],
          [33, 2],
          [34, 10],
        ],
        P.y2,
      );
      p.hline(14, 34, 9, P.y1);
      p.circle(24, 6, 1.4, P.r3);
      p.set(19, 8, P.u3);
      p.set(29, 8, P.u3);
      break;
    case 'tiara':
      p.hline(14, 34, 11, P.y2);
      p.hline(16, 32, 10, P.y3);
      p.poly(
        [
          [22, 10],
          [24, 6],
          [26, 10],
        ],
        P.y2,
      );
      p.set(24, 9, '#e04080');
      break;
    case 'cap': {
      const c = spec.accessory ?? P.u2;
      p.ellipse(24, 11, 13, 7, c);
      p.rect(11, 11, 26, 3, c);
      p.rect(9, 13, 30, 2, shade(c, -0.3));
      p.set(24, 4, mix(c, '#ffffff', 0.4));
      break;
    }
    case 'bandana': {
      const c = spec.accessory ?? P.r2;
      p.rect(11, 12, 26, 4, c);
      p.hline(11, 36, 12, mix(c, '#ffffff', 0.3));
      p.poly(
        [
          [36, 13],
          [43, 18],
          [41, 21],
          [36, 16],
        ],
        shade(c, -0.2),
      );
      break;
    }
    case 'horns':
      p.poly(
        [
          [14, 10],
          [6, 6],
          [3, -2],
          [10, 4],
          [17, 7],
        ],
        '#e8dcc0',
      );
      p.poly(
        [
          [34, 10],
          [42, 6],
          [45, -2],
          [38, 4],
          [31, 7],
        ],
        '#e8dcc0',
      );
      break;
    default:
      break;
  }

  p.outline(ink);
}

export function generateFaceSheet(key: string): HTMLCanvasElement | null {
  const spec = HUMAN_SPECS[key];
  if (!spec) return null;
  const p = new Pix(S * 4, S);
  for (let i = 0; i < 4; i++) {
    const face = new Pix(S, S);
    drawFace(face, spec, i as Expression);
    p.blit(face, i * S, 0);
  }
  return p.toCanvas(2);
}
