// M16 / AN14: stop motion (a folder of pictures shown one after another, each held for its
// frames) and frame-by-frame layers (every keyframe holds its own drawing), with onion skin.
import { describe, expect, it } from 'vitest';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createEllipse,
  createRect,
} from '../../../../src/core/animation/factory.ts';
import {
  addDrawing,
  drawingAt,
  stopMotionTiming,
  isFrameByFrame,
  onionSkin,
  removeDrawing,
  sortByName,
  stopMotion,
  toFrameByFrame,
} from '../../../../src/core/animation/frames.ts';
import { addObject, groupObjects } from '../../../../src/core/animation/layers.ts';
import { stateAt } from '../../../../src/core/animation/state.ts';
import { changeFps } from '../../../../src/core/animation/time.ts';
import { objectAt, trackOf } from '../../../../src/core/animation/tween.ts';
import type { AnimationDoc, Layer, Picture } from '../../../../src/core/animation/types.ts';

const animation = (stage: Partial<AnimationDoc['stage']> = {}): AnimationDoc => {
  const doc = createAnimation({ name: 'A' });
  return { ...doc, stage: { ...doc.stage, ...stage } };
};

const pictures = (n: number, width = 640, height = 480): Picture[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    path: `/shots/frame${String(i + 1).padStart(2, '0')}.jpg`,
    width,
    height,
  }));

describe('stop motion (AN14)', () => {
  it('stopMotionTiming spaces the pictures at the chosen rate on the stage frame rate', () => {
    expect(stopMotionTiming(24, 12, 24)).toEqual({
      starts: Array.from({ length: 24 }, (_, i) => i * 2),
      length: 48,
    });
    expect(stopMotionTiming(3, 24, 24)).toEqual({ starts: [0, 1, 2], length: 3 });
    // 8 fps on a 24 fps stage: each picture is held for three frames.
    expect(stopMotionTiming(4, 8, 24).starts).toEqual([0, 3, 6, 9]);
    // A rate that does not divide the stage's: as near as whole frames allow.
    expect(stopMotionTiming(3, 10, 24)).toEqual({ starts: [0, 2, 5], length: 7 });
  });

  it('refuses no pictures and rates outside 1 fps to the stage rate', () => {
    expect(() => stopMotionTiming(0, 12, 24)).toThrow(/no pictures/i);
    expect(() => stopMotionTiming(4, 0, 24)).toThrow(/between 1 and 24/);
    expect(() => stopMotionTiming(4, 30, 24)).toThrow(/between 1 and 24/);
  });

  it('24 pictures at 12 fps make a 2 s picture with a held keyframe per picture', () => {
    const doc = animation({ width: 640, height: 480, fps: 24 });
    const object = stopMotion(pictures(24), 12, doc.stage);
    expect(object.kind).toBe('picture');
    expect(object.pictureId).toBe('p1');
    const track = trackOf(object, 'picture')!;
    expect(track.keyframes).toHaveLength(24);
    expect(track.keyframes.every((k) => k.hold)).toBe(true);
    expect(track.keyframes.map((k) => k.frame)).toEqual(
      Array.from({ length: 24 }, (_, i) => i * 2),
    );
    expect(stopMotionTiming(24, 12, doc.stage.fps).length / doc.stage.fps).toBe(2);
    // Held: frame 1 still shows the first picture, frame 2 the second, the last stays.
    expect(objectAt(object, 1).pictureId).toBe('p1');
    expect(objectAt(object, 2).pictureId).toBe('p2');
    expect(objectAt(object, 47).pictureId).toBe('p24');
    expect(objectAt(object, 100).pictureId).toBe('p24');
  });

  it('places the pictures to fill the stage, keeping their proportions, centred', () => {
    const stage = animation({ width: 600, height: 400 }).stage;
    const o = stopMotion(pictures(2, 1200, 600), 12, stage);
    expect({ x: o.x, y: o.y, width: o.width, height: o.height }).toEqual({
      x: 0,
      y: 50,
      width: 600,
      height: 300,
    });
    // Pictures smaller than the stage keep their own size.
    const small = stopMotion(pictures(2, 100, 50), 12, stage);
    expect({ x: small.x, y: small.y, width: small.width, height: small.height }).toEqual({
      x: 250,
      y: 175,
      width: 100,
      height: 50,
    });
  });

  it('sorts the folder by name as people read numbers: frame2 before frame10', () => {
    expect(sortByName(['b/frame10.png', 'b/frame2.png', 'b/Frame1.png', 'b/frame02a.png'])).toEqual(
      ['b/Frame1.png', 'b/frame2.png', 'b/frame02a.png', 'b/frame10.png'],
    );
  });
});

/** A frame-by-frame layer with a circle drawn at frame 0. */
function withDrawing(): { doc: AnimationDoc; layer: () => Layer } {
  let doc = animation({ fps: 12 });
  const id = doc.layers[0]!.id;
  doc = { ...doc, layers: [toFrameByFrame(doc.layers[0]!)] };
  doc = addObject(doc, id, {
    ...createEllipse({ x: 10, y: 10, width: 50, height: 50 }),
    drawing: 0,
  });
  const ref = { doc };
  return {
    get doc() {
      return ref.doc;
    },
    layer: () => ref.doc.layers[0]!,
  } as { doc: AnimationDoc; layer: () => Layer };
}

describe('frame-by-frame layers (AN14)', () => {
  it('a layer becomes frame-by-frame with its objects in the first drawing', () => {
    const doc = createAnimation({ name: 'A' });
    const plain = addObject(doc, doc.layers[0]!.id, createRect({ x: 0, y: 0 })).layers[0]!;
    expect(isFrameByFrame(plain)).toBe(false);
    const fbf = toFrameByFrame(plain);
    expect(isFrameByFrame(fbf)).toBe(true);
    expect(fbf.drawings).toEqual([0]);
    expect(fbf.objects.every((o) => o.drawing === 0)).toBe(true);
    expect(toFrameByFrame(fbf)).toBe(fbf);
  });

  it('each drawing is shown from its keyframe until the next one', () => {
    const { layer } = withDrawing();
    let l = addDrawing(layer(), 6, 'blank');
    expect(l.drawings).toEqual([0, 6]);
    l = { ...l, objects: [...l.objects, { ...createRect({ x: 90, y: 0 }), drawing: 6 }] };
    expect(drawingAt(l, 0)).toBe(0);
    expect(drawingAt(l, 5)).toBe(0);
    expect(drawingAt(l, 6)).toBe(6);
    expect(drawingAt(l, 60)).toBe(6);
    const doc = { ...createAnimation({ name: 'A' }), layers: [l] };
    expect(stateAt(doc, 3).layers[0]!.objects.map((o) => o.kind)).toEqual(['ellipse']);
    expect(stateAt(doc, 7).layers[0]!.objects.map((o) => o.kind)).toEqual(['rect']);
  });

  it('Duplicate frame copies the drawing shown into a new keyframe, with new ids', () => {
    const { layer } = withDrawing();
    const l = addDrawing(layer(), 4, 'copy');
    expect(l.drawings).toEqual([0, 4]);
    expect(l.objects).toHaveLength(2);
    const [a, b] = l.objects;
    expect(b!.drawing).toBe(4);
    expect(b!.id).not.toBe(a!.id);
    expect({ ...b, id: a!.id, drawing: 0 }).toEqual(a);
  });

  it('refuses a second keyframe on the same frame, and on a layer that is not frame-by-frame', () => {
    const { layer } = withDrawing();
    expect(() => addDrawing(layer(), 0, 'blank')).toThrow(/already/i);
    const plain = createAnimation({ name: 'A' }).layers[0]!;
    expect(() => addDrawing(plain, 3, 'blank')).toThrow(/frame-by-frame/i);
  });

  it('removing a keyframe removes its drawing; the first one is cleared instead', () => {
    const { layer } = withDrawing();
    const two = addDrawing(layer(), 4, 'copy');
    const one = removeDrawing(two, 4);
    expect(one.drawings).toEqual([0]);
    expect(one.objects.map((o) => o.drawing)).toEqual([0]);
    const cleared = removeDrawing(one, 0);
    expect(cleared.drawings).toEqual([0]);
    expect(cleared.objects).toEqual([]);
    expect(() => removeDrawing(one, 2)).toThrow(/no keyframe on frame 2/i);
  });

  it('onion skin: the drawings before and after the one shown', () => {
    const { layer } = withDrawing();
    let l = addDrawing(addDrawing(layer(), 4, 'copy'), 8, 'copy');
    l = { ...l, objects: l.objects.map((o) => ({ ...o, x: o.drawing! * 10 })) };
    const skin = onionSkin(l, 5);
    expect(skin.before.map((o) => o.x)).toEqual([0]);
    expect(skin.after.map((o) => o.x)).toEqual([80]);
    expect(onionSkin(l, 0).before).toEqual([]);
    expect(onionSkin(l, 9).after).toEqual([]);
    expect(onionSkin(createAnimation({ name: 'A' }).layers[0]!, 3)).toEqual({
      before: [],
      after: [],
    });
  });

  it('a group made on a frame-by-frame layer stays in its drawing', () => {
    let doc = createAnimation({ name: 'A' });
    const id = doc.layers[0]!.id;
    doc = { ...doc, layers: [addDrawing(toFrameByFrame(doc.layers[0]!), 5, 'blank')] };
    doc = addObject(doc, id, { ...createRect({ x: 0, y: 0 }), drawing: 5 });
    doc = addObject(doc, id, { ...createRect({ x: 50, y: 0 }), drawing: 5 });
    const ids = doc.layers[0]!.objects.map((o) => o.id);
    const { group } = groupObjects(doc, ids);
    expect(group.drawing).toBe(5);
  });

  it('changing the frame rate keeping times moves the drawings with it', () => {
    const { layer } = withDrawing();
    const doc = { ...animation({ fps: 12 }), layers: [addDrawing(layer(), 6, 'copy')] };
    const faster = changeFps(doc, 24, 'times');
    expect(faster.layers[0]!.drawings).toEqual([0, 12]);
    expect(faster.layers[0]!.objects.map((o) => o.drawing)).toEqual([0, 12]);
  });

  it('onion skin draws the neighbours faintly behind the drawing shown, only when asked', () => {
    const { layer } = withDrawing();
    const l = addDrawing(addDrawing(layer(), 4, 'copy'), 8, 'copy');
    const doc: AnimationDoc = { ...createAnimation({ name: 'A' }), layers: [l] };
    const alphas = (options: Parameters<typeof drawStage>[2]) => {
      const seen: number[] = [];
      let alpha = 1;
      const saved: number[] = [];
      const ctx = new Proxy({} as Record<string, unknown>, {
        get(target, key: string) {
          if (key === 'globalAlpha') return alpha;
          if (key in target) return target[key];
          if (key === 'fill') return () => seen.push(alpha);
          if (key === 'save') return () => saved.push(alpha);
          if (key === 'restore') return () => (alpha = saved.pop()!);
          if (key.startsWith('create')) return () => ({ addColorStop() {} });
          return () => {};
        },
        set(target, key: string, value) {
          if (key === 'globalAlpha') alpha = value as number;
          else target[key] = value;
          return true;
        },
      }) as unknown as StageCanvas;
      drawStage(ctx, doc, options);
      return seen;
    };
    // The stage's background is drawn with fillRect, so only the circles are counted.
    expect(alphas({ frame: 5 })).toEqual([1]);
    const skin = (id: string) => {
      const { before, after } = onionSkin(
        doc.layers.find((x) => x.id === id)!,
        5,
      );
      return [...before, ...after];
    };
    const skinned = alphas({ frame: 5, editing: true, onionSkin: skin });
    expect(skinned).toHaveLength(3);
    expect(skinned.filter((a) => a < 1)).toHaveLength(2);
    expect(Math.max(...skinned.filter((a) => a < 1))).toBeLessThanOrEqual(0.35);
    expect(skinned.at(-1)).toBe(1);
  });
});
