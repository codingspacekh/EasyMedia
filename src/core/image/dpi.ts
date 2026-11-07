// G10 (M18): the resolution kept inside a picture file, so a 10 cm logo at 300 dpi opens as 10 cm
// in another program (9626/04 M/22: "sized 10 cm × 10 cm"). A PNG keeps it in a pHYs chunk
// (pixels per metre), a JPEG in its JFIF header (dots per inch). The canvas writes neither, so
// they are put into its files here. Reading them back serves the tests and the task checker.

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let table: Uint32Array | null = null;

/** CRC-32 as PNG chunks use it (ISO 3309). */
export function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = start; i < end; i++) crc = table[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const u32 = (b: Uint8Array, at: number) =>
  ((b[at]! << 24) | (b[at + 1]! << 16) | (b[at + 2]! << 8) | b[at + 3]!) >>> 0;

function putU32(b: Uint8Array, at: number, n: number): void {
  b[at] = (n >>> 24) & 0xff;
  b[at + 1] = (n >>> 16) & 0xff;
  b[at + 2] = (n >>> 8) & 0xff;
  b[at + 3] = n & 0xff;
}

const typeAt = (b: Uint8Array, at: number) => String.fromCharCode(...b.subarray(at, at + 4));

export const isPng = (b: Uint8Array): boolean => PNG_SIGNATURE.every((v, i) => b[i] === v);

/** Each chunk's type and where it starts (its length field) and ends (after its CRC). */
function chunks(png: Uint8Array): { type: string; start: number; end: number; data: number }[] {
  const found = [];
  let at = 8;
  while (at + 12 <= png.length) {
    const length = u32(png, at);
    const end = at + 12 + length;
    if (end > png.length) break;
    found.push({ type: typeAt(png, at + 4), start: at, end, data: at + 8 });
    at = end;
  }
  return found;
}

/**
 * The PNG with its resolution set to `dpi` (both ways): a pHYs chunk, in pixels per metre,
 * replacing any there was, straight after the header as the PNG standard asks (before IDAT).
 */
export function pngWithDpi(png: Uint8Array, dpi: number): Uint8Array {
  if (!isPng(png)) throw new Error('This is not a PNG file.');
  const all = chunks(png);
  const header = all.find((c) => c.type === 'IHDR');
  if (!header) throw new Error('This PNG has no header.');
  const ppm = Math.round(dpi / 0.0254);
  const phys = new Uint8Array(21);
  putU32(phys, 0, 9);
  phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  putU32(phys, 8, ppm);
  putU32(phys, 12, ppm);
  phys[16] = 1; // the unit is the metre
  putU32(phys, 17, crc32(phys, 4, 17));
  const parts: Uint8Array[] = [png.subarray(0, header.end), phys];
  for (const c of all)
    if (c !== header && c.type !== 'pHYs') parts.push(png.subarray(c.start, c.end));
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** A PNG's resolution in dots per inch, or null when it says none (or not in metres). */
export function pngDpi(png: Uint8Array): { x: number; y: number } | null {
  if (!isPng(png)) return null;
  const phys = chunks(png).find((c) => c.type === 'pHYs');
  if (!phys || png[phys.data + 8] !== 1) return null;
  return {
    x: Math.round(u32(png, phys.data) * 0.0254),
    y: Math.round(u32(png, phys.data + 4) * 0.0254),
  };
}

export const isJpeg = (b: Uint8Array): boolean => b[0] === 0xff && b[1] === 0xd8;

/** Where the JFIF APP0 segment's units byte is, or -1 when the JPEG starts without one. */
function jfifUnits(jpeg: Uint8Array): number {
  const app0 =
    jpeg[2] === 0xff &&
    jpeg[3] === 0xe0 &&
    String.fromCharCode(...jpeg.subarray(6, 10)) === 'JFIF' &&
    jpeg[10] === 0;
  return app0 ? 13 : -1;
}

/**
 * The JPEG with its resolution set to `dpi`: in its JFIF header (units 1 = dots per inch), or
 * with a JFIF header put in when it has none.
 */
export function jpegWithDpi(jpeg: Uint8Array, dpi: number): Uint8Array {
  if (!isJpeg(jpeg)) throw new Error('This is not a JPEG file.');
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  const units = jfifUnits(jpeg);
  if (units >= 0) {
    const out = jpeg.slice();
    out[units] = 1;
    out[units + 1] = d >> 8;
    out[units + 2] = d & 0xff;
    out[units + 3] = d >> 8;
    out[units + 4] = d & 0xff;
    return out;
  }
  // FF E0, length 16, "JFIF\0", version 1.01, units, x and y density, no thumbnail.
  const app0 = [
    0xff,
    0xe0,
    0,
    16,
    0x4a,
    0x46,
    0x49,
    0x46,
    0,
    1,
    1,
    1,
    d >> 8,
    d & 0xff,
    d >> 8,
    d & 0xff,
    0,
    0,
  ];
  const out = new Uint8Array(jpeg.length + app0.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(jpeg.subarray(2), 2 + app0.length);
  return out;
}

/** A JPEG's resolution in dots per inch, or null when its header gives none. */
export function jpegDpi(jpeg: Uint8Array): { x: number; y: number } | null {
  const units = jfifUnits(jpeg);
  if (units < 0) return null;
  const x = (jpeg[units + 1]! << 8) | jpeg[units + 2]!;
  const y = (jpeg[units + 3]! << 8) | jpeg[units + 4]!;
  if (jpeg[units] === 1) return { x, y };
  if (jpeg[units] === 2) return { x: Math.round(x * 2.54), y: Math.round(y * 2.54) };
  return null;
}
