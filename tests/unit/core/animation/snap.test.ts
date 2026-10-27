// M13 / AN2: snapping to the grid, guides, other objects' edges and centres, and whole pixels.
import { describe, expect, it } from 'vitest';
import { createAnimation, createRect, createStar } from '../../../../src/core/animation/factory.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import { snapBox, snapValue } from '../../../../src/core/animation/snap.ts';
import type { AnimationDoc } from '../../../../src/core/animation/types.ts';

const star = createStar({ x: 128, y: 102, width: 135, height: 135 });
const mover = createRect({ x: 0, y: 0, width: 40, height: 40 });

function doc(view: Partial<AnimationDoc['view']['snap']> = {}, extra: Partial<AnimationDoc> = {}) {
  let d = createAnimation({ name: 'A' });
  d = addObject(d, d.layers[0]!.id, star);
  d = addObject(d, d.layers[0]!.id, mover);
  return { ...d, view: { ...d.view, snap: { ...d.view.snap, ...view } }, ...extra };
}

describe('snapValue', () => {
  it('snaps to the nearest candidate within the threshold and says what it was', () => {
    expect(snapValue(103, [{ value: 100, label: 'grid' }], 4)).toEqual({ value: 100, to: 'grid' });
    expect(snapValue(105, [{ value: 100, label: 'grid' }], 4)).toEqual({ value: 105, to: null });
  });
});

describe('snapBox (AN2)', () => {
  // 40 wide, so its left edge, centre and right edge are all the same distance from the grid.
  const box = { x: 103, y: 0, width: 40, height: 40 };

  it('103 snaps to 100 on a 10 px grid within 4 px and reports the grid', () => {
    const d = doc({ grid: true, guides: false, objects: false });
    const r = snapBox(d, box, { threshold: 4, exclude: [mover.id] });
    expect(r).toEqual({ dx: -3, dy: 0, to: 'grid' });
  });

  it('a guide wins over the grid when both are within reach', () => {
    const d = doc({ grid: true, guides: true, objects: false }, { guides: { x: [250], y: [] } });
    const grid8 = { ...d, view: { ...d.view, grid: { ...d.view.grid, size: 8 } } };
    const r = snapBox(grid8, { ...box, x: 247.5 }, { threshold: 4, exclude: [mover.id] });
    expect(r).toEqual({ dx: 2.5, dy: 0, to: 'guide' });
  });

  it('an object’s edge or centre attracts the moved object’s edges and centre', () => {
    const d = doc({ grid: false, guides: false, objects: true });
    // The star's right edge is at 263: the moved box's left edge at 261 snaps to it.
    expect(snapBox(d, { ...box, x: 261 }, { threshold: 4, exclude: [mover.id] })).toEqual({
      dx: 2,
      dy: 0,
      to: 'edge of Star',
    });
    // The star's centre is at (195.5, 169.5): the box's own centre is too far, but its top edge at
    // 171 snaps to the star's vertical centre.
    expect(snapBox(d, { ...box, x: 400, y: 171 }, { threshold: 4, exclude: [mover.id] })).toEqual({
      dx: 0,
      dy: -1.5,
      to: 'centre of Star',
    });
  });

  it('with only pixels on, 103.4 becomes 103 quietly; with everything off nothing moves', () => {
    const pixels = doc({ grid: false, guides: false, objects: false, pixels: true });
    expect(snapBox(pixels, { ...box, x: 103.4 }, { threshold: 4, exclude: [] })).toEqual({
      dx: -0.4,
      dy: 0,
      to: null,
    });
    const off = doc({ grid: false, guides: false, objects: false, pixels: false });
    expect(snapBox(off, { ...box, x: 103.4 }, { threshold: 4, exclude: [] })).toEqual({
      dx: 0,
      dy: 0,
      to: null,
    });
    expect(snapBox(doc(), box, { threshold: 4, exclude: [], off: true })).toEqual({
      dx: 0,
      dy: 0,
      to: null,
    });
  });

  it('the threshold is in stage pixels, so it is the caller’s to scale with the zoom', () => {
    const d = doc({ grid: true, guides: false, objects: false });
    expect(snapBox(d, { ...box, x: 105 }, { threshold: 8 / 2, exclude: [] }).dx).toBe(0);
    expect(snapBox(d, { ...box, x: 105 }, { threshold: 8 / 0.5, exclude: [] }).dx).toBe(-5);
  });

  it('hidden layers’ objects and the excluded ones do not attract', () => {
    const d = doc({ grid: false, guides: false, objects: true });
    const hidden = { ...d, layers: d.layers.map((l) => ({ ...l, visible: false })) };
    expect(snapBox(hidden, { ...box, x: 261 }, { threshold: 4, exclude: [] }).dx).toBe(0);
    expect(snapBox(d, { ...box, x: 261 }, { threshold: 4, exclude: [mover.id, star.id] }).dx).toBe(
      0,
    );
  });
});
