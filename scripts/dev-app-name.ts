// Names the development copy of Electron EasyMedia, so `npm run app` shows EasyMedia in the macOS
// menu bar. Only on macOS; it re-signs the bundle (ad hoc) because Info.plist is part of the
// signature. Run again after `npm install` replaces Electron (npm run app does it every time).
// Usage: node scripts/dev-app-name.ts
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renameBundle } from './lib/dev-app-name.ts';

if (process.platform === 'darwin') {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const bundle = join(root, 'node_modules/electron/dist/Electron.app');
  const file = join(bundle, 'Contents/Info.plist');
  const plist = await readFile(file, 'utf8');
  const renamed = renameBundle(plist, 'EasyMedia');
  if (renamed !== plist) {
    await writeFile(file, renamed);
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', bundle], { stdio: 'ignore' });
  }
}
