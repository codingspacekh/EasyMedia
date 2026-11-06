// AN4: a text object's box follows its words, size and font on screen.
import { describe, expect, it } from 'vitest';
import { curvedText } from '../../../src/core/animation/curve.ts';
import { createText, roughTextWidth } from '../../../src/core/animation/factory.ts';
import { textBox, type Measurer } from '../../../src/ui/animation/measure.ts';

/** Ten px a letter, whatever the font — and remembers the font it was asked to use. */
function fake(): Measurer & { fonts: string[] } {
  const m = {
    font: '',
    fonts: [] as string[],
    measureText(text: string) {
      m.fonts.push(m.font);
      return { width: 10 * text.length };
    },
  };
  return m;
}

describe('textBox', () => {
  it('measures the widest line in the text’s own font; the height is 1.2 lines per line', () => {
    const ctx = fake();
    const t = { ...createText('Task 1\nTwo', { x: 0, y: 0, size: 64 }), bold: true };
    expect(textBox(t, ctx)).toEqual({ width: 60, height: 153.6 });
    expect(ctx.fonts[0]).toBe('700 64px "Inter"');
  });

  it('without a canvas it keeps the rough estimate', () => {
    const t = createText('Task 1', { x: 0, y: 0, size: 64 });
    expect(textBox(t, null)).toEqual({ width: 211.2, height: 76.8 });
  });

  it('AN26 curved words: the box is the bent words’ bounds, measured letter by letter in the font', () => {
    const ctx = fake();
    const t = { ...createText('HUNGRY', { x: 0, y: 0, size: 20 }), curve: 60 };
    const bent = curvedText(t, (s) => 10 * s.length);
    const round = (n: number) => Math.round(n * 100) / 100;
    expect(textBox(t, ctx)).toEqual({ width: round(bent.width), height: round(bent.height) });
    expect(ctx.fonts.every((f) => f === '400 20px "Inter"')).toBe(true);
    // Without a canvas, from the rough width of each letter.
    const rough = curvedText(t, (s) => roughTextWidth(s, 20));
    expect(textBox(t, null)).toEqual({ width: round(rough.width), height: round(rough.height) });
  });
});
