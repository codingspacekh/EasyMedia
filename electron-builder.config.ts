// M12 installers (electron-builder): Windows x64 installer and portable zip; a macOS DMG for
// Apple-chip Macs and one for Intel Macs. `npm run dist` builds the app, the licences and the
// installers for this computer; FFmpeg comes from `npm run fetch:ffmpeg` (-- --platform
// darwin-arm64 / darwin-x64 for each Mac DMG).
//
// M17a updates: a release build is given the update address (ONEEDITOR_UPDATE_URL), so
// latest.yml / latest-mac.yml are written beside the installers with this version's what's new;
// each Mac build also makes the .zip the updater takes. Macs are signed with the maintainer's own
// certificate (CSC_NAME, as the ZISPP Gradebook's) so they update by themselves; without it, ad hoc.
import { readFileSync } from 'node:fs';
import type { Configuration } from 'electron-builder';

/** FFmpeg for the platform and chip being packaged (`${arch}` is filled in by electron-builder). */
const ffmpeg = (platform: string) => ({
  from: `resources/ffmpeg/${platform}-\${arch}`,
  to: `ffmpeg/${platform}-\${arch}`,
});

/** This version's what's new, as the feed's release notes ("- " points). */
function releaseNotes(version: string): string {
  const all = JSON.parse(
    readFileSync(new URL('./src/main/whats-new.json', import.meta.url), 'utf8'),
  ) as Record<string, string[]>;
  const lines = all[version];
  if (!lines?.length)
    throw new Error(
      `src/main/whats-new.json has nothing for ${version}: write what's new first (it is shown in the app).`,
    );
  return lines.map((line) => `- ${line}`).join('\n');
}

const VERSION = (
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;

export function configFor(
  env: Record<string, string | undefined>,
  version: string = VERSION,
): Configuration {
  const url = env.ONEEDITOR_UPDATE_URL || null;
  return {
    appId: 'io.github.codingspacekh.oneeditor',
    productName: 'OneEditor',
    copyright: 'Copyright © 2026 CodingSpaceKH · GPL-3.0',
    directories: { output: 'release', buildResources: 'build-resources' },
    // The pages, main process and preload are bundled by Vite; the one runtime package,
    // electron-updater (M17a), is added from node_modules by electron-builder.
    files: ['out/**/*', 'dist/**/*', 'package.json'],
    extraResources: [
      { from: 'LICENSE', to: 'LICENSE.txt' },
      { from: 'THIRD_PARTY_LICENSES.txt', to: 'THIRD_PARTY_LICENSES.txt' },
      // Chromium's licences (the Mac build would otherwise leave them out).
      { from: 'node_modules/electron/dist/LICENSES.chromium.html', to: 'LICENSES.chromium.html' },
      // Help ▸ User guide and Teacher notes (made by `npm run guides`).
      { from: 'build-info/guides', to: 'guides' },
      // M17a: the update address (none: updates are off), written by scripts/package.ts.
      { from: 'build-info/updates.json', to: 'updates.json' },
    ],
    win: {
      target: [
        { target: 'nsis', arch: ['x64'] },
        { target: 'zip', arch: ['x64'] },
      ],
      extraResources: [ffmpeg('win32')],
    },
    nsis: {
      // Students install for themselves (no administrator password) and may choose the folder.
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      artifactName: 'OneEditor-Setup-${version}.${ext}',
    },
    mac: {
      // Two downloads about half the size of one universal DMG (which carries both of each). Each
      // Mac builds its own chip's (scripts/package.ts passes --arm64 or --x64): a chip list here
      // would override that and build the other chip's DMG without its FFmpeg. The zip is what
      // the updater downloads (M17a).
      target: ['dmg', 'zip'],
      category: 'public.app-category.education',
      extraResources: [ffmpeg('darwin')],
      extendInfo: {
        NSMicrophoneUsageDescription:
          'OneEditor uses the microphone only when you record a voiceover in Audio mode.',
      },
      // Not notarised (README §15, decision 8). Signed with the maintainer's own certificate when
      // CSC_NAME names it (a Mac then takes updates by itself), else ad hoc, which Apple-chip Macs
      // need to run it at all. The hardened runtime is for notarised apps; it can stop launch.
      identity: env.CSC_NAME || '-',
      hardenedRuntime: false,
      artifactName: 'OneEditor-${version}-mac-${arch}.${ext}',
    },
    dmg: { title: 'OneEditor ${version}' },
    // The build itself uploads nothing (`--publish never`): with an address it only writes the
    // feeds; the release workflow and scripts/release-mac.ts put them in the draft release.
    publish: url ? [{ provider: 'generic', url }] : null,
    ...(url ? { releaseInfo: { releaseNotes: releaseNotes(version) } } : {}),
  };
}

export default configFor(process.env);
