// AN5 Make a colour see-through (9626/04 O/N/19: the pearl cut out of its photo, on a transparent
// background): the colour picked from the picture, with a tolerance, made see-through by FFmpeg's
// colorkey into a PNG; the dialog's preview works it out the same way.
import { describe, expect, it } from 'vitest';
import {
  colourAt,
  colourKeyFilter,
  keyedAlpha,
  seeThrough,
  type ColourKey,
} from '../../../../src/core/image/colour-key.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const white: ColourKey = { colour: '#FFFFFF', tolerance: 20, soft: false };

describe('AN5 Make a colour see-through', () => {
  it('is FFmpeg’s colorkey with the picked colour and the tolerance (0–1), then a see-through PNG', () => {
    expect(colourKeyFilter(white)).toBe('colorkey=0xffffff:0.2:0,format=rgba');
    // Soft edges: colours just past the tolerance are partly see-through.
    expect(colourKeyFilter({ colour: '#0a64c8', tolerance: 35, soft: true })).toBe(
      'colorkey=0x0a64c8:0.35:0.1,format=rgba',
    );
  });

  it('refuses a colour that is not picked and a tolerance outside 1–100 %', () => {
    expect(() => colourKeyFilter({ ...white, colour: 'white' })).toThrow(EditError);
    expect(() => colourKeyFilter({ ...white, colour: 'white' })).toThrow(
      'Pick the colour to make see-through: click it in the picture.',
    );
    for (const tolerance of [0, 101, Number.NaN])
      expect(() => colourKeyFilter({ ...white, tolerance })).toThrow(
        'The tolerance must be between 1 and 100 %.',
      );
  });

  it('the preview: the colour and colours near it are see-through, others stay', () => {
    expect(keyedAlpha(255, 255, 255, white)).toBe(0);
    // A light grey, 10 % away from white, is within 20 %.
    expect(keyedAlpha(230, 230, 230, white)).toBe(0);
    expect(keyedAlpha(200, 30, 30, white)).toBe(255);
    // Soft: just past the tolerance, part see-through.
    const soft = { ...white, soft: true };
    const a = keyedAlpha(190, 190, 190, soft);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
    const pixels = {
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255, 10, 20, 30, 255]),
    };
    expect([...seeThrough(pixels, white)]).toEqual([255, 255, 255, 0, 10, 20, 30, 255]);
  });

  it('picks the colour under the mouse, as hex', () => {
    const pixels = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        ...[255, 255, 255, 255],
        ...[10, 100, 200, 255],
        ...[0, 0, 0, 255],
        ...[1, 2, 3, 255],
      ]),
    };
    expect(colourAt(pixels, 1, 0)).toBe('#0a64c8');
    expect(colourAt(pixels, 1.7, 1.2)).toBe('#010203');
    // Outside the picture: the nearest edge.
    expect(colourAt(pixels, -5, 9)).toBe('#000000');
  });
});
