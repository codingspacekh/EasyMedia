// README §16: THIRD_PARTY_LICENSES — everything shipped in the installers that EasyMedia did not
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
    `EasyMedia ${i.appVersion} — third-party components\n\nEasyMedia itself is free software under the GNU General Public License v3 (LICENSE.txt). It ships with these components, each under its own licence.\n`,
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
