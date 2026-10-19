// Builds the Electron main process and preload script into out/ (CommonJS for Electron).
// Two separate builds: a sandboxed preload must be ONE self-contained file (it can require only
// 'electron'), so it must never share a chunk with the main process.
//   vite build -c vite.electron.config.ts --mode main
//   vite build -c vite.electron.config.ts --mode preload
import { builtinModules } from 'node:module';
import { defineConfig } from 'vite';
import { recordPackages } from './scripts/lib/record-packages.ts';

export default defineConfig(({ mode }) => {
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
        external: ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)],
      },
    },
  };
});
