// V20: a picture or video over the video (a logo in a corner, picture-in-picture): the rules of
// the overlay track.
import { describe, expect, it } from 'vitest';
import { EditError } from '../../../../src/core/model/errors.ts';
import { createMediaAsset } from '../../../../src/core/model/factory.ts';
import {
  assertFitsOverlayTrack,
  createOverlayItem,
  overlayDuration,
  trimOverlayVideo,
  validateOverlay,
} from '../../../../src/core/model/overlay.ts';
import type { OverlayItem } from '../../../../src/core/model/types.ts';

const logo = createMediaAsset({ id: 'logo', kind: 'image', path: 'Logo.png' });
const clip2 = createMediaAsset({
  id: 'clip2',
  kind: 'video',
  path: 'Clip2.mp4',
  duration: 8,
  hasAudio: true,
});
const music = createMediaAsset({ id: 'm', kind: 'audio', path: 'm.mp3', duration: 9 });

describe('V20 the overlay track', () => {
  it('V20: a picture over the video starts at a time, lasts a duration, top right, 25 % wide', () => {
    const item = createOverlayItem(logo, 2, { id: 'o', duration: 30 });
    expect(item).toEqual({
      type: 'image',
      id: 'o',
      assetId: 'logo',
      start: 2,
      duration: 30,
      position: 'top-right',
      widthPercent: 25,
      margin: 20,
      opacity: 1,
    });
    expect(overlayDuration(item)).toBe(30);
  });

  it('V20: a video over the video plays all of it, bottom right, its own sound off', () => {
    const item = createOverlayItem(clip2, 0, { id: 'p' });
    expect(item).toMatchObject({
      type: 'video',
      in: 0,
      out: 8,
      position: 'bottom-right',
      muted: true,
      volume: 1,
    });
    expect(overlayDuration(item)).toBe(8);
  });

  it('V20: only pictures and videos can go over the video', () => {
    expect(() => createOverlayItem(music, 0)).toThrow(EditError);
  });

  it('V20: items on the overlay track may touch but not overlap (a clear message)', () => {
    const a = createOverlayItem(logo, 0, { id: 'a', duration: 5 });
    const touching = createOverlayItem(clip2, 5, { id: 'b' });
    const over = createOverlayItem(clip2, 4.99, { id: 'c' });
    expect(() => assertFitsOverlayTrack([a], touching)).not.toThrow();
    expect(() => assertFitsOverlayTrack([a], over)).toThrow(
      /overlaps another picture or video over the video/i,
    );
    // Moving an item over its own old place is fine.
    expect(() => assertFitsOverlayTrack([a], { ...a, start: 1 })).not.toThrow();
  });

  it('V20: trims a video over the video like a clip, typed to 0.01 s (N8)', () => {
    const item = createOverlayItem(clip2, 0, { id: 'p' }) as Extract<
      OverlayItem,
      { type: 'video' }
    >;
    expect(trimOverlayVideo(item, { in: 1.25, out: 3.5 }, clip2)).toMatchObject({
      in: 1.25,
      out: 3.5,
    });
    expect(() => trimOverlayVideo(item, { in: 0, out: 9 }, clip2)).toThrow(/8\.00 s/);
    expect(() => trimOverlayVideo(item, { in: 3, out: 2 }, clip2)).toThrow(/after the start/);
    expect(() => trimOverlayVideo(item, { in: 1, out: 1.05 }, clip2)).toThrow(/at least/);
  });

  it.each([
    [{ widthPercent: 0 }, /between 1 and 100 %/],
    [{ widthPercent: 101 }, /between 1 and 100 %/],
    [{ margin: -1 }, /margin/i],
    [{ opacity: 1.2 }, /between 0 % and 100 %/],
    [{ start: -1 }, /before 0\.00 s/],
    [{ duration: 0.05 }, /at least 0\.10 s/],
    [{ fadeIn: 3, fadeOut: 3 }, /fades are longer/i],
    [{ fadeIn: -1 }, /negative/i],
    [{ position: 'middle' }, /one of the nine places/i],
  ] as [Partial<OverlayItem>, RegExp][])('V20: refuses %o', (change, message) => {
    const item = { ...createOverlayItem(logo, 0, { duration: 5 }), ...change } as OverlayItem;
    expect(() => validateOverlay(item)).toThrow(message);
  });

  it('V20: accepts a half see-through logo that fades in and out', () => {
    const item = { ...createOverlayItem(logo, 0, { duration: 5 }), opacity: 0.5, fadeIn: 1 };
    expect(() => validateOverlay({ ...item, fadeOut: 1 })).not.toThrow();
  });
});
