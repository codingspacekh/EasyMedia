import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { binaryPaths, platformKey } from '../../../../src/main/ffmpeg/paths.ts';

describe('X5 bundled FFmpeg per platform', () => {
  describe('platformKey', () => {
    it.each([
      ['win32', 'x64', 'win32-x64'],
      ['darwin', 'arm64', 'darwin-arm64'],
      ['darwin', 'x64', 'darwin-x64'],
    ] as const)('%s + %s → %s', (platform, arch, expected) => {
      expect(platformKey(platform, arch)).toBe(expected);
    });

    it.each([
      ['linux', 'x64'],
      ['win32', 'ia32'],
      ['win32', 'arm64'],
    ] as const)('rejects unsupported %s + %s', (platform, arch) => {
      expect(() => platformKey(platform, arch)).toThrow(/not supported/i);
    });
  });

  describe('binaryPaths', () => {
    it('uses .exe on Windows', () => {
      expect(binaryPaths('/app/resources', 'win32-x64')).toEqual({
        ffmpeg: join('/app/resources', 'ffmpeg', 'win32-x64', 'ffmpeg.exe'),
        ffprobe: join('/app/resources', 'ffmpeg', 'win32-x64', 'ffprobe.exe'),
      });
    });

    it('has no extension on macOS', () => {
      expect(binaryPaths('/app/resources', 'darwin-arm64')).toEqual({
        ffmpeg: join('/app/resources', 'ffmpeg', 'darwin-arm64', 'ffmpeg'),
        ffprobe: join('/app/resources', 'ffmpeg', 'darwin-arm64', 'ffprobe'),
      });
    });
  });
});
