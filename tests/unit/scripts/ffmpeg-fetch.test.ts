import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isUpToDate, parseManifest, verifySha256 } from '../../../scripts/lib/ffmpeg-fetch.ts';

const realManifest = JSON.parse(
  readFileSync(new URL('../../../scripts/ffmpeg-manifest.json', import.meta.url), 'utf8'),
);
const HASH = 'a'.repeat(64);

function manifestWith(overrides: Record<string, unknown>) {
  const archive = (files: Record<string, string>) => ({
    url: 'https://x.test/a.zip',
    sha256: HASH,
    files,
  });
  return {
    version: '9.0.2',
    platforms: {
      'win32-x64': [archive({ 'ffmpeg.exe': 'bin/ffmpeg.exe', 'ffprobe.exe': 'bin/ffprobe.exe' })],
      'darwin-arm64': [archive({ ffmpeg: 'ffmpeg' }), archive({ ffprobe: 'ffprobe' })],
      'darwin-x64': [archive({ ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' })],
      ...overrides,
    },
  };
}

describe('X5 FFmpeg download manifest', () => {
  it('the committed manifest is valid', () => {
    const manifest = parseManifest(realManifest);
    expect(manifest.version).toMatch(/^\d+\.\d+/);
    expect(Object.keys(manifest.platforms).sort()).toEqual([
      'darwin-arm64',
      'darwin-x64',
      'win32-x64',
    ]);
  });

  it('accepts a well-formed manifest', () => {
    expect(() => parseManifest(manifestWith({}))).not.toThrow();
  });

  it('rejects a missing platform', () => {
    const m = manifestWith({});
    delete (m.platforms as Record<string, unknown>)['darwin-x64'];
    expect(() => parseManifest(m)).toThrow(/darwin-x64/);
  });

  it('rejects a checksum that is not 64 hex characters', () => {
    const bad = manifestWith({
      'darwin-x64': [
        {
          url: 'https://x.test/a.zip',
          sha256: 'abc',
          files: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
        },
      ],
    });
    expect(() => parseManifest(bad)).toThrow(/sha256/i);
  });

  it('rejects plain http downloads', () => {
    const bad = manifestWith({
      'darwin-x64': [
        {
          url: 'http://x.test/a.zip',
          sha256: HASH,
          files: { ffmpeg: 'ffmpeg', ffprobe: 'ffprobe' },
        },
      ],
    });
    expect(() => parseManifest(bad)).toThrow(/https/i);
  });

  it('rejects a platform that does not provide both ffmpeg and ffprobe', () => {
    const bad = manifestWith({
      'win32-x64': [
        { url: 'https://x.test/a.zip', sha256: HASH, files: { 'ffmpeg.exe': 'bin/ffmpeg.exe' } },
      ],
    });
    expect(() => parseManifest(bad)).toThrow(/ffprobe\.exe/);
  });
});

describe('verifySha256', () => {
  const data = new TextEncoder().encode('hello');
  const good = createHash('sha256').update(data).digest('hex');

  it('passes when the checksum matches (any letter case)', () => {
    expect(() => verifySha256(data, good.toUpperCase(), 'hello.zip')).not.toThrow();
  });

  it('fails with the file name when the checksum differs', () => {
    expect(() => verifySha256(data, HASH, 'hello.zip')).toThrow(/checksum mismatch.*hello\.zip/i);
  });
});

describe('isUpToDate', () => {
  it('is true when the installed version stamp matches', () => {
    expect(isUpToDate('9.0.2\n', '9.0.2')).toBe(true);
  });
  it('is false when nothing is installed or the version differs', () => {
    expect(isUpToDate(undefined, '9.0.2')).toBe(false);
    expect(isUpToDate('9.0.1', '9.0.2')).toBe(false);
  });
});
