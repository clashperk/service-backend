import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const lib = (path: string) => resolve(import.meta.dirname, 'libs', path);

const alias = [
  { find: /^@app\/auth/, replacement: lib('auth') },
  { find: /^@app\/clash-client/, replacement: lib('clash-client/src') },
  { find: /^@app\/collections/, replacement: lib('collections') },
  { find: /^@app\/constants/, replacement: lib('constants') },
  { find: /^@app\/decorators/, replacement: lib('decorators') },
  { find: /^@app\/discord-rest/, replacement: lib('discord-rest/src') },
  { find: /^@app\/dto/, replacement: lib('dto') },
  { find: /^@app\/google-sheet/, replacement: lib('google-sheet/src') },
  { find: /^@app\/helpers/, replacement: lib('helpers') },
  { find: /^@app\/interceptors/, replacement: lib('interceptors') },
];

export default defineConfig({
  test: {
    globals: true,
    root: './',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['apps/**/*.spec.ts', 'libs/**/*.spec.ts'] },
      },
      { extends: true, test: { name: 'e2e', include: ['apps/**/*.e2e-spec.ts'] } },
    ],
  },
  // SWC emits the decorator metadata Nest's dependency injection reads.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { alias },
});
