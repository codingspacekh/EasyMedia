// M15 / AN11: path geometry for motion paths — a path's length, the point and the direction at
// any distance or fraction, and even speed along segments of different lengths.
import { describe, expect, it } from 'vitest';
import {
  flattenCurves,
  pathLength,
  pointAt,
  pointAtFraction,
  polylineOf,
} from '../../../../src/core/animation/path.ts';

/** A cubic Bézier quarter circle of radius 100: from (0, 0) right, then curving down to (100, 100). */
const K = 0.5522847498;
const quarter = [
  { x: 0, y: 0, out: { x: 100 * K, y: 0 } },
  { x: 100, y: 100, in: { x: 100, y: 100 - 100 * K } },
];

describe('path geometry (AN11)', () => {
  it('a straight path from (0, 0) to (300, 0) is 300 long; halfway is (150, 0), heading 0°', () => {
    const line = polylineOf(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      false,
    );
    expect(pathLength(line)).toBe(300);
    expect(pointAt(line, 150)).toEqual({ x: 150, y: 0, angle: 0 });
    expect(pointAtFraction(line, 0.5)).toEqual({ x: 150, y: 0, angle: 0 });
  });

  it('a quarter circle of radius 100 is 157.08 long; it starts heading 0° and ends heading 90°', () => {
    const arc = polylineOf(flattenCurves(quarter, false), false);
    expect(pathLength(arc)).toBeCloseTo(157.08, 1);
    // The heading comes from the flattened chords: within a degree (unseen on a car on a road).
    expect(Math.abs(pointAtFraction(arc, 0).angle)).toBeLessThan(1);
    const end = pointAtFraction(arc, 1);
    expect([end.x, end.y]).toEqual([100, 100]);
    expect(Math.abs(end.angle - 90)).toBeLessThan(1);
    const half = pointAtFraction(arc, 0.5);
    expect(Math.hypot(half.x - 0, half.y - 100)).toBeCloseTo(100, 1);
    expect(half.angle).toBeCloseTo(45, 0);
  });

  it('at even speed two unequal segments meet at the right fraction, not at 50 %', () => {
    const corner = polylineOf(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 300 },
      ],
      false,
    );
    expect(pointAtFraction(corner, 0.25)).toMatchObject({ x: 100, y: 0 });
    expect(pointAtFraction(corner, 0.5, false)).toMatchObject({ x: 100, y: 0 });
    expect(pointAtFraction(corner, 0.75, false)).toMatchObject({ x: 100, y: 150, angle: 90 });
  });

  it('a closed path goes back to its start; heading left is 180°, up is −90°', () => {
    const square = polylineOf(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      true,
    );
    expect(pathLength(square)).toBe(400);
    expect(pointAtFraction(square, 0.625)).toMatchObject({ x: 50, y: 100, angle: 180 });
    expect(pointAtFraction(square, 0.875)).toMatchObject({ x: 0, y: 50, angle: -90 });
    expect(pointAtFraction(square, 1)).toMatchObject({ x: 0, y: 0 });
  });

  it('fractions outside 0–1 stay at the ends; a path with no length stays at its point', () => {
    const line = polylineOf(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      false,
    );
    expect(pointAtFraction(line, -1)).toMatchObject({ x: 0, y: 0 });
    expect(pointAtFraction(line, 2)).toMatchObject({ x: 10, y: 0 });
    const dot = polylineOf(
      [
        { x: 5, y: 5 },
        { x: 5, y: 5 },
      ],
      false,
    );
    expect(pointAtFraction(dot, 0.5)).toEqual({ x: 5, y: 5, angle: 0 });
  });

  it('curves are flattened finely enough for motion (within a quarter of a pixel)', () => {
    const pts = flattenCurves(quarter, false);
    expect(pts.length).toBeGreaterThan(30);
    for (const p of pts) expect(Math.abs(Math.hypot(p.x, p.y - 100) - 100)).toBeLessThan(0.25);
  });
});
