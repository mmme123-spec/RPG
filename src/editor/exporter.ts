/** Export helpers: project JSON download and the standalone single-file HTML game. */

import type { Project } from '../core/types';
import runtime from 'virtual:rpgforge-runtime';

export function download(name: string, content: string | Blob, type = 'application/octet-stream'): void {
  const blob = typeof content === 'string' ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeFileName(s: string): string {
  return s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'game';
}

/** Make a string safe to place inside an inline <script> element. */
function scriptSafe(s: string): string {
  return s.replace(/<\/(script)/gi, '<\\/$1');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function buildStandaloneHtml(project: Project): string {
  const title = escapeHtml(project.system.gameTitle || 'RPG');
  // `<` only occurs inside JSON strings, where \u003c is an equivalent escape.
  const data = JSON.stringify(project).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${title}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}#game{position:fixed;inset:0}</style>
</head>
<body>
<div id="game"></div>
<script>${scriptSafe(runtime)}</script>
<script id="project" type="application/json">${data}</script>
<script>RPGForgeRuntime.boot(document.getElementById('game'), JSON.parse(document.getElementById('project').textContent));</script>
</body>
</html>
`;
}

export function exportGame(project: Project): void {
  download(`${safeFileName(project.system.gameTitle)}.html`, buildStandaloneHtml(project), 'text/html');
}

export function exportProject(project: Project): void {
  download(`${safeFileName(project.system.gameTitle)}.rpgforge.json`, JSON.stringify(project), 'application/json');
}
