// M15 / AN10–AN12 in Animation mode: Follow path, Morph into… and Mask, each one undo step.
import { describe, expect, it } from 'vitest';
import { centreOf } from '../../../src/core/animation/geometry.ts';
import { objectAt, trackOf } from '../../../src/core/animation/tween.ts';
import type { AnimObject, PathObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const objects = (): AnimObject[] => doc().layers.flatMap((l) => l.objects);
  const find = (id: string) => objects().find((o) => o.id === id)!;
  const last = () => objects().at(-1)!;
  return { ...t, anim, doc, objects, find, last, state: () => anim.store.get() };
}

describe('Follow path (AN11)', () => {
  it('the selected object follows another object from frame 0 to the end; the path object stays (a road)', () => {
    const s = setup();
    s.anim.addLine({ x: 0, y: 500 }, { x: 1240, y: 500 });
    const road = s.last();
    s.anim.addShape('rect', { x: 0, y: 0, width: 80, height: 30 });
    const car = s.last();
    expect(s.anim.followPath(car.id, road.id)).toBeNull();
    expect(s.find(car.id).paths![0]).toMatchObject({
      from: 0,
      to: 120,
      orient: false,
      source: 'Line',
    });
    expect(centreOf(objectAt(s.find(car.id), 60))).toEqual({ x: 620, y: 500 });
    expect(s.find(road.id)).toBeDefined();
    expect(s.state().history.past.at(-1)!.label).toBe('Follow path');
    s.anim.undo();
    expect(s.find(car.id).paths).toBeUndefined();
  });

  it('its frames, Orient to path, even speed and easing can be changed; a bad range is explained; Remove', () => {
    const s = setup();
    s.anim.addLine({ x: 0, y: 0 }, { x: 100, y: 100 });
    const path = s.last();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    const box = s.last();
    s.anim.followPath(box.id, path.id);
    expect(
      s.anim.setMotion(box.id, 0, { from: 24, to: 72, orient: true, easing: 'ease-in-out' }),
    ).toBeNull();
    expect(s.find(box.id).paths![0]).toMatchObject({
      from: 24,
      to: 72,
      orient: true,
      easing: 'ease-in-out',
    });
    expect(objectAt(s.find(box.id), 48).rotation).toBeCloseTo(45, 6);
    expect(s.anim.setMotion(box.id, 0, { to: 10 })).toMatch(/before it ends/);
    s.anim.removeMotion(box.id, 0);
    expect(s.find(box.id).paths).toBeUndefined();
  });

  it('Task 6: a second path starts where the first ends; with no time left it is explained', () => {
    const s = setup();
    s.anim.addLine({ x: 100, y: 400 }, { x: 400, y: 300 });
    const out = s.last();
    s.anim.addLine({ x: 400, y: 300 }, { x: 100, y: 400 });
    const back = s.last();
    s.anim.addShape('rect', { x: 0, y: 0, width: 40, height: 30 });
    const computer = s.last();
    s.anim.followPath(computer.id, out.id);
    expect(s.anim.followPath(computer.id, back.id)).toMatch(/no time left/);
    s.anim.setMotion(computer.id, 0, { to: 24 });
    expect(s.anim.followPath(computer.id, back.id)).toBeNull();
    expect(s.anim.setMotion(computer.id, 1, { from: 48, to: 72 })).toBeNull();
    expect(s.find(computer.id).paths!.map((p) => [p.from, p.to])).toEqual([
      [0, 24],
      [48, 72],
    ]);
    expect(centreOf(objectAt(s.find(computer.id), 36))).toEqual({ x: 400, y: 300 });
    expect(centreOf(objectAt(s.find(computer.id), 72))).toEqual({ x: 100, y: 400 });
    expect(s.anim.setMotion(computer.id, 1, { from: 10 })).toMatch(/overlap/);
  });

  it('an object cannot follow itself, or a path that is gone', () => {
    const s = setup();
    s.anim.addShape('rect', { x: 0, y: 0, width: 100, height: 100 });
    const box = s.last();
    expect(s.anim.followPath(box.id, box.id)).toMatch(/another object/);
    expect(s.anim.followPath(box.id, 'gone')).toMatch(/no longer exists/);
  });
});

describe('Morph into… (AN10)', () => {
  it('at the playhead the shape becomes the one picked, which is removed; one undo step brings both back', () => {
    const s = setup();
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
    const circle = s.last();
    s.anim.addShape('rect', { x: 200, y: 0, width: 100, height: 100 });
    const square = s.last();
    s.anim.setFrame(24);
    expect(s.anim.morphInto(circle.id, square.id)).toBeNull();
    expect(s.objects().map((o) => o.id)).toEqual([circle.id]);
    expect(trackOf(s.find(circle.id), 'shape')!.keyframes.map((k) => k.frame)).toEqual([0, 24]);
    const end = objectAt(s.find(circle.id), 24) as PathObject;
    expect(end).toMatchObject({ kind: 'path', x: 200, width: 100 });
    expect(end.points).toHaveLength(4);
    s.anim.undo();
    expect(s.objects().map((o) => o.id)).toEqual([circle.id, square.id]);
  });

  it('the shape picked can be kept; text cannot morph', () => {
    const s = setup();
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
    const circle = s.last();
    s.anim.addShape('rect', { x: 200, y: 0, width: 100, height: 100 });
    const square = s.last();
    s.anim.setFrame(24);
    s.anim.morphInto(circle.id, square.id, { keepTarget: true });
    expect(s.objects()).toHaveLength(2);
    s.anim.addText({ x: 0, y: 0 }, 'A');
    expect(s.anim.morphInto(s.last().id, square.id)).toMatch(/Only shapes/);
  });
});

describe('Mask (AN12)', () => {
  it('a layer becomes a mask and back, one undo step each', () => {
    const s = setup();
    s.anim.addLayer();
    const top = s.state().layerId;
    s.anim.toggleLayer(top, 'mask');
    expect(s.doc().layers.find((l) => l.id === top)!.mask).toBe(true);
    expect(s.state().history.past.at(-1)!.label).toBe('Mask layer');
    s.anim.toggleLayer(top, 'mask');
    expect(s.doc().layers.find((l) => l.id === top)!.mask).toBe(false);
  });
});
