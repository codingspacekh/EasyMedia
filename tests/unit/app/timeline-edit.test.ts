import { describe, expect, it } from 'vitest';
import { handleDrag, snap } from '../../../src/app/timeline-edit.ts';
import {
  createImageClip,
  createMediaAsset,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { setVideoSpeed, trimVideo } from '../../../src/core/model/timeline.ts';

const lake = createMediaAsset({ id: 'lake', kind: 'video', path: 'lake.mp4', duration: 20 });
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'p.jpg' });

describe('snapping', () => {
  it('moves to the nearest target within the tolerance', () => {
    expect(snap(4.93, [5, 10], 0.1)).toBe(5);
    expect(snap(9.95, [5, 10], 0.1)).toBe(10);
  });
  it('stays put when no target is close', () => {
    expect(snap(7, [5, 10], 0.1)).toBe(7);
  });
});

describe('dragging a trim handle (timeline seconds → source points)', () => {
  it('dragging the end handle left by 2 s trims 2 s off the end', () => {
    const clip = createVideoClip(lake, { id: 'c' }); // 0–20
    expect(handleDrag(clip, 'end', 0, -2, [], 0)).toEqual({ in: 0, out: 18 });
  });

  it('on a 2× clip, 1 s on the timeline is 2 s of the source', () => {
    const clip = setVideoSpeed(
      trimVideo(createVideoClip(lake, { id: 'c' }), { in: 4, out: 12 }, lake),
      2,
    ); // 4 s long
    expect(handleDrag(clip, 'start', 0, 1, [], 0)).toEqual({ in: 6, out: 12 });
  });

  it('snaps the dragged edge to the playhead when close', () => {
    const clip = createVideoClip(lake, { id: 'c' }); // starts at 3 on the timeline, ends at 23
    // dragging the end to 15.97 snaps to the playhead at 16 → end 16 → source out 13
    expect(handleDrag(clip, 'end', 3, -7.03, [16], 0.1)).toEqual({ in: 0, out: 13 });
  });

  it('cannot go past the ends of the source file', () => {
    const clip = trimVideo(createVideoClip(lake, { id: 'c' }), { in: 2, out: 18 }, lake);
    expect(handleDrag(clip, 'start', 0, -5, [], 0)).toEqual({ in: 0, out: 18 });
    expect(handleDrag(clip, 'end', 0, 5, [], 0, lake.duration)).toEqual({ in: 2, out: 20 });
  });

  it('a still image: the end handle changes its duration', () => {
    const still = createImageClip(photo, { id: 'i' }); // 5 s
    expect(handleDrag(still, 'end', 0, 3, [], 0)).toEqual({ duration: 8 });
  });
});
