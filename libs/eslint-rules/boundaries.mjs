// @ts-check
import path from 'path';

/**
 * Module-boundary enforcement.
 *
 * Three layers — apps/api, apps/worker, libs — with directed rules:
 *   - apps/api    ⇏ apps/worker   (independent services)
 *   - apps/worker ⇏ apps/api      (independent services)
 *   - libs        ⇏ apps/*        (libraries are lower-level shared code)
 *
 * Only relative imports can cross these boundaries (apps have no `@app/*` alias;
 * `@app/*` always resolves into libs, which every layer may import). So we resolve
 * each relative import to an absolute path and classify both ends — depth-proof,
 * unlike string-glob matching on `../../..` prefixes.
 */
const layerOf = (/** @type {string} */ absPath) => {
  const p = absPath.replace(/\\/g, '/');
  if (p.includes('/apps/api/')) return 'api';
  if (p.includes('/apps/worker/')) return 'worker';
  if (p.includes('/libs/')) return 'libs';
  return null;
};

const LAYER_LABEL = { api: 'apps/api', worker: 'apps/worker', libs: 'libs' };

// from-layer -> target layers it must not import from
const FORBIDDEN = {
  api: new Set(['worker']),
  worker: new Set(['api']),
  libs: new Set(['api', 'worker']),
};

/** ESLint plugin exposing the `boundaries/no-cross-layer-import` rule. */
export const boundariesPlugin = {
  rules: {
    'no-cross-layer-import': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow imports across the apps/api, apps/worker, and libs boundaries.',
        },
        schema: [],
        messages: {
          crossApp:
            "'{{from}}' must not import from '{{to}}'. apps/api and apps/worker are independent services — share code through a lib (@app/*), never by importing across apps.",
          libToApp:
            "'{{from}}' (a library) must not import from '{{to}}'. Libraries are lower-level shared code and must not depend on an application; move the shared code into a lib instead.",
        },
      },
      create(/** @type {any} */ context) {
        const fromAbs = context.physicalFilename || context.filename;
        const fromLayer = layerOf(fromAbs);
        if (!fromLayer || !FORBIDDEN[fromLayer]) return {};

        const check = (/** @type {any} */ source) => {
          const src = source && source.value;
          if (typeof src !== 'string' || !src.startsWith('.')) return; // only relative imports cross boundaries
          const toLayer = layerOf(path.resolve(path.dirname(fromAbs), src));
          if (!toLayer || toLayer === fromLayer || !FORBIDDEN[fromLayer].has(toLayer)) return;
          context.report({
            node: source,
            messageId: fromLayer === 'libs' ? 'libToApp' : 'crossApp',
            data: { from: LAYER_LABEL[fromLayer], to: LAYER_LABEL[toLayer] },
          });
        };

        return {
          ImportDeclaration: (/** @type {any} */ node) => check(node.source),
          ExportNamedDeclaration: (/** @type {any} */ node) => check(node.source), // export { x } from '...'
          ExportAllDeclaration: (/** @type {any} */ node) => check(node.source), // export * from '...'
          ImportExpression: (/** @type {any} */ node) => check(node.source), // dynamic import('...')
        };
      },
    },
  },
};
