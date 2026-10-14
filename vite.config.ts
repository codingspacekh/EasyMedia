import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// base './' so the built page also works when Electron loads it from a file.
export default defineConfig({
  base: './',
  plugins: [svelte()],
});
