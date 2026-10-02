import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { runtimeSource } from './vite-plugins/runtime-source';

// `vite build --mode single` produces one self-contained HTML file
// (dist-single/index.html) with every script and stylesheet inlined.
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: [react(), runtimeSource(), ...(single ? [viteSingleFile()] : [])],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      chunkSizeWarningLimit: 4000,
      ...(single ? { assetsInlineLimit: 100_000_000 } : {}),
    },
    test: {
      include: ['src/**/*.test.ts'],
      environment: 'node',
    },
  };
});
