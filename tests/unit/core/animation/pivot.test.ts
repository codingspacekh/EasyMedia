// M17a, from the animation benchmark: AN27 Turn about a chosen point (Animate's "transformation
// point"). 9626/04 M/J/20 needed a meter's needle turning about its end; clock hands, windmills,
// pendulums, wipers and doors do the same. An object's pivot is a point of its own box (fractions
// of its width and height; absent: the centre, so older files play exactly as before). The turn,
// flip and skew are all about it, in the one stage drawing, the SVG, hit-testing and the handles.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createGroup,
  createPath,
  createPicture,
  createRect,
} from '../../../../src/core/animation/factory.ts';
import {
  boundsOf,
  flipObject,
  hitTest,
  pivotOnStage,
  resizeFrom,
  toLocal,
  toStage,
  withPivot,
  type Point,
} from '../../../../src/core/animation/geometry.ts';
import { addObject, groupObjects, ungroup } from '../../../../src/core/animation/layers.ts';
import { anchorsOnStage, moveAnchor } from '../../../../src/core/animation/pen.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import { placementOf, stateAt } from '../../../../src/core/animation/state.ts';
import { objectAt, setPropertyAt } from '../../../../src/core/animation/tween.ts';
import { applyEffect } from '../../../../src/core/animation/effects.ts';
import { combineShapes } from '../../../../src/core/animation/combine.ts';
import { withPaths } from '../../../../src/core/animation/motion.ts';
import { croppedPicture } from '../../../../src/core/animation/picture-edit.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type {
  AnimationDoc,
  AnimObject,
  PictureObject,
} from '../../../../src/core/animation/types.ts';

const red = { kind: 'solid' as const, colour: '#ff0000' };
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<AnimObject> = {},
) => ({ ...createRect({ x, y, width, height }), fill: red, ...extra }) as AnimObject;

/** A meter's needle, 10 × 100 px, turning about the middle of its bottom end (105, 200). */
const needle = (extra: Partial<AnimObject> = {}) =>
  rect(100, 100, 10, 100, { pivot: { x: 0.5, y: 1 }, ...extra });

const close = (p: Point, x: number, y: number, digits = 6) => {
  expect(p.x).toBeCloseTo(x, digits);
  expect(p.y).toBeCloseTo(y, digits);
};

const corners = (o: AnimObject): Point[] =>
  [
    { x: 0, y: 0 },
    { x: o.width, y: 0 },
    { x: o.width, y: o.height },
    { x: 0, y: o.height },
  ].map((c) => toStage(o, c));

/** The object is drawn in exactly the same place: every corner on the same stage point. */
const samePlace = (a: AnimObject, b: AnimObject) =>
  corners(a).forEach((p, i) => close(p, corners(b)[i]!.x, corners(b)[i]!.y));

function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      if (key === 'withLayer') return undefined;
      return (...args: unknown[]) => {
        calls.push(
          `${key}(${args.map((a) => (typeof a === 'number' ? String(Math.round(a * 1000) / 1000) : String(a))).join(',')})`,
        );
        if (key === 'createLinearGradient' || key === 'createRadialGradient')
          return { addColorStop() {} };
        return undefined;
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

function stageWith(...objects: AnimObject[]): AnimationDoc {
  let doc = createAnimation({ name: 'A' });
  doc = { ...doc, stage: { ...doc.stage, width: 400, height: 300, background: '#ffffff' } };
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
}

describe('AN27 Turn about a chosen point', () => {
  it('an object turns about its pivot: the pivot stays still and the rest swings round it', () => {
    const n = needle({ rotation: 90 });
    close(pivotOnStage(n), 105, 200);
    close(toStage(n, { x: 5, y: 100 }), 105, 200);
    // Turned a quarter clockwise, its top end points right, 100 px from the pivot.
    close(toStage(n, { x: 5, y: 0 }), 205, 200);
    close(toLocal(n, toStage(n, { x: 3, y: 47 })), 3, 47);
    // Without a pivot it turns about its centre, exactly as before (older files play the same).
    const plain = rect(100, 100, 10, 100, { rotation: 90 });
    close(pivotOnStage(plain), 105, 150);
    close(toStage(plain, { x: 5, y: 0 }), 155, 150);
    // A pivot outside the box: the moon goes round the Earth.
    const moon = rect(0, 0, 20, 20, { pivot: { x: 5.5, y: 0.5 }, rotation: 180 });
    close(toStage(moon, { x: 10, y: 10 }), 210, 10);
  });

  it('hit-testing and the bounds follow the object turned about its pivot', () => {
    const n = needle({ rotation: 90 });
    const b = boundsOf(n);
    close(b, 105, 195);
    expect(b.width).toBeCloseTo(100);
    expect(b.height).toBeCloseTo(10);
    expect(hitTest(n, { x: 190, y: 200 })).toBe(true);
    expect(hitTest(n, { x: 105, y: 150 })).toBe(false);
  });

  it('is drawn turned about the pivot (the preview and every export); without one, as before', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(needle({ rotation: 90 })));
    const at = calls.indexOf('translate(105,200)');
    expect(at).toBeGreaterThan(-1);
    expect(calls[at + 1]).toBe('rotate(1.571)');
    // Then the box's centre is placed from the pivot (50 px above it, in the turned box).
    expect(calls[at + 2]).toBe('translate(0,-50)');
    const plain = recorder();
    drawStage(plain.ctx, stageWith(rect(100, 100, 10, 100, { rotation: 90 })));
    const c = plain.calls.indexOf('translate(105,150)');
    expect(plain.calls[c + 1]).toBe('rotate(1.571)');
    expect(plain.calls[c + 2]).not.toMatch(/^translate/);
  });

  it('the SVG shows it where the stage does', () => {
    // The needle turned about its end is the same picture as one turned about its centre placed
    // with its centre 50 px right of the pivot.
    const d = (doc: AnimationDoc) => /<path d="([^"]+)"/.exec(stageSvg(doc))?.[1];
    const about = d(stageWith(needle({ rotation: 90 })));
    const same = d(stageWith(rect(150, 150, 10, 100, { rotation: 90 })));
    expect(about).toBeDefined();
    expect(about).toBe(same);
  });

  it('a rotation tween swings round the pivot at every frame (a needle sweeping, a pendulum)', () => {
    const swing = setPropertyAt(needle(), 'rotation', 10, 90);
    for (const frame of [0, 3, 5, 10]) {
      const now = objectAt(swing, frame);
      const deg = (frame / 10) * 90;
      const a = (deg * Math.PI) / 180;
      // The tip is always 100 px from the pivot, on the circle round it.
      close(toStage(now, { x: 5, y: 0 }), 105 + 100 * Math.sin(a), 200 - 100 * Math.cos(a));
      close(pivotOnStage(now), 105, 200);
    }
    const doc = stageWith(swing);
    const shown = stateAt(doc, 5).layers[0]!.objects[0]!;
    close(toStage(shown, { x: 5, y: 0 }), 105 + 100 * Math.SQRT1_2, 200 - 100 * Math.SQRT1_2);
  });

  it('effects turn about the pivot (spin, wobble) and grow about it (pulse, zoom)', () => {
    const stage = { width: 400, height: 300 };
    for (const id of ['spin', 'wobble', 'pulse', 'zoomIn']) {
      const done = applyEffect(needle(), id, 0, 24, stage);
      for (const frame of [3, 7, 12, 20]) close(pivotOnStage(objectAt(done, frame)), 105, 200, 4);
    }
  });

  it('moving the pivot does not move the object, turned, flipped and skewed too', () => {
    for (const extra of [
      {},
      { rotation: 30 },
      { rotation: 200, flipX: true },
      { rotation: 45, skewX: 20, skewY: -10, flipY: true },
    ]) {
      const o = rect(50, 60, 80, 40, extra);
      const moved = withPivot(o, { x: 0, y: 1 });
      expect(moved.pivot).toEqual({ x: 0, y: 1 });
      samePlace(moved, o);
      close(pivotOnStage(moved), toStage(o, { x: 0, y: 40 }).x, toStage(o, { x: 0, y: 40 }).y);
      // Back to the centre: nothing is saved (an older version opens it the same).
      const back = withPivot(moved, { x: 0.5, y: 0.5 });
      expect('pivot' in back).toBe(false);
      samePlace(back, o);
    }
  });

  it('moving the pivot on an animated object keeps it still at the frame shown; all its motion moves with it', () => {
    let o = rect(50, 60, 80, 40, { rotation: 30 });
    o = setPropertyAt(setPropertyAt(o, 'x', 10, 150), 'rotation', 10, 120);
    const at5 = objectAt(o, 5);
    const moved = withPivot(o, { x: 1, y: 0 }, at5);
    samePlace(objectAt(moved, 5), at5);
    // The x keyframes are moved by the same amount (the move is the same at every frame).
    const xs = (a: AnimObject) => a.tracks!.find((t) => t.property === 'x')!.keyframes;
    const shift = objectAt(moved, 5).x - at5.x;
    expect(xs(moved).map((k) => k.value)).toEqual(xs(o).map((k) => Number(k.value) + shift));
  });

  it('on a motion path the pivot follows the path; orient to path turns about it', () => {
    const path = {
      points: [
        { x: 0, y: 100 },
        { x: 300, y: 100 },
      ],
      closed: false,
      from: 0,
      to: 10,
      orient: true,
      even: true,
      easing: 'linear' as const,
    };
    const car = withPaths(rect(0, 0, 40, 20, { pivot: { x: 0, y: 1 } }), [path]);
    for (const frame of [0, 5, 10]) close(pivotOnStage(objectAt(car, frame)), frame * 30, 100);
    // Moving the pivot moves the path with it, so the car stays where it is shown.
    const at5 = objectAt(car, 5);
    const moved = withPivot(car, { x: 1, y: 1 }, at5);
    samePlace(objectAt(moved, 5), at5);
    close(moved.paths![0]!.points[0]!, 40, 100);
  });

  it('resizing from a handle keeps the opposite corner where it is, the pivot moved', () => {
    for (const extra of [{ rotation: 40 }, { rotation: 120, skewX: 15, flipX: true }]) {
      const r = rect(100, 100, 100, 50, { pivot: { x: 0.2, y: 0.9 }, ...extra });
      const corner = toStage(r, { x: 0, y: 0 });
      const sized = resizeFrom(r, 'se', toStage(r, { x: 150, y: 80 }), { lockRatio: false });
      expect(sized.width).toBeCloseTo(150);
      expect(sized.height).toBeCloseTo(80);
      close(toStage(sized, { x: 0, y: 0 }), corner.x, corner.y);
    }
  });

  it('flip and skew are about the pivot too: the pivot stays still (a door on its hinge)', () => {
    const door = rect(100, 100, 60, 100, { pivot: { x: 0, y: 0.5 } });
    const flipped = flipObject(door, 'horizontal');
    close(pivotOnStage(flipped), 100, 150);
    // The door swings to the other side of its hinge.
    close(toStage(flipped, { x: 60, y: 50 }), 40, 150);
    // A tree swaying about its foot: the foot stays, the top leans.
    const tree = rect(100, 100, 20, 100, { pivot: { x: 0.5, y: 1 }, skewX: 45 });
    close(toStage(tree, { x: 10, y: 100 }), 110, 200);
    close(toStage(tree, { x: 10, y: 0 }), 210, 100);
  });

  it('a group turns about its pivot, a part about its own inside it; ungrouping keeps places', () => {
    let doc = stageWith(needle({ rotation: 30 }), rect(200, 120, 40, 40, { rotation: 10 }));
    const grouped = groupObjects(
      doc,
      doc.layers[0]!.objects.map((o) => o.id),
    );
    const group = { ...grouped.group, pivot: { x: 0, y: 1 }, rotation: 50 };
    doc = { ...grouped.doc, layers: [{ ...grouped.doc.layers[0]!, objects: [group] }] };
    const parts = ungroup(doc, group.id).layers[0]!.objects;
    parts.forEach((part, i) => {
      const child = group.children[i]!;
      // Each corner where the group showed it: the part's own turn inside the group's.
      corners(child).forEach((p, k) => {
        const shown = toStage(group, p);
        close(corners(part)[k]!, shown.x, shown.y);
      });
    });
    expect(parts[0]!.pivot).toEqual({ x: 0.5, y: 1 });
    // Its placement on the stage (state.ts) puts the centre where the group shows it.
    const child = group.children[0]!;
    const centre = toStage(group, toStage(child, { x: 5, y: 50 }));
    close(placementOf(doc, child.id, 0).centre, centre.x, centre.y);
  });

  it('a group of parts is drawn with the group turned about its pivot', () => {
    const g = { ...createGroup([rect(0, 0, 10, 10)]), pivot: { x: 0, y: 0 }, rotation: 90 };
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(g as AnimObject));
    const at = calls.indexOf('translate(0,0)');
    expect(calls[at + 1]).toBe('rotate(1.571)');
    expect(calls[at + 2]).toBe('translate(5,5)');
  });

  it('Combine shapes and morphs keep a shape turned about its pivot where it is', () => {
    const n = needle({ rotation: 90 });
    const [cut] = combineShapes([n, rect(0, 0, 400, 300)], 'intersect');
    const a = boundsOf(cut!);
    const b = boundsOf(n);
    close(a, b.x, b.y, 3);
    expect(a.width).toBeCloseTo(b.width, 3);
    const shaped = setPropertyAt(n, 'shape', 10, {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
      closed: true,
    });
    expect(objectAt(shaped, 5).pivot).toEqual({ x: 0.5, y: 1 });
    close(pivotOnStage(objectAt(shaped, 5)), 105, 200);
  });

  it('a crop keeps the part kept where it was, the picture turned about its pivot', () => {
    const from = { id: 'p1', path: 'a.png', width: 400, height: 200 };
    const to = { id: 'p2', path: 'b.png', width: 200, height: 100 };
    const pic: PictureObject = {
      ...createPicture(from, { x: 100, y: 100 }),
      width: 200,
      height: 100,
      rotation: 60,
      pivot: { x: 0, y: 0 },
    };
    const cut = croppedPicture(pic, from, { x: 200, y: 100, width: 200, height: 100 }, to);
    const kept = toStage(pic, { x: 100, y: 50 });
    close(toStage(cut, { x: 0, y: 0 }), kept.x, kept.y);
  });

  it('a pen path turned about its pivot (or flipped) has its points moved where they are shown', () => {
    const line = createPath(
      [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 160 },
      ],
      false,
    );
    for (const extra of [{ rotation: 30, pivot: { x: 0, y: 0 } }, { flipX: true }]) {
      const path = { ...line, ...extra };
      const edited = moveAnchor(path, 2, { x: 250, y: 250 });
      close(anchorsOnStage(edited)[2]!, 250, 250);
      close(anchorsOnStage(edited)[0]!, anchorsOnStage(path)[0]!.x, anchorsOnStage(path)[0]!.y);
    }
  });

  it('is kept when saved and opened again; an older file opens unchanged; checked', () => {
    const doc = stageWith(needle());
    const back = deserializeAnimation(serializeAnimation(doc)).layers[0]!.objects[0]!;
    expect(back.pivot).toEqual({ x: 0.5, y: 1 });
    const plain = deserializeAnimation(serializeAnimation(stageWith(rect(0, 0, 10, 10))));
    expect('pivot' in plain.layers[0]!.objects[0]!).toBe(false);
    const damaged = serializeAnimation(doc).replace(/"pivot": \{[^}]*\}/, '"pivot": "the end"');
    expect(() => deserializeAnimation(damaged)).toThrow();
    expect(() => validateObject(needle({ pivot: { x: -10, y: 10 } }))).not.toThrow();
    expect(() => validateObject(needle({ pivot: { x: Number.NaN, y: 0 } }))).toThrow(EditError);
    expect(() => validateObject(needle({ pivot: { x: 0, y: 11 } }))).toThrow(
      'The point it turns about must be between −1000 % and 1000 % of its box.',
    );
  });
});
