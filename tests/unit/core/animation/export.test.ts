// M14 / AN15: the animation export formats — their pros and cons (T7), the estimated size, the
// frames exported, even sizes for MP4 and the PNG sequence's file names.
import { describe, expect, it } from 'vitest';
import {
  ANIMATION_FORMATS,
  carriesSound,
  estimateAnimationSize,
  evenSize,
  exportedFrames,
  exportSize,
  hasRange,
  hasSize,
  sequenceName,
} from '../../../../src/core/animation/export.ts';
import { createAnimation } from '../../../../src/core/animation/factory.ts';

const task1 = () => {
  const doc = createAnimation({ name: 'Task 1' });
  return { ...doc, stage: { ...doc.stage, width: 600, height: 400, length: 72 } };
};

describe('animation export (AN15)', () => {
  it('offers MP4, animated GIF, a web page, PNG sequence and a picture of the frame (PNG or SVG), each with pros and cons', () => {
    expect(ANIMATION_FORMATS.map((f) => f.id)).toEqual([
      'mp4',
      'avi',
      'mov',
      'gif',
      'html',
      'png-sequence',
      'png',
      'svg',
    ]);
    for (const f of ANIMATION_FORMATS) {
      expect(f.label.length).toBeGreaterThan(2);
      expect(f.pros.length).toBeGreaterThan(0);
      expect(f.cons.length).toBeGreaterThan(0);
    }
    expect(ANIMATION_FORMATS.find((f) => f.id === 'gif')!.cons.join(' ')).toMatch(/256 colours/);
    const html = ANIMATION_FORMATS.find((f) => f.id === 'html')!;
    expect(html.pros.join(' ')).toMatch(/any web browser/i);
    expect(html.pros.join(' ')).toMatch(/Pause/);
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

  it('AN15: a web page is small — the drawing, not every frame — and grows with its pictures', () => {
    const doc = task1();
    const html = estimateAnimationSize(doc, 'html');
    expect(html).toBeLessThan(estimateAnimationSize(doc, 'mp4'));
    const longer = { ...doc, stage: { ...doc.stage, length: 720 } };
    expect(estimateAnimationSize(longer, 'html')).toBe(html);
    const withPicture = {
      ...doc,
      pictures: [{ id: 'p', path: 'Paris1.jpg', width: 800, height: 600 }],
    };
    expect(estimateAnimationSize(withPicture, 'html')).toBeGreaterThan(html + 100_000);
  });

  it('names the PNG sequence after the chosen file, numbered from 0001', () => {
    expect(sequenceName('/work/Task1.png', 0)).toBe('/work/Task1_0001.png');
    expect(sequenceName('C:\\work\\Task1.PNG', 71)).toBe('C:\\work\\Task1_0072.png');
    expect(sequenceName('/work/frames', 9)).toBe('/work/frames_0010.png');
  });

  it('AN15 AVI and MOV: the codecs Video mode uses, with their pros and cons', () => {
    const avi = ANIMATION_FORMATS.find((f) => f.id === 'avi')!;
    const mov = ANIMATION_FORMATS.find((f) => f.id === 'mov')!;
    expect(avi.label).toBe('AVI video');
    expect(avi.pros.join(' ')).toMatch(/MPEG-4 Part 2/);
    expect(avi.cons.join(' ')).toMatch(/twice as big as MP4/i);
    expect(mov.label).toBe('MOV video');
    expect(mov.pros.join(' ')).toMatch(/H\.264/);
    expect(mov.pros.join(' ').concat(mov.cons.join(' '))).toMatch(/Apple|QuickTime/);
    // A video is bigger as AVI (an older codec) than as MP4 or MOV.
    const doc = task1();
    expect(estimateAnimationSize(doc, 'avi')).toBeGreaterThan(estimateAnimationSize(doc, 'mp4'));
    expect(estimateAnimationSize(doc, 'mov')).toBe(estimateAnimationSize(doc, 'mp4'));
  });

  it('AN15 another width: the height kept in proportion; even sides for a video', () => {
    const stage = { ...task1().stage, width: 1024, height: 768 };
    expect(exportSize(stage, 'png', 600)).toEqual({ width: 600, height: 450, padded: false });
    expect(exportSize(stage, 'mp4', 600)).toEqual({ width: 600, height: 450, padded: false });
    // 500 × 375 for a picture; a video keeps even sides: 500 × 376.
    expect(exportSize(stage, 'gif', 500)).toEqual({ width: 500, height: 375, padded: false });
    expect(exportSize(stage, 'avi', 500)).toEqual({ width: 500, height: 376, padded: false });
    // An odd width typed for a video gets one pixel more, as an odd stage does.
    expect(exportSize(stage, 'mov', 601)).toEqual({ width: 602, height: 452, padded: true });
    // No width: the stage's own size (an odd stage padded for a video).
    expect(exportSize({ ...stage, width: 601, height: 401 }, 'mp4')).toEqual({
      width: 602,
      height: 402,
      padded: true,
    });
    expect(() => exportSize(stage, 'png', 4)).toThrow(/between 16 and 3840/);
  });

  it('AN15 a range of frames: from–to, both exported; the whole animation by default', () => {
    const doc = task1();
    expect(exportedFrames(doc, { from: 24, to: 47 })).toEqual({
      count: 24,
      first: 24,
      last: 47,
      seconds: 1,
    });
    expect(() => exportedFrames(doc, { from: 50, to: 40 })).toThrow(/first frame .* last/i);
    expect(() => exportedFrames(doc, { from: 0, to: 72 })).toThrow(/0 to 71/);
    // Half the frames: about half the size.
    expect(estimateAnimationSize(doc, 'mp4', { from: 0, to: 35 })).toBeCloseTo(
      estimateAnimationSize(doc, 'mp4') / 2,
      0,
    );
    // Half the width: a quarter of the pixels.
    expect(estimateAnimationSize(doc, 'png', { width: 300 })).toBeCloseTo(
      estimateAnimationSize(doc, 'png') / 4,
      0,
    );
  });

  it('AN15 which formats have a size, a range and sound (AN28)', () => {
    const ids = ANIMATION_FORMATS.map((f) => f.id);
    expect(ids.filter(hasSize)).toEqual([
      'mp4',
      'avi',
      'mov',
      'gif',
      'html',
      'png-sequence',
      'png',
    ]);
    expect(ids.filter(hasRange)).toEqual(['mp4', 'avi', 'mov', 'gif', 'html', 'png-sequence']);
    expect(ids.filter(carriesSound)).toEqual(['mp4', 'avi', 'mov', 'html']);
  });

  it('T7 AN28 the size includes the sound: in a video for its length, in a page its files', () => {
    const doc = task1();
    const alarm = {
      id: 's',
      name: 'alarm.mp3',
      path: '/m/alarm.mp3',
      duration: 2,
      start: 0,
      volume: 100,
    };
    const withSound = { ...doc, sounds: [alarm] };
    // 3 s of AAC at 160 kbit/s is 60 KB.
    expect(estimateAnimationSize(withSound, 'mp4') - estimateAnimationSize(doc, 'mp4')).toBe(
      60_000,
    );
    // 3 s of MP3 at 192 kbit/s is 72 KB.
    expect(estimateAnimationSize(withSound, 'avi') - estimateAnimationSize(doc, 'avi')).toBe(
      72_000,
    );
    // The 2 s MP3 file inside the page as text (a third bigger).
    expect(
      estimateAnimationSize(withSound, 'html') - estimateAnimationSize(doc, 'html'),
    ).toBeCloseTo((32_000 * 4) / 3, 3);
    expect(estimateAnimationSize(withSound, 'gif')).toBe(estimateAnimationSize(doc, 'gif'));
  });
});
