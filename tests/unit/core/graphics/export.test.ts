// M18 / G11: exporting an image — its pixel size and resolution, an SVG in cm, and the chosen
// objects alone or each in a file of its own.
import { describe, expect, it } from 'vitest';
import { createEllipse, createRect } from '../../../../src/core/animation/factory.ts';
import { addObject, groupObjects } from '../../../../src/core/animation/layers.ts';
import { createGraphic, defaultGraphic } from '../../../../src/core/graphics/document.ts';
import {
  exportPixels,
  FORMAT_INFO,
  imageOfObjects,
  imagesOfEach,
  jpegQuality,
  svgDimensions,
} from '../../../../src/core/graphics/export.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

describe('exportPixels (G11)', () => {
  const canvas = { width: 800, height: 400 };

  it('is the canvas, or another width or height with the other side in proportion', () => {
    expect(exportPixels(canvas, 96)).toEqual({ width: 800, height: 400, dpi: 96 });
    // 9626/04 J/20: "a non-transparent bitmap format with a width of 600px".
    expect(exportPixels(canvas, 96, { by: 'width', px: 600 })).toEqual({
      width: 600,
      height: 300,
      dpi: 96,
    });
    // M/21: "export the image with a height of 500 pixels".
    expect(exportPixels(canvas, 96, { by: 'height', px: 500 })).toEqual({
      width: 1000,
      height: 500,
      dpi: 96,
    });
    expect(exportPixels(canvas, 96, { by: 'percent', percent: 50 })).toEqual({
      width: 400,
      height: 200,
      dpi: 96,
    });
  });

  it('is a printed width at a resolution, written into the file', () => {
    // 10 cm at 300 dpi.
    expect(
      exportPixels({ width: 500, height: 500 }, 96, {
        by: 'print',
        width: 10,
        unit: 'cm',
        dpi: 300,
      }),
    ).toEqual({ width: 1181, height: 1181, dpi: 300 });
  });

  it('refuses sizes of nothing or too many pixels', () => {
    expect(() => exportPixels(canvas, 96, { by: 'width', px: 0 })).toThrow(EditError);
    expect(() => exportPixels(canvas, 96, { by: 'width', px: 40000 })).toThrow(/40000 × 20000/);
    expect(() => exportPixels(canvas, 96, { by: 'percent', percent: -5 })).toThrow(EditError);
  });
});

describe('svgDimensions (G11, G10)', () => {
  it('writes px for a screen image and cm for a 10 cm logo (9626/04 M/22 HeronV10cm)', () => {
    expect(svgDimensions(defaultGraphic())).toEqual({ width: '1280', height: '720' });
    const logo = createGraphic({
      name: 'Heron',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: '#ffffff',
    });
    expect(svgDimensions(logo)).toEqual({ width: '10cm', height: '10cm' });
    expect(
      svgDimensions(defaultGraphic(), { by: 'print', width: 4, unit: 'in', dpi: 300 }),
    ).toEqual({
      width: '4in',
      height: '2.25in',
    });
    expect(svgDimensions(logo, { by: 'width', px: 200 })).toEqual({ width: '200', height: '200' });
  });
});

describe('exporting the chosen objects (G11)', () => {
  function monitor() {
    let doc = defaultGraphic();
    const layer = doc.layers[0]!.id;
    const casing = { ...createRect({ x: 100, y: 100, width: 300, height: 200 }), name: 'Casing' };
    const grid = { ...createRect({ x: 120, y: 120, width: 100, height: 80 }), name: 'Grid' };
    const star = { ...createRect({ x: 500, y: 50, width: 40, height: 40 }), name: 'Star' };
    const other = { ...createEllipse({ x: 600, y: 300, width: 40, height: 40 }), name: 'Star' };
    for (const o of [casing, grid, star, other]) doc = addObject(doc, layer, o);
    return { doc, casing, grid, star, other };
  }

  it('crops the canvas to them and leaves the rest out, see-through around them', () => {
    const { doc, casing, grid } = monitor();
    const part = imageOfObjects(doc, [casing.id, grid.id]);
    expect(part.stage).toMatchObject({ width: 300, height: 200, background: 'none' });
    expect(part.layers[0]!.objects.map((o) => o.name)).toEqual(['Casing', 'Grid']);
    expect(part.layers[0]!.objects[1]).toMatchObject({ x: 20, y: 20 });
  });

  it('makes one image per object, named after it, names made different', () => {
    const { doc, casing, star, other } = monitor();
    const each = imagesOfEach(doc, [casing.id, star.id, other.id]);
    expect(each.map((e) => e.name)).toEqual(['Casing', 'Star', 'Star 2']);
    expect(each[1]!.doc.stage).toMatchObject({ width: 40, height: 40 });
  });

  it('keeps a group whole (9626/04 J/19: the grouped Casing)', () => {
    const { doc, casing, grid } = monitor();
    const grouped = groupObjects(doc, [casing.id, grid.id]);
    const group = { ...grouped.group, name: 'Casing' };
    const withName = {
      ...grouped.doc,
      layers: grouped.doc.layers.map((l) => ({
        ...l,
        objects: l.objects.map((o) => (o.id === group.id ? group : o)),
      })),
    };
    const [only] = imagesOfEach(withName, [group.id]);
    expect(only!.name).toBe('Casing');
    expect(only!.doc.stage).toMatchObject({ width: 300, height: 200 });
  });

  it('asks for objects to be chosen first', () => {
    expect(() => imageOfObjects(defaultGraphic(), [])).toThrow(/Choose the objects/);
  });
});

describe('formats (G11)', () => {
  it('says which keep transparency and which lose detail', () => {
    expect(FORMAT_INFO.png).toMatchObject({
      kind: 'bitmap',
      compression: 'lossless',
      transparency: true,
    });
    expect(FORMAT_INFO.jpg).toMatchObject({
      kind: 'bitmap',
      compression: 'lossy',
      transparency: false,
    });
    expect(FORMAT_INFO.svg).toMatchObject({ kind: 'vector', transparency: true });
  });

  it('checks the JPG quality', () => {
    expect(jpegQuality()).toBe(90);
    expect(jpegQuality(40)).toBe(40);
    expect(() => jpegQuality(0)).toThrow(EditError);
    expect(() => jpegQuality(101)).toThrow(EditError);
  });
});
