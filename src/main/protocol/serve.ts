// Serves an allowed local file to the page as an HTTP-style response (media:// protocol).
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import type { AllowList } from './allowlist.ts';
import { parseRange } from './range.ts';

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

export async function serveMediaFile(
  path: string,
  rangeHeader: string | null,
  allow: AllowList,
): Promise<Response> {
  if (!allow.has(path)) return new Response('Not allowed', { status: 403 });
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const type = TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const range = parseRange(rangeHeader, size);
  if (range === 'unsatisfiable') {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body =
    size === 0 ? null : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream);
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': type,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    },
  });
}
