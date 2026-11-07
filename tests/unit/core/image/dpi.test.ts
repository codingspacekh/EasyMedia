// M18 / G10: the resolution inside PNG and JPEG files, so a 10 cm logo opens as 10 cm elsewhere.
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32, jpegDpi, jpegWithDpi, pngDpi, pngWithDpi } from '../../../../src/core/image/dpi.ts';

/** A 1 × 1 red PNG made here, chunk by chunk (no pHYs, as the canvas writes them). */
function tinyPng(): Uint8Array {
  const chunk = (type: string, data: number[]) => {
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
  };
  const ihdr = [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0];
  const idat = [...deflateSync(Buffer.from([0, 255, 0, 0]))];
  return new Uint8Array([
    137,
    80,
    78,
    71,
    13,
    10,
    26,
    10,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', idat),
    ...chunk('IEND', []),
  ]);
}

const chunkTypes = (png: Uint8Array): string[] => {
  const types: string[] = [];
  for (let at = 8; at + 8 <= png.length;) {
    const len = (png[at]! << 24) | (png[at + 1]! << 16) | (png[at + 2]! << 8) | png[at + 3]!;
    types.push(String.fromCharCode(...png.subarray(at + 4, at + 8)));
    at += 12 + len;
  }
  return types;
};

describe('crc32', () => {
  it('matches the standard check value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('pngWithDpi (G10)', () => {
  it('adds a pHYs chunk after the header, in pixels per metre', () => {
    const png = pngWithDpi(tinyPng(), 300);
    expect(chunkTypes(png)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(pngDpi(png)).toEqual({ x: 300, y: 300 });
    // 300 dpi is 11 811 pixels per metre.
    const at = 8 + 25 + 8;
    expect((png[at]! << 24) | (png[at + 1]! << 16) | (png[at + 2]! << 8) | png[at + 3]!).toBe(
      11811,
    );
  });

  it('replaces a resolution already there, and keeps the picture', () => {
    const twice = pngWithDpi(pngWithDpi(tinyPng(), 72), 96);
    expect(chunkTypes(twice)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    expect(pngDpi(twice)).toEqual({ x: 96, y: 96 });
    expect(twice.length).toBe(tinyPng().length + 21);
  });

  it('writes a chunk whose CRC is right', () => {
    const png = pngWithDpi(tinyPng(), 150);
    const start = 8 + 25;
    const stored =
      ((png[start + 17]! << 24) |
        (png[start + 18]! << 16) |
        (png[start + 19]! << 8) |
        png[start + 20]!) >>>
      0;
    expect(stored).toBe(crc32(png, start + 4, start + 17));
  });

  it('says a PNG without one has no resolution, and refuses what is not a PNG', () => {
    expect(pngDpi(tinyPng())).toBe(null);
    expect(() => pngWithDpi(new Uint8Array([1, 2, 3]), 96)).toThrow();
  });
});

describe('jpegWithDpi (G10)', () => {
  // The start of a JPEG as Chromium writes it: SOI, then JFIF APP0 with no units and density 1.
  const jfif = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xdb,
    0, 2, 0xff, 0xd9,
  ]);

  it('sets dots per inch in the JFIF header', () => {
    const out = jpegWithDpi(jfif, 300);
    expect(jpegDpi(out)).toEqual({ x: 300, y: 300 });
    expect(out.length).toBe(jfif.length);
    expect(jpegDpi(jfif)).toBe(null); // no units: an aspect ratio only
  });

  it('puts a JFIF header in when the JPEG has none', () => {
    const bare = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0xff, 0xd9]);
    const out = jpegWithDpi(bare, 96);
    expect(jpegDpi(out)).toEqual({ x: 96, y: 96 });
    expect([...out.subarray(out.length - 6)]).toEqual([0xff, 0xdb, 0, 2, 0xff, 0xd9]);
  });
});
