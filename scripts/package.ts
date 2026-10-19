// Builds EasyMedia's installers for this computer (or with --dir an unpacked app), then starts the
// packaged app with EASYMEDIA_SELF_CHECK: its FFmpeg runs and its pages and fonts are there.
// Usage: npm run build:app && npm run licences && npm run package [-- --dir]
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builderArgs, oversized, packagedProgram } from './lib/package.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = process.argv.includes('--dir');
const builder = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);
execFileSync(builder, builderArgs(process.platform, process.arch, { dir }), {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

const report = join(mkdtempSync(join(tmpdir(), 'mve-self-check-')), 'self-check.json');
try {
  execFileSync(join(root, packagedProgram(process.platform, process.arch)), [], {
    env: { ...process.env, EASYMEDIA_SELF_CHECK: report },
    stdio: 'inherit',
    timeout: 120_000,
  });
} finally {
  console.log(readFileSync(report, 'utf8'));
}
console.log('The packaged app checked itself: everything is in place.');

// N6: the installers must not grow past the size students are asked to download.
if (!dir) {
  const release = join(root, 'release');
  const installers = readdirSync(release)
    .filter((f) => /\.(exe|zip|dmg)$/.test(f))
    .map((name) => ({ name, bytes: statSync(join(release, name)).size }));
  for (const f of installers) console.log(`${f.name}: ${Math.round(f.bytes / 1e6)} MB`);
  const tooBig = oversized(installers);
  if (tooBig.length) throw new Error(tooBig.join('\n'));
}
