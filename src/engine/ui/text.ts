/**
 * Game text: font loading, control codes and layout.
 *
 * Supported control codes (case-insensitive):
 *   \V[n] variable   \N[n] actor name   \P[n] party member name   \G currency
 *   \C[n] colour     \I[n] icon         \{ \} bigger/smaller text
 *   \. wait 1/4 s    \| wait 1 s        \! wait for a key press
 *   \> \< instant text on/off            \\ backslash
 */

import font400 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-400-normal.woff2?inline';
import font700 from '@fontsource/pixelify-sans/files/pixelify-sans-latin-700-normal.woff2?inline';

export const FONT_FAMILY = '"Pixelify Sans", "Trebuchet MS", "Segoe UI", sans-serif';

let fontPromise: Promise<void> | null = null;

/** Load the bundled game font (resolves even if it fails). */
export function loadGameFont(): Promise<void> {
  if (!fontPromise) {
    fontPromise = (async () => {
      try {
        if (typeof FontFace === 'undefined' || typeof document === 'undefined') return;
        const faces = [
          new FontFace('Pixelify Sans', `url(${font400})`, { weight: '400' }),
          new FontFace('Pixelify Sans', `url(${font700})`, { weight: '700' }),
        ];
        for (const f of faces) {
          await f.load();
          document.fonts.add(f);
        }
      } catch {
        // fall back to system fonts
      }
    })();
  }
  return fontPromise;
}

export const TEXT_COLORS = [
  '#ffffff',
  '#40b0f0',
  '#ff8060',
  '#70d850',
  '#90c8ff',
  '#d0b8ff',
  '#ffff90',
  '#909090',
  '#c8c8c8',
  '#3080d0',
  '#ff4020',
  '#30b030',
  '#4090e0',
  '#a890ff',
  '#ffd030',
  '#000000',
  '#90b4ff',
  '#ffe040',
  '#ff3838',
  '#20203c',
  '#e07840',
  '#f0b830',
  '#4080d0',
  '#50c0f8',
  '#80ff90',
  '#ff8080',
];

export const UI = {
  normal: TEXT_COLORS[0],
  system: TEXT_COLORS[16],
  crisis: TEXT_COLORS[17],
  death: TEXT_COLORS[18],
  gaugeBack: TEXT_COLORS[19],
  hp1: TEXT_COLORS[20],
  hp2: TEXT_COLORS[21],
  mp1: TEXT_COLORS[22],
  mp2: TEXT_COLORS[23],
  mpCost: TEXT_COLORS[23],
  powerUp: TEXT_COLORS[24],
  powerDown: TEXT_COLORS[25],
  disabledAlpha: 0.45,
};

export function font(size: number, bold = false): string {
  return `${bold ? '700 ' : ''}${size}px ${FONT_FAMILY}`;
}

export interface TextContext {
  variable(id: number): number;
  actorName(id: number): string;
  partyMemberName(index: number): string;
  currency: string;
}

/** Replace value-producing escape codes with their text. */
export function expandEscapes(text: string, ctx: TextContext | null): string {
  let s = text.replace(/\\\\/g, '\u001b');
  if (ctx) {
    for (let pass = 0; pass < 2; pass++) s = s.replace(/\\V\[(\d+)\]/gi, (_, n) => String(ctx.variable(Number(n))));
    s = s.replace(/\\N\[(\d+)\]/gi, (_, n) => ctx.actorName(Number(n)));
    s = s.replace(/\\P\[(\d+)\]/gi, (_, n) => ctx.partyMemberName(Number(n)));
    s = s.replace(/\\G/gi, ctx.currency);
  }
  return s;
}

export type Token =
  | { t: 'ch'; ch: string }
  | { t: 'color'; c: number }
  | { t: 'icon'; i: number }
  | { t: 'wait'; f: number }
  | { t: 'pause' }
  | { t: 'nl' }
  | { t: 'instant'; on: boolean }
  | { t: 'size'; d: number };

export function tokenize(expanded: string): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < expanded.length; i++) {
    const ch = expanded[i];
    if (ch === '\n') {
      out.push({ t: 'nl' });
      continue;
    }
    if (ch === '\r') continue;
    if (ch === '\u001b') {
      out.push({ t: 'ch', ch: '\\' });
      continue;
    }
    if (ch === '\\' && i + 1 < expanded.length) {
      const next = expanded[i + 1];
      const arg = /^\[(\d+)\]/.exec(expanded.slice(i + 2));
      const code = next.toUpperCase();
      if ((code === 'C' || code === 'I') && arg) {
        out.push(code === 'C' ? { t: 'color', c: Number(arg[1]) } : { t: 'icon', i: Number(arg[1]) });
        i += 1 + arg[0].length;
        continue;
      }
      if (next === '.') {
        out.push({ t: 'wait', f: 15 });
        i++;
        continue;
      }
      if (next === '|') {
        out.push({ t: 'wait', f: 60 });
        i++;
        continue;
      }
      if (next === '!') {
        out.push({ t: 'pause' });
        i++;
        continue;
      }
      if (next === '>' || next === '<') {
        out.push({ t: 'instant', on: next === '>' });
        i++;
        continue;
      }
      if (next === '{' || next === '}') {
        out.push({ t: 'size', d: next === '{' ? 4 : -4 });
        i++;
        continue;
      }
    }
    out.push({ t: 'ch', ch });
  }
  return out;
}

export interface LaidToken {
  token: Token;
  x: number;
  w: number;
  size: number;
}

export interface Line {
  tokens: LaidToken[];
  width: number;
  height: number;
}

/**
 * Lay out tokens into lines no wider than maxWidth, wrapping at spaces.
 * The context's font is changed while measuring.
 */
export function layoutTokens(ctx: CanvasRenderingContext2D, tokens: Token[], maxWidth: number, baseSize: number, lineHeight: number, iconSize = 24): Line[] {
  const lines: Line[] = [];
  let size = baseSize;
  let cur: LaidToken[] = [];
  let x = 0;
  const widthCache = new Map<string, number>();
  const measure = (ch: string) => {
    const k = `${size}|${ch}`;
    let w = widthCache.get(k);
    if (w === undefined) {
      ctx.font = font(size);
      w = ctx.measureText(ch).width;
      widthCache.set(k, w);
    }
    return w;
  };
  const pushLine = () => {
    lines.push({ tokens: cur, width: x, height: Math.max(lineHeight, ...cur.map((t) => (t.token.t === 'ch' ? t.size + 8 : lineHeight))) });
    cur = [];
    x = 0;
  };
  // word wrapping: find the last space when overflowing
  for (const token of tokens) {
    if (token.t === 'nl') {
      pushLine();
      continue;
    }
    if (token.t === 'size') {
      size = Math.max(10, Math.min(48, size + token.d));
      cur.push({ token, x, w: 0, size });
      continue;
    }
    let w = 0;
    if (token.t === 'ch') w = measure(token.ch);
    else if (token.t === 'icon') w = iconSize + 4;
    if (w > 0 && x + w > maxWidth && cur.length > 0) {
      if (token.t === 'ch' && token.ch === ' ') {
        pushLine();
        continue;
      }
      let breakAt = -1;
      for (let i = cur.length - 1; i >= 0; i--) {
        const t = cur[i].token;
        if (t.t === 'ch' && t.ch === ' ') {
          breakAt = i;
          break;
        }
      }
      if (breakAt > 0) {
        const rest = cur.slice(breakAt + 1);
        cur = cur.slice(0, breakAt);
        x = cur.length ? cur[cur.length - 1].x + cur[cur.length - 1].w : 0;
        pushLine();
        for (const r of rest) {
          r.x = x;
          x += r.w;
          cur.push(r);
        }
      } else {
        pushLine();
      }
    }
    cur.push({ token, x, w, size });
    x += w;
  }
  if (cur.length || lines.length === 0) pushLine();
  return lines;
}

/** Draw a run of plain text with a soft outline. */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; color?: string; align?: CanvasTextAlign; maxWidth?: number; bold?: boolean; outline?: boolean; alpha?: number } = {},
): void {
  const size = opts.size ?? 20;
  ctx.save();
  ctx.font = font(size, opts.bold);
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha *= opts.alpha ?? 1;
  const mw = opts.maxWidth && opts.maxWidth > 0 ? opts.maxWidth : undefined;
  if (opts.outline !== false) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(text, x, y, mw);
  }
  ctx.fillStyle = opts.color ?? '#ffffff';
  ctx.fillText(text, x, y, mw);
  ctx.restore();
}

export function measureText(ctx: CanvasRenderingContext2D, text: string, size = 20, bold = false): number {
  ctx.save();
  ctx.font = font(size, bold);
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
