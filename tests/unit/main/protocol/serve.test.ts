import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAllowList } from '../../../../src/main/protocol/allowlist.ts';
import { serveMediaFile } from '../../../../src/main/protocol/serve.ts';

let dir: string;
let file: string;
const allow = createAllowList();
const bytes = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-serve-'));
  file = join(dir, 'clip.mp4');
  await writeFile(file, bytes);
  allow.add(file);
});
afterAll(() => rm(dir, { recursive: true, force: true }));

describe('media:// file server', () => {
  it('sends a whole allowed file with its type and length', async () => {
    const res = await serveMediaFile(file, null, allow);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('content-length')).toBe('1000');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it('sends part of a file for a range request (seeking)', async () => {
    const res = await serveMediaFile(file, 'bytes=100-199', allow);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 100-199/1000');
    expect(res.headers.get('content-length')).toBe('100');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes.subarray(100, 200));
  });

  it('answers 416 for a range outside the file', async () => {
    const res = await serveMediaFile(file, 'bytes=5000-', allow);
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */1000');
  });

  it('refuses files the app did not import or create (403)', async () => {
    const other = join(dir, 'secret.txt');
    await writeFile(other, 'secret');
    expect((await serveMediaFile(other, null, allow)).status).toBe(403);
  });

  it('answers 404 for an allowed file that has since disappeared', async () => {
    const gone = join(dir, 'gone.mp4');
    allow.add(gone);
    expect((await serveMediaFile(gone, null, allow)).status).toBe(404);
  });

  it.each([
    ['a.mov', 'video/quicktime'],
    ['a.png', 'image/png'],
    ['a.JPG', 'image/jpeg'],
    ['a.mp3', 'audio/mpeg'],
    ['a.wav', 'audio/wav'],
    ['a.xyz', 'application/octet-stream'],
  ])('%s is sent as %s', async (name, type) => {
    const path = join(dir, name);
    await writeFile(path, 'x');
    allow.add(path);
    expect((await serveMediaFile(path, null, allow)).headers.get('content-type')).toBe(type);
  });
});
