import { build, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Provides `virtual:rpgforge-runtime`, a module whose default export is the
 * minified source of the standalone game runtime (an IIFE that defines
 * `window.RPGForgeRuntime`). The editor inlines this string into exported
 * games so that a finished game is a single self-contained HTML file.
 *
 * The runtime is compiled on demand with a nested Vite build and cached until
 * one of its source files changes.
 */
export function runtimeSource(): Plugin {
  const VIRTUAL_ID = 'virtual:rpgforge-runtime';
  const RESOLVED_ID = '\0' + VIRTUAL_ID;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const entry = path.join(root, 'src/engine/standalone.ts');
  let cached: string | null = null;
  let watched = new Set<string>();

  return {
    name: 'rpgforge-runtime-source',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    watchChange(id) {
      if (watched.has(id)) cached = null;
    },
    async load(id) {
      if (id !== RESOLVED_ID) return null;
      if (cached === null) {
        const result = await build({
          configFile: false,
          root,
          logLevel: 'warn',
          publicDir: false,
          build: {
            write: false,
            emptyOutDir: false,
            minify: true,
            assetsInlineLimit: 100_000_000,
            lib: {
              entry,
              name: 'RPGForgeRuntime',
              formats: ['iife'],
              fileName: () => 'runtime.js',
            },
          },
        });
        const outputs = Array.isArray(result) ? result : [result];
        let code = '';
        const ids = new Set<string>();
        for (const out of outputs) {
          if (!('output' in out)) continue;
          for (const item of out.output) {
            if (item.type === 'chunk') {
              code += item.code;
              for (const m of item.moduleIds) ids.add(m);
            }
          }
        }
        if (!code) throw new Error('Runtime build produced no code');
        cached = code;
        watched = ids;
      }
      for (const file of watched) {
        if (!file.startsWith('\0')) this.addWatchFile(file);
      }
      return `export default ${JSON.stringify(cached)};`;
    },
  };
}
