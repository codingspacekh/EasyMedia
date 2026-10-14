import { join } from 'node:path';

/** Platforms we ship FFmpeg for (README §4.1, X5). */
export const PLATFORM_KEYS = ['win32-x64', 'darwin-arm64', 'darwin-x64'] as const;
export type PlatformKey = (typeof PLATFORM_KEYS)[number];

export interface BinaryPaths {
  ffmpeg: string;
  ffprobe: string;
}

export function platformKey(platform: string, arch: string): PlatformKey {
  const key = `${platform}-${arch}`;
  if (!(PLATFORM_KEYS as readonly string[]).includes(key)) {
    throw new Error(`Platform ${key} is not supported. Supported: ${PLATFORM_KEYS.join(', ')}.`);
  }
  return key as PlatformKey;
}

/** Where the bundled binaries live: <resources>/ffmpeg/<platform-key>/ffmpeg[.exe]. */
export function binaryPaths(resourcesDir: string, key: PlatformKey): BinaryPaths {
  const ext = key.startsWith('win32') ? '.exe' : '';
  const dir = join(resourcesDir, 'ffmpeg', key);
  return { ffmpeg: join(dir, `ffmpeg${ext}`), ffprobe: join(dir, `ffprobe${ext}`) };
}
