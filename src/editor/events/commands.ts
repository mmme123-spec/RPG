/** Command metadata, descriptions and tree navigation for the event editor. */

import type { Condition, EventCommand, EventCommandType, MoveCommand, Project, ValueSource } from '../../core/types';

export type BranchKey = string;
export type ListPath = [number, BranchKey][];

export const COMMAND_GROUPS: { name: string; items: [EventCommandType, string][] }[] = [
  {
    name: 'Message',
    items: [
      ['showText', 'Show Text'],
      ['showChoices', 'Show Choices'],
      ['inputNumber', 'Input Number'],
      ['comment', 'Comment'],
    ],
  },
  {
    name: 'Flow',
    items: [
      ['conditional', 'Conditional Branch'],
      ['loop', 'Loop'],
      ['breakLoop', 'Break Loop'],
      ['exitEvent', 'Exit Event'],
      ['callCommonEvent', 'Common Event'],
      ['label', 'Label'],
      ['jumpToLabel', 'Jump to Label'],
      ['wait', 'Wait'],
    ],
  },
  {
    name: 'Game State',
    items: [
      ['controlSwitches', 'Control Switches'],
      ['controlVariables', 'Control Variables'],
      ['controlSelfSwitch', 'Control Self Switch'],
      ['controlTimer', 'Control Timer'],
      ['changeAccess', 'Change Access'],
    ],
  },
  {
    name: 'Party',
    items: [
      ['changeGold', 'Change Gold'],
      ['changeItems', 'Change Items'],
      ['changePartyMember', 'Change Party Member'],
    ],
  },
  {
    name: 'Actor',
    items: [
      ['changeHp', 'Change HP'],
      ['changeMp', 'Change MP'],
      ['changeState', 'Change State'],
      ['recoverAll', 'Recover All'],
      ['changeExp', 'Change EXP'],
      ['changeLevel', 'Change Level'],
      ['changeSkill', 'Change Skill'],
      ['changeEquipment', 'Change Equipment'],
      ['changeName', 'Change Name'],
      ['changeActorGraphic', 'Change Actor Graphic'],
      ['nameInput', 'Name Input'],
    ],
  },
  {
    name: 'Movement',
    items: [
      ['transferPlayer', 'Transfer Player'],
      ['setEventLocation', 'Set Event Location'],
      ['setMoveRoute', 'Set Move Route'],
      ['changeTransparency', 'Player Transparency'],
      ['changeFollowers', 'Show/Hide Followers'],
      ['showAnimation', 'Show Animation'],
      ['showBalloon', 'Show Balloon'],
      ['eraseEvent', 'Erase Event'],
    ],
  },
  {
    name: 'Screen',
    items: [
      ['fadeOut', 'Fade Out'],
      ['fadeIn', 'Fade In'],
      ['tintScreen', 'Tint Screen'],
      ['flashScreen', 'Flash Screen'],
      ['shakeScreen', 'Shake Screen'],
      ['setWeather', 'Set Weather'],
      ['showPicture', 'Show Picture'],
      ['movePicture', 'Move Picture'],
      ['erasePicture', 'Erase Picture'],
    ],
  },
  {
    name: 'Audio',
    items: [
      ['playBgm', 'Play BGM'],
      ['fadeOutBgm', 'Fade Out BGM'],
      ['playBgs', 'Play BGS'],
      ['playMe', 'Play ME'],
      ['playSe', 'Play SE'],
    ],
  },
  {
    name: 'Scene',
    items: [
      ['battle', 'Battle'],
      ['shop', 'Shop'],
      ['openMenu', 'Open Menu'],
      ['openSave', 'Open Save Screen'],
      ['gameOver', 'Game Over'],
      ['returnToTitle', 'Return to Title'],
      ['script', 'Script'],
    ],
  },
];

export const COMMAND_LABEL: Record<string, string> = Object.fromEntries(COMMAND_GROUPS.flatMap((g) => g.items));

export function commandColor(t: EventCommandType): string {
  const g = COMMAND_GROUPS.findIndex((gr) => gr.items.some(([x]) => x === t));
  return ['#7ab8ff', '#ff9b8a', '#ffd166', '#9be38a', '#c5a3ff', '#7fe0d4', '#ffb3d9', '#f5c27a', '#d0d0d8'][g] ?? '#ddd';
}

/** The child lists of a command, keyed for paths. */
export function branchesOf(c: EventCommand): { key: BranchKey; label: string; list: EventCommand[] }[] {
  switch (c.type) {
    case 'conditional':
      return c.else ? [{ key: 'then', label: '', list: c.then }, { key: 'else', label: 'Else', list: c.else }] : [{ key: 'then', label: '', list: c.then }];
    case 'loop':
      return [{ key: 'body', label: '', list: c.body }];
    case 'showChoices':
      return [
        ...c.choices.map((ch, i) => ({ key: `branch:${i}`, label: `When [${ch}]`, list: c.branches[i] ?? [] })),
        ...(c.cancel === -2 ? [{ key: 'cancel', label: 'When Cancel', list: c.cancelBranch }] : []),
      ];
    case 'battle':
      return c.canEscape || c.canLose
        ? [
            { key: 'win', label: 'If Win', list: c.winBranch },
            ...(c.canEscape ? [{ key: 'escape', label: 'If Escape', list: c.escapeBranch }] : []),
            ...(c.canLose ? [{ key: 'lose', label: 'If Lose', list: c.loseBranch }] : []),
          ]
        : [];
    default:
      return [];
  }
}

export function childList(c: EventCommand, key: BranchKey): EventCommand[] {
  if (c.type === 'conditional') return key === 'else' ? (c.else ??= []) : c.then;
  if (c.type === 'loop') return c.body;
  if (c.type === 'showChoices') {
    if (key === 'cancel') return c.cancelBranch;
    const i = Number(key.split(':')[1]);
    while (c.branches.length <= i) c.branches.push([]);
    return c.branches[i];
  }
  if (c.type === 'battle') return key === 'win' ? c.winBranch : key === 'escape' ? c.escapeBranch : c.loseBranch;
  throw new Error('Command has no child lists');
}

export function resolveList(root: EventCommand[], path: ListPath): EventCommand[] {
  let list = root;
  for (const [i, key] of path) list = childList(list[i], key);
  return list;
}

export interface Row {
  path: ListPath;
  /** Index in the list; equal to list length for the insertion row at the end. */
  index: number;
  depth: number;
  kind: 'command' | 'end' | 'label';
  text: string;
  color: string;
}

export function flatten(root: EventCommand[], project: Project): Row[] {
  const rows: Row[] = [];
  const walk = (list: EventCommand[], path: ListPath, depth: number) => {
    list.forEach((c, i) => {
      rows.push({ path, index: i, depth, kind: 'command', text: describe(c, project), color: commandColor(c.type) });
      for (const b of branchesOf(c)) {
        if (b.label) rows.push({ path, index: i, depth, kind: 'label', text: `: ${b.label}`, color: commandColor(c.type) });
        walk(b.list, [...path, [i, b.key]], depth + 1);
      }
      if (branchesOf(c).length) rows.push({ path, index: i, depth, kind: 'label', text: ': End', color: commandColor(c.type) });
    });
    rows.push({ path, index: list.length, depth, kind: 'end', text: '◆', color: '#888' });
  };
  walk(root, [], 0);
  return rows;
}

const name = (list: { id: number; name: string }[], id: number) => list.find((e) => e.id === id)?.name ?? `#${id}`;

export function describeValue(v: ValueSource, p: Project): string {
  switch (v.kind) {
    case 'constant':
      return String(v.value);
    case 'variable':
      return `V[${v.id}] ${p.system.variables[v.id - 1] ?? ''}`.trim();
    case 'random':
      return `Random ${v.min}..${v.max}`;
    case 'script':
      return `Script: ${v.script}`;
    case 'gameData':
      return `${v.data}${v.id ? ` #${v.id}` : ''}${v.param ? ` ${v.param}` : ''}`;
  }
}

export function describeCondition(c: Condition, p: Project): string {
  switch (c.kind) {
    case 'switch':
      return `Switch [${c.id}: ${p.system.switches[c.id - 1] || '?'}] is ${c.value ? 'ON' : 'OFF'}`;
    case 'variable':
      return `Variable [${c.id}: ${p.system.variables[c.id - 1] || '?'}] ${c.op} ${describeValue(c.operand, p)}`;
    case 'selfSwitch':
      return `Self Switch ${c.letter} is ${c.value ? 'ON' : 'OFF'}`;
    case 'timer':
      return `Timer ${c.op} ${c.seconds}s`;
    case 'actor':
      return `${name(p.actors, c.actorId)} ${c.check === 'inParty' ? 'is in the party' : c.check === 'name' ? `is named ${c.name}` : `has ${c.check} ${c.refId}`}`;
    case 'character':
      return `${c.target < 0 ? 'Player' : c.target === 0 ? 'This event' : `Event ${c.target}`} faces ${({ 2: 'down', 4: 'left', 6: 'right', 8: 'up' } as Record<number, string>)[c.direction]}`;
    case 'gold':
      return `Gold ${c.op} ${c.value}`;
    case 'item':
      return `Party has ${name(p.items, c.itemId)}`;
    case 'weapon':
      return `Party has ${name(p.weapons, c.weaponId)}`;
    case 'armor':
      return `Party has ${name(p.armors, c.armorId)}`;
    case 'button':
      return `Button [${c.button}] is pressed`;
    case 'script':
      return `Script: ${c.script}`;
  }
}

export function describeMove(m: MoveCommand): string {
  switch (m.code) {
    case 'jump':
      return `Jump ${m.x},${m.y}`;
    case 'wait':
      return `Wait ${m.frames}f`;
    case 'switchOn':
    case 'switchOff':
      return `${m.code === 'switchOn' ? 'Switch ON' : 'Switch OFF'} ${m.id}`;
    case 'speed':
      return `Speed ${m.value}`;
    case 'frequency':
      return `Frequency ${m.value}`;
    case 'graphic':
      return `Graphic ${m.sheet}`;
    case 'opacity':
      return `Opacity ${m.value}`;
    case 'se':
      return `SE ${m.audio.name}`;
    case 'script':
      return `Script`;
    default:
      return m.code.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
  }
}

const who = (id: number) => (id === 0 ? 'Entire Party' : `Actor ${id}`);
const target = (t: number) => (t < 0 ? 'Player' : t === 0 ? 'This Event' : `Event ${t}`);

export function describe(c: EventCommand, p: Project): string {
  const L = COMMAND_LABEL[c.type] ?? c.type;
  switch (c.type) {
    case 'showText':
      return `${L}: ${c.speaker ? `[${c.speaker}] ` : ''}${c.text.replace(/\n/g, ' ⏎ ')}`;
    case 'showChoices':
      return `${L}: ${c.choices.join(', ')}`;
    case 'inputNumber':
      return `${L}: V[${c.variableId}], ${c.digits} digits`;
    case 'comment':
      return `// ${c.text}`;
    case 'conditional':
      return `If: ${describeCondition(c.condition, p)}`;
    case 'callCommonEvent':
      return `${L}: ${name(p.commonEvents, c.commonEventId)}`;
    case 'label':
    case 'jumpToLabel':
      return `${L}: ${c.name}`;
    case 'controlSwitches':
      return `${L}: [${c.from}${c.to !== c.from ? `..${c.to}` : `: ${p.system.switches[c.from - 1] || ''}`}] = ${c.value.toUpperCase()}`;
    case 'controlVariables':
      return `${L}: [${c.from}${c.to !== c.from ? `..${c.to}` : `: ${p.system.variables[c.from - 1] || ''}`}] ${{ set: '=', add: '+=', sub: '-=', mul: '*=', div: '/=', mod: '%=' }[c.op]} ${describeValue(c.operand, p)}`;
    case 'controlSelfSwitch':
      return `${L}: ${c.letter} = ${c.value ? 'ON' : 'OFF'}`;
    case 'controlTimer':
      return `${L}: ${c.action === 'start' ? `Start ${c.seconds}s` : 'Stop'}`;
    case 'changeGold':
      return `${L}: ${c.op} ${describeValue(c.operand, p)}`;
    case 'changeItems': {
      const list = c.itemKind === 'item' ? p.items : c.itemKind === 'weapon' ? p.weapons : p.armors;
      return `${L}: ${name(list, c.id)} ${c.op} ${describeValue(c.operand, p)}`;
    }
    case 'changePartyMember':
      return `${L}: ${c.op === 'add' ? 'Add' : 'Remove'} ${name(p.actors, c.actorId)}`;
    case 'changeHp':
    case 'changeMp':
    case 'changeExp':
    case 'changeLevel':
      return `${L}: ${c.actorId ? name(p.actors, c.actorId) : who(0)} ${c.op} ${describeValue(c.operand, p)}`;
    case 'changeState':
      return `${L}: ${c.actorId ? name(p.actors, c.actorId) : who(0)} ${c.op === 'add' ? '+' : '-'} ${name(p.states, c.stateId)}`;
    case 'recoverAll':
      return `${L}: ${c.actorId ? name(p.actors, c.actorId) : who(0)}`;
    case 'changeSkill':
      return `${L}: ${name(p.actors, c.actorId)} ${c.op} ${name(p.skills, c.skillId)}`;
    case 'changeEquipment':
      return `${L}: ${name(p.actors, c.actorId)} slot ${c.slot + 1} = ${c.itemId || 'none'}`;
    case 'changeName':
      return `${L}: ${name(p.actors, c.actorId)} → ${c.name}`;
    case 'changeActorGraphic':
    case 'nameInput':
      return `${L}: ${name(p.actors, c.actorId)}`;
    case 'transferPlayer':
      return `${L}: ${name(p.maps, c.mapId)} (${c.x}, ${c.y})`;
    case 'setEventLocation':
      return `${L}: ${target(c.eventId)} → (${c.x}, ${c.y})`;
    case 'setMoveRoute':
      return `${L}: ${target(c.target)} — ${c.route.commands.map(describeMove).join(', ') || '(empty)'}${c.route.wait ? ' [wait]' : ''}`;
    case 'changeTransparency':
      return `${L}: ${c.transparent ? 'ON' : 'OFF'}`;
    case 'changeFollowers':
      return `${L}: ${c.visible ? 'Show' : 'Hide'}`;
    case 'showAnimation':
      return `${L}: ${target(c.target)}, ${c.animation}`;
    case 'showBalloon':
      return `${L}: ${target(c.target)}, ${c.balloon}`;
    case 'showPicture':
      return `${L}: #${c.pictureId} ${c.image}`;
    case 'movePicture':
    case 'erasePicture':
      return `${L}: #${c.pictureId}`;
    case 'wait':
      return `${L}: ${c.frames} frames`;
    case 'tintScreen':
      return `${L}: (${c.tone.join(', ')}), ${c.duration}f`;
    case 'flashScreen':
      return `${L}: (${c.color.join(', ')}), ${c.duration}f`;
    case 'shakeScreen':
      return `${L}: ${c.power}, ${c.speed}, ${c.duration}f`;
    case 'setWeather':
      return `${L}: ${c.weather}, ${c.power}`;
    case 'playBgm':
    case 'playBgs':
      return `${L}: ${c.audio?.name.replace('builtin:', '') ?? 'None'}`;
    case 'playMe':
    case 'playSe':
      return `${L}: ${c.audio.name.replace('builtin:', '')}`;
    case 'fadeOutBgm':
      return `${L}: ${c.seconds}s`;
    case 'battle':
      return `${L}: ${c.troopId ? name(p.troops, c.troopId) : 'Random encounter'}${c.canEscape ? ', can escape' : ''}${c.canLose ? ', continue on loss' : ''}`;
    case 'shop':
      return `${L}: ${c.goods.length} goods`;
    case 'changeAccess':
      return `${L}: ${c.access} ${c.enabled ? 'enabled' : 'disabled'}`;
    case 'script':
      return `${L}: ${c.script.split('\n')[0]}`;
    default:
      return L;
  }
}
