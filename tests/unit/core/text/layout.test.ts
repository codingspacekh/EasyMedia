import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  creditsY,
  cssFont,
  layoutText,
  readability,
} from '../../../../src/core/text/layout.ts';
import type { TextStyle } from '../../../../src/core/model/types.ts';

const style = (over: Partial<TextStyle> = {}): TextStyle => ({
  font: 'Inter',
  size: 60,
  colour: '#ffffff',
  bold: false,
  italic: false,
  align: 'centre',
  position: 'centre',
  ...over,
});
// A fake font: every character is half as wide as the font size.
const measure = (text: string, font: string) =>
  text.length * (Number(/(\d+(\.\d+)?)px/.exec(font)![1]) / 2);
const HD = { width: 1920, height: 1080 };

describe('V4 text layout in the frame', () => {
  it('font sizes are relative to a 1080-pixel-tall frame', () => {
    expect(cssFont(style({ size: 60 }), 1080)).toBe('400 60px "Inter"');
    expect(cssFont(style({ size: 60, bold: true, italic: true }), 720)).toBe(
      'italic 700 40px "Inter"',
    );
    expect(cssFont(style({ font: 'Courier Prime' }), 1080)).toBe('400 60px "Courier Prime"');
  });

  it('keeps the lines the student typed, including blank lines', () => {
    const l = layoutText('Filmed by: GBRvideo\n\nEdited by: Me', style(), HD, measure);
    expect(l.lines).toEqual(['Filmed by: GBRvideo', '', 'Edited by: Me']);
  });

  it('wraps a long line to fit inside the safe area (90 % of the width)', () => {
    const text =
      'Lake Naivasha sits in the Great Rift Valley. It is home to over 400 species of birds.';
    const l = layoutText(text, style({ size: 60 }), HD, measure); // 30 px per character → 57 characters fit in 1728 px
    expect(l.lines.length).toBeGreaterThan(1);
    expect(Math.max(...l.lines.map((line) => measure(line, l.font)))).toBeLessThanOrEqual(1728);
    expect(l.lines.join(' ')).toBe(text);
  });

  it.each([
    ['top-left', 96, 54],
    ['centre', 960 - 300 / 2, 540 - 72 / 2],
    ['bottom-right', 1920 - 96 - 300, 1080 - 54 - 72],
  ] as const)('%s places the block inside the 5 %% safe margin', (position, x, y) => {
    const l = layoutText('0123456789', style({ position }), HD, measure); // 10 × 30 = 300 px wide, 1.2 × 60 = 72 px tall
    expect([l.box.x, l.box.y, l.box.width, l.box.height]).toEqual([x, y, 300, 72]);
  });

  it('aligns each line inside the block', () => {
    const l = layoutText('abcd\nab', style({ align: 'right', position: 'top-left' }), HD, measure);
    expect(l.lineX).toEqual([96, 96 + 60]);
  });
});

describe('V5 scrolling credits', () => {
  it('start just below the frame and end just above it', () => {
    expect(creditsY(0, 6, 1080, 400)).toBe(1080);
    expect(creditsY(6, 6, 1080, 400)).toBe(-400);
    expect(creditsY(3, 6, 1080, 400)).toBe(340);
  });
});

describe('V6 readability: contrast ratio (WCAG)', () => {
  it('white on black is 21:1, the same colours 1:1', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('calls 4.5:1 or more easy to read', () => {
    expect(readability('#ffffff', '#000000')).toEqual({ ratio: 21, easy: true });
    expect(readability('#777777', '#666666').easy).toBe(false);
  });
});
