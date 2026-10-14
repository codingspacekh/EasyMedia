import { describe, expect, it } from 'vitest';
import { parseRange } from '../../../../src/main/protocol/range.ts';

describe('HTTP Range requests (needed for seeking in <video>)', () => {
  const size = 1000;
  it.each([
    [null, null],
    ['bytes=0-', { start: 0, end: 999 }],
    ['bytes=100-199', { start: 100, end: 199 }],
    ['bytes=900-5000', { start: 900, end: 999 }],
    ['bytes=-200', { start: 800, end: 999 }],
  ])('%s', (header, expected) => {
    expect(parseRange(header, size)).toEqual(expected);
  });

  it.each(['bytes=1000-', 'bytes=500-100', 'items=0-1', 'bytes=0-1,5-6', 'bytes=abc'])(
    '%s cannot be served',
    (header) => {
      expect(parseRange(header, size)).toBe('unsatisfiable');
    },
  );
});
