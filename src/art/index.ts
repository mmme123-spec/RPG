/** Entry point for generating built-in graphics by category and key. */

import { generateAutotileSheet } from './autotiles';
import { generateBattleback, generateTitle } from './backgrounds';
import { generateCharacterSheet } from './characters';
import { generateEnemy } from './enemies';
import { generateFaceSheet } from './faces';
import { generateIconSheet } from './icons';
import { generateIndoorSheet, generateOutdoorSheet } from './tiles';

export type BuiltinCategory = 'tiles' | 'character' | 'face' | 'enemy' | 'battleback' | 'title' | 'picture' | 'icons';

export function generateBuiltin(category: BuiltinCategory, key: string): HTMLCanvasElement | null {
  switch (category) {
    case 'tiles':
      if (key === 'outdoor') return generateOutdoorSheet();
      if (key === 'indoor') return generateIndoorSheet();
      if (key === 'autotiles') return generateAutotileSheet();
      return null;
    case 'character':
      return generateCharacterSheet(key);
    case 'face':
      return generateFaceSheet(key);
    case 'enemy':
      return generateEnemy(key);
    case 'battleback':
      return generateBattleback(key);
    case 'title':
      return generateTitle(key);
    case 'icons':
      return generateIconSheet();
    case 'picture':
      return generateEnemy(key) ?? generateBattleback(key) ?? generateTitle(key);
  }
}
