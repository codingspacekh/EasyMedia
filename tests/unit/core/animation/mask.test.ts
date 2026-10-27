// M15 / AN12: masks. As in the coursebook (19.6), a layer marked as a mask restricts what can be
// seen of the layer directly beneath it to its shapes; the mask's own shapes are not drawn. On the
// stage the effect shows while the mask layer is locked (the padlock); exports always apply it.
import { describe, expect, it } from 'vitest';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createEllipse,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { addLayer, addObject, setLayer } from '../../../../src/core/animation/layers.ts';
import { setPropertyAt } from '../../../../src/core/animation/tween.ts';
import type { AnimationDoc } from '../../../../src/core/animation/types.ts';

/** Records the drawing calls that matter here, with numbers rounded. */
function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key: string) =>
      key in target
        ? target[key]
        : (...args: unknown[]) => {
            calls.push(
              `${key}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : typeof a === 'string' ? a : '…')).join(',')})`,
            );
            if (key.startsWith('create')) return { addColorStop: () => {} };
            return undefined;
          },
    set: (target, key: string, value) => ((target[key] = value), true),
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

/** A photo-like rectangle, a circle mask above it, and an unmasked title above that. */
function scene(): { doc: AnimationDoc; maskId: string; circleId: string } {
  let doc = createAnimation({ name: 'Mask' });
  const photo = doc.layers[0]!.id;
  doc = addObject(doc, photo, {
    ...createRect({ x: 0, y: 0, width: 1280, height: 720 }),
    name: 'Photo',
  });
  const mask = addLayer(doc, 'Spotlight');
  doc = mask.doc;
  const circle = { ...createEllipse({ x: 100, y: 100, width: 200, height: 200 }), name: 'Ball' };
  doc = addObject(doc, mask.layer.id, circle);
  doc = setLayer(doc, mask.layer.id, { mask: true, locked: true });
  const title = addLayer(doc, 'Title');
  doc = addObject(title.doc, title.layer.id, createText('Title', { x: 10, y: 10 }));
  return { doc, maskId: mask.layer.id, circleId: circle.id };
}

const index = (calls: string[], prefix: string, from = 0) =>
  calls.findIndex((c, i) => i >= from && c.startsWith(prefix));

describe('masks (AN12)', () => {
  it('the circle clips the layer beneath it: clip before the photo is drawn, and the circle itself is not drawn', () => {
    const { doc } = scene();
    const { ctx, calls } = recorder();
    drawStage(ctx, doc);
    const clip = index(calls, 'clip(');
    const photo = index(calls, 'fillRect(-640,-360');
    expect(clip).toBeGreaterThan(-1);
    expect(index(calls, 'ellipse(')).toBe(-1);
    // The photo is a plain rectangle path, traced after the clip.
    const traced = index(calls, 'moveTo(-640,-360', clip);
    expect(traced).toBeGreaterThan(clip);
    expect(photo).toBe(-1);
    // The clip is the circle on the stage: its points stay 100 px from (200, 200).
    const clipPoints = calls
      .slice(index(calls, 'save('), clip)
      .filter((c) => c.startsWith('moveTo(') || c.startsWith('lineTo('))
      .map(
        (c) =>
          c
            .slice(c.indexOf('(') + 1, -1)
            .split(',')
            .map(Number) as [number, number],
      );
    expect(clipPoints.length).toBeGreaterThan(30);
    for (const [x, y] of clipPoints)
      expect(Math.abs(Math.hypot(x - 200, y - 200) - 100)).toBeLessThanOrEqual(1);
  });

  it('a layer above the mask is not clipped: it is drawn after the clip is undone', () => {
    const { doc } = scene();
    const { ctx, calls } = recorder();
    drawStage(ctx, doc);
    const clip = index(calls, 'clip(');
    const undone = calls.findIndex(
      (c, i) =>
        i > clip &&
        c === 'restore()' &&
        calls.slice(clip, i).filter((x) => x === 'save()').length ===
          calls.slice(clip, i).filter((x) => x === 'restore()').length,
    );
    expect(undone).toBeGreaterThan(clip);
    expect(index(calls, 'fillText(Title', undone)).toBeGreaterThan(undone);
  });

  it('the mask moves like any object: at frame 24 the clip has moved with it', () => {
    const { doc, maskId, circleId } = scene();
    const moving: AnimationDoc = {
      ...doc,
      layers: doc.layers.map((l) =>
        l.id === maskId
          ? {
              ...l,
              objects: l.objects.map((o) =>
                o.id === circleId ? setPropertyAt(o, 'x', 24, 500) : o,
              ),
            }
          : l,
      ),
    };
    const { ctx, calls } = recorder();
    drawStage(ctx, moving, { frame: 24 });
    const first = calls.find((c) => c.startsWith('moveTo('))!;
    const [x] = first.slice(7, -1).split(',').map(Number) as [number];
    expect(x).toBeGreaterThan(500);
  });

  it('on the stage, an unlocked mask shows its shapes and does not clip (to edit them); exports always clip', () => {
    const { doc, maskId } = scene();
    const unlocked = setLayer(doc, maskId, { locked: false });
    const editing = recorder();
    drawStage(editing.ctx, unlocked, { editing: true });
    expect(index(editing.calls, 'clip(')).toBe(-1);
    expect(index(editing.calls, 'ellipse(')).toBeGreaterThan(-1);
    const exported = recorder();
    drawStage(exported.ctx, unlocked);
    expect(index(exported.calls, 'clip(')).toBeGreaterThan(-1);
  });

  it('a hidden mask masks nothing; a mask at the bottom has nothing beneath it to mask', () => {
    const { doc, maskId } = scene();
    const hidden = recorder();
    drawStage(hidden.ctx, setLayer(doc, maskId, { visible: false }));
    expect(index(hidden.calls, 'clip(')).toBe(-1);
    expect(index(hidden.calls, 'ellipse(')).toBe(-1);
    let bottom = createAnimation({ name: 'b' });
    bottom = addObject(bottom, bottom.layers[0]!.id, createEllipse({ x: 0, y: 0 }));
    bottom = setLayer(bottom, bottom.layers[0]!.id, { mask: true });
    const alone = recorder();
    drawStage(alone.ctx, bottom);
    expect(index(alone.calls, 'clip(')).toBe(-1);
    expect(index(alone.calls, 'ellipse(')).toBe(-1);
  });
});
