// M18 exit gate (phase 3): past-paper graphics tasks done in Graphics mode as a student does them —
// a new image of the size asked, shapes with the numbers and colours given, lined up, saved and
// exported with the candidate's details in each file name — and the files checked.
import { describe, expect, it } from 'vitest';
import type { AnimObject, Paint } from '../../src/core/animation/types.ts';
import { pngDpi } from '../../src/core/image/dpi.ts';
import { rgbToHex } from '../../src/core/colour.ts';
import { picture } from '../helpers/animation-studio.ts';
import { testApp } from '../helpers/test-app.ts';

/** Graphics mode with the candidate's details set (P8: ZZ999_9999 in every name). */
async function graphics(media: Parameters<typeof testApp>[0] = {}) {
  const t = testApp(media);
  await t.app.candidate.set({ centre: 'ZZ999', number: '9999', name: 'Ann' });
  const g = t.app.graphics;
  const doc = () => g.store.get().history.present;
  const objects = () => doc().layers.flatMap((l) => l.objects);
  const last = (): AnimObject => objects().at(-1)!;
  /** Selects one object and types its values in Properties. */
  const type = (o: AnimObject, values: Partial<AnimObject>) => {
    g.select([o.id]);
    expect(g.setProperties(values)).toBeNull();
  };
  const solid = (colour: string): Paint => ({ kind: 'solid', colour });
  /** Exports with the save box answering `path`; the files made. */
  async function exportTo(path: string, options: Parameters<typeof g.exportImage>[0]) {
    t.dialogs.exportGraphic.mockResolvedValueOnce(path);
    const made = await g.exportImage(options);
    expect(made).toEqual([path]);
    return made!;
  }
  return { ...t, g, doc, objects, last, type, solid, exportTo };
}

describe('9626/04 M/19 Task 1(a): a seven-segment display', () => {
  it('a 60 × 110 px template of 7 segments with a 1-point grey outline, then the digits 0–9', async () => {
    const s = await graphics();
    expect(
      await s.g.newImage({
        name: '7seg_template',
        size: { width: 60, height: 110, units: 'px', dpi: 96 },
        background: 'none',
      }),
    ).toBeNull();
    // Each segment is a long hexagon (pen points), 40 × 8 across or 8 × 40 down.
    const across = (y: number) => [
      { x: 10, y: y + 4 },
      { x: 14, y },
      { x: 46, y },
      { x: 50, y: y + 4 },
      { x: 46, y: y + 8 },
      { x: 14, y: y + 8 },
    ];
    const down = (x: number, y: number) => [
      { x: x + 4, y },
      { x: x + 8, y: y + 4 },
      { x: x + 8, y: y + 40 },
      { x: x + 4, y: y + 44 },
      { x, y: y + 40 },
      { x, y: y + 4 },
    ];
    const segments: [string, { x: number; y: number }[]][] = [
      ['a', across(5)],
      ['b', down(46, 9)],
      ['c', down(46, 57)],
      ['d', across(97)],
      ['e', down(6, 57)],
      ['f', down(6, 9)],
      ['g', across(51)],
    ];
    const grey = rgbToHex({ r: 150, g: 150, b: 150 });
    // 1 point at 96 dpi is 1.33 px.
    const outline = { colour: grey, width: 1.33, dash: 'solid' as const };
    for (const [name, points] of segments) {
      s.g.addPath(points, true);
      s.type(s.last(), { name, fill: { kind: 'none' }, stroke: outline });
    }
    expect(s.objects()).toHaveLength(7);
    // Lined up: b and c share their left edge; a, g and d their centres (G5).
    s.g.select(['a', 'g', 'd'].map((n) => s.objects().find((o) => o.name === n)!.id));
    s.g.align('centre', 'selection');
    const a = s.objects().find((o) => o.name === 'a')!;
    const d = s.objects().find((o) => o.name === 'd')!;
    expect(a.x + a.width / 2).toBe(d.x + d.width / 2);

    s.dialogs.saveGraphic.mockResolvedValueOnce('/exam/7seg_template_ZZ999_9999.mveg');
    await s.g.saveAs();
    expect(s.dialogs.saveGraphic).toHaveBeenCalledWith('7seg_template_ZZ999_9999');

    // Each digit: its segments filled; saved in a format that supports transparency (PNG).
    const lit: Record<string, string> = {
      '0': 'abcdef',
      '1': 'bc',
      '7': 'abc',
      '8': 'abcdefg',
    };
    for (const [digit, on] of Object.entries(lit)) {
      for (const o of s.objects())
        s.type(o, { fill: on.includes(o.name) ? s.solid('#ff0000') : { kind: 'none' } });
      s.g.select([]);
      await s.exportTo(`/exam/${digit}.png`, { format: 'png' });
      const [drawn] = s.stageRenderer.renderPng.mock.calls.at(-1)!;
      expect(drawn.stage).toMatchObject({ width: 60, height: 110, background: 'none' });
      const red = drawn.layers[0]!.objects.filter((o) => o.fill.kind === 'solid').map(
        (o) => o.name,
      );
      expect(red.sort().join('')).toBe(on);
    }
  });
});

describe('9626/04 J/23 Task 1: BasicWheel and NewWheel', () => {
  it('a 250 px wheel: 15 px #505050 tyre and spokes, a 30 px #ff0000 hub, saved as SVG', async () => {
    const s = await graphics();
    await s.g.newImage({
      name: 'BasicWheel',
      size: { width: 250, height: 250, units: 'px', dpi: 96 },
      background: 'none',
    });
    const dark = '#505050';
    // The tyre: a circle whose 15 px outline sits inside the 250 px diameter.
    s.g.addShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
    s.type(s.last(), {
      name: 'Tyre',
      x: 7.5,
      y: 7.5,
      width: 235,
      height: 235,
      fill: { kind: 'none' },
      stroke: { colour: dark, width: 15, dash: 'solid' },
    });
    // Four spokes across the wheel, 15 px wide, turned 0°, 45°, 90° and 135°.
    for (const turn of [0, 45, 90, 135]) {
      s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
      s.type(s.last(), {
        name: `Spoke ${turn}`,
        x: 7.5,
        y: 117.5,
        width: 235,
        height: 15,
        rotation: turn,
        fill: s.solid(dark),
        stroke: undefined,
      });
    }
    // The hub, centred on the canvas with Align (one object lines up with the canvas).
    s.g.addShape('ellipse', { x: 0, y: 0, width: 30, height: 30 });
    s.type(s.last(), { name: 'Hub', fill: s.solid('#ff0000'), stroke: undefined });
    s.g.align('centre', 'canvas');
    s.g.align('middle', 'canvas');
    expect(s.last()).toMatchObject({ x: 110, y: 110, width: 30, height: 30 });

    s.g.select([]);
    await s.exportTo('/exam/BasicWheel_ZZ999_9999.svg', { format: 'svg' });
    expect(s.dialogs.exportGraphic).toHaveBeenLastCalledWith('BasicWheel_ZZ999_9999', 'svg');
    const svg = s.disk.get('/exam/BasicWheel_ZZ999_9999.svg')!;
    expect(svg).toMatch(/width="250" height="250"/);
    expect(svg).toMatch(/#505050/i);
    expect(svg).toMatch(/#ff0000/i);
    expect(svg).toMatch(/stroke-width="15"/);

    // (b) NewWheel: the spokes thinner and the hub larger, saved under the new name.
    for (const spoke of s.objects().filter((o) => o.name.startsWith('Spoke')))
      s.type(spoke, { height: 6, y: 122 });
    const hub = s.objects().find((o) => o.name === 'Hub')!;
    s.type(hub, { width: 60, height: 60 });
    s.g.align('centre', 'canvas');
    s.g.align('middle', 'canvas');
    s.g.select([]);
    await s.exportTo('/exam/NewWheel_ZZ999_9999.svg', { format: 'svg' });
    expect(s.disk.get('/exam/NewWheel_ZZ999_9999.svg')).toMatch(/#505050/i);
    expect(s.objects().find((o) => o.name === 'Hub')).toMatchObject({ x: 95, y: 95 });
  });
});

describe('9626/04 J/26 Task 2: Proton, Neutron, Electron, Orbit and CarbonStructure', () => {
  it('a red sphere recoloured twice, halved with a black bar, an orbit, then the carbon atom', async () => {
    const s = await graphics({
      '/exam/Proton_ZZ999_9999.png': picture(120, 120),
      '/exam/Neutron_ZZ999_9999.png': picture(120, 120),
      '/exam/Electron_ZZ999_9999.png': picture(60, 60),
      '/exam/Orbit_ZZ999_9999.png': picture(500, 500),
    });
    await s.g.newImage({
      name: 'Proton',
      size: { width: 120, height: 120, units: 'px', dpi: 96 },
      background: 'none',
    });
    const sphere = (from: string, to: string): Paint => ({
      kind: 'radial',
      from,
      to,
      cx: 35,
      cy: 35,
    });
    // The sphere: RGB 255,0,0 darkening to RGB 166,0,0; a white light bloom, half see-through.
    s.g.addShape('ellipse', { x: 0, y: 0, width: 120, height: 120 });
    const red = rgbToHex({ r: 255, g: 0, b: 0 });
    const dark = rgbToHex({ r: 166, g: 0, b: 0 });
    s.type(s.last(), { name: 'Sphere', fill: sphere(red, dark), stroke: undefined });
    s.g.addShape('ellipse', { x: 25, y: 20, width: 30, height: 20 });
    s.type(s.last(), { name: 'Bloom', fill: s.solid('#ffffff'), opacity: 60, stroke: undefined });
    s.g.select([]);
    await s.exportTo('/exam/Proton_ZZ999_9999.png', { format: 'png' });
    expect(s.dialogs.exportGraphic).toHaveBeenLastCalledWith('Proton_ZZ999_9999', 'png');

    // Recoloured to RGB 67,57,255: the Neutron.
    const body = () => s.objects().find((o) => o.name === 'Sphere')!;
    s.type(body(), { fill: sphere(rgbToHex({ r: 67, g: 57, b: 255 }), dark) });
    s.g.select([]);
    await s.exportTo('/exam/Neutron_ZZ999_9999.png', { format: 'png' });
    expect(
      s.stageRenderer.renderPng.mock.calls.at(-1)![0].layers[0]!.objects[0]!.fill,
    ).toMatchObject({
      from: '#4339ff',
    });

    // RGB 147,200,36, half size, a black rectangle: the Electron (60 × 60).
    s.type(body(), { fill: sphere(rgbToHex({ r: 147, g: 200, b: 36 }), dark) });
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    s.type(s.last(), {
      name: 'Bar',
      x: 20,
      y: 55,
      width: 80,
      height: 10,
      fill: s.solid('#000000'),
    });
    s.g.selectAll();
    s.g.group();
    s.type(s.last(), { width: 60, height: 60 });
    s.g.cropCanvas('drawing');
    expect(s.doc().stage).toMatchObject({ width: 60, height: 60 });
    s.g.select([]);
    await s.exportTo('/exam/Electron_ZZ999_9999.png', { format: 'png' });

    // (b) The orbit: a dark green ring.
    await s.g.newImage({
      name: 'Orbit',
      size: { width: 500, height: 500, units: 'px', dpi: 96 },
      background: 'none',
    });
    s.g.addShape('ellipse', { x: 10, y: 10, width: 480, height: 480 });
    s.type(s.last(), {
      name: 'Orbit',
      fill: { kind: 'none' },
      stroke: { colour: '#006400', width: 6, dash: 'solid' },
    });
    await s.exportTo('/exam/Orbit_ZZ999_9999.png', { format: 'png' });

    // (c) The carbon atom from the saved pictures: 6 protons, 6 neutrons, the orbit, 6 electrons.
    await s.g.newImage({
      name: 'CarbonStructure',
      size: { width: 800, height: 800, units: 'px', dpi: 96 },
      background: '#ffffff',
    });
    const place = async (file: string, x: number, y: number) => {
      s.dialogs.openPicture.mockResolvedValueOnce(file);
      await s.g.addPicture({ x, y });
    };
    await place('/exam/Orbit_ZZ999_9999.png', 150, 150);
    for (let i = 0; i < 6; i++) {
      await place('/exam/Proton_ZZ999_9999.png', 280 + (i % 3) * 40, 300 + Math.floor(i / 3) * 80);
      await place('/exam/Neutron_ZZ999_9999.png', 300 + (i % 3) * 40, 340 + Math.floor(i / 3) * 80);
    }
    for (let i = 0; i < 6; i++) {
      const turn = (i * Math.PI) / 3;
      await place(
        '/exam/Electron_ZZ999_9999.png',
        370 + 240 * Math.cos(turn),
        370 + 240 * Math.sin(turn),
      );
    }
    expect(s.objects().filter((o) => o.kind === 'picture')).toHaveLength(19);
    expect(s.doc().pictures).toHaveLength(4); // each file once, however often it is placed
    s.g.select([]);
    await s.exportTo('/exam/CarbonStructure_ZZ999_9999.png', { format: 'png' });
    expect(pngDpi(s.bytes.get('/exam/CarbonStructure_ZZ999_9999.png')!)).toEqual({ x: 96, y: 96 });
  });
});

describe('9626/04 J/17 Question 1(a) and M/22 Task 1: logos for the web and for print', () => {
  it('J/17 HUNGRY: 200 × 200 pixels, in a compressed format for a website', async () => {
    const s = await graphics();
    await s.g.newImage({
      name: 'Hungry_logo',
      size: { width: 200, height: 200, units: 'px', dpi: 96 },
      background: '#ffffff',
    });
    s.g.addShape('ellipse', { x: 10, y: 10, width: 180, height: 180 });
    s.g.select([]);
    // PNG compresses without loss: sharp edges and text, as a logo needs.
    await s.exportTo('/exam/Hungry_logo_ZZ999_9999.png', { format: 'png' });
    expect(s.dialogs.exportGraphic).toHaveBeenLastCalledWith('Hungry_logo_ZZ999_9999', 'png');
    expect(s.stageRenderer.renderPng.mock.calls.at(-1)![0].stage).toMatchObject({
      width: 200,
      height: 200,
    });
  });

  it('M/22 Heron: one image as a 10 cm × 10 cm SVG and a 200 × 200 px bitmap with a transparent inside', async () => {
    const s = await graphics();
    await s.g.newImage({
      name: 'HeronV10cm',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: 'none',
    });
    s.g.addShape('ellipse', { x: 100, y: 200, width: 981, height: 700 });
    s.type(s.last(), { fill: s.solid('#ff0000') });
    s.g.select([]);
    await s.exportTo('/exam/HeronV10cm_ZZ999_9999.svg', { format: 'svg' });
    expect(s.disk.get('/exam/HeronV10cm_ZZ999_9999.svg')).toMatch(/width="10cm" height="10cm"/);
    await s.exportTo('/exam/HeronV200px_ZZ999_9999.png', {
      format: 'png',
      size: { by: 'width', px: 200 },
    });
    const [drawn, , size] = s.stageRenderer.renderPng.mock.calls.at(-1)!;
    expect(size).toEqual({ width: 200, height: 200 });
    expect(drawn.stage.background).toBe('none');
  });
});
