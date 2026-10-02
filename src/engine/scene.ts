/** Scene base class. Scenes are stacked; transparent scenes draw the one below first. */

import type { Game } from './game';

export abstract class Scene {
  readonly game: Game;
  /** Draw the scene underneath before this one (menus over the map). */
  transparent = false;

  constructor(game: Game) {
    this.game = game;
  }

  /** Called when the scene becomes the top scene for the first time. */
  start(): void {}

  /** Called when a scene pushed on top of this one is popped. */
  resume(): void {}

  abstract update(): void;

  abstract render(ctx: CanvasRenderingContext2D): void;

  /** Called when the scene is removed. */
  stop(): void {}
}
