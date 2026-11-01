// M16 / AN5 and P2: pictures in Animation mode — the picture dialog (PNG, JPG, GIF, BMP, SVG),
// pictures checked again when an animation is opened (so they can be shown), and Package
// Animation, which copies the animation and its pictures into one folder.
import { describe, expect, it } from 'vitest';
import { deserializeAnimation } from '../../../src/core/animation/serialize.ts';
import { MediaError } from '../../../src/core/model/errors.ts';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { IMAGE, testApp } from '../../helpers/test-app.ts';

const SVG: ProbeInfo = {
  kind: 'image',
  container: 'svg',
  sizeBytes: 300,
  video: { codec: 'svg', width: 135, height: 120 },
};
const GIF: ProbeInfo = {
  kind: 'video',
  container: 'gif',
  sizeBytes: 900,
  duration: 0.2,
  video: { codec: 'gif', width: 40, height: 30 },
};

function setup() {
  const t = testApp({
    '/m/photo.jpg': IMAGE,
    '/m/star.svg': SVG,
    '/m/wave.gif': GIF,
    '/n/photo.jpg': IMAGE,
  });
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const objects = () => doc().layers.flatMap((l) => l.objects);
  return { ...t, anim, doc, objects, state: () => anim.store.get() };
}

describe('the picture dialog (AN5)', () => {
  it('AN5 an SVG picture is placed at the size written in the file', async () => {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/star.svg');
    await s.anim.addPicture({ x: 128, y: 102 });
    expect(s.dialogs.openMedia).not.toHaveBeenCalled();
    expect(s.doc().pictures[0]).toMatchObject({ path: '/m/star.svg', width: 135, height: 120 });
    expect(s.objects()[0]).toMatchObject({
      kind: 'picture',
      name: 'star.svg',
      width: 135,
      height: 120,
    });
  });

  it('AN5 a GIF is a picture too (FFmpeg calls it a video), shown at its own size', async () => {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/wave.gif');
    await s.anim.addPicture({ x: 0, y: 0 });
    expect(s.objects()[0]).toMatchObject({ kind: 'picture', width: 40, height: 30 });
  });
});

describe('opening an animation with pictures (AN5, AN16)', () => {
  async function saved() {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    s.dialogs.openPicture.mockResolvedValueOnce('/m/star.svg');
    await s.anim.addPicture({ x: 0, y: 0 });
    s.dialogs.saveAnimation.mockResolvedValueOnce('/m/Task6.mvea');
    await s.anim.saveAs();
    await s.anim.newAnimation();
    return s;
  }

  it('AN5 every picture is checked again before the animation is shown, so it can be drawn', async () => {
    const s = await saved();
    const probed: string[] = [];
    const probe = s.engine.probe.bind(s.engine);
    s.engine.probe = async (path: string) => (probed.push(path), probe(path));
    s.dialogs.openAnimation.mockResolvedValueOnce('/m/Task6.mvea');
    await s.anim.open();
    expect(probed.sort()).toEqual(['/m/photo.jpg', '/m/star.svg']);
    expect(s.objects()).toHaveLength(2);
    expect(s.state().message).toBeNull();
  });

  it('AN5 a picture that has gone is named, and the animation still opens', async () => {
    const s = await saved();
    s.disk.set('/m/Moved.mvea', s.disk.get('/m/Task6.mvea')!.replaceAll('star.svg', 'gone.svg'));
    s.dialogs.openAnimation.mockResolvedValueOnce('/m/Moved.mvea');
    await s.anim.open();
    expect(s.state().path).toBe('/m/Moved.mvea');
    expect(s.objects()).toHaveLength(2);
    expect(s.state().message).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('gone.svg'),
    });
  });
});

describe('Package Animation (P2, AN5)', () => {
  it('P2 copies every picture into a pictures folder and saves the animation beside it', async () => {
    const s = setup();
    for (const path of ['/m/photo.jpg', '/n/photo.jpg', '/m/star.svg']) {
      s.dialogs.openPicture.mockResolvedValueOnce(path);
      await s.anim.addPicture({ x: 0, y: 0 });
    }
    s.dialogs.saveAnimation.mockResolvedValueOnce('/m/Star Designs.mvea');
    await s.anim.saveAs();
    s.dialogs.chooseFolder.mockResolvedValueOnce('/usb/hand-in');
    await s.anim.packageAnimation();
    expect(s.copies).toEqual([
      ['/m/photo.jpg', '/usb/hand-in/pictures/photo.jpg'],
      ['/n/photo.jpg', '/usb/hand-in/pictures/photo-2.jpg'],
      ['/m/star.svg', '/usb/hand-in/pictures/star.svg'],
    ]);
    const packed = deserializeAnimation(s.disk.get('/usb/hand-in/Star Designs.mvea')!);
    expect(packed.pictures.map((p) => p.path)).toEqual([
      'pictures/photo.jpg',
      'pictures/photo-2.jpg',
      'pictures/star.svg',
    ]);
    expect(packed.layers).toEqual(s.doc().layers);
    // The animation being edited is still the one on the computer, unchanged.
    expect(s.state().path).toBe('/m/Star Designs.mvea');
    expect(s.anim.isDirty()).toBe(false);
    expect(s.state().message).toMatchObject({
      kind: 'info',
      text: expect.stringContaining('/usb/hand-in'),
    });
  });

  it('P2 an untitled animation is packaged under its name; a cancelled folder does nothing', async () => {
    const s = setup();
    await s.anim.packageAnimation();
    expect(s.disk.size).toBe(0);
    s.dialogs.chooseFolder.mockResolvedValueOnce('/usb');
    await s.anim.packageAnimation();
    expect([...s.disk.keys()]).toEqual(['/usb/Untitled.mvea']);
    expect(s.copies).toEqual([]);
  });

  it('P2 a picture that cannot be copied stops the packaging with a message', async () => {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    s.copies.push = () => {
      throw new MediaError('The disk is full.');
    };
    s.dialogs.chooseFolder.mockResolvedValueOnce('/usb');
    await s.anim.packageAnimation();
    expect(s.state().message).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('disk is full'),
    });
    expect(s.disk.has('/usb/Untitled.mvea')).toBe(false);
  });
});
