import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          exclude: ['tests/unit/ui/**'],
          environment: 'node',
        },
      },
      {
        plugins: [svelte(), svelteTesting()],
        test: {
          name: 'ui',
          include: ['tests/unit/ui/**/*.test.ts'],
          environment: 'jsdom',
        },
      },
      {
        test: {
          name: 'acceptance',
          include: ['tests/acceptance/**/*.test.ts'],
          environment: 'node',
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
      {
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          testTimeout: 180_000,
          hookTimeout: 180_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,svelte}', 'scripts/lib/**/*.ts'],
      exclude: ['src/ui/main.ts'],
      thresholds: {
        lines: 85,
        branches: 85,
        functions: 85,
        statements: 85,
        'src/core/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'src/app/**': { lines: 85, branches: 85, functions: 85, statements: 85 },
      },
    },
  },
});
