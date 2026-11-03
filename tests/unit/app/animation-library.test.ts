// M16b / AN19, AN20 as Animation mode's use cases: a library item is placed (a background on a
// layer of its own at the bottom), an effect is applied to the selection at the playhead — each
// one undo step.
import { describe, expect, it } from 'vitest';
import { centreOf } from '../../../src/core/animation/geometry.ts';
import { objectAt } from '../../../src/core/animation/tween.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  anim.setStage({ ...doc().stage, width: 600, height: 400, length: 72 });
  return { ...t, anim, doc, state: () => anim.store.get() };
}

describe('the library in Animation mode (AN19)', () => {
  it('a cartoon is placed in the middle of the stage as one group, selected, in one undo step', () => {
    const s = setup();
    expect(s.anim.addFromLibrary('cartoon.car')).toBeNull();
    const [car] = s.doc().layers[0]!.objects;
    expect(car).toMatchObject({ kind: 'group', name: 'Car' });
    expect(centreOf(car!)).toEqual({ x: 300, y: 200 });
    expect(s.state().selection).toEqual([car!.id]);
    expect(s.state().tool).toBe('select');
    s.anim.undo();
    expect(s.doc().layers[0]!.objects).toEqual([]);
  });

  it('the same item twice gets two names', () => {
    const s = setup();
    s.anim.addFromLibrary('icon.star');
    s.anim.addFromLibrary('icon.star');
    expect(s.doc().layers[0]!.objects.map((o) => o.name)).toEqual(['Star', 'Star 2']);
  });

  it('a background covers the stage on a new layer at the bottom', () => {
    const s = setup();
    s.anim.addShape('rect', { x: 10, y: 10, width: 20, height: 20 });
    expect(s.anim.addFromLibrary('background.underwater')).toBeNull();
    const [bottom, top] = s.doc().layers;
    expect(bottom!.name).toBe('Background');
    expect(bottom!.objects[0]).toMatchObject({ x: 0, y: 0, width: 600, height: 400 });
    expect(top!.objects[0]!.kind).toBe('rect');
    s.anim.undo();
    expect(s.doc().layers).toHaveLength(1);
  });

  it('refuses an item that does not exist, and a locked layer', () => {
    const s = setup();
    expect(s.anim.addFromLibrary('nope')).toMatch(/not in the library/i);
    s.anim.toggleLayer(s.doc().layers[0]!.id, 'locked');
    expect(s.anim.addFromLibrary('cartoon.cat')).toMatch(/locked/i);
  });
});

describe('one-click effects in Animation mode (AN20)', () => {
  it('applies to every selected object from the playhead, in one undo step', () => {
    const s = setup();
    s.anim.addShape('rect', { x: 100, y: 100, width: 50, height: 50 });
    s.anim.addShape('ellipse', { x: 300, y: 100, width: 50, height: 50 });
    s.anim.selectAll();
    s.anim.setFrame(24);
    expect(s.anim.applyEffect('fadeIn', 1)).toBeNull();
    for (const o of s.doc().layers[0]!.objects) {
      expect(objectAt(o, 24).opacity).toBe(0);
      expect(objectAt(o, 48).opacity).toBe(100);
    }
    s.anim.undo();
    expect(s.doc().layers[0]!.objects.every((o) => !o.tracks)).toBe(true);
  });

  it('makes the stage longer when the effect runs past its end', () => {
    const s = setup();
    s.anim.addShape('rect', { x: 100, y: 100, width: 50, height: 50 });
    s.anim.setFrame(60);
    expect(s.anim.applyEffect('spin', 2)).toBeNull();
    expect(s.doc().stage.length).toBe(108);
  });

  it('says what is wrong: nothing selected, text-only effect on a shape, a bad length', () => {
    const s = setup();
    expect(s.anim.applyEffect('fadeIn', 1)).toMatch(/select/i);
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    expect(s.anim.applyEffect('typewriter', 1)).toMatch(/only for text/i);
    expect(s.anim.applyEffect('fadeIn', 0)).toMatch(/at least one frame/i);
  });
});
