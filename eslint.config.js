import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'out/',
      'coverage/',
      'resources/',
      'design/',
      'spikes/',
      'test-results/',
      'playwright-report/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.svelte'] },
    },
  },
  {
    // ARCHITECTURE §1: core/ is plain TypeScript and imports nothing outside core/.
    files: ['src/core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(electron|svelte)(/|$)',
              message: 'core/ must not depend on Electron or Svelte (docs/ARCHITECTURE.md §1).',
            },
            {
              regex: '^(node:|(fs|path|os|child_process|url|worker_threads)$)',
              message:
                'core/ must not use Node.js APIs; go through a port (docs/ARCHITECTURE.md §8).',
            },
            {
              regex: '^(\\.\\./)+(app|ui|adapters|main|preload|workers)(/|$)',
              message: 'core/ must not import from outer layers (docs/ARCHITECTURE.md §1).',
            },
          ],
        },
      ],
    },
  },
);
