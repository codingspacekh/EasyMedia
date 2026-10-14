// Downloads the pinned FFmpeg/ffprobe build for one platform into resources/ffmpeg/<platform>/.
// Usage: npm run fetch:ffmpeg [-- --platform darwin-arm64] [-- --force]
import { execFileSync } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformKey } from '../src/main/ffmpeg/paths.ts';
import { isUpToDate, parseManifest, verifySha256 } from './lib/ffmpeg-fetch.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const force = args.includes('--force');
const platformArg = args[args.indexOf('--platform') + 1];
const key =
  args.includes('--platform') && platformArg
    ? platformKey(platformArg.split('-')[0] ?? '', platformArg.split('-')[1] ?? '')
    : platformKey(process.platform, process.arch);

const manifest = parseManifest(
  JSON.parse(await readFile(join(root, 'scripts', 'ffmpeg-manifest.json'), 'utf8')),
);
const dest = join(root, 'resources', 'ffmpeg', key);
const stampFile = join(dest, 'VERSION');
const stamp = await readFile(stampFile, 'utf8').catch(() => undefined);

if (!force && isUpToDate(stamp, manifest.version)) {
  console.log(`FFmpeg ${manifest.version} for ${key} is already installed in ${dest}`);
  process.exit(0);
}

// bsdtar extracts zip files on both macOS and Windows 10+.
const tar =
  process.platform === 'win32'
    ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe')
    : '/usr/bin/tar';
const work = await mkdtemp(join(tmpdir(), 'mve-ffmpeg-'));
try {
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  for (const archive of manifest.platforms[key]) {
    const name = basename(new URL(archive.url).pathname);
    console.log(`Downloading ${archive.url}`);
    const res = await fetch(archive.url);
    if (!res.ok) throw new Error(`Download failed (${res.status}) for ${archive.url}`);
    const data = new Uint8Array(await res.arrayBuffer());
    verifySha256(data, archive.sha256, name);

    const zip = join(work, name);
    const out = join(work, `${name}.d`);
    await writeFile(zip, data);
    await mkdir(out);
    execFileSync(tar, ['-xf', zip, '-C', out]);
    for (const [target, inside] of Object.entries(archive.files)) {
      await copyFile(join(out, inside), join(dest, target));
      await chmod(join(dest, target), 0o755);
    }
  }
  await writeFile(stampFile, `${manifest.version}\n`);
  console.log(`Installed FFmpeg ${manifest.version} for ${key} in ${dest}`);
} finally {
  await rm(work, { recursive: true, force: true });
}
