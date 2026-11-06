import { describe, expect, it } from 'vitest';
import { hexToHsv, hsvToHex, normaliseHex } from '../../../src/core/colour.ts';

describe("the colour picker's colour maths", () => {
  it('reads the hex codes people type: with or without #, 3 or 6 digits, any capitals', () => {
    expect(normaliseHex('#F4C8EE')).toBe('#f4c8ee');
    expect(normaliseHex('f4c8ee')).toBe('#f4c8ee');
    expect(normaliseHex(' #abc ')).toBe('#aabbcc');
    expect(normaliseHex('#12345')).toBeNull();
    expect(normaliseHex('red')).toBeNull();
  });

  it('turns a colour into hue, saturation and brightness and back without change', () => {
    expect(hexToHsv('#ff0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#ffffff')).toEqual({ h: 0, s: 0, v: 1 });
    expect(hexToHsv('#00ff00').h).toBeCloseTo(120, 6);
    for (const hex of ['#f4c8ee', '#333333', '#2f7fe0', '#c8901a', '#00008b', '#7c3aed'])
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
});
