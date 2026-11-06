// Builds the Electron main process and preload script into out/ (CommonJS for Electron), and the
// HTML web animation's player (AN15). Separate builds: a sandboxed preload must be ONE
// self-contained file (it can require only 'electron'), so it must never share a chunk with the
// main process; the player is one script put inside every exported .html page.
//   vite build -c vite.electron.config.ts --mode main
//   vite build -c vite.electron.config.ts --mode preload
//   vite build -c vite.electron.config.ts --mode player
import { builtinModules } from 'node:module';
import { defineConfig, type UserConfig } from 'vite';
import { recordPackages } from './scripts/lib/record-packages.ts';

/** AN15: the player, for browsers: one script with no imports, run as the page loads. */
export const playerBuild: UserConfig = {
  plugins: [recordPackages('player')],
  build: {
    outDir: 'out',
    emptyOutDir: false,
    target: 'es2020',
    minify: true,
    sourcemap: false,
    lib: {
      entry: 'src/player/main.ts',
      formats: ['iife'],
      name: 'OneEditorPlayer',
      fileName: () => 'player.js',
    },
  },
};

export default defineConfig(({ mode }) => {
  if (mode === 'player') return playerBuild;
  const entry = mode === 'preload' ? 'src/preload/index.ts' : 'src/main/index.ts';
  const name = mode === 'preload' ? 'preload' : 'main';
  return {
    plugins: [recordPackages(name)],
    build: {
      outDir: 'out',
      emptyOutDir: mode !== 'preload',
      target: 'node24',
      minify: false,
      sourcemap: true,
      lib: { entry, formats: ['cjs'], fileName: () => `${name}.cjs` },
      rollupOptions: {
        // electron-updater (M17a U1) is a runtime package of the installed app, loaded only when
        // updates are on, so it is left out of the bundle.
        external: [
          'electron',
          'electron-updater',
          ...builtinModules,
          ...builtinModules.map((m) => `node:${m}`),
        ],
      },
    },
  };
});
