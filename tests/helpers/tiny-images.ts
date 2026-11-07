// A real 1 × 1 PNG and a JPEG header, for fakes of the canvas (M18: the resolution is written
// into the files the canvas makes, so a fake must make files that can be read).
import { deflateSync } from 'node:zlib';
import { crc32 } from '../../src/core/image/dpi.ts';

function chunk(type: string, data: number[]): number[] {
  const body = new Uint8Array([...type].map((c) => c.charCodeAt(0)).concat(data));
  const len = data.length;
  const crc = crc32(body);
  return [
    len >>> 24,
    (len >>> 16) & 255,
    (len >>> 8) & 255,
    len & 255,
    ...body,
    crc >>> 24,
    (crc >>> 16) & 255,
    (crc >>> 8) & 255,
    crc & 255,
  ];
}

/** A 1 × 1 red PNG with no resolution in it, as the canvas writes them. */
export const TINY_PNG = new Uint8Array([
  137,
  80,
  78,
  71,
  13,
  10,
  26,
  10,
  ...chunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
  ...chunk('IDAT', [...deflateSync(Buffer.from([0, 255, 0, 0]))]),
  ...chunk('IEND', []),
]);

/** The start of a JPEG as Chromium writes it (JFIF header, no units), and its end. */
export const TINY_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9,
]);
