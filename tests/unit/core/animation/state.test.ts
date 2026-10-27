// M14 / AN9, AN13: the document at a frame — every object with its tweened values; a group's
// parts placed by the group's position and turn while keeping their own tweens; drawn at a frame.
import { describe, expect, it } from 'vitest';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createRect,
} from '../../../../src/core/animation/factory.ts';
import { moved as movedBy } from '../../../../src/core/animation/geometry.ts';
import {
  addObject,
  duplicateObjects,
  groupObjects,
  ungroup,
  updateObject,
} from '../../../../src/core/animation/layers.ts';
import { placementOf, stateAt } from '../../../../src/core/animation/state.ts';
import { setPropertyAt } from '../../../../src/core/animation/tween.ts';
import type { AnimationDoc } from '../../../../src/core/animation/types.ts';

function withCircle(): { doc: AnimationDoc; id: string } {
  const circle = setPropertyAt(
    createEllipse({ x: 0, y: 0, width: 204, height: 204 }),
    'x',
    72,
    396,
  );
  const doc = createAnimation({ name: 'Task 1' });
  return { doc: addObject(doc, doc.layers[0]!.id, circle), id: circle.id };
}

describe('the document at a frame (AN9)', () => {
  it('stateAt gives every object its tweened values and keeps everything else', () => {
    const { doc } = withCircle();
    const at36 = stateAt(doc, 36);
    expect(at36.layers[0]!.objects[0]!.x).toBe(198);
    expect(at36.stage).toBe(doc.stage);
    expect(stateAt(doc, 0)).toEqual(doc);
  });

  it('draws the stage at a frame through the same drawing function', () => {
    const { doc } = withCircle();
    const translates: number[][] = [];
    const ctx = new Proxy({} as Record<string, unknown>, {
      get: (target, key: string) =>
        key in target
          ? target[key]
          : (...args: unknown[]) => {
              if (key === 'translate') translates.push(args as number[]);
              if (key.startsWith('create')) return { addColorStop: () => {} };
              return undefined;
            },
      set: (target, key: string, value) => ((target[key] = value), true),
    }) as unknown as StageCanvas;
    drawStage(ctx, doc, { frame: 36 });
    expect(translates[0]).toEqual([300, 102]);
  });
});

describe('groups keep their own motion (AN13)', () => {
  const car = () => {
    const body = createRect({ x: 100, y: 500, width: 200, height: 100 });
    const wheel = setPropertyAt(
      createEllipse({ x: 140, y: 560, width: 40, height: 40 }),
      'rotation',
      72,
      360,
    );
    const group = createGroup([body, wheel]);
    const doc = createAnimation({ name: 'car' });
    return { doc: addObject(doc, doc.layers[0]!.id, group), group, wheel };
  };

  it('a wheel at (40, 60) inside a car group at (100, 500) draws at (140, 560)', () => {
    const { doc, group, wheel } = car();
    expect(group.children[1]).toMatchObject({ x: 40, y: 60 });
    const place = placementOf(doc, wheel.id, 0);
    expect(place).toEqual({ x: 140, y: 560, centre: { x: 160, y: 580 }, rotation: 0 });
    expect(placementOf(doc, group.id, 0)).toMatchObject({ x: 100, y: 500, rotation: 0 });
  });

  it("the car turning 90° turns the wheel's position with it; the wheel's own turn adds to the car's", () => {
    const { group, wheel, ...rest } = car();
    let doc = rest.doc;
    const turned = setPropertyAt(group, 'rotation', 72, 90);
    doc = { ...doc, layers: [{ ...doc.layers[0]!, objects: [turned] }] };
    const place = placementOf(doc, wheel.id, 72);
    expect(place.centre.x).toBeCloseTo(170, 6);
    expect(place.centre.y).toBeCloseTo(510, 6);
    expect(place.rotation).toBe(450);
    expect(placementOf(doc, wheel.id, 36).rotation).toBe(225);
  });

  it('the car driving moves the wheel, which keeps spinning', () => {
    const { group, wheel, ...rest } = car();
    let doc = rest.doc;
    const driving = setPropertyAt(group, 'x', 72, 700);
    doc = { ...doc, layers: [{ ...doc.layers[0]!, objects: [driving] }] };
    const place = placementOf(doc, wheel.id, 36);
    expect(place).toMatchObject({ x: 440, y: 560, rotation: 180 });
    const children = (
      stateAt(doc, 36).layers[0]!.objects[0] as { children: { rotation: number }[] }
    ).children;
    expect(children[1]!.rotation).toBe(180);
  });

  it('a group that grows scales its parts with it', () => {
    const { doc, group, wheel } = car();
    const bigger = setPropertyAt(group, 'width', 72, 400);
    const d = { ...doc, layers: [{ ...doc.layers[0]!, objects: [bigger] }] };
    expect(placementOf(d, wheel.id, 72)).toMatchObject({ x: 180, y: 560 });
    const children = (stateAt(d, 72).layers[0]!.objects[0] as { children: { width: number }[] })
      .children;
    expect(children[1]!.width).toBe(80);
  });

  it('grouping and ungrouping objects that already move keeps their motion on the stage', () => {
    const circle = setPropertyAt(
      createEllipse({ x: 100, y: 50, width: 204, height: 204 }),
      'x',
      72,
      496,
    );
    const rect = createRect({ x: 20, y: 10 });
    let doc = createAnimation({ name: 'g' });
    doc = addObject(addObject(doc, doc.layers[0]!.id, rect), doc.layers[0]!.id, circle);
    const { doc: grouped, group } = groupObjects(doc, [rect.id, circle.id]);
    const inside = (
      grouped.layers[0]!.objects[0] as {
        children: { tracks?: { keyframes: { value: number }[] }[] }[];
      }
    ).children[1]!;
    expect(inside.tracks![0]!.keyframes.map((k) => k.value)).toEqual([80, 476]);
    expect(placementOf(grouped, circle.id, 36).x).toBe(298);
    const back = ungroup(grouped, group.id);
    expect(placementOf(back, circle.id, 36).x).toBe(298);
    expect(placementOf(back, circle.id, 72).x).toBe(496);
  });

  it('moving or duplicating an object moves its whole motion', () => {
    const { doc, id } = withCircle();
    const moved = updateObject(doc, id, (o) => movedBy(o, 10, 0));
    expect(placementOf(moved, id, 72).x).toBe(406);
    const { doc: two, ids } = duplicateObjects(doc, [id]);
    expect(placementOf(two, ids[0]!, 36).x).toBe(208);
  });

  it('asks for an object that exists', () => {
    const { doc } = withCircle();
    expect(() => placementOf(doc, 'nope', 0)).toThrow(/no longer exists/);
  });
});
