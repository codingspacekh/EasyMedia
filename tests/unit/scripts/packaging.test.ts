// M12: the installers (electron-builder) carry everything the app needs on each platform.
import { describe, expect, it } from 'vitest';
import config, { configFor } from '../../../electron-builder.config.ts';

const resources = (list: unknown) =>
  (list as { from: string; to: string }[]).map((r) => `${r.from} → ${r.to}`);

describe('installers', () => {
  it('are called OneEditor and hold only the built app (no node_modules)', () => {
    expect(config.productName).toBe('OneEditor');
    expect(config.appId).toBe('io.github.codingspacekh.oneeditor');
    expect(config.files).toEqual(['out/**/*', 'dist/**/*', 'package.json']);
  });

  it('every installer carries the licences and the guides', () => {
    expect(resources(config.extraResources)).toEqual([
      'LICENSE → LICENSE.txt',
      'THIRD_PARTY_LICENSES.txt → THIRD_PARTY_LICENSES.txt',
      // Chromium's licences (the Mac build would otherwise leave them out).
      'node_modules/electron/dist/LICENSES.chromium.html → LICENSES.chromium.html',
      'build-info/guides → guides',
      // M17a: the update address (none: updates are off), written by scripts/package.ts.
      'build-info/updates.json → updates.json',
    ]);
  });

  it('Windows: an installer and a portable zip, 64-bit, with the Windows FFmpeg', () => {
    expect(config.win!.target).toEqual([
      { target: 'nsis', arch: ['x64'] },
      { target: 'zip', arch: ['x64'] },
    ]);
    expect(resources(config.win!.extraResources)).toEqual([
      'resources/ffmpeg/win32-${arch} → ffmpeg/win32-${arch}',
    ]);
    // Students install for themselves, without an administrator password.
    expect(config.nsis).toMatchObject({ oneClick: false, perMachine: false });
  });

  it('macOS: a DMG for Apple-chip Macs and one for Intel Macs, each with its own FFmpeg', () => {
    // Two downloads of about half the size of one universal DMG (which carries both of each).
    // No chip list here: it would override `--arm64` / `--x64`, so each Mac runner would also
    // build the other chip's DMG without its FFmpeg (and upload it over the good one).
    // M17a: and the zip the updater takes a new version from.
    expect(config.mac!.target).toEqual(['dmg', 'zip']);
    expect(resources(config.mac!.extraResources)).toEqual([
      'resources/ffmpeg/darwin-${arch} → ffmpeg/darwin-${arch}',
    ]);
    expect(config.mac!.artifactName).toBe('OneEditor-${version}-mac-${arch}.${ext}');
    expect(config.mac!.extendInfo).toMatchObject({
      NSMicrophoneUsageDescription: expect.stringMatching(/record.*voiceover/i),
    });
    // Not notarised (README §16, decision 8): signed ad hoc, so Apple Silicon Macs run it; the
    // hardened runtime is only for notarised apps (with an ad-hoc signature it can stop launch).
    expect(config.mac!.identity).toBe('-');
    expect(config.mac!.hardenedRuntime).toBe(false);
  });

  it('nothing is published by the build itself (the release workflow uploads a draft)', () => {
    expect(config.publish).toBeNull();
  });

  const url = 'https://github.com/codingspacekh/OneEditor/releases/latest/download';
  it('M17a a release build has the update address, so latest.yml and latest-mac.yml are made', () => {
    const release = configFor({ ONEEDITOR_UPDATE_URL: url }, '1.5.0');
    expect(release.publish).toEqual([{ provider: 'generic', url }]);
    // What's new (src/main/whats-new.json) goes into the feed, for the app to show.
    expect(release.releaseInfo!.releaseNotes).toMatch(/^- The app is now called OneEditor/);
    expect(() => configFor({ ONEEDITOR_UPDATE_URL: url }, '9.9.9')).toThrow(/what's new/i);
  });

  it("M17a a Mac release is signed with the maintainer's certificate (CSC_NAME), else ad hoc", () => {
    expect(configFor({ CSC_NAME: 'ZISPP Gradebook' }, '1.5.0').mac!.identity).toBe(
      'ZISPP Gradebook',
    );
    expect(configFor({}, '1.5.0').mac!.identity).toBe('-');
  });
});

describe('packaging this computer’s build (scripts/package.ts)', () => {
  it('builds for this platform and chip only, and knows where the app lands', async () => {
    const { builderArgs, packagedProgram } = await import('../../../scripts/lib/package.ts');
    expect(builderArgs('darwin', 'arm64', { dir: true })).toEqual([
      '--config',
      'electron-builder.config.ts',
      '--publish',
      'never',
      '--mac',
      '--arm64',
      '--dir',
    ]);
    expect(builderArgs('win32', 'x64', { dir: false }).slice(-2)).toEqual(['--win', '--x64']);
    expect(packagedProgram('darwin', 'arm64')).toBe(
      'release/mac-arm64/OneEditor.app/Contents/MacOS/OneEditor',
    );
    expect(packagedProgram('darwin', 'x64')).toBe(
      'release/mac/OneEditor.app/Contents/MacOS/OneEditor',
    );
    expect(packagedProgram('win32', 'x64')).toBe('release/win-unpacked/OneEditor.exe');
  });
});

describe('M17a the update address in the installed app (scripts/package.ts)', () => {
  it('updates.json: the address, and whether a Mac build is signed with the certificate', async () => {
    const { updateConfig, macFeedName } = await import('../../../scripts/lib/package.ts');
    const url = 'https://github.com/codingspacekh/OneEditor/releases/latest/download';
    expect(
      updateConfig({ ONEEDITOR_UPDATE_URL: url, CSC_NAME: 'ZISPP Gradebook' }, 'darwin'),
    ).toEqual({ url, macSigned: true });
    expect(updateConfig({ ONEEDITOR_UPDATE_URL: url }, 'darwin')).toEqual({
      url,
      macSigned: false,
    });
    expect(updateConfig({ ONEEDITOR_UPDATE_URL: url, CSC_NAME: 'x' }, 'win32')).toEqual({
      url,
      macSigned: false,
    });
    expect(updateConfig({}, 'win32')).toEqual({ url: null, macSigned: false });
    // Each Mac build's own feed, kept apart until both are merged into latest-mac.yml.
    expect(macFeedName('arm64')).toBe('latest-mac-arm64.yml');
  });
});

describe('N6 installer size', () => {
  it('each installer is at most 220 MB; a bigger one stops the release', async () => {
    const { MAX_INSTALLER_MB, oversized } = await import('../../../scripts/lib/package.ts');
    expect(MAX_INSTALLER_MB).toBe(220);
    expect(
      oversized([
        { name: 'OneEditor-1.0.0-mac-x64.dmg', bytes: 207_000_000 },
        { name: 'OneEditor-Setup-1.0.0.exe', bytes: 221_000_001 },
        // The portable zip (for a USB stick) is not an installer: zip packs less tightly.
        { name: 'OneEditor-1.0.0-win.zip', bytes: 235_000_000 },
      ]),
    ).toEqual(['OneEditor-Setup-1.0.0.exe is 221 MB (at most 220 MB, README N6)']);
  });
});
