// One-click text looks (Word Art style): each sets the colours and effects, never the font,
// size or place.
import { describe, expect, it } from 'vitest';
import { applyLook, lookOf, TEXT_LOOKS } from '../../../../src/core/text/looks.ts';
import { validateTextStyle } from '../../../../src/core/text/fonts.ts';
import type { TextStyle } from '../../../../src/core/model/types.ts';

const STYLE: TextStyle = {
  font: 'Lobster',
  size: 72,
  colour: '#123456',
  bold: true,
  italic: false,
  align: 'left',
  position: 'top-left',
  shadow: true,
  box: true,
  boxColour: '#ffd400',
};

describe('text looks', () => {
  it('there are at least 12, with unique names', () => {
    expect(TEXT_LOOKS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(TEXT_LOOKS.map((l) => l.label)).size).toBe(TEXT_LOOKS.length);
  });

  it('a look replaces the colours and effects, and keeps font, size, style and place', () => {
    const neon = applyLook(STYLE, 'neon');
    expect(neon).toMatchObject({
      font: 'Lobster',
      size: 72,
      bold: true,
      align: 'left',
      position: 'top-left',
      glow: true,
      shadow: false,
      box: false,
    });
    expect(neon.boxColour).toBeUndefined();
    expect(() => validateTextStyle(neon)).not.toThrow();
  });

  it('every look gives a valid style, and is recognised again', () => {
    for (const look of TEXT_LOOKS) {
      const styled = applyLook(STYLE, look.id);
      expect(() => validateTextStyle(styled), look.id).not.toThrow();
      expect(lookOf(styled), look.id).toBe(look.id);
    }
    expect(lookOf({ ...applyLook(STYLE, 'gold'), colour: '#000000' })).toBeNull();
  });

  it('colours must be colours', () => {
    expect(() => validateTextStyle({ ...STYLE, accent: 'red' })).toThrow(/colour/i);
    expect(() => validateTextStyle({ ...STYLE, outlineColour: '#12' })).toThrow(/colour/i);
  });
});
