/**
 * Message queue state shared between the interpreter (which requests
 * messages) and the message window (which displays them).
 */

import type { FaceRef } from '../core/types';

export interface MessageRequest {
  face: FaceRef | null;
  speaker: string;
  text: string;
  position: 'top' | 'middle' | 'bottom';
  background: 'window' | 'dim' | 'transparent';
}

export interface ChoiceRequest {
  items: string[];
  defaultIndex: number;
  /** -1 cannot cancel, -2 cancel branch, >=0 the choice used on cancel */
  cancel: number;
}

export interface NumberRequest {
  digits: number;
  initial: number;
}

export class MessageState {
  text: MessageRequest | null = null;
  choices: ChoiceRequest | null = null;
  number: NumberRequest | null = null;
  /** Incremented on every new request so the window can detect changes. */
  serial = 0;
  private callback: ((result: number) => void) | null = null;

  isBusy(): boolean {
    return this.text !== null || this.choices !== null || this.number !== null;
  }

  /**
   * Show a message (optionally followed by choices or a number input in the
   * same window). The callback receives the choice index, -2 for the cancel
   * branch, or the entered number.
   */
  show(text: MessageRequest | null, extra: { choices?: ChoiceRequest; number?: NumberRequest } = {}, callback?: (result: number) => void): void {
    this.text = text;
    this.choices = extra.choices ?? null;
    this.number = extra.number ?? null;
    this.callback = callback ?? null;
    this.serial++;
  }

  finish(result = -1): void {
    const cb = this.callback;
    this.text = null;
    this.choices = null;
    this.number = null;
    this.callback = null;
    cb?.(result);
  }

  clear(): void {
    this.text = null;
    this.choices = null;
    this.number = null;
    this.callback = null;
  }
}
