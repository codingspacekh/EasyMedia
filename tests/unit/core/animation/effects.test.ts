// M16b / AN20: one-click effects. Each is only ordinary keyframes from the start frame, so it can
// be changed on the timeline afterwards; what the object did before the start is kept.
import { describe, expect, it } from 'vitest';
import { centreOf } from '../../../../src/core/animation/geometry.ts';
import { ANIM_EFFECTS, applyEffect, effectOf } from '../../../../src/core/animation/effects.ts';
import { createRect, createText } from '../../../../src/core/animation/factory.ts';
import { objectAt, setPropertyAt, trackOf } from '../../../../src/core/animation/tween.ts';
import type { AnimObject, TextObject } from '../../../../src/core/animation/types.ts';

const STAGE = { width: 600, height: 400 };
const box = () => createRect({ x: 200, y: 150, width: 100, height: 60 });
const at = (o: AnimObject, f: number) => objectAt(o, f);

describe('one-click effects (AN20)', () => {
  it('has entrances, exits and emphasis, each with a label and a usual length', () => {
    const ids = ANIM_EFFECTS.map((e) => e.id);
    for (const id of [
      'fadeIn',
      'fadeOut',
      'flyInLeft',
      'flyInRight',
      'flyInTop',
      'flyInBottom',
      'flyOutLeft',
      'flyOutRight',
      'zoomIn',
      'zoomOut',
      'bounceIn',
      'spin',
      'pulse',
      'shake',
      'wobble',
      'typewriter',
      'blink',
    ])
      expect(ids).toContain(id);
    for (const e of ANIM_EFFECTS) {
      expect(['entrance', 'exit', 'emphasis']).toContain(e.group);
      expect(e.seconds).toBeGreaterThan(0);
      expect(e.label.length).toBeGreaterThan(2);
    }
    expect(effectOf('nope')).toBeUndefined();
  });

  it('Fade in: invisible until the start, then up to full opacity', () => {
    const o = applyEffect(box(), 'fadeIn', 24, 24, STAGE);
    expect(at(o, 0).opacity).toBe(0);
    expect(at(o, 24).opacity).toBe(0);
    expect(at(o, 36).opacity).toBe(50);
    expect(at(o, 48).opacity).toBe(100);
  });

  it('Fade out: as it was until the start, then gone', () => {
    const o = applyEffect({ ...box(), opacity: 80 }, 'fadeOut', 10, 20, STAGE);
    expect(at(o, 5).opacity).toBe(80);
    expect(at(o, 20).opacity).toBe(40);
    expect(at(o, 30).opacity).toBe(0);
  });

  it('Fly in from the left / right / top / bottom: from just off the stage to where it is', () => {
    const left = applyEffect(box(), 'flyInLeft', 0, 24, STAGE);
    expect(at(left, 0).x).toBe(-100);
    expect(at(left, 24).x).toBe(200);
    expect(at(left, 12).y).toBe(150);
    expect(at(applyEffect(box(), 'flyInRight', 0, 24, STAGE), 0).x).toBe(600);
    expect(at(applyEffect(box(), 'flyInTop', 0, 24, STAGE), 0).y).toBe(-60);
    expect(at(applyEffect(box(), 'flyInBottom', 0, 24, STAGE), 0).y).toBe(400);
    // Eased: more than half way at half time (it slows down as it lands).
    expect(at(left, 12).x).toBeGreaterThan(50);
  });

  it('Fly out: from where it is to just off the stage', () => {
    const o = applyEffect(box(), 'flyOutRight', 12, 12, STAGE);
    expect(at(o, 12).x).toBe(200);
    expect(at(o, 24).x).toBe(600);
    expect(at(applyEffect(box(), 'flyOutLeft', 0, 12, STAGE), 12).x).toBe(-100);
  });

  it('Zoom in grows from nothing about its centre; Zoom out shrinks to nothing', () => {
    const o = applyEffect(box(), 'zoomIn', 0, 20, STAGE);
    expect(at(o, 0)).toMatchObject({ width: 0, height: 0 });
    expect(centreOf(at(o, 0))).toEqual({ x: 250, y: 180 });
    expect(centreOf(at(o, 10))).toEqual({ x: 250, y: 180 });
    expect(at(o, 20)).toMatchObject({ x: 200, y: 150, width: 100, height: 60 });
    const out = applyEffect(box(), 'zoomOut', 0, 20, STAGE);
    expect(at(out, 20)).toMatchObject({ width: 0, height: 0 });
    expect(centreOf(at(out, 20))).toEqual({ x: 250, y: 180 });
  });

  it('Bounce in drops from above the stage and bounces to a stop where it is', () => {
    const o = applyEffect(box(), 'bounceIn', 0, 24, STAGE);
    expect(at(o, 0).y).toBe(-60);
    expect(at(o, 24).y).toBe(150);
    expect(trackOf(o, 'y')!.keyframes[0]!.easing).toBe('bounce');
  });

  it('Spin turns once, clockwise, from its own turn', () => {
    const o = applyEffect({ ...box(), rotation: 30 }, 'spin', 0, 24, STAGE);
    expect(at(o, 0).rotation).toBe(30);
    expect(at(o, 12).rotation).toBe(210);
    expect(at(o, 24).rotation).toBe(390);
  });

  it('Pulse grows a little and back, about its centre', () => {
    const o = applyEffect(box(), 'pulse', 0, 24, STAGE);
    expect(at(o, 12).width).toBeCloseTo(120, 6);
    expect(centreOf(at(o, 12))).toEqual({ x: 250, y: 180 });
    expect(at(o, 24)).toMatchObject({ x: 200, width: 100 });
  });

  it('Shake moves side to side and ends where it started; Wobble rocks and ends upright', () => {
    const shake = applyEffect(box(), 'shake', 0, 24, STAGE);
    const xs = Array.from({ length: 25 }, (_, f) => at(shake, f).x);
    expect(Math.min(...xs)).toBeLessThan(200);
    expect(Math.max(...xs)).toBeGreaterThan(200);
    expect(xs.at(-1)).toBe(200);
    const wobble = applyEffect(box(), 'wobble', 0, 24, STAGE);
    const turns = Array.from({ length: 25 }, (_, f) => at(wobble, f).rotation);
    expect(Math.min(...turns)).toBeLessThan(0);
    expect(Math.max(...turns)).toBeGreaterThan(0);
    expect(turns.at(-1)).toBe(0);
  });

  it('Typewriter shows the words a letter at a time', () => {
    const t = createText('Hello', { x: 10, y: 10 });
    const o = applyEffect(t, 'typewriter', 10, 10, STAGE) as TextObject;
    expect((at(o, 9) as TextObject).text).toBe('');
    expect((at(o, 10) as TextObject).text).toBe('H');
    expect((at(o, 14) as TextObject).text).toBe('Hel');
    expect((at(o, 20) as TextObject).text).toBe('Hello');
    expect(() => applyEffect(box(), 'typewriter', 0, 10, STAGE)).toThrow(/only for text/i);
  });

  it('Blink switches it off and on at once (held keyframes), ending on', () => {
    const o = applyEffect(box(), 'blink', 0, 24, STAGE);
    const values = new Set(Array.from({ length: 25 }, (_, f) => at(o, f).opacity));
    expect(values).toEqual(new Set([0, 100]));
    expect(at(o, 24).opacity).toBe(100);
  });

  it('keeps what the object did before the start, and replaces only the effect span', () => {
    const moving = setPropertyAt(box(), 'x', 24, 400); // 200 → 400 over the first second
    const o = applyEffect(moving, 'fadeOut', 48, 24, STAGE);
    expect(at(o, 12).x).toBe(300);
    expect(at(o, 24).x).toBe(400);
    expect(at(o, 30).opacity).toBe(100);
    expect(at(o, 72).opacity).toBe(0);
    // A second effect over the same span replaces the first one's keyframes there.
    const again = applyEffect(o, 'fadeIn', 48, 24, STAGE);
    expect(at(again, 72).opacity).toBe(100);
  });

  it('refuses a length below one frame and an unknown effect', () => {
    expect(() => applyEffect(box(), 'fadeIn', 0, 0, STAGE)).toThrow(/at least one frame/i);
    expect(() => applyEffect(box(), 'nope', 0, 10, STAGE)).toThrow(/no effect/i);
  });
});
