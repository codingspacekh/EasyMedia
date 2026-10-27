// M13 / AN3, AN6: outlines, bounds, centres, hit-testing, resizing from handles, rotation.
// Numbers from the workbook (Task 1's star and circle, Task 5's road).
import { describe, expect, it } from 'vitest';
import {
  createEllipse,
  createLine,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../../../../src/core/animation/factory.ts';
import {
  angleOf,
  boundsOf,
  centreOf,
  hitTest,
  moved,
  outlineOf,
  resizeFrom,
  rotated,
  setSize,
  snapAngle,
  toLocal,
} from '../../../../src/core/animation/geometry.ts';

const star = createStar({ x: 128, y: 102, width: 135, height: 135 });
const circle = createEllipse({ x: 0, y: 0, width: 204, height: 204 });
const square = createRect({ x: 0, y: 0, width: 100, height: 100 });
const road = {
  ...createLine({ x: 0, y: 500 }, { x: 1240, y: 500 }),
  stroke: { colour: '#000000', width: 19, dash: 'solid' as const },
};

describe('centres and outlines', () => {
  it('Task 1: the star’s centre is (195.5, 169.5); it has 10 outline points; the top point is at the top', () => {
    expect(centreOf(star)).toEqual({ x: 195.5, y: 169.5 });
    const [points] = outlineOf(star);
    expect(points).toHaveLength(10);
    expect(points![0]!.x).toBeCloseTo(195.5, 6);
    expect(points![0]!.y).toBeCloseTo(102, 6);
    // Inner points are halfway to the centre (inner 0.5).
    const inner = points![1]!;
    expect(Math.hypot(inner.x - 195.5, inner.y - 169.5)).toBeCloseTo(33.75, 6);
  });

  it('a hexagon has six points on its ellipse; a rectangle four corners; a line its two ends', () => {
    expect(outlineOf(createPolygon({ x: 0, y: 0 }))[0]).toHaveLength(6);
    expect(outlineOf(square)[0]).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]);
    expect(outlineOf(road)[0]).toEqual([
      { x: 0, y: 500 },
      { x: 1240, y: 500 },
    ]);
  });

  it('a rounded rectangle’s outline follows its corners', () => {
    const [points] = outlineOf({ ...square, radius: 20 });
    expect(points!.length).toBeGreaterThan(4);
    for (const p of points!) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(100 + 1e-9);
    }
    // The very corner (0, 0) is cut off.
    expect(points!.some((p) => p.x < 1e-9 && p.y < 1e-9)).toBe(false);
  });
});

describe('bounds and rotation', () => {
  it('Task 1: the circle of radius 102 at (0, 0) is 204 × 204', () => {
    expect(boundsOf(circle)).toEqual({ x: 0, y: 0, width: 204, height: 204 });
  });

  it('a 100 × 100 square turned 45° has bounds 141.42 wide around the same centre', () => {
    const turned = rotated(square, 45);
    expect(centreOf(turned)).toEqual({ x: 50, y: 50 });
    const b = boundsOf(turned);
    expect(b.width).toBeCloseTo(141.42, 2);
    expect(b.height).toBeCloseTo(141.42, 2);
    expect(b.x).toBeCloseTo(50 - 70.71, 2);
  });

  it('rotation is kept within 0–360', () => {
    expect(rotated(square, 370).rotation).toBe(10);
    expect(rotated(square, -90).rotation).toBe(270);
  });

  it('toLocal undoes the rotation: the top-right corner of the turned square is at (100, 0) locally', () => {
    const turned = rotated(square, 90);
    // Turned 90° clockwise about (50, 50), the local top-right corner (100, 0) is at the bottom right.
    const local = toLocal(turned, { x: 100, y: 100 });
    expect(local.x).toBeCloseTo(100, 6);
    expect(local.y).toBeCloseTo(0, 6);
  });

  it('the handle angle: straight up is 0°, right is 90°, and it snaps to 15° steps with Shift', () => {
    expect(angleOf({ x: 50, y: 50 }, { x: 50, y: 0 })).toBe(0);
    expect(angleOf({ x: 50, y: 50 }, { x: 100, y: 50 })).toBe(90);
    expect(angleOf({ x: 50, y: 50 }, { x: 50, y: 100 })).toBe(180);
    expect(snapAngle(47, 15)).toBe(45);
    expect(snapAngle(356, 15)).toBe(0);
  });
});

describe('hitTest', () => {
  it('Task 1: the circle contains its centre and not the corner of its box', () => {
    expect(hitTest(circle, { x: 102, y: 102 })).toBe(true);
    expect(hitTest(circle, { x: 0, y: 0 })).toBe(false);
    expect(hitTest(circle, { x: 102, y: 2 })).toBe(true);
  });

  it('the star is hit at its centre and between two points only near the inner radius', () => {
    expect(hitTest(star, { x: 195.5, y: 169.5 })).toBe(true);
    expect(hitTest(star, { x: 128, y: 102 })).toBe(false);
  });

  it('Task 5: a 19 px road is hit within its thickness', () => {
    expect(hitTest(road, { x: 600, y: 505 })).toBe(true);
    expect(hitTest(road, { x: 600, y: 520 })).toBe(false);
    expect(hitTest(road, { x: 1300, y: 500 })).toBe(false);
  });

  it('a turned square is hit as a diamond', () => {
    const diamond = rotated(square, 45);
    expect(hitTest(diamond, { x: 50, y: -10 })).toBe(true);
    expect(hitTest(diamond, { x: 5, y: 5 })).toBe(false);
  });

  it('a transparent shape (no fill) is hit on its outline only; text and pictures by their box', () => {
    const ring = { ...circle, fill: { kind: 'none' as const } };
    expect(hitTest(ring, { x: 102, y: 102 })).toBe(false);
    expect(hitTest(ring, { x: 102, y: 1 })).toBe(true);
    const t = createText('Task 1', { x: 193, y: 73, size: 64 });
    expect(hitTest(t, { x: 200, y: 100 })).toBe(true);
    expect(hitTest(t, { x: 190, y: 100 })).toBe(false);
  });
});

describe('moving and resizing', () => {
  it('moved shifts the box only', () => {
    expect(moved(star, 2, -3)).toMatchObject({ x: 130, y: 99, width: 135, height: 135 });
  });

  it('setSize keeps the top-left corner; a path’s points scale with the box', () => {
    expect(setSize(square, 50, 20)).toMatchObject({ x: 0, y: 0, width: 50, height: 20 });
    const half = setSize(road, 620, 0);
    expect(half.kind === 'path' && half.points[1]).toEqual({ x: 620, y: 0 });
    // A line 0 px high stays 0 px high: no division by zero.
    expect(half.height).toBe(0);
  });

  it('dragging the bottom-right handle keeps the top-left corner still', () => {
    const r = resizeFrom(square, 'se', { x: 150, y: 80 }, { lockRatio: false });
    expect(r).toMatchObject({ x: 0, y: 0, width: 150, height: 80 });
  });

  it('dragging the top handle keeps the bottom edge still; the left handle the right edge', () => {
    expect(resizeFrom(square, 'n', { x: 999, y: 30 }, { lockRatio: false })).toMatchObject({
      x: 0,
      y: 30,
      width: 100,
      height: 70,
    });
    expect(resizeFrom(square, 'w', { x: 25, y: 999 }, { lockRatio: false })).toMatchObject({
      x: 25,
      y: 0,
      width: 75,
      height: 100,
    });
  });

  it('with the ratio locked, a corner drag keeps the proportions (the larger change wins)', () => {
    const r = resizeFrom(
      { ...square, width: 200, height: 100 },
      'se',
      { x: 300, y: 120 },
      { lockRatio: true },
    );
    expect(r).toMatchObject({ x: 0, y: 0, width: 300, height: 150 });
  });

  it('a drag past the opposite edge stops at zero size instead of flipping', () => {
    expect(resizeFrom(square, 'se', { x: -20, y: -20 }, { lockRatio: false })).toMatchObject({
      width: 0,
      height: 0,
    });
  });

  it('a turned object resizes in its own directions and its fixed corner stays put', () => {
    const turned = rotated(square, 90);
    // The local bottom-right corner (100, 100) is at stage (0, 100) when turned 90° clockwise about (50, 50);
    // its fixed corner (the local top-left) is at stage (100, 0).
    const pointer = { x: -20, y: 130 }; // local (130, 120)
    const r = resizeFrom(turned, 'se', pointer, { lockRatio: false });
    expect(r.width).toBeCloseTo(130, 6);
    expect(r.height).toBeCloseTo(120, 6);
    const [corners] = outlineOf(r);
    expect(corners![0]!.x).toBeCloseTo(100, 6);
    expect(corners![0]!.y).toBeCloseTo(0, 6);
  });
});

describe('groups (AN13)', () => {
  it('resizing a group scales its children with it', async () => {
    const { createGroup } = await import('../../../../src/core/animation/factory.ts');
    const g = createGroup([
      createRect({ x: 100, y: 500, width: 200, height: 80 }),
      createEllipse({ x: 120, y: 560, width: 40, height: 40 }),
    ]);
    const half = setSize(g, 100, 50);
    expect(half.children[0]).toMatchObject({ x: 0, y: 0, width: 100, height: 40 });
    expect(half.children[1]).toMatchObject({ x: 10, y: 30, width: 20, height: 20 });
  });
});
