// M16b / AN19: the built-in library — cartoon clip-art, icons and symbols, and backgrounds, each
// made of the app's own vector shapes, grouped and named by part so the parts can be animated.
import { describe, expect, it } from 'vitest';
import { drawObject, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import { outlineOf } from '../../../../src/core/animation/geometry.ts';
import {
  LIBRARY,
  LIBRARY_CATEGORIES,
  buildItem,
  itemById,
  placeItem,
  searchLibrary,
} from '../../../../src/core/animation/library/index.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import type { AnimObject, GroupObject } from '../../../../src/core/animation/types.ts';

const leaves = (o: AnimObject): AnimObject[] =>
  o.kind === 'group' ? o.children.flatMap(leaves) : [o];
const ids = (o: AnimObject): string[] =>
  o.kind === 'group' ? [o.id, ...o.children.flatMap(ids)] : [o.id];

/** A canvas that accepts every call and records nothing (drawing must not throw). */
const quiet = new Proxy({} as Record<string, unknown>, {
  get: (t, k: string) =>
    k in t ? t[k] : k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {},
  set: (t, k: string, v) => ((t[k] = v), true),
}) as unknown as StageCanvas;

describe('the library (AN19)', () => {
  it('has the three categories, each with enough to choose from', () => {
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toEqual(['cartoons', 'icons', 'backgrounds']);
    const count = (c: string) => LIBRARY.filter((i) => i.category === c).length;
    expect(count('cartoons')).toBeGreaterThanOrEqual(12);
    expect(count('icons')).toBeGreaterThanOrEqual(16);
    expect(count('backgrounds')).toBeGreaterThanOrEqual(6);
    expect(new Set(LIBRARY.map((i) => i.id)).size).toBe(LIBRARY.length);
  });

  it.each(LIBRARY.map((i) => [i.id, i] as const))(
    '%s is a named group of named, valid parts inside its box, and draws',
    (_id, item) => {
      const group = buildItem(item) as GroupObject;
      expect(group.kind).toBe('group');
      expect(group.name).toBe(item.name);
      expect(group.children.length).toBeGreaterThanOrEqual(item.category === 'icons' ? 1 : 2);
      for (const part of leaves(group)) {
        validateObject(part);
        expect(part.name).not.toMatch(/^(Rectangle|Ellipse|Star|Polygon|Shape|Path)$/);
      }
      // Every part lies inside the item's own box (a pixel's leeway for outlines).
      expect(group.width).toBeLessThanOrEqual(item.width + 1);
      expect(group.height).toBeLessThanOrEqual(item.height + 1);
      for (const child of group.children)
        for (const outline of outlineOf(child))
          for (const p of outline) {
            expect(p.x).toBeGreaterThanOrEqual(-1);
            expect(p.y).toBeGreaterThanOrEqual(-1);
            expect(p.x).toBeLessThanOrEqual(group.width + 1);
            expect(p.y).toBeLessThanOrEqual(group.height + 1);
          }
      expect(() => drawObject(quiet, group)).not.toThrow();
      expect(item.keywords.length).toBeGreaterThan(0);
    },
  );

  it('each placing makes new ids, so the same item can be used twice', () => {
    const item = itemById('cartoon.car')!;
    const a = ids(buildItem(item));
    const b = ids(buildItem(item));
    expect(a.some((id) => b.includes(id))).toBe(false);
  });

  it('a picture is placed in the middle of the stage, made smaller if it would not fit', () => {
    const stage = { width: 600, height: 400 };
    const car = itemById('cartoon.car')!;
    const placed = placeItem(car, stage);
    expect(placed.x + placed.width / 2).toBeCloseTo(300, 6);
    expect(placed.y + placed.height / 2).toBeCloseTo(200, 6);
    const tiny = placeItem(car, { width: 100, height: 60 });
    expect(tiny.width).toBeLessThanOrEqual(100 * 0.8 + 1e-9);
    expect(tiny.height).toBeLessThanOrEqual(60 * 0.8 + 1e-9);
    const own = buildItem(car);
    expect(tiny.width / tiny.height).toBeCloseTo(own.width / own.height, 6);
  });

  it('a background covers the whole stage', () => {
    const stage = { width: 1024, height: 768 };
    const sky = placeItem(itemById('background.sky')!, stage);
    expect({ x: sky.x, y: sky.y, width: sky.width, height: sky.height }).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 768,
    });
  });

  it('search finds by name and keyword, ignoring capitals, within a category', () => {
    expect(searchLibrary('CAR').map((i) => i.id)).toContain('cartoon.car');
    expect(searchLibrary('weather').map((i) => i.id)).toEqual(
      expect.arrayContaining(['icon.sun', 'icon.cloud', 'icon.lightning']),
    );
    expect(searchLibrary('', 'backgrounds').every((i) => i.category === 'backgrounds')).toBe(true);
    expect(searchLibrary('flowchart', 'icons').length).toBeGreaterThanOrEqual(4);
    expect(searchLibrary('zzzz')).toEqual([]);
  });
});
