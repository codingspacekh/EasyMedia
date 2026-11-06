// README §17: THIRD_PARTY_LICENSES — everything shipped in the installers that OneEditor did not
// write, with its licence. Pure: scripts/licences.ts reads the inputs from disk.

export interface LicenceInputs {
  appVersion: string;
  ffmpeg: { version: string; licence: string; builds: readonly string[] };
  electron: { version: string; licence: string };
  fonts: readonly { name: string; licence: string }[];
  packages: readonly { name: string; version: string; licence: string; text: string }[];
}

const RULE = '='.repeat(78);
const section = (title: string, body: string) => `${RULE}\n${title}\n${RULE}\n\n${body.trim()}\n`;

export function thirdPartyLicences(i: LicenceInputs): string {
  for (const f of i.fonts)
    if (!f.licence.trim()) throw new Error(`The font ${f.name} has no licence.`);
  for (const p of i.packages) if (!p.text.trim()) throw new Error(`${p.name} has no licence.`);
  return [
    `OneEditor ${i.appVersion} — third-party components\n\nOneEditor itself is free software under the GNU General Public License v3 (LICENSE.txt). It ships with these components, each under its own licence.\n`,
    section(
      `FFmpeg ${i.ffmpeg.version} (ffmpeg and ffprobe) — GNU General Public License v3`,
      `FFmpeg is used to read, convert and export video and sound. The bundled builds include GPL parts (x264), so they are under the GPL v3.\nSource code: https://ffmpeg.org/download.html (version ${i.ffmpeg.version}).\nThe builds shipped were downloaded from:\n${i.ffmpeg.builds.map((b) => `  ${b}`).join('\n')}\n\n${i.ffmpeg.licence}`,
    ),
    section(
      `Electron ${i.electron.version} — MIT License`,
      `${i.electron.licence}\n\nElectron includes Chromium and other components; their licences are in LICENSES.chromium.html, in the same folder as this file.`,
    ),
    section(
      'Fonts — SIL Open Font License 1.1',
      i.fonts.map((f) => `--- ${f.name} ---\n\n${f.licence.trim()}`).join('\n\n'),
    ),
    section(
      'Packages built into the app',
      i.packages
        .map((p) => `--- ${p.name} ${p.version} (${p.licence}) ---\n\n${p.text.trim()}`)
        .join('\n\n'),
    ),
  ].join('\n');
}

/** The npm packages of a build's module ids (paths under node_modules), sorted. */
export function bundledPackages(moduleIds: readonly string[]): string[] {
  const names = new Set<string>();
  for (const id of moduleIds) {
    const parts = id.split(/[\\/]/);
    const at = parts.lastIndexOf('node_modules');
    if (at < 0 || !parts[at + 1]) continue;
    const first = parts[at + 1]!;
    names.add(first.startsWith('@') ? `${first}/${parts[at + 2]}` : first);
  }
  return [...names].sort();
}

/** The package names in build-info's lists; its other files (updates.json) are not lists. */
export function packageLists(files: readonly unknown[]): string[] {
  const names = files.filter(Array.isArray).flat() as unknown[];
  return [...new Set(names.filter((n): n is string => typeof n === 'string'))].sort();
}

interface PackageJson {
  version: string;
  dependencies?: Record<string, string>;
}

/**
 * M17a: the packages the installers carry in node_modules (not bundled by Vite: electron-updater),
 * with every package they depend on. A dependency is found as Node finds it: in the package's own
 * node_modules first, then in the folders above. `read` gives a folder's package.json, or null.
 */
export function shippedPackages(
  dependencies: Record<string, string>,
  read: (dir: string) => PackageJson | null,
): { name: string; version: string; dir: string }[] {
  const found = new Map<string, { name: string; version: string; dir: string }>();
  const locate = (name: string, from: string): string | null => {
    for (let dir = from; ;) {
      const candidate = dir ? `${dir}/node_modules/${name}` : `node_modules/${name}`;
      if (read(candidate)) return candidate;
      if (!dir) return null;
      const above = dir.lastIndexOf('/node_modules/');
      dir = above < 0 ? '' : dir.slice(0, above);
    }
  };
  const visit = (deps: Record<string, string> | undefined, from: string) => {
    for (const name of Object.keys(deps ?? {})) {
      const dir = locate(name, from);
      if (!dir || found.has(dir)) continue;
      const pkg = read(dir)!;
      found.set(dir, { name, version: pkg.version, dir });
      visit(pkg.dependencies, dir);
    }
  };
  visit(dependencies, '');
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.dir.localeCompare(b.dir),
  );
}

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

/**
 * A package's licence text: its licence file; for an MIT package without one (lazy-val), the
 * standard MIT text with its author, as its package.json declares; otherwise none (refused).
 */
export function licenceTextOf(
  pkg: { license?: string; author?: string | { name?: string } },
  fileText: string,
): string {
  if (fileText.trim()) return fileText;
  if (pkg.license !== 'MIT') return '';
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
  return `MIT License (declared in its package.json; the package has no licence file, so this is the standard MIT text)\n\nCopyright (c) ${author ?? 'its authors'}\n\n${MIT}`;
}
