// AN5 Crop… and Make a colour see-through… on a picture in Animation mode (9626/04 O/N/19: the
// pearl cut from a photo, on a transparent background): each saves a new picture beside the old
// one and the selected object shows it, one undo step.
import { describe, expect, it } from 'vitest';
import type { PictureObject } from '../../../src/core/animation/types.ts';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { IMAGE, testApp } from '../../helpers/test-app.ts';

const SVG: ProbeInfo = {
  kind: 'image',
  container: 'svg',
  sizeBytes: 300,
  video: { codec: 'svg', width: 135, height: 120 },
};

async function withPicture(path = '/m/photo.jpg') {
  const t = testApp({ '/m/photo.jpg': IMAGE, '/m/star.svg': SVG });
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const picture = () => doc().layers.flatMap((l) => l.objects)[0] as PictureObject;
  t.dialogs.openPicture.mockResolvedValueOnce(path);
  await anim.addPicture({ x: 0, y: 0 });
  return { ...t, anim, doc, picture, message: () => anim.store.get().message };
}

describe('AN5 Crop… a picture in Animation mode', () => {
  it('saves the part beside the picture and the object shows it where it was (one undo step)', async () => {
    const s = await withPicture();
    expect(s.anim.selectedPictureFile()).toMatchObject({ path: '/m/photo.jpg', width: 100 });
    const before = s.picture();
    await s.anim.cropPicture({ x: 10, y: 20, width: 50, height: 40 });
    const made = s.doc().pictures.at(-1)!;
    expect(made).toMatchObject({ path: '/m/photo1.jpg', width: 50, height: 40 });
    expect(s.picture()).toMatchObject({ pictureId: made.id, x: 10, y: 20, width: 50, height: 40 });
    expect(s.message()).toEqual({ kind: 'info', text: 'Saved photo1.jpg beside photo.jpg.' });
    s.anim.undo();
    expect(s.picture()).toEqual(before);
  });

  it('a name typed for the new picture is used (never overwriting)', async () => {
    const s = await withPicture();
    await s.anim.cropPicture({ x: 0, y: 0, width: 10, height: 10 }, 'pearl');
    expect(s.doc().pictures.at(-1)!.path).toBe('/m/pearl.jpg');
  });

  it('with nothing or not a picture selected, or an SVG, it explains', async () => {
    const s = await withPicture('/m/star.svg');
    await s.anim.cropPicture({ x: 0, y: 0, width: 10, height: 10 });
    expect(s.message()).toEqual({
      kind: 'error',
      text: 'Only a PNG, JPG, GIF or BMP picture can be cropped, not an SVG.',
    });
    s.anim.select([]);
    expect(s.anim.selectedPictureFile()).toBeNull();
    await s.anim.cropPicture({ x: 0, y: 0, width: 10, height: 10 });
    expect(s.message()).toEqual({ kind: 'error', text: 'Select a picture to crop it.' });
  });
});

describe('AN5 Make a colour see-through… in Animation mode', () => {
  it('saves a see-through PNG beside the picture and the object shows it, the same size', async () => {
    const s = await withPicture();
    const before = s.picture();
    await s.anim.seeThroughPicture({ colour: '#ffffff', tolerance: 20, soft: true });
    const made = s.doc().pictures.at(-1)!;
    expect(made).toMatchObject({ path: '/m/photo1.png', width: 100, height: 100 });
    expect(s.picture()).toEqual({ ...before, pictureId: made.id });
    expect(s.message()).toEqual({ kind: 'info', text: 'Saved photo1.png beside photo.jpg.' });
    await s.anim.seeThroughPicture({ colour: '#ffffff', tolerance: 20, soft: true }, 'pearl');
    expect(s.doc().pictures.at(-1)!.path).toBe('/m/pearl.png');
    s.anim.undo();
    s.anim.undo();
    expect(s.picture()).toEqual(before);
  });

  it('a colour not picked is explained; the preview reads the picture’s pixels', async () => {
    const s = await withPicture();
    await s.anim.seeThroughPicture({ colour: '', tolerance: 20, soft: false });
    expect(s.message()).toEqual({
      kind: 'error',
      text: 'Pick the colour to make see-through: click it in the picture.',
    });
    expect(await s.anim.picturePixels(240)).toMatchObject({ width: 1, height: 1 });
    expect(s.stageRenderer.pixels).toHaveBeenCalledWith('/m/photo.jpg', 240);
  });
});
