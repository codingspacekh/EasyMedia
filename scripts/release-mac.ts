// M17a: the two Mac installers of a release, built on the maintainer's Mac and signed with their
// own certificate (CSC_NAME, the one the ZISPP Gradebook uses), so every installed OneEditor on a
// Mac can take the next version by itself. Windows is built by the Release workflow.
//
//   npm run release:mac            build both Macs here and add them to the draft release
//   npm run release:mac -- --dry   build only, and list what would be added
//
// First push the tag (vX.Y.Z on the merge into main): the Release workflow makes the draft and
// adds Windows. This adds the Mac installers, their zips (what the updater downloads) and one
// latest-mac.yml for both chips. Nothing reaches a laptop until the draft is published on GitHub.
// Settings are read from ~/.oneeditor/release.env when it is there (CSC_NAME=…; kept on this Mac,
// never in the project); anything already set wins.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { mergeMacFeeds, type Feed } from '../src/core/updates.ts';
import { macFeedName } from './lib/package.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const dry = process.argv.includes('--dry');
const stop = (message: string): never => {
  console.error(`\n${message}`);
  process.exit(1);
};
const run = (file: string, args: string[], env: NodeJS.ProcessEnv = process.env) =>
  execFileSync(file, args, { cwd: root, stdio: 'inherit', env });
const read = (file: string, args: string[]) =>
  execFileSync(file, args, { cwd: root, encoding: 'utf8' }).trim();

if (process.platform !== 'darwin') stop('Run this on the Mac that has the certificate.');

const settings = join(homedir(), '.oneeditor', 'release.env');
if (existsSync(settings))
  for (const line of readFileSync(settings, 'utf8').split('\n')) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!;
  }
if (!process.env.CSC_NAME)
  stop(`CSC_NAME is not set: name the certificate (e.g. CSC_NAME=ZISPP Gradebook in ${settings}).`);

const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string;
};
const tag = `v${version}`;
const repo = read('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
process.env.ONEEDITOR_UPDATE_URL ||= `https://github.com/${repo}/releases/latest/download`;

if (read('git', ['status', '--porcelain']))
  stop('There are changes not committed: commit them first.');
if (!read('git', ['tag', '--points-at', 'HEAD']).split('\n').includes(tag))
  stop(`HEAD is not ${tag}: check out the release's tag first.`);
if (!dry) {
  const draft = read('gh', ['release', 'view', tag, '--json', 'isDraft', '--jq', '.isDraft']);
  if (draft !== 'true')
    stop(`${tag} is not a draft release (push the tag first; never add to a published one).`);
}

console.log(
  `OneEditor ${version}: both Macs, signed as "${process.env.CSC_NAME}", updates from ${process.env.ONEEDITOR_UPDATE_URL}`,
);
run('npm', ['run', 'build:app']);
run('npm', ['run', 'licences']);
run('npm', ['run', 'guides']);
for (const arch of ['arm64', 'x64']) {
  run('npm', ['run', 'fetch:ffmpeg', '--', '--platform', `darwin-${arch}`]);
  run('node', ['scripts/package.ts', '--arch', arch]);
}

const release = join(root, 'release');
const feeds = ['arm64', 'x64'].map(
  (arch) => yaml.load(readFileSync(join(release, macFeedName(arch)), 'utf8')) as Feed,
);
if (feeds.some((f) => f.version !== version)) stop('A Mac feed is not for this version.');
writeFileSync(join(release, 'latest-mac.yml'), yaml.dump(mergeMacFeeds(feeds), { lineWidth: -1 }));

const files = [
  ...['arm64', 'x64'].flatMap((arch) =>
    ['dmg', 'zip', 'dmg.blockmap', 'zip.blockmap'].map(
      (ext) => `OneEditor-${version}-mac-${arch}.${ext}`,
    ),
  ),
  'latest-mac.yml',
].filter((f) => existsSync(join(release, f)));
console.log(`\n${dry ? 'Would add' : 'Adding'} to the draft ${tag}:\n  ${files.join('\n  ')}`);
if (dry) process.exit(0);
run('gh', ['release', 'upload', tag, '--clobber', ...files.map((f) => join(release, f))]);
console.log(
  `\nDone. Check the draft ${tag} on GitHub (Windows comes from the Release workflow), then publish it:` +
    ' every installed OneEditor sees it within 6 hours, or at its next start.',
);
