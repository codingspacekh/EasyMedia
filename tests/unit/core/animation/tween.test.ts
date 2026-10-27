// M14 / AN9, AN13: keyframes per property and the values in between (tweening), checked with
// the workbook's Task 1 numbers.
import { describe, expect, it } from 'vitest';
import {
  createEllipse,
  createLine,
  createRect,
  createStar,
  createText,
} from '../../../../src/core/animation/factory.ts';
import {
  copyKeyframe,
  ease,
  editAt,
  insertKeyframe,
  interpolate,
  moveKeyframe,
  objectAt,
  removeKeyframe,
  reversed,
  setKeyframe,
  setPropertyAt,
  trackOf,
  valueAt,
  withRepeat,
} from '../../../../src/core/animation/tween.ts';
import { setSize } from '../../../../src/core/animation/geometry.ts';
import type { Track } from '../../../../src/core/animation/types.ts';

const track = (
  property: Track['property'],
  frames: [number, number | string][],
  extra: Partial<Track> = {},
): Track => ({
  property,
  keyframes: frames.map(([frame, value]) => ({ frame, value, easing: 'linear', hold: false })),
  ...extra,
});

describe('tweens with Task 1 numbers (AN9)', () => {
  it('a circle at (0, 0) with a keyframe at frame 72 at (396, 196) is at (198, 98) at frame 36', () => {
    let circle = createEllipse({ x: 0, y: 0, width: 204, height: 204 });
    circle = setPropertyAt(circle, 'x', 72, 396);
    circle = setPropertyAt(circle, 'y', 72, 196);
    const at36 = objectAt(circle, 36);
    expect([at36.x, at36.y]).toEqual([198, 98]);
    expect([objectAt(circle, 0).x, objectAt(circle, 72).x, objectAt(circle, 100).x]).toEqual([
      0, 396, 396,
    ]);
  });

  it('the fill #FF1CC8 → #F0DB82 is #F87CA5 halfway; opacity 100 → 57 % is 78.5 % halfway', () => {
    expect(interpolate('#FF1CC8', '#F0DB82', 0.5)).toBe('#f87ca5');
    expect(interpolate(100, 57, 0.5)).toBe(78.5);
    let rect = createRect({ x: 0, y: 0 });
    rect = setPropertyAt(rect, 'fillColour', 0, '#FF1CC8');
    rect = setPropertyAt(rect, 'fillColour', 72, '#F0DB82');
    rect = setPropertyAt(rect, 'opacity', 72, 57);
    const half = objectAt(rect, 36);
    expect(half.fill).toEqual({ kind: 'solid', colour: '#f87ca5' });
    expect(half.opacity).toBe(78.5);
  });

  it('text grows from 0 to 64 px', () => {
    let text = createText('Task 1', { x: 193, y: 73, size: 64 });
    text = setPropertyAt(text, 'size', 0, 0);
    text = setPropertyAt(text, 'size', 72, 64);
    expect(objectAt(text, 36)).toMatchObject({ kind: 'text', size: 32 });
    expect(objectAt(text, 18)).toMatchObject({ size: 16 });
  });

  it("a star's turn 0 → 360° in 72 frames, repeated, is 90° at frame 18 and 90° again at frame 90", () => {
    let star = createStar({ x: 128, y: 102, width: 135, height: 135 });
    star = setPropertyAt(star, 'rotation', 72, 360);
    expect(objectAt(star, 90).rotation).toBe(360);
    star = { ...star, tracks: [withRepeat(trackOf(star, 'rotation')!, 'end')] };
    expect(objectAt(star, 18).rotation).toBe(90);
    expect(objectAt(star, 90).rotation).toBe(90);
    expect(objectAt(star, 144).rotation).toBe(0);
    const twice = withRepeat(trackOf(star, 'rotation')!, 1);
    expect(valueAt(twice, 90)).toBe(90);
    expect(valueAt(twice, 150)).toBe(360);
  });

  it('ease-in starts slower than linear and ends at the same place; bounce ends exactly at the end', () => {
    const linear = track('x', [
      [0, 0],
      [72, 100],
    ]);
    const easeIn = track('x', [
      [0, 0],
      [72, 100],
    ]);
    easeIn.keyframes[0]!.easing = 'ease-in';
    expect(valueAt(linear, 18)).toBe(25);
    expect(valueAt(easeIn, 18)).toBeLessThan(25);
    expect(valueAt(easeIn, 72)).toBe(100);
    for (const easing of ['ease-in', 'ease-out', 'ease-in-out', 'bounce'] as const) {
      expect(ease(easing, 0)).toBe(0);
      expect(ease(easing, 1)).toBeCloseTo(1, 10);
    }
    expect(ease('ease-out', 0.25)).toBeGreaterThan(0.25);
    expect(ease('ease-in-out', 0.5)).toBeCloseTo(0.5, 10);
  });

  it('a hold keeps the value until the next keyframe', () => {
    const t = track('x', [
      [0, 0],
      [72, 100],
    ]);
    t.keyframes[0]!.hold = true;
    expect(valueAt(t, 36)).toBe(0);
    expect(valueAt(t, 71)).toBe(0);
    expect(valueAt(t, 72)).toBe(100);
  });

  it('words change at the keyframe, not in between', () => {
    const t = track('text', [
      [0, 'Hello'],
      [48, 'Au revoir'],
    ]);
    expect(valueAt(t, 47)).toBe('Hello');
    expect(valueAt(t, 48)).toBe('Au revoir');
  });

  it('before the first keyframe the first value; after the last the last', () => {
    const t = track('x', [
      [24, 10],
      [48, 20],
    ]);
    expect(valueAt(t, 0)).toBe(10);
    expect(valueAt(t, 100)).toBe(20);
    expect(valueAt(track('x', [[24, 10]]), 0)).toBe(10);
  });

  it('Reverse copies the keyframes mirrored after the last one: the start values at frame 144', () => {
    const t = reversed(
      track('x', [
        [0, 0],
        [24, 50],
        [72, 100],
      ]),
    );
    expect(t.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [24, 50],
      [72, 100],
      [120, 50],
      [144, 0],
    ]);
  });
});

describe('keyframe editing (AN9)', () => {
  const base = track('x', [
    [0, 0],
    [72, 100],
  ]);

  it('setting a keyframe keeps them sorted and replaces one on the same frame', () => {
    const t = setKeyframe(base, { frame: 36, value: 30 });
    expect(t.keyframes.map((k) => k.frame)).toEqual([0, 36, 72]);
    expect(t.keyframes[1]).toEqual({ frame: 36, value: 30, easing: 'linear', hold: false });
    const again = setKeyframe(t, { frame: 36, value: 40, easing: 'bounce' });
    expect(again.keyframes.length).toBe(3);
    expect(again.keyframes[1]).toMatchObject({ value: 40, easing: 'bounce' });
    expect(() => setKeyframe(base, { frame: -1, value: 0 })).toThrow(/frame/);
    expect(() => setKeyframe(base, { frame: 1.5, value: 0 })).toThrow(/whole/);
  });

  it('keyframes can be moved, copied and deleted', () => {
    expect(moveKeyframe(base, 72, 48).keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [48, 100],
    ]);
    expect(copyKeyframe(base, 72, 96).keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [72, 100],
      [96, 100],
    ]);
    expect(removeKeyframe(base, 72).keyframes.map((k) => k.frame)).toEqual([0]);
    expect(() => removeKeyframe(base, 10)).toThrow(/no keyframe/i);
  });

  it('setting a property at a frame makes a keyframe; the first one at frame 0 is made with it', () => {
    const rect = createRect({ x: 50, y: 0 });
    expect(rect.tracks).toBeUndefined();
    const still = setPropertyAt(rect, 'x', 0, 80);
    expect(still.x).toBe(80);
    expect(still.tracks).toBeUndefined();
    const moving = setPropertyAt(rect, 'x', 72, 396);
    expect(trackOf(moving, 'x')!.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 50],
      [72, 396],
    ]);
    const changed = setPropertyAt(moving, 'x', 0, 10);
    expect(trackOf(changed, 'x')!.keyframes[0]!.value).toBe(10);
    expect(objectAt(changed, 0).x).toBe(10);
  });

  it('Insert keyframe fixes the tweened value at the playhead', () => {
    let rect = setPropertyAt(createRect({ x: 0, y: 0 }), 'x', 72, 100);
    rect = insertKeyframe(rect, 'x', 36);
    expect(trackOf(rect, 'x')!.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [36, 50],
      [72, 100],
    ]);
    const fresh = insertKeyframe(createRect({ x: 7, y: 0 }), 'y', 0);
    expect(trackOf(fresh, 'y')!.keyframes).toEqual([
      { frame: 0, value: 0, easing: 'linear', hold: false },
    ]);
    const stroke = insertKeyframe(createRect({ x: 0, y: 0 }), 'strokeWidth', 0);
    expect(trackOf(stroke, 'strokeWidth')!.keyframes[0]!.value).toBe(2);
  });

  it('deleting the last keyframe removes the track and the object keeps its static value', () => {
    const rect = setPropertyAt(createRect({ x: 50, y: 0 }), 'x', 72, 396);
    const one = { ...rect, tracks: [removeKeyframe(trackOf(rect, 'x')!, 72)] };
    expect(objectAt(one, 72).x).toBe(50);
  });

  it('every tweened property reaches the drawn object', () => {
    let rect = createRect({ x: 0, y: 0, width: 100, height: 50 });
    for (const [property, value] of [
      ['width', 200],
      ['height', 100],
      ['rotation', 90],
      ['strokeColour', '#ff0000'],
      ['strokeWidth', 10],
      ['radius', 20],
    ] as const) {
      rect = setPropertyAt(rect, property, 48, value);
    }
    expect(objectAt(rect, 24)).toMatchObject({
      width: 150,
      height: 75,
      rotation: 45,
      stroke: { colour: '#8f1115', width: 6 },
      radius: 10,
    });
    expect(() => setPropertyAt(rect, 'size', 0, 10)).toThrow(/text/);
  });
});

describe('an edit at the playhead (AN9)', () => {
  it('at frame 0 on a still object it is a plain change; later it makes keyframes only for what changed', () => {
    const rect = createRect({ x: 0, y: 0, width: 100, height: 50 });
    const still = editAt(rect, 0, (o) => ({ ...o, x: 40, name: 'Box' }));
    expect(still).toMatchObject({ x: 40, name: 'Box' });
    expect(still.tracks).toBeUndefined();
    const moving = editAt(still, 72, (o) => ({ ...o, x: 396, y: 196 }));
    expect(moving.tracks!.map((t) => t.property).sort()).toEqual(['x', 'y']);
    expect(objectAt(moving, 36)).toMatchObject({ x: 218, y: 98, width: 100 });
  });

  it('position and size are keyed as pairs: moving only X at a frame also fixes Y there (Worked Example 19.01)', () => {
    const ball = createEllipse({ x: 0, y: 0, width: 100, height: 100 });
    const right = editAt(ball, 15, (o) => ({ ...o, x: 1180 }));
    expect(trackOf(right, 'y')!.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [15, 0],
    ]);
    const down = editAt(right, 30, (o) => ({ ...o, y: 620 }));
    expect(objectAt(down, 15)).toMatchObject({ x: 1180, y: 0 });
    expect(objectAt(down, 22).x).toBe(1180);
    const wider = editAt(ball, 24, (o) => ({ ...o, width: 200 }));
    expect(trackOf(wider, 'height')!.keyframes.map((k) => k.value)).toEqual([100, 100]);
    expect(editAt(ball, 0, (o) => ({ ...o, x: 5 })).tracks).toBeUndefined();
  });

  it('starts from the values at that frame, so a drag mid-tween keys where it was dropped', () => {
    const rect = setPropertyAt(createRect({ x: 0, y: 0 }), 'x', 72, 100);
    const dragged = editAt(rect, 36, (o) => ({ ...o, x: o.x + 10 }));
    expect(trackOf(dragged, 'x')!.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [36, 60],
      [72, 100],
    ]);
  });

  it('colours, outline, corner radius, words and font size become keyframes; other changes are plain', () => {
    const rect = createRect({ x: 0, y: 0 });
    const next = editAt(rect, 24, (o) => ({
      ...o,
      fill: { kind: 'solid', colour: '#ff0000' },
      stroke: { colour: '#00ff00', width: 6, dash: 'dashed' },
      radius: 12,
    }));
    expect(next.tracks!.map((t) => t.property).sort()).toEqual([
      'fillColour',
      'radius',
      'strokeColour',
      'strokeWidth',
    ]);
    expect(next.stroke!.dash).toBe('dashed');
    const text = editAt(createText('Hi', { x: 0, y: 0, size: 20 }), 24, (o) => ({
      ...o,
      text: 'Bye',
      size: 40,
      bold: true,
    }));
    expect(text.tracks!.map((t) => t.property).sort()).toEqual(['size', 'text']);
    expect(text.bold).toBe(true);
  });

  it('a change of fill to a gradient is plain and ends the fill colour track', () => {
    const rect = setPropertyAt(createRect({ x: 0, y: 0 }), 'fillColour', 24, '#ff0000');
    const gradient = editAt(rect, 48, (o) => ({
      ...o,
      fill: { kind: 'linear', from: '#000000', to: '#ffffff', angle: 0 },
    }));
    expect(gradient.fill.kind).toBe('linear');
    expect(trackOf(gradient, 'fillColour')).toBeUndefined();
  });

  it("resizing a path at a frame keys its size without baking the frame's points into it", () => {
    const line = createLine({ x: 0, y: 0 }, { x: 100, y: 100 });
    const bigger = editAt(line, 24, (o) => setSize(o, 200, 200));
    expect(bigger.points).toEqual(line.points);
    expect(objectAt(bigger, 24).points[1]).toEqual({ x: 200, y: 200 });
  });
});
