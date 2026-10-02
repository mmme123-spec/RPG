/** Screen effects state: fades, tone, flash, shake, weather and pictures. */

import type { WeatherType } from '../core/types';

export type Tone = [number, number, number, number];

export interface Picture {
  image: string;
  x: number;
  y: number;
  origin: 'topLeft' | 'center';
  scale: number;
  opacity: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  targetOpacity: number;
  duration: number;
}

export class ScreenState {
  /** 1 = normal, 0 = fully faded to fadeColor */
  brightness = 1;
  fadeColor: 'black' | 'white' = 'black';
  private fadeTarget = 1;
  private fadeDuration = 0;
  tone: Tone = [0, 0, 0, 0];
  private toneTarget: Tone = [0, 0, 0, 0];
  private toneDuration = 0;
  flashColor: Tone = [255, 255, 255, 0];
  private flashDuration = 0;
  shake = 0;
  private shakePower = 0;
  private shakeSpeed = 0;
  private shakeDuration = 0;
  private shakeDirection = 1;
  weatherType: WeatherType = 'none';
  weatherPower = 0;
  private weatherTarget = 0;
  private weatherDuration = 0;
  pictures = new Map<number, Picture>();

  clearAll(): void {
    this.brightness = 1;
    this.fadeDuration = 0;
    this.tone = [0, 0, 0, 0];
    this.toneDuration = 0;
    this.flashColor = [255, 255, 255, 0];
    this.flashDuration = 0;
    this.shake = 0;
    this.shakeDuration = 0;
    this.weatherType = 'none';
    this.weatherPower = 0;
    this.weatherDuration = 0;
    this.pictures.clear();
  }

  startFadeOut(frames: number, color: 'black' | 'white' = 'black'): void {
    this.fadeColor = color;
    this.fadeTarget = 0;
    this.fadeDuration = Math.max(1, frames);
    if (frames <= 0) {
      this.brightness = 0;
      this.fadeDuration = 0;
    }
  }

  startFadeIn(frames: number): void {
    this.fadeTarget = 1;
    this.fadeDuration = Math.max(1, frames);
    if (frames <= 0) {
      this.brightness = 1;
      this.fadeDuration = 0;
    }
  }

  isFading(): boolean {
    return this.fadeDuration > 0;
  }

  startTint(tone: Tone, frames: number): void {
    this.toneTarget = [...tone];
    this.toneDuration = frames;
    if (frames <= 0) this.tone = [...tone];
  }

  isTinting(): boolean {
    return this.toneDuration > 0;
  }

  startFlash(color: Tone, frames: number): void {
    this.flashColor = [...color];
    this.flashDuration = Math.max(1, frames);
  }

  isFlashing(): boolean {
    return this.flashDuration > 0;
  }

  startShake(power: number, speed: number, frames: number): void {
    this.shakePower = power;
    this.shakeSpeed = speed;
    this.shakeDuration = frames;
  }

  isShaking(): boolean {
    return this.shakeDuration > 0 || this.shake !== 0;
  }

  changeWeather(type: WeatherType, power: number, frames: number): void {
    if (type !== 'none' || frames === 0) this.weatherType = type;
    this.weatherTarget = type === 'none' ? 0 : power;
    this.weatherDuration = frames;
    if (frames === 0) this.weatherPower = this.weatherTarget;
  }

  isWeatherChanging(): boolean {
    return this.weatherDuration > 0;
  }

  showPicture(id: number, image: string, x: number, y: number, origin: 'topLeft' | 'center', scale: number, opacity: number): void {
    this.pictures.set(id, { image, x, y, origin, scale, opacity, targetX: x, targetY: y, targetScale: scale, targetOpacity: opacity, duration: 0 });
  }

  movePicture(id: number, x: number, y: number, scale: number, opacity: number, duration: number): void {
    const p = this.pictures.get(id);
    if (!p) return;
    p.targetX = x;
    p.targetY = y;
    p.targetScale = scale;
    p.targetOpacity = opacity;
    p.duration = duration;
    if (duration <= 0) {
      p.x = x;
      p.y = y;
      p.scale = scale;
      p.opacity = opacity;
    }
  }

  isPictureMoving(id: number): boolean {
    return (this.pictures.get(id)?.duration ?? 0) > 0;
  }

  erasePicture(id: number): void {
    this.pictures.delete(id);
  }

  update(): void {
    if (this.fadeDuration > 0) {
      const d = this.fadeDuration;
      this.brightness = (this.brightness * (d - 1) + this.fadeTarget) / d;
      this.fadeDuration--;
    }
    if (this.toneDuration > 0) {
      const d = this.toneDuration;
      this.tone = this.tone.map((v, i) => (v * (d - 1) + this.toneTarget[i]) / d) as Tone;
      this.toneDuration--;
    }
    if (this.flashDuration > 0) {
      const d = this.flashDuration;
      this.flashColor[3] *= (d - 1) / d;
      this.flashDuration--;
    }
    if (this.shakeDuration > 0 || this.shake !== 0) {
      const delta = (this.shakePower * this.shakeSpeed * this.shakeDirection) / 10;
      if (this.shakeDuration <= 1 && this.shake * (this.shake + delta) < 0) {
        this.shake = 0;
      } else {
        this.shake += delta;
      }
      if (this.shake > this.shakePower * 2) this.shakeDirection = -1;
      if (this.shake < -this.shakePower * 2) this.shakeDirection = 1;
      this.shakeDuration--;
      if (this.shakeDuration < 0 && Math.abs(this.shake) < 1) this.shake = 0;
    }
    if (this.weatherDuration > 0) {
      const d = this.weatherDuration;
      this.weatherPower = (this.weatherPower * (d - 1) + this.weatherTarget) / d;
      this.weatherDuration--;
      if (this.weatherDuration === 0 && this.weatherTarget === 0) this.weatherType = 'none';
    }
    for (const p of this.pictures.values()) {
      if (p.duration > 0) {
        const d = p.duration;
        p.x = (p.x * (d - 1) + p.targetX) / d;
        p.y = (p.y * (d - 1) + p.targetY) / d;
        p.scale = (p.scale * (d - 1) + p.targetScale) / d;
        p.opacity = (p.opacity * (d - 1) + p.targetOpacity) / d;
        p.duration--;
      }
    }
  }
}
