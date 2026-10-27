// M15 / AN10: morphing (shape tweening) — a shape becomes another shape, the in-between outlines
// generated; colour, size and position can change at the same time.
import { describe, expect, it } from 'vitest';
import {
  createEllipse,
  createLine,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { morphShapes, resample, shapeOf } from '../../../../src/core/animation/morph.ts';
import {
  morphInto,
  objectAt,
  setPropertyAt,
  trackOf,
} from '../../../../src/core/animation/tween.ts';
import type { AnimObject, PathObject } from '../../../../src/core/animation/types.ts';

const bounds = (pts: { x: number; y: number }[]) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

describe('morphing (AN10)', () => {
  it('resamples an outline by length: a square to 8 points gives its corners and the middles of its sides', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(resample(square, true, 8)).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0.5, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0.5 },
    ]);
    expect(
      resample(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        false,
        3,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 1, y: 0 },
    ]);
  });

  it('a circle into a square: exactly each at the ends; halfway it has four-fold symmetry', () => {
    const circle = shapeOf(createEllipse({ x: 0, y: 0, width: 100, height: 100 }));
    const square = shapeOf(createRect({ x: 0, y: 0, width: 100, height: 100 }));
    expect(morphShapes(circle, square, 0)).toBe(circle);
    expect(morphShapes(circle, square, 1)).toBe(square);
    const half = morphShapes(circle, square, 0.5);
    expect(half.closed).toBe(true);
    const b = bounds(half.points);
    expect(b.w).toBeCloseTo(b.h, 6);
    // Turned a quarter about the centre, every point lands on another point of the outline.
    for (const p of half.points) {
      const q = { x: 0.5 - (p.y - 0.5), y: 0.5 + (p.x - 0.5) };
      const nearest = Math.min(...half.points.map((r) => Math.hypot(r.x - q.x, r.y - q.y)));
      expect(nearest).toBeLessThan(0.02);
    }
    // Between round and square: the corners stick out further than the circle's, not as far as the square's.
    const reach = Math.max(...half.points.map((p) => Math.hypot(p.x - 0.5, p.y - 0.5)));
    expect(reach).toBeGreaterThan(0.5);
    expect(reach).toBeLessThan(Math.SQRT1_2);
  });

  it('Worked Example 19.02: a line into a circle into a rectangle and back into the same line', () => {
    let o = createLine({ x: 100, y: 100 }, { x: 300, y: 100 });
    const line = shapeOf(o);
    o = morphInto(o, createEllipse({ x: 120, y: 40, width: 160, height: 120 }), 15);
    o = morphInto(o, { ...createRect({ x: 80, y: 60, width: 240, height: 80 }), radius: 12 }, 30);
    o = setPropertyAt(o, 'shape', 45, line);
    o = setPropertyAt(o, 'width', 45, 200);
    o = setPropertyAt(o, 'height', 45, 0);
    o = setPropertyAt(o, 'x', 45, 100);
    o = setPropertyAt(o, 'y', 45, 100);
    expect(trackOf(o, 'shape')!.keyframes.map((k) => k.frame)).toEqual([0, 15, 30, 45]);
    const atCircle = objectAt(o, 15) as PathObject;
    expect(atCircle).toMatchObject({
      kind: 'path',
      closed: true,
      x: 120,
      y: 40,
      width: 160,
      height: 120,
    });
    const end = objectAt(o, 45) as PathObject;
    expect(end.closed).toBe(false);
    expect(end.points[0]).toEqual({ x: 0, y: 0 });
    expect(end.points.at(-1)).toEqual({ x: 200, y: 0 });
    expect(end).toMatchObject({ x: 100, y: 100, width: 200 });
    // On the way the outline really is in between: closed and taller than the line.
    const between = objectAt(o, 22) as PathObject;
    expect(between.kind).toBe('path');
    expect(between.height).toBeGreaterThan(0);
  });

  it('the colour changes with the shape (a small red square into a large blue circle)', () => {
    let o = {
      ...createRect({ x: 0, y: 0, width: 50, height: 50 }),
      fill: { kind: 'solid' as const, colour: '#ff0000' },
    };
    o = morphInto(
      o,
      {
        ...createEllipse({ x: 0, y: 0, width: 200, height: 200 }),
        fill: { kind: 'solid', colour: '#0000ff' },
      },
      24,
    );
    expect(objectAt(o, 12)).toMatchObject({
      width: 125,
      fill: { kind: 'solid', colour: '#800080' },
    });
    expect(objectAt(o, 24).fill).toEqual({ kind: 'solid', colour: '#0000ff' });
  });

  it('only shapes morph: text, pictures and groups are refused', () => {
    expect(() => shapeOf(createText('A', { x: 0, y: 0 }))).toThrow(/Only shapes/);
    expect(() =>
      morphInto(createRect({ x: 0, y: 0 }), createText('A', { x: 0, y: 0 }), 10),
    ).toThrow(/Only shapes/);
  });

  it('a hold keeps the first shape until the next keyframe (frame by frame)', () => {
    let o = morphInto(
      createRect({ x: 0, y: 0, width: 100, height: 100 }),
      createEllipse({ x: 0, y: 0, width: 100, height: 100 }),
      10,
    );
    const t = trackOf(o, 'shape')!;
    o = {
      ...o,
      tracks: o.tracks!.map((k) =>
        k === t ? { ...t, keyframes: [{ ...t.keyframes[0]!, hold: true }, t.keyframes[1]!] } : k,
      ),
    };
    expect((objectAt(o, 9) as AnimObject as PathObject).points).toHaveLength(4);
  });
});
