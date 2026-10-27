// M14 / AN8: frames and seconds at the stage's frame rate; the frame rate change that keeps
// keyframes at the same times or at the same frames; the time shown and typed.
import { describe, expect, it } from 'vitest';
import { createAnimation, createEllipse } from '../../../../src/core/animation/factory.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import {
  changeFps,
  framesFor,
  parseFrame,
  secondsFor,
  timeLabel,
} from '../../../../src/core/animation/time.ts';
import { setPropertyAt } from '../../../../src/core/animation/tween.ts';

describe('frames and seconds (AN8)', () => {
  it('3 s at 24 fps is frame 72; frame 36 is 1.50 s', () => {
    expect(framesFor(3, 24)).toBe(72);
    expect(secondsFor(36, 24)).toBe(1.5);
  });

  it('shows the time as minutes, seconds, hundredths and the frame', () => {
    expect(timeLabel(72, 24)).toBe('0:03.00 · frame 72');
    expect(timeLabel(36, 24)).toBe('0:01.50 · frame 36');
    expect(timeLabel(0, 24)).toBe('0:00.00 · frame 0');
    expect(timeLabel(24 * 61 + 12, 24)).toBe('1:01.50 · frame 1476');
  });

  it('reads a typed frame, a time in seconds or a clock time', () => {
    expect(parseFrame('72', 24)).toBe(72);
    expect(parseFrame(' 3 s', 24)).toBe(72);
    expect(parseFrame('1.5s', 24)).toBe(36);
    expect(parseFrame('0:03.00', 24)).toBe(72);
    expect(parseFrame('1:01.5', 24)).toBe(1476);
    expect(parseFrame('f 10', 24)).toBeNull();
    expect(parseFrame('', 24)).toBeNull();
    expect(parseFrame('-3', 24)).toBeNull();
  });
});

describe('changing the frame rate (AN8)', () => {
  const at3s = () => {
    const circle = setPropertyAt(createEllipse({ x: 0, y: 0 }), 'x', 72, 396);
    const doc = createAnimation({ name: 'fps' });
    return addObject(doc, doc.layers[0]!.id, circle);
  };
  const framesOf = (doc: ReturnType<typeof at3s>) =>
    doc.layers[0]!.objects[0]!.tracks![0]!.keyframes.map((k) => k.frame);

  it('by time: a keyframe at 3 s moves to frame 90 at 30 fps and the length keeps its seconds', () => {
    const doc = changeFps(at3s(), 30, 'times');
    expect(doc.stage.fps).toBe(30);
    expect(doc.stage.length).toBe(150);
    expect(framesOf(doc)).toEqual([0, 90]);
  });

  it('by frame: the keyframe stays on frame 72, which is now 2.40 s', () => {
    const doc = changeFps(at3s(), 30, 'frames');
    expect(doc.stage.length).toBe(120);
    expect(framesOf(doc)).toEqual([0, 72]);
    expect(secondsFor(72, doc.stage.fps)).toBe(2.4);
  });

  it('refuses a frame rate outside 1–60', () => {
    expect(() => changeFps(at3s(), 0, 'times')).toThrow(/between 1 and 60/);
  });
});
