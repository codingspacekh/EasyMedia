// M18 / G7, G9: the same colour in RGB, HSL and CMYK (syllabus 19.1 colour systems; coursebook
// Questions 5–10 and Figures 18.23–18.25).
import { describe, expect, it } from 'vitest';
import {
  cmykToHex,
  hexToCmyk,
  hexToHsl,
  hexToRgb,
  hslToHex,
  rgbToHex,
} from '../../../src/core/colour.ts';

describe('RGB (G9)', () => {
  it('reads FF0000 as all red and no green or blue, and back (coursebook Questions 6–10)', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(rgbToHex({ r: 180, g: 0, b: 0 })).toBe('#b40000'); // 9626/04 O/N/25 the apple
    expect(rgbToHex({ r: 150, g: 150, b: 150 })).toBe('#969696'); // M/19 the grey outline
    expect(rgbToHex({ r: 300, g: -4, b: 12.6 })).toBe('#ff000d');
  });
});

describe('HSL (G9)', () => {
  it('gives hue, saturation and lightness, as Figures 18.23–18.25', () => {
    expect(hexToHsl(hslToHex({ h: 100, s: 50, l: 50 }))).toEqual({ h: 100, s: 50, l: 50 });
    expect(hexToHsl('#ff0000')).toEqual({ h: 0, s: 100, l: 50 });
    expect(hexToHsl('#ffffff')).toEqual({ h: 0, s: 0, l: 100 });
    expect(hslToHex({ h: 240, s: 100, l: 50 })).toBe('#0000ff');
    expect(hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000');
  });
});

describe('CMYK (G9)', () => {
  it('mixes inks: red is magenta and yellow, black is all key', () => {
    expect(hexToCmyk('#ff0000')).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(hexToCmyk('#000000')).toEqual({ c: 0, m: 0, y: 0, k: 100 });
    expect(hexToCmyk('#ffffff')).toEqual({ c: 0, m: 0, y: 0, k: 0 });
    expect(hexToCmyk('#4339ff')).toEqual({ c: 74, m: 78, y: 0, k: 0 }); // J/26 the neutron
    expect(cmykToHex({ c: 0, m: 100, y: 100, k: 0 })).toBe('#ff0000');
    expect(cmykToHex({ c: 0, m: 0, y: 0, k: 50 })).toBe('#808080');
  });
});
