// M18 / G5: align left, centre, right, top, middle, bottom to the selection, the first object or
// the canvas; distribute centres or gaps evenly (coursebook Figures 18.14, 18.15).
import { describe, expect, it } from 'vitest';
import { createEllipse, createRect } from '../../../../src/core/animation/factory.ts';
import { alignMoves, distributeMoves } from '../../../../src/core/graphics/align.ts';

const box = (x: number, y: number, width = 20, height = 20, name = 'R') => ({
  ...createRect({ x, y, width, height }),
  name,
});
const canvas = { width: 500, height: 400 };

describe('alignMoves (G5)', () => {
  const a = box(10, 100, 40, 20);
  const b = box(100, 30, 20, 60);
  const c = box(60, 200, 80, 10);

  it('lines up left edges with the leftmost, right edges with the rightmost', () => {
    expect(alignMoves([a, b, c], 'left', 'selection', canvas)).toEqual([
      { id: b.id, dx: -90, dy: 0 },
      { id: c.id, dx: -50, dy: 0 },
    ]);
    expect(alignMoves([a, b, c], 'right', 'selection', canvas)).toEqual([
      { id: a.id, dx: 90, dy: 0 },
      { id: b.id, dx: 20, dy: 0 },
    ]);
  });

  it('centres them on the middle of the box round them all', () => {
    // From x 10 to 140: centre 75.
    expect(alignMoves([a, b, c], 'centre', 'selection', canvas)).toEqual([
      { id: a.id, dx: 45, dy: 0 },
      { id: b.id, dx: -35, dy: 0 },
      { id: c.id, dx: -25, dy: 0 },
    ]);
    // From y 30 to 210: middle 120.
    expect(alignMoves([a, b, c], 'middle', 'selection', canvas)).toEqual([
      { id: a.id, dx: 0, dy: 10 },
      { id: b.id, dx: 0, dy: 60 },
      { id: c.id, dx: 0, dy: -85 },
    ]);
  });

  it('lines up with the first chosen, which stays where it is (the key object)', () => {
    expect(alignMoves([c, a, b], 'top', 'first', canvas)).toEqual([
      { id: a.id, dx: 0, dy: 100 },
      { id: b.id, dx: 0, dy: 170 },
    ]);
  });

  it('puts one object in the middle of the canvas, or at its bottom edge', () => {
    expect(alignMoves([a], 'centre', 'canvas', canvas)).toEqual([{ id: a.id, dx: 220, dy: 0 }]);
    expect(alignMoves([a], 'bottom', 'canvas', canvas)).toEqual([{ id: a.id, dx: 0, dy: 280 }]);
    // One object alone has nothing else to line up with.
    expect(alignMoves([a], 'left', 'selection', canvas)).toEqual([]);
  });

  it('measures a turned object by the corners it shows', () => {
    // A 20 × 20 square turned 45° reaches 14.14 px either side of its centre (20, 20).
    const turned = { ...box(10, 10), rotation: 45 };
    const [move] = alignMoves([turned], 'left', 'canvas', canvas);
    expect(move!.dx).toBeCloseTo(-5.858, 2);
  });
});

describe('distributeMoves (G5)', () => {
  it('spaces centres evenly between the two furthest apart, which stay', () => {
    const a = box(0, 0, 20);
    const b = box(30, 0, 40);
    const c = box(200, 0, 20);
    // Centres 10, 50, 210: the middle one goes to 110.
    expect(distributeMoves([c, a, b], 'horizontal', 'centres')).toEqual([
      { id: b.id, dx: 60, dy: 0 },
    ]);
  });

  it('makes the gaps between edges the same', () => {
    const a = box(0, 0, 20);
    const b = box(30, 0, 60);
    const c = box(200, 0, 20);
    // 220 px across, 100 px of shapes: gaps of 60. b starts at 80.
    expect(distributeMoves([a, b, c], 'horizontal', 'gaps')).toEqual([{ id: b.id, dx: 50, dy: 0 }]);
  });

  it('spaces six wheels down a column (coursebook exam-style 2: six evenly spaced circles)', () => {
    const wheels = [0, 15, 70, 80, 160, 250].map((y) => ({
      ...createEllipse({ x: 0, y, width: 30, height: 30 }),
      name: 'Wheel',
    }));
    const moved = distributeMoves(wheels, 'vertical', 'centres');
    const ys = wheels.map((w) => w.y + (moved.find((m) => m.id === w.id)?.dy ?? 0));
    expect(ys).toEqual([0, 50, 100, 150, 200, 250]);
  });

  it('needs three or more', () => {
    expect(distributeMoves([box(0, 0), box(50, 0)], 'horizontal', 'centres')).toEqual([]);
  });
});
