import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { recordPackages } from './scripts/lib/record-packages.ts';

// base './' so the built page also works when Electron loads it from a file.
export default defineConfig({
  base: './',
  plugins: [svelte(), recordPackages('pages')],
});
