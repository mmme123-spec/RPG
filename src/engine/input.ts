/**
 * Keyboard, gamepad and touch input mapped to virtual buttons, with
 * "triggered" and key-repeat semantics evaluated once per logic frame.
 */

import type { Direction } from '../core/types';
import type { InputButtonName, InputLike } from './host';

const KEYMAP: Record<string, InputButtonName> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'ok',
  NumpadEnter: 'ok',
  Space: 'ok',
  KeyZ: 'ok',
  Escape: 'cancel',
  KeyX: 'cancel',
  Backspace: 'cancel',
  Numpad0: 'cancel',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  KeyQ: 'pageup',
  KeyE: 'pagedown',
  F9: 'debug',
};

const BUTTONS: InputButtonName[] = ['up', 'down', 'left', 'right', 'ok', 'cancel', 'menu', 'shift', 'pageup', 'pagedown', 'debug'];

export interface PointerState {
  x: number;
  y: number;
  down: boolean;
  /** Pressed this frame */
  triggered: boolean;
  /** Released this frame */
  released: boolean;
  moved: boolean;
}

export class Input implements InputLike {
  private keyDown = new Set<InputButtonName>();
  private padDown = new Set<InputButtonName>();
  private touchDown = new Set<InputButtonName>();
  /** Buttons pressed since the last update (so very short taps are not lost). */
  private latched = new Set<InputButtonName>();
  private held = new Map<InputButtonName, number>();
  private latestDir: InputButtonName | null = null;
  private dirOrder: InputButtonName[] = [];
  ctrl = false;
  enabled = true;
  pointer: PointerState = { x: 0, y: 0, down: false, triggered: false, released: false, moved: false };
  private pointerEvents: { type: 'down' | 'up' | 'move'; x: number; y: number }[] = [];
  private target: HTMLElement | null = null;
  private pad: HTMLElement | null = null;
  private toGame: ((cx: number, cy: number) => { x: number; y: number }) | null = null;

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    this.ctrl = e.ctrlKey;
    const b = KEYMAP[e.code];
    if (!b) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    e.stopPropagation();
    this.keyDown.add(b);
    this.latched.add(b);
    if (b === 'cancel') {
      this.keyDown.add('menu');
      this.latched.add('menu');
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.ctrl = e.ctrlKey;
    const b = KEYMAP[e.code];
    if (!b) return;
    this.keyDown.delete(b);
    if (b === 'cancel') this.keyDown.delete('menu');
  };

  private onBlur = (): void => {
    this.keyDown.clear();
    this.touchDown.clear();
    this.ctrl = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.toGame) return;
    const p = this.toGame(e.clientX, e.clientY);
    this.pointerEvents.push({ type: 'down', ...p });
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.toGame) return;
    const p = this.toGame(e.clientX, e.clientY);
    this.pointerEvents.push({ type: 'move', ...p });
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (!this.toGame) return;
    const p = this.toGame(e.clientX, e.clientY);
    this.pointerEvents.push({ type: 'up', ...p });
  };

  attach(canvas: HTMLElement, toGame: (cx: number, cy: number) => { x: number; y: number }): void {
    this.target = canvas;
    this.toGame = toGame;
    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
    window.removeEventListener('blur', this.onBlur);
    this.target?.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.pad?.remove();
    this.pad = null;
    this.target = null;
  }

  /** Build an on-screen gamepad for touch devices inside `container`. */
  createTouchPad(container: HTMLElement): void {
    const pad = document.createElement('div');
    pad.className = 'rpgf-touchpad';
    pad.innerHTML = `
      <style>
        .rpgf-touchpad{position:absolute;inset:0;pointer-events:none;user-select:none;-webkit-user-select:none;touch-action:none;z-index:5}
        .rpgf-touchpad button{position:absolute;pointer-events:auto;border:2px solid rgba(255,255,255,.55);background:rgba(20,24,40,.45);color:#fff;font:bold 16px system-ui,sans-serif;border-radius:50%;width:56px;height:56px;touch-action:none;-webkit-tap-highlight-color:transparent;padding:0}
        .rpgf-touchpad button.on{background:rgba(255,255,255,.35)}
        .rpgf-touchpad .dpad{position:absolute;left:14px;bottom:14px;width:168px;height:168px;pointer-events:none}
        .rpgf-touchpad .dpad button{border-radius:12px}
        .rpgf-touchpad .ab{position:absolute;right:14px;bottom:24px;width:140px;height:130px;pointer-events:none}
        .rpgf-touchpad .menu{position:absolute;right:12px;top:12px;width:auto;height:34px;border-radius:17px;padding:0 14px;font-size:13px}
      </style>
      <div class="dpad">
        <button data-b="up" style="left:56px;top:0">▲</button>
        <button data-b="left" style="left:0;top:56px">◀</button>
        <button data-b="right" style="left:112px;top:56px">▶</button>
        <button data-b="down" style="left:56px;top:112px">▼</button>
      </div>
      <div class="ab">
        <button data-b="ok" style="right:0;top:10px;width:66px;height:66px">A</button>
        <button data-b="cancel" style="left:0;top:64px">B</button>
      </div>
      <button class="menu" data-b="menu">Menu</button>`;
    const bind = (btn: HTMLButtonElement) => {
      const b = btn.dataset.b as InputButtonName;
      const press = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.touchDown.add(b);
        this.latched.add(b);
        if (b === 'menu') {
          this.touchDown.add('cancel');
          this.latched.add('cancel');
        }
        btn.classList.add('on');
      };
      const release = (e: Event) => {
        e.preventDefault();
        this.touchDown.delete(b);
        if (b === 'menu') this.touchDown.delete('cancel');
        btn.classList.remove('on');
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    pad.querySelectorAll('button').forEach((b) => bind(b as HTMLButtonElement));
    container.appendChild(pad);
    this.pad = pad;
  }

  setTouchPadVisible(visible: boolean): void {
    if (this.pad) this.pad.style.display = visible ? '' : 'none';
  }

  private pollGamepads(): void {
    this.padDown.clear();
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    for (const gp of navigator.getGamepads()) {
      if (!gp) continue;
      const btn = (i: number) => !!gp.buttons[i]?.pressed;
      if (btn(0)) this.padDown.add('ok');
      if (btn(1)) this.padDown.add('cancel');
      if (btn(2)) this.padDown.add('shift');
      if (btn(3)) this.padDown.add('menu');
      if (btn(4)) this.padDown.add('pageup');
      if (btn(5)) this.padDown.add('pagedown');
      if (btn(12)) this.padDown.add('up');
      if (btn(13)) this.padDown.add('down');
      if (btn(14)) this.padDown.add('left');
      if (btn(15)) this.padDown.add('right');
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      if (ax < -0.5) this.padDown.add('left');
      if (ax > 0.5) this.padDown.add('right');
      if (ay < -0.5) this.padDown.add('up');
      if (ay > 0.5) this.padDown.add('down');
    }
  }

  /** Advance one logic frame. */
  update(): void {
    this.pollGamepads();
    for (const b of BUTTONS) {
      const down = this.enabled && (this.keyDown.has(b) || this.padDown.has(b) || this.touchDown.has(b) || this.latched.has(b));
      if (down) {
        const n = (this.held.get(b) ?? 0) + 1;
        this.held.set(b, n);
        if (n === 1 && (b === 'up' || b === 'down' || b === 'left' || b === 'right')) {
          this.latestDir = b;
          this.dirOrder = [b, ...this.dirOrder.filter((d) => d !== b)];
        }
      } else {
        this.held.delete(b);
        this.dirOrder = this.dirOrder.filter((d) => d !== b);
        if (this.latestDir === b) this.latestDir = this.dirOrder[0] ?? null;
      }
    }
    this.latched.clear();
    const p = this.pointer;
    p.triggered = false;
    p.released = false;
    p.moved = false;
    for (const ev of this.pointerEvents) {
      p.x = ev.x;
      p.y = ev.y;
      if (ev.type === 'down') {
        p.down = true;
        p.triggered = true;
      } else if (ev.type === 'up') {
        if (p.down) p.released = true;
        p.down = false;
      } else {
        p.moved = true;
      }
    }
    this.pointerEvents = [];
  }

  /** Forget all held buttons (e.g. after a scene change). */
  clear(): void {
    this.keyDown.clear();
    this.touchDown.clear();
    this.latched.clear();
    this.held.clear();
    this.latestDir = null;
    this.dirOrder = [];
  }

  isPressed(b: InputButtonName): boolean {
    return (this.held.get(b) ?? 0) > 0;
  }

  isTriggered(b: InputButtonName): boolean {
    return this.held.get(b) === 1;
  }

  isRepeated(b: InputButtonName): boolean {
    const n = this.held.get(b) ?? 0;
    return n === 1 || (n >= 24 && (n - 24) % 6 === 0);
  }

  dir4(): 0 | Direction {
    const d = this.latestDir;
    if (!d || !this.isPressed(d)) return 0;
    return d === 'up' ? 8 : d === 'down' ? 2 : d === 'left' ? 4 : 6;
  }
}
