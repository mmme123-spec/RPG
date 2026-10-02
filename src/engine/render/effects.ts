/**
 * Procedural visual effects: battle/map animations, balloons and weather.
 * Drawn with canvas primitives and additive blending for glows.
 */

import type { BalloonType, WeatherType } from '../../core/types';
import { mulberry32 } from '../../core/util';

const DURATIONS: Record<string, number> = {
  hit: 18,
  slash: 22,
  pierce: 20,
  claw: 24,
  blunt: 22,
  fire: 40,
  ice: 40,
  thunder: 30,
  wind: 36,
  earth: 36,
  water: 36,
  light: 42,
  dark: 40,
  heal: 40,
  cure: 32,
  buff: 36,
  debuff: 36,
  poison: 36,
  sleep: 44,
  explosion: 42,
  sparkle: 36,
};

/** Frames during which an animation flashes its target (for battlers). */
export const HIT_FRAME: Record<string, number> = { hit: 2, slash: 6, pierce: 6, claw: 8, blunt: 6, thunder: 6, explosion: 8 };

export function animationDuration(key: string): number {
  return DURATIONS[key] ?? 30;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  seed: number;
}

export class EffectAnimation {
  readonly key: string;
  x: number;
  y: number;
  frame = 0;
  readonly duration: number;
  private rng: () => number;
  private particles: Particle[] = [];
  /** Scale (1 = sized for a ~64px target). */
  scale: number;

  constructor(key: string, x: number, y: number, scale = 1, seed = Math.floor(Math.random() * 1e9)) {
    this.key = key;
    this.x = x;
    this.y = y;
    this.scale = scale;
    this.duration = animationDuration(key);
    this.rng = mulberry32(seed);
    this.initParticles();
  }

  isDone(): boolean {
    return this.frame >= this.duration;
  }

  update(): void {
    this.frame++;
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      if (this.key === 'fire' || this.key === 'heal' || this.key === 'poison' || this.key === 'buff' || this.key === 'sparkle') p.vx *= 0.96;
      if (this.key === 'earth' || this.key === 'water') p.vy += 0.35;
      if (this.key === 'explosion') {
        p.vx *= 0.92;
        p.vy *= 0.92;
      }
    }
  }

  private initParticles(): void {
    const r = this.rng;
    const s = this.scale;
    const add = (n: number, fn: (i: number) => Partial<Particle>) => {
      for (let i = 0; i < n; i++) this.particles.push({ x: 0, y: 0, vx: 0, vy: 0, r: 3, life: 0, seed: r(), ...fn(i) });
    };
    switch (this.key) {
      case 'hit':
      case 'blunt':
        add(10, () => {
          const a = r() * Math.PI * 2;
          const v = (2 + r() * 3) * s;
          return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (2 + r() * 2) * s };
        });
        break;
      case 'fire':
        add(26, (i) => ({ x: (r() - 0.5) * 40 * s, y: (r() * 10 + 10) * s, vx: (r() - 0.5) * 0.6, vy: -(1.2 + r() * 1.8) * s, r: (5 + r() * 7) * s, life: -Math.floor(i * 0.8) }));
        break;
      case 'heal':
      case 'sparkle':
        add(18, (i) => ({ x: (r() - 0.5) * 50 * s, y: (r() * 30 - 5) * s, vx: 0, vy: -(0.6 + r() * 1.2) * s, r: (2 + r() * 2.5) * s, life: -Math.floor(i * 1.2) }));
        break;
      case 'poison':
        add(14, (i) => ({ x: (r() - 0.5) * 44 * s, y: (r() * 20 + 5) * s, vx: 0, vy: -(0.5 + r()) * s, r: (3 + r() * 4) * s, life: -Math.floor(i * 1.5) }));
        break;
      case 'buff':
      case 'debuff':
        add(8, (i) => ({ x: (r() - 0.5) * 50 * s, y: (this.key === 'buff' ? 20 : -30) * s, vx: 0, vy: (this.key === 'buff' ? -1.4 : 1.4) * s, r: 6 * s, life: -i * 3 }));
        break;
      case 'earth':
        add(12, () => ({ x: (r() - 0.5) * 30 * s, y: 20 * s, vx: (r() - 0.5) * 4 * s, vy: -(4 + r() * 4) * s, r: (4 + r() * 5) * s }));
        break;
      case 'water':
        add(24, () => ({ x: (r() - 0.5) * 10 * s, y: 15 * s, vx: (r() - 0.5) * 5 * s, vy: -(4 + r() * 5) * s, r: (2 + r() * 3) * s }));
        break;
      case 'explosion':
        add(22, () => {
          const a = r() * Math.PI * 2;
          const v = (3 + r() * 5) * s;
          return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: (3 + r() * 4) * s };
        });
        break;
      case 'ice':
        add(9, (i) => {
          const a = (i / 9) * Math.PI * 2;
          return { x: Math.cos(a) * 30 * s, y: Math.sin(a) * 22 * s, r: (7 + r() * 5) * s, seed: a };
        });
        break;
      case 'dark':
        add(12, (i) => {
          const a = (i / 12) * Math.PI * 2;
          return { x: Math.cos(a) * 60 * s, y: Math.sin(a) * 46 * s, vx: -Math.cos(a) * 1.8 * s, vy: -Math.sin(a) * 1.4 * s, r: (5 + r() * 4) * s };
        });
        break;
      default:
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDone()) return;
    const t = this.frame / this.duration;
    const s = this.scale;
    ctx.save();
    ctx.translate(this.x, this.y);
    switch (this.key) {
      case 'hit':
        this.drawBurst(ctx, t, '#ffffff', '#ffe080', 26 * s);
        this.drawParticles(ctx, '#fff4c0', 1 - t);
        break;
      case 'blunt':
        this.drawRing(ctx, t, '#ffffff', 40 * s, 6 * s);
        this.drawBurst(ctx, t, '#ffd080', '#ff9040', 22 * s);
        this.drawParticles(ctx, '#ffe0a0', 1 - t);
        break;
      case 'slash':
        this.drawSlash(ctx, t, -1, '#ffffff', 0);
        break;
      case 'claw':
        for (let i = 0; i < 3; i++) this.drawSlash(ctx, Math.max(0, Math.min(1, (this.frame - i * 3) / (this.duration - 6))), -1, '#ffdada', (i - 1) * 12 * s);
        break;
      case 'pierce': {
        const p = Math.min(1, t * 2.2);
        const a = 1 - Math.max(0, (t - 0.45) / 0.55);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const g = ctx.createLinearGradient(-50 * s, 0, 50 * s, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(1, '#ffffff');
        ctx.strokeStyle = g;
        ctx.lineWidth = 5 * s;
        ctx.beginPath();
        ctx.moveTo(-50 * s + p * 30 * s, 6 * s);
        ctx.lineTo(-10 * s + p * 50 * s, -6 * s);
        ctx.stroke();
        if (t > 0.3) this.drawBurst(ctx, (t - 0.3) / 0.7, '#ffffff', '#c0e0ff', 18 * s);
        break;
      }
      case 'fire':
        this.drawGlow(ctx, '#ff6020', 50 * s, 0.5 * Math.sin(t * Math.PI));
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
          if (p.life < 0) continue;
          const life = p.life / 26;
          if (life > 1) continue;
          const rr = p.r * (1 - life * 0.7);
          ctx.globalAlpha = Math.max(0, 1 - life) * 0.9;
          ctx.fillStyle = life < 0.3 ? '#fff0a0' : life < 0.6 ? '#ffa030' : '#e04010';
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'ice': {
        const grow = Math.min(1, t * 2.5);
        const shatter = t > 0.7 ? (t - 0.7) / 0.3 : 0;
        ctx.globalAlpha = 1 - shatter;
        for (const p of this.particles) {
          const rr = p.r * grow;
          const ox = p.x * (1 + shatter * 1.5);
          const oy = p.y * (1 + shatter * 1.5) - 10 * s;
          ctx.save();
          ctx.translate(ox, oy);
          ctx.rotate(p.seed);
          ctx.fillStyle = 'rgba(160,220,255,0.85)';
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, -rr * 1.6);
          ctx.lineTo(rr * 0.6, 0);
          ctx.lineTo(0, rr * 1.6);
          ctx.lineTo(-rr * 0.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        this.drawGlow(ctx, '#80d0ff', 45 * s, 0.4 * (1 - t));
        break;
      }
      case 'thunder': {
        const a = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const r = mulberry32(Math.floor(this.frame / 3) + 7);
        for (let k = 0; k < 2; k++) {
          ctx.strokeStyle = k === 0 ? 'rgba(160,180,255,0.6)' : '#ffffff';
          ctx.lineWidth = (k === 0 ? 9 : 3) * s;
          ctx.beginPath();
          let x = (r() - 0.5) * 20 * s;
          let y = -220 * s;
          ctx.moveTo(x, y);
          while (y < 0) {
            y += (18 + r() * 14) * s;
            x += (r() - 0.5) * 28 * s;
            ctx.lineTo(x, Math.min(0, y));
          }
          ctx.stroke();
        }
        this.drawBurst(ctx, t, '#ffffff', '#a0b8ff', 30 * s);
        break;
      }
      case 'wind': {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const ang = t * Math.PI * 4 + (i * Math.PI) / 2;
          const rad = (20 + i * 8) * s * (0.6 + t * 0.6);
          ctx.globalAlpha = (1 - t) * 0.9;
          ctx.strokeStyle = i % 2 ? '#c0ffe0' : '#ffffff';
          ctx.lineWidth = 3 * s;
          ctx.beginPath();
          ctx.ellipse(0, -10 * s, rad, rad * 0.55, 0, ang, ang + 1.8);
          ctx.stroke();
        }
        break;
      }
      case 'earth':
        ctx.globalAlpha = 1 - Math.max(0, (t - 0.6) / 0.4);
        for (const p of this.particles) {
          ctx.fillStyle = p.seed > 0.5 ? '#a07848' : '#7a5a34';
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life * 0.2 + p.seed * 6);
          ctx.fillRect(-p.r, -p.r * 0.8, p.r * 2, p.r * 1.6);
          ctx.restore();
        }
        this.drawRing(ctx, Math.min(1, t * 2), '#c8a070', 50 * s, 4 * s);
        break;
      case 'water':
        ctx.globalAlpha = 1 - Math.max(0, (t - 0.5) / 0.5);
        ctx.fillStyle = '#80c8ff';
        for (const p of this.particles) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        this.drawRing(ctx, t, '#c0e8ff', 40 * s, 3 * s);
        break;
      case 'light': {
        ctx.globalCompositeOperation = 'lighter';
        const a = Math.sin(t * Math.PI);
        const g = ctx.createLinearGradient(0, -200 * s, 0, 20 * s);
        g.addColorStop(0, 'rgba(255,255,220,0)');
        g.addColorStop(0.7, `rgba(255,250,200,${0.7 * a})`);
        g.addColorStop(1, `rgba(255,255,255,${0.9 * a})`);
        ctx.fillStyle = g;
        const w = 30 * s * (0.4 + a * 0.6);
        ctx.fillRect(-w, -200 * s, w * 2, 220 * s);
        this.drawGlow(ctx, '#fff8c0', 50 * s, a * 0.6);
        this.drawSparkles(ctx, t, '#ffffff', 10);
        break;
      }
      case 'dark':
        this.drawGlow(ctx, '#6020a0', 50 * s, 0.6 * Math.sin(t * Math.PI));
        ctx.fillStyle = '#2a0a40';
        for (const p of this.particles) {
          const k = Math.min(1, this.frame / (this.duration * 0.6));
          ctx.globalAlpha = 1 - Math.max(0, (t - 0.7) / 0.3);
          ctx.beginPath();
          ctx.arc(p.x * (1 - k), p.y * (1 - k) - 10 * s * k, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#a060e0';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (t > 0.6) this.drawBurst(ctx, (t - 0.6) / 0.4, '#c080ff', '#400060', 40 * s);
        break;
      case 'heal':
      case 'sparkle':
        this.drawGlow(ctx, this.key === 'heal' ? '#80ffa0' : '#fff0a0', 45 * s, 0.45 * Math.sin(t * Math.PI));
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.particles) {
          if (p.life < 0 || p.life > 28) continue;
          ctx.globalAlpha = Math.sin((p.life / 28) * Math.PI);
          this.star(ctx, p.x, p.y, p.r * 2, this.key === 'heal' ? '#c0ffd0' : '#ffffff');
        }
        break;
      case 'cure':
        for (let i = 0; i < 3; i++) {
          const tt = Math.max(0, Math.min(1, t * 1.5 - i * 0.2));
          if (tt > 0 && tt < 1) this.drawRing(ctx, tt, '#a0ffb0', 46 * s, 3 * s);
        }
        this.drawGlow(ctx, '#a0ffc0', 40 * s, 0.4 * Math.sin(t * Math.PI));
        break;
      case 'buff':
      case 'debuff': {
        const c = this.key === 'buff' ? '#ff9040' : '#4090ff';
        this.drawGlow(ctx, c, 45 * s, 0.4 * Math.sin(t * Math.PI));
        ctx.fillStyle = c;
        for (const p of this.particles) {
          if (p.life < 0 || p.life > 24) continue;
          ctx.globalAlpha = Math.sin((p.life / 24) * Math.PI);
          const dir = this.key === 'buff' ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y + dir * p.r * 1.4);
          ctx.lineTo(p.x + p.r, p.y);
          ctx.lineTo(p.x + p.r * 0.4, p.y);
          ctx.lineTo(p.x + p.r * 0.4, p.y - dir * p.r * 1.2);
          ctx.lineTo(p.x - p.r * 0.4, p.y - dir * p.r * 1.2);
          ctx.lineTo(p.x - p.r * 0.4, p.y);
          ctx.lineTo(p.x - p.r, p.y);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
      case 'poison':
        for (const p of this.particles) {
          if (p.life < 0 || p.life > 26) continue;
          ctx.globalAlpha = 1 - p.life / 26;
          ctx.fillStyle = '#9a50d0';
          ctx.strokeStyle = '#e0b0ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        break;
      case 'sleep':
        for (let i = 0; i < 3; i++) {
          const tt = (t * 1.4 - i * 0.2) % 1;
          if (tt < 0) continue;
          ctx.globalAlpha = Math.sin(tt * Math.PI);
          ctx.fillStyle = '#c0d0ff';
          ctx.font = `bold ${(14 + i * 4) * s}px sans-serif`;
          ctx.fillText('Z', (8 + i * 10 + Math.sin(tt * 6) * 4) * s, (-10 - tt * 50) * s);
        }
        break;
      case 'explosion': {
        const r = 60 * s * Math.min(1, t * 2.5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1 - t;
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, r));
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.3, '#ffd060');
        g.addColorStop(0.7, '#ff6020');
        g.addColorStop(1, 'rgba(160,30,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        this.drawParticles(ctx, '#ffb040', 1 - t);
        break;
      }
      default:
        this.drawBurst(ctx, t, '#ffffff', '#ffffa0', 24 * s);
    }
    ctx.restore();
  }

  private drawParticles(ctx: CanvasRenderingContext2D, color: string, alpha: number): void {
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.fillStyle = color;
    for (const p of this.particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawBurst(ctx: CanvasRenderingContext2D, t: number, inner: string, outer: string, size: number): void {
    const a = 1 - t;
    const r = size * (0.5 + t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= a;
    ctx.fillStyle = outer;
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRing(ctx: CanvasRenderingContext2D, t: number, color: string, size: number, width: number): void {
    ctx.save();
    ctx.globalAlpha *= 1 - t;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * t + 2, (size * t + 2) * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawGlow(ctx: CanvasRenderingContext2D, color: string, r: number, alpha: number): void {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(0, -10, 0, 0, -10, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -10, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawSlash(ctx: CanvasRenderingContext2D, t: number, dir: number, color: string, offset: number): void {
    if (t <= 0) return;
    const s = this.scale;
    const head = Math.min(1, t * 2);
    const tail = Math.max(0, t * 2 - 0.6);
    const ax = 34 * s * -dir;
    const ay = -34 * s;
    const p = (k: number) => [ax + (-ax * 2) * k + offset, ay + (-ay * 2) * k + offset * 0.3] as const;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, a] of [
      [10, 0.35],
      [4, 1],
    ] as const) {
      ctx.globalAlpha = a * (1 - Math.max(0, (t - 0.6) / 0.4));
      ctx.strokeStyle = color;
      ctx.lineWidth = w * s;
      ctx.beginPath();
      const [x0, y0] = p(tail);
      const [x1, y1] = p(head);
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + 8 * s, (y0 + y1) / 2 + 8 * s, x1, y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawSparkles(ctx: CanvasRenderingContext2D, t: number, color: string, n: number): void {
    const r = mulberry32(99);
    for (let i = 0; i < n; i++) {
      const phase = (t * 2 + r()) % 1;
      ctx.globalAlpha = Math.sin(phase * Math.PI);
      this.star(ctx, (r() - 0.5) * 70 * this.scale, (r() - 0.8) * 70 * this.scale, 6 * this.scale, color);
    }
    ctx.globalAlpha = 1;
  }

  private star(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x, y, x + size, y);
    ctx.quadraticCurveTo(x, y, x, y + size);
    ctx.quadraticCurveTo(x, y, x - size, y);
    ctx.quadraticCurveTo(x, y, x, y - size);
    ctx.fill();
  }
}

/** Draw an emotion balloon above a point. `frame` counts up to 72. */
export function drawBalloon(ctx: CanvasRenderingContext2D, type: BalloonType, x: number, y: number, frame: number): void {
  const pop = Math.min(1, frame / 6);
  const fade = frame > 60 ? 1 - (frame - 60) / 12 : 1;
  const scale = pop < 1 ? 0.5 + pop * 0.6 : 1 + Math.max(0, 0.1 - (frame - 6) * 0.02);
  ctx.save();
  ctx.translate(x, y - 14);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= fade;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#2a2040';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-14, -26, 28, 24, 8);
  ctx.moveTo(-4, -3);
  ctx.lineTo(0, 4);
  ctx.lineTo(4, -3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-4, -4, 8, 3);
  const cy = -14;
  ctx.lineWidth = 3;
  switch (type) {
    case 'exclamation':
      ctx.fillStyle = '#e02020';
      ctx.fillRect(-2, cy - 8, 4, 10);
      ctx.fillRect(-2, cy + 4, 4, 4);
      break;
    case 'question':
      ctx.fillStyle = '#2050e0';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, cy + 1);
      break;
    case 'music':
      ctx.fillStyle = '#20a040';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', 0, cy + 1);
      break;
    case 'heart':
      ctx.fillStyle = '#ff3070';
      ctx.beginPath();
      ctx.moveTo(0, cy + 7);
      ctx.bezierCurveTo(-12, cy - 2, -6, cy - 11, 0, cy - 4);
      ctx.bezierCurveTo(6, cy - 11, 12, cy - 2, 0, cy + 7);
      ctx.fill();
      break;
    case 'anger':
      ctx.strokeStyle = '#e02020';
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        ctx.beginPath();
        ctx.arc(sx * 6, cy + sy * 5, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case 'sweat':
      ctx.fillStyle = '#40a0f0';
      ctx.beginPath();
      ctx.moveTo(0, cy - 9);
      ctx.quadraticCurveTo(7, cy + 2, 0, cy + 7);
      ctx.quadraticCurveTo(-7, cy + 2, 0, cy - 9);
      ctx.fill();
      break;
    case 'frustration':
      ctx.strokeStyle = '#404040';
      ctx.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = i * 0.7;
        ctx.lineTo(Math.cos(a) * (1 + i * 0.4), cy + Math.sin(a) * (1 + i * 0.4));
      }
      ctx.stroke();
      break;
    case 'silence':
      ctx.fillStyle = '#404040';
      for (let i = -1; i <= 1; i++) ctx.fillRect(i * 7 - 2, cy, 4, 4);
      break;
    case 'light':
      ctx.fillStyle = '#f0c020';
      ctx.beginPath();
      ctx.arc(0, cy - 2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-3, cy + 3, 6, 5);
      break;
    case 'zzz':
      ctx.fillStyle = '#4060c0';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Zz', 0, cy + 1);
      break;
  }
  ctx.restore();
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

/** Screen-space weather particles. */
export class Weather {
  private drops: Drop[] = [];
  private rng = mulberry32(1234);

  update(type: WeatherType, power: number, w: number, h: number): void {
    const target = type === 'none' ? 0 : Math.round(power * (type === 'snow' ? 12 : type === 'storm' ? 30 : 20));
    while (this.drops.length < target) this.drops.push(this.spawn(type, w, h, true));
    if (this.drops.length > target) this.drops.length = target;
    for (const d of this.drops) {
      d.x += d.vx + (type === 'snow' ? Math.sin(d.phase) * 0.6 : 0);
      d.y += d.vy;
      d.phase += 0.05;
      if (d.y > h + 10 || d.x < -20 || d.x > w + 20) Object.assign(d, this.spawn(type, w, h, false));
    }
  }

  private spawn(type: WeatherType, w: number, h: number, anywhere: boolean): Drop {
    const r = this.rng;
    if (type === 'snow') return { x: r() * w, y: anywhere ? r() * h : -10, vx: -0.3 + r() * 0.6, vy: 0.8 + r() * 1.2, size: 2 + r() * 2.5, phase: r() * 6 };
    const storm = type === 'storm';
    return { x: r() * (w + 100), y: anywhere ? r() * h : -20, vx: storm ? -6 : -3, vy: storm ? 16 : 11 + r() * 3, size: storm ? 20 : 14, phase: 0 };
  }

  draw(ctx: CanvasRenderingContext2D, type: WeatherType, power: number, w: number, h: number): void {
    if (type === 'none' || this.drops.length === 0) return;
    ctx.save();
    if (type === 'storm') {
      ctx.fillStyle = `rgba(0,0,20,${Math.min(0.35, power * 0.04)})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (type === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const d of this.drops) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.strokeStyle = 'rgba(200,215,255,0.65)';
      ctx.lineWidth = type === 'storm' ? 2 : 1.5;
      ctx.beginPath();
      for (const d of this.drops) {
        const k = d.size / Math.hypot(d.vx, d.vy);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - d.vx * k, d.y - d.vy * k);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
