/** Development page: boots the engine with a small test project. */
import { builtinTileId } from '../core/builtins';
import { createCommand, createEvent } from '../core/factory';
import { createEmptyProject } from '../core/project';
import { createSampleProject } from '../core/sample';
import type { EventCommand } from '../core/types';
import { Game } from '../engine/game';

const project = createEmptyProject('Engine Test');
const map = project.maps[0];
map.displayName = 'Test Meadow';
map.bgm = { name: 'builtin:town', volume: 70, pitch: 100 };
const set = (layer: number, x: number, y: number, key: string) => (map.layers[layer][y * map.width + x] = builtinTileId(key));
for (let x = 0; x < map.width; x++) {
  set(2, x, 0, 'treeBottom');
}
for (let y = 3; y < 7; y++) for (let x = 12; x < 17; x++) set(0, x, y, 'water');
set(2, 4, 4, 'treeBottom');
set(2, 4, 3, 'treeTop');
const text = (t: string, face = 'villager'): EventCommand => ({ type: 'showText', face: { sheet: `builtin:${face}`, index: 0 }, speaker: face, text: t, position: 'bottom', background: 'window' });
const npc = createEvent(1, 6, 8);
npc.pages[0].graphic = { kind: 'character', sheet: 'builtin:villager', index: 0, direction: 2, pattern: 1 };
npc.pages[0].moveType = 'random';
const choice = createCommand('showChoices') as Extract<EventCommand, { type: 'showChoices' }>;
choice.choices = ['Fight a slime', 'Visit the shop', 'Never mind'];
choice.branches = [
  [{ type: 'battle', troopId: 1, canEscape: true, canLose: false, winBranch: [], escapeBranch: [], loseBranch: [] }],
  [{ type: 'shop', goods: [{ kind: 'item', id: 1, price: null }, { kind: 'weapon', id: 2, price: null }, { kind: 'armor', id: 7, price: null }], purchaseOnly: false }],
  [text('Take care out there!')],
];
npc.pages[0].commands = [text('Hello, traveler! \\C[6]Welcome\\C[0] to the test meadow. This text is long enough to wrap onto a second line, and it keeps going so that we can check paging in the message window too. One more sentence here.'), choice];
map.events.push(npc);
project.system.startGold = 500;
project.system.party = [1, 2];
project.maps[0].encounters = [{ troopId: 2, weight: 1, regions: [] }];
project.maps[0].encounterSteps = 9999;

const params = new URLSearchParams(location.search);
const sample = params.get('sample');
const [sm, sx, sy] = (sample ?? '').split(',').map(Number);
Game.create({ container: document.getElementById('game')!, project: sample ? createSampleProject() : project, isTest: true, skipTitle: params.has('skip'), startAt: sample ? { mapId: sm, x: sx, y: sy } : undefined }).then((g) => {
  (window as unknown as { game: Game }).game = g;
});
