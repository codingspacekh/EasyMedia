// M16 / AN14: stop motion (*Import frames…*: a folder of pictures becomes a picture showing them in
// turn on a layer of its own) and frame-by-frame layers (*Insert blank keyframe*, *Duplicate frame*,
// onion skin) as Animation mode's use cases: each change is one undo step.
import { describe, expect, it } from 'vitest';
import { trackOf } from '../../../src/core/animation/tween.ts';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { testApp } from '../../helpers/test-app.ts';

const shot: ProbeInfo = {
  kind: 'image',
  container: 'jpg',
  sizeBytes: 50_000,
  video: { codec: 'mjpeg', width: 640, height: 480 },
};

/** frame1.jpg … frame24.jpg, listed by the folder in the wrong order (frame10 before frame2). */
const SHOTS = Array.from({ length: 24 }, (_, i) => `/clay/frame${i + 1}.jpg`).sort();

function setup() {
  const media: Record<string, ProbeInfo> = Object.fromEntries(SHOTS.map((p) => [p, shot]));
  media['/clay/notes.mp4'] = {
    kind: 'video',
    container: 'mp4',
    sizeBytes: 1,
    duration: 1,
    video: { codec: 'h264', width: 10, height: 10 },
  };
  const t = testApp(media);
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const layer = () => doc().layers.find((l) => l.id === anim.store.get().layerId)!;
  return { ...t, anim, doc, layer, state: () => anim.store.get() };
}

describe('Import frames (AN14 stop motion)', () => {
  it('24 pictures at 12 fps make a 2 s stop motion on a layer of its own, in one undo step', async () => {
    const s = setup();
    s.anim.setStage({ ...s.doc().stage, width: 640, height: 480, fps: 24, length: 24 });
    const layersBefore = s.doc().layers.length;
    s.dialogs.openFrames.mockResolvedValueOnce(SHOTS);
    await s.anim.importFrames(12);
    expect(s.doc().layers).toHaveLength(layersBefore + 1);
    expect(s.layer().name).toBe('Stop motion');
    const [object] = s.layer().objects;
    expect(object).toMatchObject({ kind: 'picture', x: 0, y: 0, width: 640, height: 480 });
    const keys = trackOf(object!, 'picture')!.keyframes;
    expect(keys).toHaveLength(24);
    // Sorted by name as people read it: frame1, frame2 … frame10.
    const pathOf = (id: unknown) => s.doc().pictures.find((p) => p.id === id)!.path;
    expect(keys.slice(0, 3).map((k) => pathOf(k.value))).toEqual([
      '/clay/frame1.jpg',
      '/clay/frame2.jpg',
      '/clay/frame3.jpg',
    ]);
    expect(keys.at(-1)!.frame).toBe(46);
    // The stage was 1 s: it is lengthened to fit the 2 s.
    expect(s.doc().stage.length).toBe(48);
    expect(s.state().selection).toEqual([object!.id]);
    expect(s.state().message?.text).toMatch(/24 pictures.*2 s/);
    s.anim.undo();
    expect(s.doc().layers).toHaveLength(layersBefore);
    expect(s.doc().pictures).toEqual([]);
    expect(s.doc().stage.length).toBe(24);
  });

  it('a longer stage keeps its length', async () => {
    const s = setup();
    s.dialogs.openFrames.mockResolvedValueOnce(SHOTS.slice(0, 4));
    await s.anim.importFrames(12);
    expect(s.doc().stage.length).toBe(120);
  });

  it('leaves out files that are not pictures, and says when there are none', async () => {
    const s = setup();
    s.dialogs.openFrames.mockResolvedValueOnce([...SHOTS.slice(0, 2), '/clay/notes.mp4']);
    await s.anim.importFrames(12);
    expect(trackOf(s.layer().objects[0]!, 'picture')!.keyframes).toHaveLength(2);
    s.dialogs.openFrames.mockResolvedValueOnce(['/clay/notes.mp4']);
    const before = s.doc();
    await s.anim.importFrames(12);
    expect(s.doc()).toBe(before);
    expect(s.state().message).toMatchObject({ kind: 'error', text: /no pictures/i });
  });

  it('does nothing when the dialog is cancelled, and refuses a rate above the stage fps', async () => {
    const s = setup();
    const before = s.doc();
    await s.anim.importFrames(12);
    expect(s.doc()).toBe(before);
    s.dialogs.openFrames.mockResolvedValueOnce(SHOTS);
    await s.anim.importFrames(60);
    expect(s.doc()).toBe(before);
    expect(s.state().message?.text).toMatch(/between 1 and 24/);
  });
});

describe('frame-by-frame layers (AN14)', () => {
  it('a layer becomes frame-by-frame; new drawings start at the playhead', () => {
    const s = setup();
    s.anim.addShape('ellipse', { x: 10, y: 10, width: 40, height: 40 });
    expect(s.anim.makeFrameByFrame()).toBeNull();
    expect(s.layer().drawings).toEqual([0]);
    s.anim.setFrame(6);
    expect(s.anim.insertDrawing('blank')).toBeNull();
    expect(s.layer().drawings).toEqual([0, 6]);
    // The circle belongs to the first drawing: it is not shown, nor selected, at frame 6.
    expect(s.state().selection).toEqual([]);
    s.anim.selectAll();
    expect(s.state().selection).toEqual([]);
    s.anim.addShape('rect', { x: 100, y: 10, width: 40, height: 40 });
    expect(s.layer().objects.at(-1)!.drawing).toBe(6);
    s.anim.setFrame(2);
    s.anim.selectAll();
    expect(s.state().selection).toEqual([s.layer().objects[0]!.id]);
  });

  it('Duplicate frame copies the drawing shown to the playhead, to change it a little', () => {
    const s = setup();
    s.anim.addShape('ellipse', { x: 10, y: 10, width: 40, height: 40 });
    s.anim.makeFrameByFrame();
    s.anim.setFrame(3);
    expect(s.anim.insertDrawing('copy')).toBeNull();
    const copy = s.layer().objects.at(-1)!;
    expect(copy).toMatchObject({ kind: 'ellipse', drawing: 3, x: 10 });
    expect(s.state().selection).toEqual([copy.id]);
    s.anim.moveSelection(5, 0);
    expect(s.layer().objects.map((o) => o.x)).toEqual([10, 15]);
    expect(s.anim.insertDrawing('copy')).toMatch(/already a keyframe on frame 3/);
    s.anim.undo();
    s.anim.undo();
    expect(s.layer().drawings).toEqual([0]);
  });

  it('Remove keyframe takes the drawing away; the playhead must be on a keyframe', () => {
    const s = setup();
    s.anim.addShape('ellipse', { x: 10, y: 10, width: 40, height: 40 });
    s.anim.makeFrameByFrame();
    s.anim.setFrame(4);
    s.anim.insertDrawing('copy');
    expect(s.anim.removeDrawing()).toBeNull();
    expect(s.layer().drawings).toEqual([0]);
    expect(s.layer().objects).toHaveLength(1);
    s.anim.setFrame(2);
    expect(s.anim.removeDrawing()).toMatch(/no keyframe on frame 2/);
  });

  it('keyframes need a frame-by-frame layer, and pasted objects join the drawing shown', () => {
    const s = setup();
    expect(s.anim.insertDrawing('blank')).toMatch(/not a frame-by-frame layer/);
    s.anim.addShape('rect', { x: 0, y: 0, width: 20, height: 20 });
    s.anim.copy();
    s.anim.makeFrameByFrame();
    s.anim.setFrame(5);
    s.anim.insertDrawing('blank');
    s.anim.paste();
    expect(s.layer().objects.at(-1)!.drawing).toBe(5);
  });

  it('onion skin is a view setting, off at first', () => {
    const s = setup();
    expect(s.state().onionSkin).toBe(false);
    s.anim.setOnionSkin(true);
    expect(s.state().onionSkin).toBe(true);
    expect(s.anim.isDirty()).toBe(false);
  });
});
