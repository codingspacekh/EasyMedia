// M16 / AN5 and P2: pictures in Animation mode — the picture dialog (PNG, JPG, GIF, BMP, SVG),
// pictures checked again when an animation is opened (so they can be shown), and Package
// Animation, which copies the animation and its pictures into one folder.
import { describe, expect, it } from 'vitest';
import { deserializeAnimation } from '../../../src/core/animation/serialize.ts';
import type { Pixels } from '../../../src/core/animation/trace.ts';
import type { GroupObject } from '../../../src/core/animation/types.ts';
import { TRACE_MAX_SIDE, TRACE_PREVIEW_SIDE } from '../../../src/app/animation.ts';
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

describe('copy and paste with pictures (AN5, AN6)', () => {
  /** A group of the two pictures, copied, then a new animation. */
  async function copied() {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    s.dialogs.openPicture.mockResolvedValueOnce('/m/star.svg');
    await s.anim.addPicture({ x: 50, y: 0 });
    s.anim.selectAll();
    s.anim.group();
    s.anim.copy();
    await s.anim.newAnimation();
    return s;
  }
  const pictureIdsIn = (o: GroupObject) =>
    o.children.map((c) => (c.kind === 'picture' ? c.pictureId : ''));

  it('AN5 pasted into another animation, the pictures come too and are drawn (the 9626 exam trial)', async () => {
    const s = await copied();
    expect(s.doc().pictures).toEqual([]);
    s.anim.paste();
    const group = s.objects()[0] as GroupObject;
    expect(s.doc().pictures.map((p) => p.path)).toEqual(['/m/photo.jpg', '/m/star.svg']);
    const known = new Set(s.doc().pictures.map((p) => p.id));
    expect(pictureIdsIn(group).every((id) => known.has(id))).toBe(true);
    s.anim.paste(); // a second paste adds no second copy of each picture
    expect(s.doc().pictures).toHaveLength(2);
  });

  it('AN5 a picture the animation already has is used again, not added twice', async () => {
    const s = await copied();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    const own = s.doc().pictures[0]!.id;
    s.anim.paste();
    expect(s.doc().pictures.map((p) => p.path)).toEqual(['/m/photo.jpg', '/m/star.svg']);
    const group = s.objects().find((o) => o.kind === 'group') as GroupObject;
    expect(pictureIdsIn(group)[0]).toBe(own);
  });

  it('AN14 a stop motion keeps every picture it changes to', async () => {
    const s = setup();
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    s.dialogs.openPicture.mockResolvedValueOnce('/n/photo.jpg');
    await s.anim.addPicture({ x: 0, y: 0 });
    const [first, second] = s.doc().pictures;
    // The first picture object changes to the second picture at frame 10.
    const id = s.objects()[0]!.id;
    s.anim.store.update((st) => ({
      ...st,
      history: {
        ...st.history,
        present: {
          ...st.history.present,
          layers: st.history.present.layers.map((l) => ({
            ...l,
            objects: l.objects
              .filter((o) => o.id === id)
              .map((o) => ({
                ...o,
                tracks: [
                  {
                    property: 'picture' as const,
                    keyframes: [
                      { frame: 0, value: first!.id, easing: 'linear' as const, hold: true },
                      { frame: 10, value: second!.id, easing: 'linear' as const, hold: true },
                    ],
                  },
                ],
              })),
          })),
        },
      },
    }));
    s.anim.select([id]);
    s.anim.copy();
    await s.anim.newAnimation();
    s.anim.paste();
    const pasted = s.objects()[0]!;
    const ids = new Set(s.doc().pictures.map((p) => p.id));
    expect(s.doc().pictures.map((p) => p.path)).toEqual(['/m/photo.jpg', '/n/photo.jpg']);
    expect(pasted.tracks![0]!.keyframes.every((k) => ids.has(String(k.value)))).toBe(true);
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

describe('Trace bitmap (AN5)', () => {
  /** A red square (20–60) on white, 80 × 80, as the canvas reads it. */
  const square: Pixels = (() => {
    const data = new Uint8ClampedArray(80 * 80 * 4);
    for (let i = 0; i < 80 * 80; i++) {
      const [x, y] = [i % 80, Math.floor(i / 80)];
      data.set(
        x >= 20 && x < 60 && y >= 20 && y < 60 ? [230, 20, 30, 255] : [255, 255, 255, 255],
        i * 4,
      );
    }
    return { width: 80, height: 80, data };
  })();
  const options = { colours: 2, detail: 60, smoothing: 0 };

  async function withPicture() {
    const s = setup();
    s.stageRenderer.pixels.mockResolvedValue(square);
    s.dialogs.openPicture.mockResolvedValueOnce('/m/photo.jpg');
    await s.anim.addPicture({ x: 10, y: 20 });
    return s;
  }

  it('AN5 the selected picture becomes a group of filled shapes in its place, selected; one undo brings it back', async () => {
    const s = await withPicture();
    await s.anim.traceBitmap(options);
    expect(s.stageRenderer.pixels).toHaveBeenCalledWith('/m/photo.jpg', TRACE_MAX_SIDE);
    const group = s.objects()[0] as GroupObject;
    expect(group).toMatchObject({
      kind: 'group',
      name: 'Traced photo.jpg',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    });
    expect(group.children.map((c) => (c.fill.kind === 'solid' ? c.fill.colour : ''))).toEqual([
      '#ffffff',
      '#e6141e',
    ]);
    // The 80 px picture is shown at 100 px: the square's corner at 20 px is at 25.
    expect(group.children[1]).toMatchObject({ x: 25, y: 25, width: 50, height: 50 });
    expect(s.state().selection).toEqual([group.id]);
    s.anim.undo();
    expect(s.objects()[0]).toMatchObject({ kind: 'picture' });
  });

  it('AN5 the preview traces a small copy and does not change the animation', async () => {
    const s = await withPicture();
    const before = s.doc();
    const preview = await s.anim.tracePreview(options);
    expect(s.stageRenderer.pixels).toHaveBeenCalledWith('/m/photo.jpg', TRACE_PREVIEW_SIDE);
    expect(preview).toMatchObject({ width: 80, height: 80 });
    expect(preview!.regions).toHaveLength(2);
    expect(s.doc()).toBe(before);
  });

  it('AN5 only a picture can be traced; a see-through picture or one that cannot be read says so', async () => {
    const s = await withPicture();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await s.anim.traceBitmap(options);
    expect(s.state().message).toMatchObject({
      kind: 'error',
      text: expect.stringMatching(/picture/i),
    });
    expect(await s.anim.tracePreview(options)).toBeNull();

    s.anim.select([s.objects()[0]!.id]);
    s.stageRenderer.pixels.mockResolvedValueOnce({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(16),
    });
    await s.anim.traceBitmap(options);
    expect(s.state().message?.text).toMatch(/see-through/);
    s.stageRenderer.pixels.mockRejectedValueOnce(new MediaError('This picture could not be read.'));
    await s.anim.traceBitmap(options);
    expect(s.state().message?.text).toMatch(/could not be read/);
    expect(s.objects()[0]).toMatchObject({ kind: 'picture' });
  });
});
