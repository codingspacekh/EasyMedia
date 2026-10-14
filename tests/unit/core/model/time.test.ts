import { describe, expect, it } from 'vitest';
import { formatTime, parseTime, roundTime } from '../../../../src/core/model/time.ts';

describe('N8 time values (0.01 s precision)', () => {
  describe('roundTime', () => {
    it.each([
      [4.199999999, 4.2],
      [12.505, 12.51],
      [0.004, 0],
      [40.7, 40.7],
    ])('%f → %f', (input, expected) => {
      expect(roundTime(input)).toBe(expected);
    });
  });

  describe('formatTime', () => {
    it.each([
      [0, '00:00.00'],
      [12.5, '00:12.50'],
      [6.3 / 1.5, '00:04.20'],
      [75.256, '01:15.26'],
      [59.996, '01:00.00'],
      [3725, '1:02:05.00'],
    ])('%f s → %s', (seconds, expected) => {
      expect(formatTime(seconds)).toBe(expected);
    });

    it('never shows a negative time', () => {
      expect(formatTime(-0.001)).toBe('00:00.00');
    });
  });

  describe('parseTime (what students type)', () => {
    it.each([
      ['12.5', 12.5],
      [' 8 ', 8],
      ['00:12.50', 12.5],
      ['1:15.26', 75.26],
      ['1:02:05', 3725],
      ['6,3', 6.3],
      ['4.199', 4.2],
    ])('%j → %f', (text, expected) => {
      expect(parseTime(text)).toBe(expected);
    });

    it.each(['', 'abc', '-3', '1:75', '12.5.1', '1:2:3:4'])('rejects %j', (text) => {
      expect(parseTime(text)).toBeNull();
    });
  });
});
