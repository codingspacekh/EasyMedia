// Preview proxies live in the app's proxy folder. The name depends on the source path and size,
// so the same file reuses its proxy and a changed file gets a new one.
import { fileNameOf } from '../core/project/relocate.ts';

export function proxyPathFor(proxyDir: string, sourcePath: string, sizeBytes: number): string {
  const base = fileNameOf(sourcePath)
    .replace(/\.[^.]*$/, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_');
  return `${proxyDir}/${base}-${fnv1a(`${sourcePath}|${sizeBytes}`)}.mp4`;
}

/** 32-bit FNV-1a hash as 8 hex digits. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
