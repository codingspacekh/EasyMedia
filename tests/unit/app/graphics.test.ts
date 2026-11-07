// M18: Graphics mode's app — a new image in the papers' sizes, its own .mveg file, the canvas
// settings and crop, align and distribute, PNG / JPG / SVG export with the resolution in the
// file (of the whole image, the selection, or each part in its own file), and Send to Animation.
import { describe, expect, it } from 'vitest';
import { IMAGE_PRESETS } from '../../../src/core/graphics/document.ts';
import { jpegDpi, pngDpi } from '../../../src/core/image/dpi.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const g = t.app.graphics;
  const doc = () => g.store.get().history.present;
  const objects = () => doc().layers.flatMap((l) => l.objects);
  const message = () => g.store.get().message?.text ?? '';
  return { ...t, g, doc, objects, message };
}

describe('a new image (G1)', () => {
  it('starts as an untitled 1280 × 720 px screen image, kept apart from the animation', () => {
    const s = setup();
    expect(s.doc().graphic).toEqual({ dpi: 96, units: 'px' });
    expect(s.doc().stage).toMatchObject({ width: 1280, height: 720, length: 1 });
    s.g.addShape('rect', { x: 10, y: 10, width: 50, height: 50 });
    expect(s.objects()).toHaveLength(1);
    expect(s.app.animation.store.get().history.present.layers[0]!.objects).toHaveLength(0);
    expect(s.g.kind.extension).toBe('mveg');
  });

  it('is made in a chosen size, resolution and background (9626/04 M/J/18: A4)', async () => {
    const s = setup();
    const a4 = IMAGE_PRESETS.find((p) => p.name === 'A4 portrait')!;
    expect(await s.g.newImage({ name: 'TTS10', size: a4, background: 'none' })).toBeNull();
    expect(s.doc().stage).toMatchObject({ width: 2480, height: 3508, background: 'none' });
    expect(s.doc().graphic).toEqual({ dpi: 300, units: 'cm' });
  });

  it('says why a size cannot be made, and keeps the image there was', async () => {
    const s = setup();
    const error = await s.g.newImage({
      name: 'Huge',
      size: { width: 100, height: 100, units: 'cm', dpi: 300 },
      background: '#ffffff',
    });
    expect(error).toMatch(/8192/);
    expect(s.doc().stage.width).toBe(1280);
  });

  it('asks before throwing away unsaved work', async () => {
    const s = setup();
    s.g.addShape('rect', { x: 10, y: 10, width: 50, height: 50 });
    s.dialogs.confirm.mockResolvedValueOnce(false);
    await s.g.newImage({ name: 'B', size: IMAGE_PRESETS[4]!, background: '#ffffff' });
    expect(s.dialogs.confirm).toHaveBeenCalledWith(expect.stringMatching(/unsaved image work/));
    expect(s.objects()).toHaveLength(1);
  });
});

describe('the image file (G1)', () => {
  it('is saved as .mveg and opened again with its resolution and units', async () => {
    const s = setup();
    await s.g.newImage({
      name: 'Heron',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: '#ffffff',
    });
    s.g.addShape('ellipse', { x: 100, y: 100, width: 900, height: 700 });
    s.dialogs.saveGraphic.mockResolvedValueOnce('/work/HeronV10cm.mveg');
    await s.g.saveAs();
    expect(s.dialogs.saveGraphic).toHaveBeenCalledWith('Heron');
    expect(s.disk.has('/work/HeronV10cm.mveg')).toBe(true);
    expect(s.g.isDirty()).toBe(false);
    await s.g.newAnimation();
    s.dialogs.openGraphic.mockResolvedValueOnce('/work/HeronV10cm.mveg');
    await s.g.open();
    expect(s.doc().graphic).toEqual({ dpi: 300, units: 'cm' });
    expect(s.objects()).toHaveLength(1);
  });

  it('marks a change of resolution or units as unsaved work', async () => {
    const s = setup();
    s.dialogs.saveGraphic.mockResolvedValueOnce('/work/Logo.mveg');
    await s.g.saveAs();
    expect(s.g.setImage({ dpi: 300 })).toBeNull();
    expect(s.g.isDirty()).toBe(true);
  });
});

describe('the canvas (G1, G8)', () => {
  it('changes size, resolution and background in one undo step, or says why not', () => {
    const s = setup();
    expect(s.g.setImage({ width: 200, height: 200, background: 'none' })).toBeNull();
    expect(s.doc().stage).toMatchObject({ width: 200, height: 200, background: 'none' });
    expect(s.g.setImage({ dpi: 5 })).toMatch(/10 to 1200/);
    s.g.undo();
    expect(s.doc().stage.width).toBe(1280);
  });

  it('crops to the drawing, or to the selection (9626/04 O/N/19: no white space round it)', () => {
    const s = setup();
    s.g.addShape('rect', { x: 100, y: 80, width: 50, height: 40 });
    const first = s.objects()[0]!.id;
    s.g.addShape('ellipse', { x: 300, y: 200, width: 60, height: 60 });
    s.g.select([]);
    s.g.cropCanvas('drawing');
    expect(s.doc().stage).toMatchObject({ width: 260, height: 180 });
    expect(s.objects()[0]).toMatchObject({ x: 0, y: 0 });
    s.g.select([first]);
    s.g.cropCanvas('selection');
    expect(s.doc().stage).toMatchObject({ width: 50, height: 40 });
  });

  it('says when there is nothing to crop to', () => {
    const s = setup();
    s.g.cropCanvas('selection');
    expect(s.message()).toMatch(/Select what to crop/);
    s.g.cropCanvas('drawing');
    expect(s.message()).toMatch(/nothing drawn/);
  });
});

describe('align and distribute (G5)', () => {
  it('lines up the selection, and centres one object on the canvas', () => {
    const s = setup();
    s.g.addShape('rect', { x: 10, y: 10, width: 40, height: 40 });
    s.g.addShape('rect', { x: 200, y: 100, width: 20, height: 20 });
    const ids = s.objects().map((o) => o.id);
    s.g.select(ids);
    s.g.align('top', 'selection');
    expect(s.objects().map((o) => o.y)).toEqual([10, 10]);
    s.g.undo();
    s.g.select([ids[0]!]);
    s.g.align('centre', 'selection');
    expect(s.objects()[0]!.x).toBe(620);
  });

  it('works in Animation mode too, keyed at the playhead', () => {
    const t = testApp();
    const a = t.app.animation;
    a.addShape('rect', { x: 10, y: 10, width: 40, height: 40 });
    a.addShape('rect', { x: 200, y: 100, width: 20, height: 20 });
    const objects = () => a.store.get().history.present.layers[0]!.objects;
    a.select(objects().map((o) => o.id));
    a.setFrame(24);
    a.align('left', 'first');
    expect(a.objectAtPlayhead(objects()[1]!.id)!.x).toBe(10);
    a.setFrame(0);
    expect(a.objectAtPlayhead(objects()[1]!.id)!.x).toBe(200);
  });

  it('distributes three or more, or says it needs three', () => {
    const s = setup();
    for (const x of [0, 30, 200]) s.g.addShape('rect', { x, y: 0, width: 20, height: 20 });
    s.g.select(
      s
        .objects()
        .slice(0, 2)
        .map((o) => o.id),
    );
    s.g.distribute('horizontal', 'centres');
    expect(s.message()).toMatch(/three or more/);
    s.g.select(s.objects().map((o) => o.id));
    s.g.distribute('horizontal', 'centres');
    expect(s.objects().map((o) => o.x)).toEqual([0, 100, 200]);
  });
});

describe('export (G10, G11)', () => {
  it('saves a PNG with its resolution inside, at another width (9626/04 J/20: 600 px)', async () => {
    const s = setup();
    s.g.setImage({ width: 800, height: 400, dpi: 300 });
    s.g.addShape('ellipse', { x: 0, y: 0, width: 400, height: 400 });
    s.dialogs.exportGraphic.mockResolvedValueOnce('/work/Meter1.png');
    expect(await s.g.exportImage({ format: 'png', size: { by: 'width', px: 600 } })).toEqual([
      '/work/Meter1.png',
    ]);
    expect(s.dialogs.exportGraphic).toHaveBeenCalledWith('Untitled', 'png');
    const [, , size] = s.stageRenderer.renderPng.mock.calls.at(-1)!;
    expect(size).toEqual({ width: 600, height: 300 });
    expect(pngDpi(s.bytes.get('/work/Meter1.png')!)).toEqual({ x: 300, y: 300 });
    expect(s.message()).toBe('Saved Meter1.png (600 × 300 px, 300 dpi).');
  });

  it('saves a JPG on a background colour at the quality chosen, its dpi inside', async () => {
    const s = setup();
    s.g.setImage({ background: 'none' });
    s.dialogs.exportGraphic.mockResolvedValueOnce('/work/Photo.jpg');
    await s.g.exportImage({ format: 'jpg', quality: 70, background: '#000000' });
    expect(s.stageRenderer.renderJpeg).toHaveBeenCalledWith(expect.anything(), {
      quality: 70,
      background: '#000000',
    });
    expect(jpegDpi(s.bytes.get('/work/Photo.jpg')!)).toEqual({ x: 96, y: 96 });
  });

  it('saves an SVG 10 cm square for a 10 cm logo (9626/04 M/22 HeronV10cm)', async () => {
    const s = setup();
    await s.g.newImage({
      name: 'Heron',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: '#ffffff',
    });
    s.g.addShape('ellipse', { x: 100, y: 100, width: 900, height: 700 });
    s.dialogs.exportGraphic.mockResolvedValueOnce('/work/HeronV10cm.svg');
    await s.g.exportImage({ format: 'svg' });
    const svg = s.disk.get('/work/HeronV10cm.svg')!;
    expect(svg).toMatch(/width="10cm" height="10cm" viewBox="0 0 1181 1181"/);
    expect(svg).toMatch(/<ellipse|<path/);
  });

  it('saves only the selection, cropped to it and see-through round it', async () => {
    const s = setup();
    s.g.addShape('rect', { x: 100, y: 100, width: 300, height: 200 });
    s.g.addShape('ellipse', { x: 700, y: 400, width: 50, height: 50 });
    s.g.select([s.objects()[0]!.id]);
    s.dialogs.exportGraphic.mockResolvedValueOnce('/work/Casing.png');
    await s.g.exportImage({ format: 'png', what: 'selection' });
    expect(s.dialogs.exportGraphic).toHaveBeenCalledWith('Rectangle', 'png');
    const [drawn] = s.stageRenderer.renderPng.mock.calls.at(-1)!;
    expect(drawn.stage).toMatchObject({ width: 300, height: 200, background: 'none' });
    expect(drawn.layers[0]!.objects).toHaveLength(1);
  });

  it('saves each selected part in a file of its own, named after it with the candidate details', async () => {
    const s = setup();
    await s.app.candidate.set({ centre: 'ZZ999', number: '9999', name: 'Ann' });
    s.g.addShape('rect', { x: 0, y: 0, width: 300, height: 200 });
    s.g.addShape('ellipse', { x: 400, y: 0, width: 60, height: 60 });
    const [casing, needle] = s.objects().map((o) => o.id);
    s.g.select([casing!]);
    s.g.setProperties({ name: 'Surround' });
    s.g.select([needle!]);
    s.g.setProperties({ name: 'Needle' });
    s.g.select([casing!, needle!]);
    s.dialogs.chooseFolder.mockResolvedValueOnce('/work/parts');
    const made = await s.g.exportImage({ format: 'svg', what: 'each' });
    expect(made).toEqual([
      '/work/parts/Surround_ZZ999_9999.svg',
      '/work/parts/Needle_ZZ999_9999.svg',
    ]);
    expect(s.disk.get('/work/parts/Needle_ZZ999_9999.svg')).toMatch(/width="60" height="60"/);
    expect(s.message()).toBe('Saved Surround_ZZ999_9999.svg, Needle_ZZ999_9999.svg.');
  });

  it('asks for a selection first, and checks sizes before any save box', async () => {
    const s = setup();
    expect(await s.g.exportImage({ format: 'png', what: 'each' })).toBeNull();
    expect(s.message()).toMatch(/Select the objects/);
    expect(await s.g.exportImage({ format: 'png', size: { by: 'width', px: 0 } })).toBeNull();
    expect(s.dialogs.exportGraphic).not.toHaveBeenCalled();
    expect(await s.g.exportImage({ format: 'jpg', quality: 0 })).toBeNull();
    expect(s.dialogs.exportGraphic).not.toHaveBeenCalled();
  });

  it('does nothing when the save box is closed', async () => {
    const s = setup();
    expect(await s.g.exportImage({ format: 'png' })).toBeNull();
    expect(s.stageRenderer.renderPng).not.toHaveBeenCalled();
  });
});

describe('Send to Animation (GL3)', () => {
  it('puts the selected objects into the animation where they were drawn, on a layer of their own', () => {
    const s = setup();
    s.g.addShape('star', { x: 40, y: 50, width: 100, height: 100 });
    s.g.addShape('rect', { x: 300, y: 50, width: 100, height: 100 });
    s.g.select([s.objects()[0]!.id]);
    expect(s.app.sendGraphicToAnimation()).toBe(true);
    const anim = s.app.animation.store.get();
    const layer = anim.history.present.layers.at(-1)!;
    expect(layer.name).toBe('Untitled');
    expect(layer.objects).toHaveLength(1);
    expect(layer.objects[0]).toMatchObject({ kind: 'star', x: 40, y: 50 });
    expect(layer.objects[0]!.id).not.toBe(s.objects()[0]!.id);
    expect(anim.selection).toEqual([layer.objects[0]!.id]);
    expect(anim.message?.text).toMatch(/One object from Untitled/);
  });

  it('sends everything when nothing is selected, and says when there is nothing', () => {
    const s = setup();
    expect(s.app.sendGraphicToAnimation()).toBe(false);
    expect(s.message()).toMatch(/nothing drawn/);
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    s.g.addShape('rect', { x: 20, y: 0, width: 10, height: 10 });
    s.g.select([]);
    s.app.sendGraphicToAnimation();
    s.app.sendGraphicToAnimation();
    const layers = s.app.animation.store.get().history.present.layers;
    expect(layers.map((l) => l.name)).toEqual(['Layer 1', 'Untitled', 'Untitled 2']);
    expect(layers[1]!.objects).toHaveLength(2);
  });

  it('copies in Graphics mode paste in Animation mode (one clipboard)', () => {
    const s = setup();
    s.g.addShape('ellipse', { x: 0, y: 0, width: 10, height: 10 });
    s.g.copy();
    s.app.animation.paste();
    expect(s.app.animation.store.get().history.present.layers[0]!.objects[0]!.kind).toBe('ellipse');
  });
});
