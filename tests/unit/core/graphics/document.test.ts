// M18 / G1, G6, G8, G10: a Graphics mode image — sizes in the papers' units, its resolution, the
// canvas cropped to the drawing.
import { describe, expect, it } from 'vitest';
import { createEllipse, createRect } from '../../../../src/core/animation/factory.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import {
  canvasPixels,
  createGraphic,
  cropCanvas,
  defaultGraphic,
  drawingBounds,
  graphicOf,
  IMAGE_PRESETS,
  isGraphic,
  MAX_CANVAS,
  setImage,
} from '../../../../src/core/graphics/document.ts';
import {
  formatLength,
  fromPx,
  roundIn,
  toPx,
  validateDpi,
} from '../../../../src/core/graphics/units.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

describe('units (G1, G6, G10)', () => {
  it('turns cm, mm, in and pt into pixels at a resolution, and back', () => {
    // A4 at 300 dpi is 2480 × 3508 (21 × 29.7 cm), as print shops say.
    expect(Math.round(toPx(21, 'cm', 300))).toBe(2480);
    expect(Math.round(toPx(29.7, 'cm', 300))).toBe(3508);
    expect(toPx(80, 'mm', 96)).toBeCloseTo(302.36, 2); // 9626/04 M/25: an 80 mm square
    expect(toPx(1, 'in', 96)).toBe(96);
    expect(toPx(72, 'pt', 300)).toBe(300); // a point is 1/72 inch
    expect(toPx(250, 'px', 300)).toBe(250);
    expect(fromPx(2480, 'cm', 300)).toBeCloseTo(21, 2);
    expect(fromPx(96, 'in', 96)).toBe(1);
  });

  it('shows lengths rounded as each unit is typed', () => {
    expect(roundIn(20.99733, 'cm')).toBe(21);
    expect(roundIn(302.3622, 'px')).toBe(302);
    expect(formatLength(2480, 'cm', 300)).toBe('21 cm');
    expect(formatLength(336, 'in', 96)).toBe('3.5 in');
  });

  it('refuses a resolution that is not a whole number from 10 to 1200 dpi', () => {
    expect(() => validateDpi(300)).not.toThrow();
    for (const bad of [0, 9, 1201, 72.5, Number.NaN])
      expect(() => validateDpi(bad)).toThrow(EditError);
  });
});

describe('a new image (G1)', () => {
  it('is an A4 page at 300 dpi when the paper asks for A4 (9626/04 M/J/18)', () => {
    const a4 = IMAGE_PRESETS.find((p) => p.name === 'A4 portrait')!;
    const doc = createGraphic({ name: 'TTS10', size: a4, background: '#ffffff' });
    expect(doc.stage).toMatchObject({
      width: 2480,
      height: 3508,
      background: '#ffffff',
      length: 1,
    });
    expect(doc.graphic).toEqual({ dpi: 300, units: 'cm' });
    expect(isGraphic(doc)).toBe(true);
    expect(doc.view.rulers).toBe(true);
    expect(doc.layers).toHaveLength(1);
  });

  it('is 200 × 200 px for a web logo, and may be transparent (9626/04 O/N/17)', () => {
    const doc = createGraphic({
      name: 'RockICT_logo',
      size: { width: 200, height: 200, units: 'px', dpi: 96 },
      background: 'none',
    });
    expect(doc.stage).toMatchObject({ width: 200, height: 200, background: 'none' });
  });

  it('rounds a size in cm to whole pixels: 10 cm at 300 dpi is 1181 px (9626/04 M/22)', () => {
    expect(canvasPixels({ width: 10, height: 10, units: 'cm', dpi: 300 })).toEqual({
      width: 1181,
      height: 1181,
    });
  });

  it('refuses a canvas too small or too big, saying how many pixels it would be', () => {
    expect(() => canvasPixels({ width: 0.3, height: 1, units: 'cm', dpi: 96 })).toThrow(/11 px/);
    expect(() => canvasPixels({ width: 100, height: 10, units: 'cm', dpi: 300 })).toThrow(
      new RegExp(`${MAX_CANVAS}`),
    );
  });

  it('is saved and opened again with its resolution and units', () => {
    const doc = createGraphic({
      name: 'Heron',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: '#ffffff',
    });
    const back = deserializeAnimation(serializeAnimation(doc));
    expect(back.graphic).toEqual({ dpi: 300, units: 'cm' });
    expect(back.stage.width).toBe(1181);
  });

  it('refuses a file whose units are not ones it knows', () => {
    const text = serializeAnimation({
      ...defaultGraphic(),
      graphic: { dpi: 96, units: 'px' },
    }).replace('"units": "px"', '"units": "furlongs"');
    expect(() => deserializeAnimation(text)).toThrow();
  });

  it('treats an animation as a screen picture in pixels', () => {
    const animation = { ...defaultGraphic() };
    delete animation.graphic;
    expect(graphicOf(animation)).toEqual({ dpi: 96, units: 'px' });
  });
});

describe('the canvas (G1, G8)', () => {
  const withShapes = () => {
    let doc = defaultGraphic();
    const layer = doc.layers[0]!.id;
    doc = addObject(doc, layer, createRect({ x: 100.4, y: 50, width: 200, height: 100 }));
    doc = addObject(doc, layer, createEllipse({ x: 400, y: 300, width: 50, height: 50 }));
    return { ...doc, guides: { x: [150, 1000], y: [60] } };
  };

  it('changes size, resolution, units and background; the drawing stays where it is', () => {
    const doc = withShapes();
    const next = setImage(doc, {
      width: 600,
      height: 400,
      dpi: 300,
      units: 'cm',
      background: 'none',
    });
    expect(next.stage).toMatchObject({ width: 600, height: 400, background: 'none' });
    expect(next.graphic).toEqual({ dpi: 300, units: 'cm' });
    expect(next.layers[0]!.objects[0]).toMatchObject({ x: 100.4, y: 50 });
    expect(() => setImage(doc, { width: 9000 })).toThrow(EditError);
    expect(() => setImage(doc, { dpi: 5000 })).toThrow(EditError);
  });

  it('crops to the drawing: everything moves up and left, guides outside are dropped', () => {
    const doc = withShapes();
    const box = drawingBounds(doc)!;
    expect(box).toMatchObject({ x: 100.4, y: 50 });
    const cropped = cropCanvas(doc, box);
    // From x 100 (whole pixels) to 450, from y 50 to 350.
    expect(cropped.stage).toMatchObject({ width: 350, height: 300 });
    expect(cropped.layers[0]!.objects[0]!.x).toBeCloseTo(0.4, 9);
    expect(cropped.layers[0]!.objects[0]!.y).toBe(0);
    expect(cropped.layers[0]!.objects[1]).toMatchObject({ x: 300, y: 250 });
    expect(cropped.guides).toEqual({ x: [50], y: [10] });
  });

  it('has no drawing to crop to when every layer is hidden', () => {
    const doc = withShapes();
    expect(
      drawingBounds({ ...doc, layers: doc.layers.map((l) => ({ ...l, visible: false })) }),
    ).toBe(null);
  });
});
