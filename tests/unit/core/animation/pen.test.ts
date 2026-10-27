// M15 / AN3, AN11: editing a pen path — move an anchor, pull out its curve handles (both sides at
// once, as Hype's and Animate's pens do), make it a corner again, add and remove points.
import { describe, expect, it } from 'vitest';
import { createPath } from '../../../../src/core/animation/factory.ts';
import { rotated } from '../../../../src/core/animation/geometry.ts';
import {
  anchorsOnStage,
  cornerPoint,
  insertPoint,
  moveAnchor,
  moveHandle,
  pullHandles,
  removePoint,
} from '../../../../src/core/animation/pen.ts';

const zigzag = () =>
  createPath(
    [
      { x: 100, y: 100 },
      { x: 200, y: 200 },
      { x: 300, y: 100 },
    ],
    false,
  );

describe('editing a pen path', () => {
  it('the anchors are shown where they are on the stage, turned with the path', () => {
    expect(anchorsOnStage(zigzag()).map((a) => [a.x, a.y])).toEqual([
      [100, 100],
      [200, 200],
      [300, 100],
    ]);
    const turned = anchorsOnStage(rotated(zigzag(), 180));
    expect(turned.map((a) => [Math.round(a.x), Math.round(a.y)])).toEqual([
      [300, 200],
      [200, 100],
      [100, 200],
    ]);
  });

  it('moving an anchor keeps the others where they are; the box grows to fit', () => {
    const moved = moveAnchor(zigzag(), 1, { x: 200, y: 300 });
    expect(anchorsOnStage(moved).map((a) => [a.x, a.y])).toEqual([
      [100, 100],
      [200, 300],
      [300, 100],
    ]);
    expect(moved).toMatchObject({ x: 100, y: 100, width: 200, height: 200 });
  });

  it('pulling handles out of an anchor makes a smooth curve: both handles, mirrored', () => {
    const smooth = pullHandles(zigzag(), 1, { x: 250, y: 200 });
    const middle = anchorsOnStage(smooth)[1]!;
    expect(middle.out).toEqual({ x: 250, y: 200 });
    expect(middle.in).toEqual({ x: 150, y: 200 });
    // The curve now passes through the anchor flat (heading right) instead of a sharp V.
    expect(smooth.points[1]!.in).toBeDefined();
  });

  it('one handle can be moved alone (Alt), or with its partner kept opposite', () => {
    const smooth = pullHandles(zigzag(), 1, { x: 250, y: 200 });
    const both = anchorsOnStage(moveHandle(smooth, 1, 'out', { x: 200, y: 150 }, true))[1]!;
    expect(both.out).toEqual({ x: 200, y: 150 });
    expect(both.in).toEqual({ x: 200, y: 250 });
    const alone = anchorsOnStage(moveHandle(smooth, 1, 'in', { x: 120, y: 160 }, false))[1]!;
    expect(alone.in).toEqual({ x: 120, y: 160 });
    expect(alone.out).toEqual({ x: 250, y: 200 });
  });

  it('a curved point can become a corner again', () => {
    const smooth = pullHandles(zigzag(), 1, { x: 250, y: 200 });
    const corner = cornerPoint(smooth, 1).points[1]!;
    expect(corner.in).toBeUndefined();
    expect(corner.out).toBeUndefined();
  });

  it('a point is added on the line where it is double-clicked, between the anchors either side', () => {
    const more = insertPoint(zigzag(), { x: 152, y: 148 });
    expect(anchorsOnStage(more).map((a) => [a.x, a.y])).toEqual([
      [100, 100],
      [150, 150],
      [200, 200],
      [300, 100],
    ]);
    const closed = createPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
      ],
      true,
    );
    // On a closed path the last side (back to the start) can take a point too.
    expect(
      anchorsOnStage(insertPoint(closed, { x: 50, y: 50 }))
        .map((a) => [a.x, a.y])
        .at(-1),
    ).toEqual([50, 50]);
  });

  it('a point can be removed, but a path keeps at least two (a closed shape three)', () => {
    expect(anchorsOnStage(removePoint(zigzag(), 1)).map((a) => [a.x, a.y])).toEqual([
      [100, 100],
      [300, 100],
    ]);
    const line = createPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      false,
    );
    expect(() => removePoint(line, 0)).toThrow(/at least two/);
    const triangle = createPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      true,
    );
    expect(() => removePoint(triangle, 0)).toThrow(/at least three/);
  });
});
