// Writes THIRD_PARTY_LICENSES.txt for the installers (README §17), from what the build actually
// bundled (build-info/, written by `npm run build:app`), the bundled fonts and FFmpeg.
// Usage: npm run build:app && npm run licences
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FONTS } from '../src/core/text/fonts.ts';
import { thirdPartyLicences } from './lib/licences.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = async (path: string) => JSON.parse(await readFile(join(root, path), 'utf8'));

async function licenceText(dir: string): Promise<string> {
  const file = (await readdir(join(root, dir))).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f));
  return file ? readFile(join(root, dir, file), 'utf8') : '';
}

// The package lists of each build (build-info also holds the guides).
const infos = (
  await readdir(join(root, 'build-info')).catch(() => {
    throw new Error('Run "npm run build:app" first: it records what goes into the app.');
  })
).filter((f) => f.endsWith('.json'));
const names = [
  ...new Set((await Promise.all(infos.map((f) => json(`build-info/${f}`)))).flat() as string[]),
].sort();
const packages = await Promise.all(
  names.map(async (name) => {
    const pkg = await json(`node_modules/${name}/package.json`);
    return {
      name,
      version: pkg.version,
      licence: pkg.license ?? 'see text',
      text: await licenceText(`node_modules/${name}`),
    };
  }),
);

const manifest = await json('scripts/ffmpeg-manifest.json');
const builds = Object.values(manifest.platforms as Record<string, { url: string }[]>)
  .flat()
  .map((a) => a.url);

const text = thirdPartyLicences({
  appVersion: (await json('package.json')).version,
  ffmpeg: {
    version: manifest.version,
    licence: 'The full text of the GNU General Public License v3 is in LICENSE.txt.',
    builds,
  },
  electron: {
    version: (await json('node_modules/electron/package.json')).version,
    licence: await licenceText('node_modules/electron'),
  },
  fonts: await Promise.all(
    FONTS.map(async (f) => ({
      name: f.name,
      licence: await readFile(
        join(root, 'resources/fonts', `OFL-${f.name.replace(/ /g, '')}.txt`),
        'utf8',
      ),
    })),
  ),
  packages,
});
await writeFile(join(root, 'THIRD_PARTY_LICENSES.txt'), text);
console.log(
  `THIRD_PARTY_LICENSES.txt: FFmpeg, Electron, ${FONTS.length} fonts, ${packages.length} packages (${names.join(', ')}).`,
);
