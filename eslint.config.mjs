// @ts-check
import { includeIgnoreFile } from '@eslint/compat';
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import path from 'path';
import tseslint from 'typescript-eslint';
import { boundariesPlugin } from './libs/eslint-rules/boundaries.mjs';

const gitignorePath = path.resolve('.gitignore');

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  {
    ignores: ['**/dist/*', '**/node_modules', 'eslint.config.*', 'src/db/migrations/*'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.controller.ts'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'error',
    },
  },
  {
    files: ['{apps,libs}/**/*.ts'],
    plugins: { boundaries: boundariesPlugin },
    rules: {
      'boundaries/no-cross-layer-import': 'error',
    },
  },
  {
    // Flat-config / custom-rule files are plain ESM tooling, not part of any TS
    // project. Lint them without the type-checked project service so the typed
    // parser doesn't error with "not found by the project service".
    files: ['**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      sourceType: 'module',
      parserOptions: { projectService: false, project: false },
    },
  },
);
