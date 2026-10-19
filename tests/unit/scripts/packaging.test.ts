// M12: the installers (electron-builder) carry everything the app needs on each platform.
import { describe, expect, it } from 'vitest';
import config from '../../../electron-builder.config.ts';

const resources = (list: unknown) =>
  (list as { from: string; to: string }[]).map((r) => `${r.from} → ${r.to}`);

describe('installers', () => {
  it('are called EasyMedia and hold only the built app (no node_modules)', () => {
    expect(config.productName).toBe('EasyMedia');
    expect(config.appId).toBe('io.github.codingspacekh.easymedia');
    expect(config.files).toEqual(['out/**/*', 'dist/**/*', 'package.json']);
  });

  it('every installer carries the licences', () => {
    expect(resources(config.extraResources)).toEqual([
      'LICENSE → LICENSE.txt',
      'THIRD_PARTY_LICENSES.txt → THIRD_PARTY_LICENSES.txt',
      // Chromium's licences (the Mac build would otherwise leave them out).
      'node_modules/electron/dist/LICENSES.chromium.html → LICENSES.chromium.html',
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
    expect(config.mac!.target).toEqual([{ target: 'dmg', arch: ['arm64', 'x64'] }]);
    expect(resources(config.mac!.extraResources)).toEqual([
      'resources/ffmpeg/darwin-${arch} → ffmpeg/darwin-${arch}',
    ]);
    expect(config.mac!.artifactName).toBe('EasyMedia-${version}-mac-${arch}.${ext}');
    expect(config.mac!.extendInfo).toMatchObject({
      NSMicrophoneUsageDescription: expect.stringMatching(/record.*voiceover/i),
    });
    // Not notarised (README §15, decision 8): signed ad hoc, so Apple Silicon Macs run it; the
    // hardened runtime is only for notarised apps (with an ad-hoc signature it can stop launch).
    expect(config.mac!.identity).toBe('-');
    expect(config.mac!.hardenedRuntime).toBe(false);
  });

  it('nothing is published by the build itself (the release workflow uploads a draft)', () => {
    expect(config.publish).toBeNull();
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
      'release/mac-arm64/EasyMedia.app/Contents/MacOS/EasyMedia',
    );
    expect(packagedProgram('darwin', 'x64')).toBe(
      'release/mac/EasyMedia.app/Contents/MacOS/EasyMedia',
    );
    expect(packagedProgram('win32', 'x64')).toBe('release/win-unpacked/EasyMedia.exe');
  });
});
