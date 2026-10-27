// M14 / AN15: the animation export formats — their pros and cons (T7), the estimated size, the
// frames exported, even sizes for MP4 and the PNG sequence's file names.
import { describe, expect, it } from 'vitest';
import {
  ANIMATION_FORMATS,
  estimateAnimationSize,
  evenSize,
  exportedFrames,
  sequenceName,
} from '../../../../src/core/animation/export.ts';
import { createAnimation } from '../../../../src/core/animation/factory.ts';

const task1 = () => {
  const doc = createAnimation({ name: 'Task 1' });
  return { ...doc, stage: { ...doc.stage, width: 600, height: 400, length: 72 } };
};

describe('animation export (AN15)', () => {
  it('offers MP4, animated GIF, PNG sequence and a picture of the frame, each with pros and cons', () => {
    expect(ANIMATION_FORMATS.map((f) => f.id)).toEqual(['mp4', 'gif', 'png-sequence', 'png']);
    for (const f of ANIMATION_FORMATS) {
      expect(f.label.length).toBeGreaterThan(2);
      expect(f.pros.length).toBeGreaterThan(0);
      expect(f.cons.length).toBeGreaterThan(0);
    }
    expect(ANIMATION_FORMATS.find((f) => f.id === 'gif')!.cons.join(' ')).toMatch(/256 colours/);
  });

  it('a 3 s animation at 24 fps exports frames 0 to 71: 72 frames, 3.00 s', () => {
    expect(exportedFrames(task1())).toEqual({ count: 72, first: 0, last: 71, seconds: 3 });
  });

  it('MP4 needs even sizes: 601 × 401 is padded to 602 × 402 and reported', () => {
    expect(evenSize(600, 400)).toEqual({ width: 600, height: 400, padded: false });
    expect(evenSize(601, 401)).toEqual({ width: 602, height: 402, padded: true });
  });

  it('estimates the size of each format; a picture is one frame, a GIF is bigger than an MP4', () => {
    const doc = task1();
    const mp4 = estimateAnimationSize(doc, 'mp4');
    const gif = estimateAnimationSize(doc, 'gif');
    const seq = estimateAnimationSize(doc, 'png-sequence');
    const png = estimateAnimationSize(doc, 'png');
    expect(gif).toBeGreaterThan(mp4);
    expect(seq).toBeCloseTo(png * 72, 0);
    expect(mp4).toBeGreaterThan(10_000);
    const longer = { ...doc, stage: { ...doc.stage, length: 144 } };
    expect(estimateAnimationSize(longer, 'mp4')).toBeCloseTo(2 * mp4, 0);
  });

  it('names the PNG sequence after the chosen file, numbered from 0001', () => {
    expect(sequenceName('/work/Task1.png', 0)).toBe('/work/Task1_0001.png');
    expect(sequenceName('C:\\work\\Task1.PNG', 71)).toBe('C:\\work\\Task1_0072.png');
    expect(sequenceName('/work/frames', 9)).toBe('/work/frames_0010.png');
  });
});
