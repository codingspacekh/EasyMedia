import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { binaryPaths, platformKey, type BinaryPaths } from '../../../src/main/ffmpeg/paths.ts';

export const run = promisify(execFile);
export const resourcesDir = fileURLToPath(new URL('../../../resources', import.meta.url));

/** Paths to the bundled binaries for this machine; fails clearly if they were never fetched. */
export function bundledFfmpeg(): BinaryPaths {
  const paths = binaryPaths(resourcesDir, platformKey(process.platform, process.arch));
  for (const p of Object.values(paths)) {
    if (!existsSync(p)) throw new Error(`Missing ${p}. Run "npm run fetch:ffmpeg" first.`);
  }
  return paths;
}
