// M15 / AN11: motion paths — an object's centre follows a path between two frames, at even speed
// or eased, and turns with it when oriented (a car on a road).
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createLine,
  createPath,
  createRect,
  createStar,
} from '../../../../src/core/animation/factory.ts';
import { centreOf, moved, rotated } from '../../../../src/core/animation/geometry.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import { motionFrom, withPaths } from '../../../../src/core/animation/motion.ts';
import { flattenCurves, polylineOf } from '../../../../src/core/animation/path.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { stateAt } from '../../../../src/core/animation/state.ts';
import { editAt, objectAt } from '../../../../src/core/animation/tween.ts';
import type { MotionPath } from '../../../../src/core/animation/types.ts';

const straight: MotionPath = {
  points: [
    { x: 0, y: 0 },
    { x: 300, y: 0 },
  ],
  closed: false,
  from: 0,
  to: 72,
  orient: false,
  even: true,
  easing: 'linear',
};
const box = () => createRect({ x: 500, y: 500, width: 20, height: 20 });

describe('motion paths (AN11)', () => {
  it('the centre follows the path from its first frame to its last, and stays at the ends outside them', () => {
    const o = withPaths(box(), [{ ...straight, from: 24 }]);
    expect(centreOf(objectAt(o, 0))).toEqual({ x: 0, y: 0 });
    expect(centreOf(objectAt(o, 48))).toEqual({ x: 150, y: 0 });
    expect(objectAt(o, 48)).toMatchObject({ x: 140, y: -10 });
    expect(centreOf(objectAt(o, 100))).toEqual({ x: 300, y: 0 });
  });

  it('eased: ease in starts slowly and still arrives; not even: each segment gets the same time', () => {
    const eased = withPaths(box(), [{ ...straight, easing: 'ease-in' }]);
    expect(centreOf(objectAt(eased, 18)).x).toBeLessThan(75);
    expect(centreOf(objectAt(eased, 72)).x).toBe(300);
    const corner: MotionPath = {
      ...straight,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 300 },
      ],
      even: false,
    };
    expect(centreOf(objectAt(withPaths(box(), [corner]), 36))).toEqual({ x: 100, y: 0 });
    expect(centreOf(objectAt(withPaths(box(), [{ ...corner, even: true }]), 18))).toEqual({
      x: 100,
      y: 0,
    });
  });

  it('oriented, it turns with the path on top of its own turn (Orient to path)', () => {
    const K = 0.5522847498;
    const arc: MotionPath = {
      ...straight,
      points: [
        { x: 0, y: 0, out: { x: 100 * K, y: 0 } },
        { x: 100, y: 100, in: { x: 100, y: 100 - 100 * K } },
      ],
      orient: true,
    };
    const car = withPaths(rotated(box(), 10), [arc]);
    expect(Math.abs(objectAt(car, 0).rotation - 10)).toBeLessThan(1);
    expect(objectAt(car, 36).rotation).toBeCloseTo(55, 0);
    expect(Math.abs(objectAt(car, 72).rotation - 100)).toBeLessThan(1);
    expect(objectAt(withPaths(box(), [{ ...arc, orient: false }]), 36).rotation).toBe(0);
  });

  it('Task 5: a car on an undulating road over 5 s at 24 fps is on the road at every frame and points along it', () => {
    const road = createPath(
      Array.from({ length: 25 }, (_, i) => ({ x: i * 50, y: 400 + 60 * Math.sin(i / 2) })),
      false,
    );
    const car = withPaths(createRect({ x: 0, y: 0, width: 80, height: 30 }), [
      {
        ...motionFrom(road),
        from: 0,
        to: 120,
        orient: true,
      },
    ]);
    const line = polylineOf(flattenCurves(motionFrom(road).points, false), false);
    for (let f = 0; f <= 120; f++) {
      const c = centreOf(objectAt(car, f));
      const nearest = Math.min(
        ...line.points.slice(0, -1).map((a, i) => {
          const b = line.points[i + 1]!;
          const t = Math.max(
            0,
            Math.min(
              1,
              ((c.x - a.x) * (b.x - a.x) + (c.y - a.y) * (b.y - a.y)) /
                ((b.x - a.x) ** 2 + (b.y - a.y) ** 2),
            ),
          );
          return Math.hypot(c.x - (a.x + t * (b.x - a.x)), c.y - (a.y + t * (b.y - a.y)));
        }),
      );
      expect(nearest).toBeLessThan(0.01);
    }
    expect(centreOf(objectAt(car, 120))).toMatchObject({ x: 1200 });
    // Going up the slope the car points up (a negative angle on the screen), going down, down.
    expect(objectAt(car, 0).rotation).toBeGreaterThan(0);
  });

  it('any shape can be the path: its outline on the stage, turned as it is drawn', () => {
    const ring = motionFrom(createEllipse({ x: 0, y: 0, width: 200, height: 200 }));
    expect(ring.closed).toBe(true);
    const o = withPaths(box(), [{ ...ring, from: 0, to: 64 }]);
    expect(
      Math.hypot(centreOf(objectAt(o, 16)).x - 100, centreOf(objectAt(o, 16)).y - 100),
    ).toBeCloseTo(100, 0);
    const turned = motionFrom(rotated(createLine({ x: 0, y: 0 }, { x: 100, y: 0 }), 90));
    expect(turned.points.map((p) => [Math.round(p.x), Math.round(p.y)])).toEqual([
      [50, -50],
      [50, 50],
    ]);
    expect(motionFrom(createStar({ x: 0, y: 0 })).points).toHaveLength(10);
  });

  it('moving the object moves its path; a drag at a frame moves the path too, not a keyframe', () => {
    const o = withPaths(box(), [straight]);
    expect(moved(o, 10, 5).paths![0]!.points[1]).toEqual({ x: 310, y: 5 });
    const dragged = editAt(o, 36, (now) => ({ ...now, x: now.x + 10 }));
    expect(dragged.tracks).toBeUndefined();
    expect(centreOf(objectAt(dragged, 72))).toEqual({ x: 310, y: 0 });
  });

  it('in the document: placed at the frame, saved and read back', () => {
    let doc = createAnimation({ name: 'Task 5' });
    const car = withPaths(box(), [straight]);
    doc = addObject(doc, doc.layers[0]!.id, car);
    expect(stateAt(doc, 36).layers[0]!.objects[0]).toMatchObject({ x: 140, y: -10 });
    const back = deserializeAnimation(serializeAnimation(doc));
    expect(back).toEqual(doc);
    expect(back.schemaVersion).toBe(3);
    expect(() => withPaths(box(), [{ ...straight, to: 10, from: 20 }])).toThrow(/before/);
  });

  it('Task 6: out to the centre along one path, a second there, back along a different one', () => {
    const out: MotionPath = {
      ...straight,
      points: [
        { x: 100, y: 400 },
        { x: 400, y: 300 },
      ],
      from: 0,
      to: 24,
    };
    const back: MotionPath = {
      ...straight,
      points: [
        { x: 400, y: 300 },
        { x: 250, y: 500 },
        { x: 100, y: 400 },
      ],
      from: 48,
      to: 72,
    };
    const computer = withPaths(box(), [back, out]);
    expect(computer.paths!.map((p) => p.from)).toEqual([0, 48]);
    expect(centreOf(objectAt(computer, 12))).toEqual({ x: 250, y: 350 });
    expect(centreOf(objectAt(computer, 36))).toEqual({ x: 400, y: 300 });
    expect(centreOf(objectAt(computer, 60)).y).toBeGreaterThan(400);
    expect(centreOf(objectAt(computer, 72))).toEqual({ x: 100, y: 400 });
    expect(() => withPaths(box(), [out, { ...back, from: 20 }])).toThrow(/overlap/);
    expect(withPaths(computer, []).paths).toBeUndefined();
  });
});
