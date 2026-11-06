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
  it('has the eight categories, each with enough to choose from', () => {
    expect(LIBRARY_CATEGORIES.map((c) => c.id)).toEqual([
      'cartoons',
      'school',
      'maths',
      'science',
      'biology',
      'computers',
      'icons',
      'backgrounds',
    ]);
    const count = (c: string) => LIBRARY.filter((i) => i.category === c).length;
    expect(count('cartoons')).toBeGreaterThanOrEqual(12);
    expect(count('school')).toBeGreaterThanOrEqual(16);
    expect(count('maths')).toBeGreaterThanOrEqual(28);
    expect(count('science')).toBeGreaterThanOrEqual(26);
    expect(count('biology')).toBeGreaterThanOrEqual(22);
    expect(count('computers')).toBeGreaterThanOrEqual(62);
    expect(count('icons')).toBeGreaterThanOrEqual(16);
    expect(count('backgrounds')).toBeGreaterThanOrEqual(30);
    expect(new Set(LIBRARY.map((i) => i.id)).size).toBe(LIBRARY.length);
  });

  it.each(LIBRARY.map((i) => [i.id, i] as const))(
    '%s is a named group of named, valid parts inside its box, and draws',
    (_id, item) => {
      const group = buildItem(item) as GroupObject;
      expect(group.kind).toBe('group');
      expect(group.name).toBe(item.name);
      // A symbol (a minus sign, a pointer) may be one shape; a picture has parts.
      const symbol = item.category !== 'cartoons' && item.category !== 'backgrounds';
      expect(group.children.length).toBeGreaterThanOrEqual(symbol ? 1 : 2);
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

  it('school, science and computer pictures are found by the words a lesson uses', () => {
    const found = (q: string) => searchLibrary(q).map((i) => i.id);
    expect(found('science')).toEqual(
      expect.arrayContaining(['school.atom', 'school.flask', 'school.microscope']),
    );
    expect(found('maths')).toEqual(
      expect.arrayContaining(['school.plus', 'school.minus', 'school.times', 'school.divide']),
    );
    expect(found('network')).toEqual(
      expect.arrayContaining(['computer.router', 'computer.server', 'computer.wifi']),
    );
    expect(found('security')).toEqual(
      expect.arrayContaining(['computer.padlock', 'computer.key', 'computer.shield']),
    );
    expect(found('storage')).toEqual(
      expect.arrayContaining(['computer.database', 'computer.usb', 'computer.harddisk']),
    );
    expect(found('input device')).toEqual(
      expect.arrayContaining(['computer.keyboard', 'computer.mouse', 'computer.microphone']),
    );
    expect(found('output device')).toEqual(
      expect.arrayContaining(['computer.printer', 'computer.speaker', 'computer.monitor']),
    );
  });

  it('maths, physics, chemistry, biology and computing pictures are on their own tabs', () => {
    const tab = (c: string) => searchLibrary('', c as never).map((i) => i.id);
    expect(tab('maths')).toEqual(
      expect.arrayContaining(['school.plus', 'school.protractor', 'maths.compasses', 'maths.pi']),
    );
    expect(tab('science')).toEqual(
      expect.arrayContaining(['school.atom', 'school.magnet', 'science.circuit', 'science.prism']),
    );
    expect(tab('biology')).toEqual(
      expect.arrayContaining(['school.dna', 'school.microscope', 'biology.skeleton']),
    );
    expect(tab('school')).not.toContain('school.atom');
  });

  it('the new pictures are found by the words a lesson uses', () => {
    const found = (q: string) => searchLibrary(q).map((i) => i.id);
    expect(found('geometry')).toEqual(
      expect.arrayContaining([
        'maths.compasses',
        'maths.pythagoras',
        'school.protractor',
        'school.setsquare',
      ]),
    );
    expect(found('3d shape')).toEqual(
      expect.arrayContaining([
        'maths.cube',
        'maths.cylinder',
        'maths.cone',
        'maths.pyramid',
        'maths.sphere',
      ]),
    );
    expect(found('maths')).toEqual(
      expect.arrayContaining([
        'maths.squareroot',
        'maths.percent',
        'maths.infinity',
        'maths.axes',
        'maths.venn',
        'maths.numberline',
      ]),
    );
    expect(found('electricity')).toEqual(
      expect.arrayContaining(['science.circuit', 'school.battery']),
    );
    expect(found('light')).toEqual(expect.arrayContaining(['science.lens', 'science.prism']));
    expect(found('force')).toEqual(
      expect.arrayContaining([
        'science.forces',
        'science.pulley',
        'science.lever',
        'science.spring',
        'science.pendulum',
      ]),
    );
    expect(found('physics')).toEqual(
      expect.arrayContaining([
        'science.wave',
        'science.magnetfield',
        'science.solarsystem',
        'science.rocket',
      ]),
    );
    expect(found('chemistry')).toEqual(
      expect.arrayContaining(['science.bunsen', 'science.molecule', 'school.flask']),
    );
    expect(found('skeleton')).toEqual(
      expect.arrayContaining(['biology.skeleton', 'biology.skull']),
    );
    expect(found('organ')).toEqual(
      expect.arrayContaining([
        'biology.heart',
        'biology.lungs',
        'biology.brain',
        'biology.eye',
        'biology.digestive',
      ]),
    );
    expect(found('cell')).toEqual(
      expect.arrayContaining(['biology.animalcell', 'biology.plantcell', 'biology.neuron']),
    );
    expect(found('microbe')).toEqual(
      expect.arrayContaining(['biology.bacterium', 'biology.virus']),
    );
    expect(found('plant')).toEqual(expect.arrayContaining(['biology.flower', 'school.seedling']));
    expect(found('tooth')).toContain('biology.tooth');
    expect(found('logic gate')).toEqual(
      expect.arrayContaining([
        'computer.and',
        'computer.or',
        'computer.not',
        'computer.nand',
        'computer.nor',
        'computer.xor',
      ]),
    );
    expect(found('binary')).toContain('computer.binary');
    expect(found('hardware')).toContain('computer.motherboard');
    expect(found('security')).toEqual(
      expect.arrayContaining(['computer.firewall', 'computer.fingerprint']),
    );
    expect(found('robot')).toContain('computer.robot');
  });

  it('backgrounds: scenes, paper and patterns are found by the words a teacher uses', () => {
    const found = (q: string) => searchLibrary(q, 'backgrounds').map((i) => i.id);
    expect(found('pattern').length).toBeGreaterThanOrEqual(8);
    expect(found('texture').length).toBeGreaterThanOrEqual(4);
    expect(found('paper')).toEqual(
      expect.arrayContaining(['background.graphpaper', 'background.linedpaper']),
    );
    expect(found('chalkboard')).toContain('background.chalkboard');
    expect(found('lab')).toContain('background.sciencelab');
    expect(found('space')).toEqual(
      expect.arrayContaining(['background.space', 'background.earth']),
    );
    expect(found('map')).toContain('background.worldmap');
    expect(found('presentation')).toContain('background.stage');
    expect(found('biology')).toContain('background.cell');
    expect(found('technology')).toContain('background.circuit');
  });

  it('a background stays light enough to redraw every frame on a school laptop', () => {
    for (const item of LIBRARY.filter((i) => i.category === 'backgrounds'))
      expect(leaves(buildItem(item)).length, item.id).toBeLessThanOrEqual(320);
  });

  it('the human skeleton is built from named bones, so each can be animated on its own', () => {
    const names = leaves(buildItem(itemById('biology.skeleton')!) as GroupObject).map(
      (p) => p.name,
    );
    for (const bone of [
      /skull/i,
      /jaw|mandible/i,
      /spine|vertebra/i,
      /rib/i,
      /pelvis/i,
      /left femur/i,
      /right femur/i,
      /left humerus/i,
      /right humerus/i,
      /left tibia/i,
      /right tibia/i,
    ])
      expect(names.some((n) => bone.test(n))).toBe(true);
    expect(names.length).toBeGreaterThanOrEqual(30);
  });
});
