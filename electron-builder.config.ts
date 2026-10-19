// M12 installers (electron-builder): Windows x64 installer and portable zip; a macOS DMG for
// Apple-chip Macs and one for Intel Macs. `npm run dist` builds the app, the licences and the
// installers for this computer; FFmpeg comes from `npm run fetch:ffmpeg` (-- --platform
// darwin-arm64 / darwin-x64 for each Mac DMG).
import type { Configuration } from 'electron-builder';

/** FFmpeg for the platform and chip being packaged (`${arch}` is filled in by electron-builder). */
const ffmpeg = (platform: string) => ({
  from: `resources/ffmpeg/${platform}-\${arch}`,
  to: `ffmpeg/${platform}-\${arch}`,
});

const config: Configuration = {
  appId: 'io.github.codingspacekh.easymedia',
  productName: 'EasyMedia',
  copyright: 'EasyMedia contributors · GPL-3.0',
  directories: { output: 'release', buildResources: 'build-resources' },
  // The pages, main process and preload are bundled by Vite; the app has no runtime packages.
  files: ['out/**/*', 'dist/**/*', 'package.json'],
  extraResources: [
    { from: 'LICENSE', to: 'LICENSE.txt' },
    { from: 'THIRD_PARTY_LICENSES.txt', to: 'THIRD_PARTY_LICENSES.txt' },
    // Chromium's licences (the Mac build would otherwise leave them out).
    { from: 'node_modules/electron/dist/LICENSES.chromium.html', to: 'LICENSES.chromium.html' },
    // Help ▸ User guide and Teacher notes (made by `npm run guides`).
    { from: 'build-info/guides', to: 'guides' },
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
    artifactName: 'EasyMedia-Setup-${version}.${ext}',
  },
  mac: {
    // Two downloads about half the size of one universal DMG (which carries both of each).
    target: [{ target: 'dmg', arch: ['arm64', 'x64'] }],
    category: 'public.app-category.education',
    extraResources: [ffmpeg('darwin')],
    extendInfo: {
      NSMicrophoneUsageDescription:
        'EasyMedia uses the microphone only when you record a voiceover in Audio mode.',
    },
    // Not notarised (README §15, decision 8): an ad-hoc signature, so Apple Silicon Macs run it.
    // The hardened runtime is for notarised apps; with an ad-hoc signature it can stop launch.
    identity: '-',
    hardenedRuntime: false,
    artifactName: 'EasyMedia-${version}-mac-${arch}.${ext}',
  },
  dmg: { title: 'EasyMedia ${version}' },
  publish: null,
};

export default config;
