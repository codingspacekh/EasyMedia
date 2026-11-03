// AN17: whether an animated GIF loops is written in it (the NETSCAPE2.0 block FFmpeg's -loop 0
// writes); the task checker reads it, as ffprobe does not report it.
import { describe, expect, it } from 'vitest';
import { gifLoops } from '../../../../src/core/image/gif.ts';

/** A GIF's start: header, screen, a global colour table of 2 colours, then `rest`. */
function gif(rest: number[]): Uint8Array {
  const header = [...'GIF89a'].map((c) => c.charCodeAt(0));
  const screen = [10, 0, 10, 0, 0x80, 0, 0];
  const table = [0, 0, 0, 255, 255, 255];
  return new Uint8Array([...header, ...screen, ...table, ...rest]);
}
const netscape = (lo: number, hi: number) => [
  0x21,
  0xff,
  11,
  ...[...'NETSCAPE2.0'].map((c) => c.charCodeAt(0)),
  3,
  1,
  lo,
  hi,
  0,
];

describe('GIF looping (AN17)', () => {
  it('a NETSCAPE2.0 block with 0 loops plays again and again', () => {
    expect(gifLoops(gif([...netscape(0, 0), 0x2c]))).toBe(true);
  });

  it('a count of loops is also looping; no block plays once; not a GIF is null', () => {
    expect(gifLoops(gif([...netscape(3, 0), 0x2c]))).toBe(true);
    expect(gifLoops(gif([0x2c, 0, 0]))).toBe(false);
    expect(gifLoops(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
