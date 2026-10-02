/**
 * Entry point of the standalone runtime used by exported games. Exposes
 * `RPGForgeRuntime.boot(container, project)` on the global object.
 */
import type { Project } from '../core/types';
import { normalizeProject } from '../core/project';
import { Game } from './game';

export async function boot(container: HTMLElement, data: unknown): Promise<Game> {
  const project: Project = normalizeProject(data);
  document.title = project.system.gameTitle || document.title;
  return Game.create({ container, project, saveNamespace: `game:${project.id}` });
}
