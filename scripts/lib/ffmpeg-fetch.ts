import { createHash } from 'node:crypto';
import { PLATFORM_KEYS, type PlatformKey } from '../../src/main/ffmpeg/paths.ts';

/** One downloadable archive and the binaries to copy out of it (destination name → path inside archive). */
export interface ManifestArchive {
  url: string;
  sha256: string;
  files: Record<string, string>;
}

export interface FfmpegManifest {
  version: string;
  platforms: Record<PlatformKey, ManifestArchive[]>;
}

const SHA256 = /^[0-9a-f]{64}$/i;

export function parseManifest(raw: unknown): FfmpegManifest {
  const m = raw as Partial<FfmpegManifest> | null;
  if (!m || typeof m.version !== 'string' || !m.platforms) {
    throw new Error('FFmpeg manifest needs a "version" and "platforms".');
  }
  for (const key of PLATFORM_KEYS) {
    const archives = m.platforms[key];
    if (!Array.isArray(archives) || archives.length === 0) {
      throw new Error(`FFmpeg manifest has no archives for ${key}.`);
    }
    for (const a of archives) {
      if (!a.url?.startsWith('https://'))
        throw new Error(`${key}: download URL must use https: ${a.url}`);
      if (!SHA256.test(a.sha256 ?? ''))
        throw new Error(`${key}: sha256 must be 64 hex characters (${a.url}).`);
    }
    const ext = key.startsWith('win32') ? '.exe' : '';
    const provided = archives.flatMap((a) => Object.keys(a.files ?? {}));
    for (const name of [`ffmpeg${ext}`, `ffprobe${ext}`]) {
      if (!provided.includes(name)) throw new Error(`${key}: manifest does not provide ${name}.`);
    }
  }
  return m as FfmpegManifest;
}

export function verifySha256(data: Uint8Array, expected: string, label: string): void {
  const actual = createHash('sha256').update(data).digest('hex');
  if (actual !== expected.toLowerCase()) {
    throw new Error(`Checksum mismatch for ${label}: expected ${expected}, got ${actual}.`);
  }
}

/** The install folder holds a VERSION stamp; a matching stamp means no download is needed. */
export function isUpToDate(stamp: string | undefined, version: string): boolean {
  return stamp?.trim() === version;
}
