# RPG Forge

An RPG Maker–style game creation platform that runs entirely in the browser. You can build tile maps, script events, edit a full RPG database, playtest straight away, and export a finished game as a **single HTML file** that anyone can play.

All graphics, music and sound effects are generated procedurally at runtime, so the project ships with no binary assets. You can still import your own images and audio.

## Features

**Map editor**
- Four tile layers (layer 4 draws above characters) plus regions
- RPG Maker–style autotiles (A2 floor and A3 wall layouts) for grass, water, roads, walls, roofs, cliffs and more
- Tools: pencil, rectangle, flood fill, eraser and picker. Multi-tile brushes, zoom, grid and layer dimming
- Map tree with child maps, plus per-map music, battle background and random encounters (weighted, can be limited to regions)
- Undo/redo for every change, and autosave to IndexedDB

**Events**
- Multi-page events with conditions (switches, variables, self switches, items, gold, actors and more)
- Graphics, autonomous movement and custom move routes, priority, and triggers (action, touch, autorun, parallel)
- 60 commands: text with faces and escape codes, choices, conditional branches, loops, labels, switches and variables, party, gold, items and equipment, transfers, move routes, balloons and animations, pictures, screen tint/flash/shake, weather, audio, battles with win/escape/lose branches, shops, the inn, name input, menu/save access, and scripts
- Copy and paste for commands and events, plus right-click quick events (door/transfer, treasure chest, set start, playtest from here)

**Database**
- Actors, classes (parameter curves and skill learning), skills and items (damage formulas, effects), weapons and armour, enemies (action patterns and drops), troops (drag-and-drop layout), states, common events, tilesets (passage, bush, ladder, counter, damage and terrain flags), system settings and terms
- An asset manager for importing your own tilesets, characters, faces, enemies, backgrounds, pictures and audio

**Engine**
- Fixed 60 Hz game loop rendering to a canvas, with keyboard, gamepad and touch controls
- Title screen, map exploration with followers and dashing, a message system, menus (items, skills, equipment, status, save/load), shops and name input
- **Action combat (default):** free 8-way movement and Nuclear Throne–style real-time fights on the map. Aim with the mouse, shoot or swing your weapon (the weapon type sets the attack: swords and spears slash and deflect bullets; daggers, bows and staves fire projectiles), cast your first attack skill, and dodge-roll through bullets. Enemies spawn around you and chase, lunge or fire bullet patterns; bosses alternate volleys, rings and charges. Damage still comes from the database formulas, and you earn EXP, gold, drops and level-ups. Party followers fight beside you as AI allies: they keep formation, aim, shoot or charge with their own weapons, dodge bullets and cast heals or attack spells. When the lead hero falls, the next party member takes over. Guns (revolver, shotgun, SMG, burst-fire assault rifle, grenade launcher) are a weapon type in the default database. Enemies fire bullet-hell patterns (aimed bursts, fans, spirals, rings, flowers), ordinary encounters come in bigger packs, some enemies burst into bullet rings when they die, and your hitbox is a small dot shown when bullets get close.
- **Classic mode:** tile movement and turn-based side-view battles with skills, states, buffs, elements, critical hits and escape. Switch in Database → System → Movement & combat
- A chiptune music and sound engine (MML), plus weather and screen effects
- Twelve save slots in browser storage

**Sample game: *The Ember Crystal***
A short adventure: a village with an inn, a shop and an Elder's quest, a field with random encounters, a companion who joins you, a cave with treasure, and a Dark Knight boss.

## Getting started

```bash
npm install
npm run dev          # editor at http://localhost:5173
npm test             # unit tests (vitest)
npm run build        # production build in dist/
npm run build:single # the whole editor as one HTML file in dist-single/
```

Keyboard shortcuts:

| Shortcut | Action |
|---|---|
| F5 | Playtest |
| Shift+F5 | Playtest from the tile under the cursor |
| Ctrl+Z / Ctrl+Y | Undo / redo |
| Ctrl+S | Save |
| Ctrl+D | Database |
| 1–6 | Select layer (5 = events, 6 = regions) |
| P R F E I | Pencil, rectangle, fill, eraser, picker |
| G | Toggle grid |
| + / − / 0 | Zoom in, zoom out, reset zoom |

In game, arrows/WASD move, the mouse aims, left click (or J) attacks, right click (or K) casts a skill, Shift dodge-rolls, Z/Enter/Space talks or confirms, and X/Esc cancels or opens the menu. Gamepads work too: the right stick aims, RT attacks and LT casts. With only a keyboard, attacks auto-aim at the nearest enemy. During a playtest, Ctrl walks through walls and F9 toggles the debug panel.

## Project layout

```
src/core     data model, defaults, tiles/autotiles, sample game
src/art      procedural pixel art (tiles, characters, faces, icons, enemies, backgrounds)
src/audio    MML chiptune synthesiser, songs and sound effects
src/render   image library and tilemap renderer (shared by editor and engine)
src/engine   game runtime: interpreter, map, battle, scenes, UI windows
src/editor   React editor: map canvas, palette, event editor, database, playtest, export
vite-plugins builds the standalone runtime that is embedded in exported games
```

Exported games embed the minified runtime (`src/engine/standalone.ts`) together with the project JSON, so they work offline from a single file.
