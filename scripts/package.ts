// Builds OneEditor's installers for this computer (or with --dir an unpacked app), then starts the
// packaged app with ONEEDITOR_SELF_CHECK: its FFmpeg runs and its pages and fonts are there.
// Usage: npm run build:app && npm run licences && npm run package [-- --dir] [-- --arch arm64]
// (--arch: another chip of this platform, M17a: an Intel Mac builds the Apple-chip installer too;
// a build for another chip cannot be started here, so it is not checked here.)
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  builderArgs,
  macFeedName,
  oversized,
  packagedProgram,
  updateConfig,
} from './lib/package.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = process.argv.includes('--dir');
const at = process.argv.indexOf('--arch');
const arch = at > 0 && process.argv[at + 1] ? process.argv[at + 1]! : process.arch;
const builder = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder',
);
// M17a: the update address the installed app looks at (none: updates are off).
const updates = updateConfig(process.env, process.platform);
mkdirSync(join(root, 'build-info'), { recursive: true });
writeFileSync(join(root, 'build-info', 'updates.json'), `${JSON.stringify(updates, null, 2)}\n`);
console.log(
  updates.url
    ? `Updates from ${updates.url}${process.platform === 'darwin' ? (updates.macSigned ? `, signed as ${process.env.CSC_NAME}` : ', NOT signed with the certificate: a Mac will be offered the .dmg instead') : ''}.`
    : 'No ONEEDITOR_UPDATE_URL: this build will not look for updates.',
);

execFileSync(builder, builderArgs(process.platform, arch, { dir }), {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

// M17a: each Mac build writes latest-mac.yml for its own chip: kept apart, then merged
// (scripts/release-mac.ts) into one feed for both.
const feed = join(root, 'release', 'latest-mac.yml');
if (process.platform === 'darwin' && !dir && existsSync(feed))
  renameSync(feed, join(root, 'release', macFeedName(arch)));

if (arch === process.arch) {
  const report = join(mkdtempSync(join(tmpdir(), 'mve-self-check-')), 'self-check.json');
  try {
    execFileSync(join(root, packagedProgram(process.platform, arch)), [], {
      env: { ...process.env, ONEEDITOR_SELF_CHECK: report },
      stdio: 'inherit',
      timeout: 120_000,
    });
  } finally {
    console.log(readFileSync(report, 'utf8'));
  }
  console.log('The packaged app checked itself: everything is in place.');
} else {
  console.log(`Built for ${arch}: this ${process.arch} computer cannot start it to check it.`);
}

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
