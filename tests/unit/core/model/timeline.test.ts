import { describe, expect, it } from 'vitest';
import {
  createAudioItem,
  createImageClip,
  createMediaAsset,
  createTitleSlide,
  createVideoClip,
} from '../../../../src/core/model/factory.ts';
import {
  assertFitsInTrack,
  findMainItemAt,
  itemDuration,
  joinMainItems,
  layoutMain,
  mainTrackDuration,
  setItemDuration,
  setVideoSpeed,
  splitMainItem,
  trimVideo,
} from '../../../../src/core/model/timeline.ts';

const lake = createMediaAsset({
  id: 'lake',
  kind: 'video',
  path: 'Lake_Naivasha.mp4',
  duration: 20,
});
const photo = createMediaAsset({ id: 'photo', kind: 'image', path: 'Fish_Eagle1.jpg' });
const music = createMediaAsset({ id: 'music', kind: 'audio', path: 'music.mp3', duration: 30 });
const clip = (id = 'c') => createVideoClip(lake, { id });

describe('timeline rules', () => {
  describe('itemDuration', () => {
    it('V14 a video clip lasts (out − in) / speed: 6.3 s at 1.5× → 4.2 s', () => {
      const naivasha1 = setVideoSpeed(trimVideo(clip(), { in: 0, out: 6.3 }, lake), 1.5);
      expect(itemDuration(naivasha1)).toBeCloseTo(4.2, 6);
    });

    it('images and title slides last their duration', () => {
      expect(itemDuration(createImageClip(photo))).toBe(5);
      expect(itemDuration(setItemDuration(createTitleSlide('Hi'), 8))).toBe(8);
    });
  });

  describe('V3 magnetic main track', () => {
    it('places items one after another with no gaps', () => {
      const items = [
        setItemDuration(createTitleSlide('Title'), 8),
        trimVideo(clip('a'), { in: 0, out: 4.2 }, lake),
        trimVideo(clip('b'), { in: 8, out: 12.5 }, lake),
      ];
      const layout = layoutMain(items);
      expect(layout.map((l) => l.start)).toEqual([0, 8, 12.2]);
      expect(layout.at(-1)!.end).toBeCloseTo(16.7, 6);
      expect(mainTrackDuration(items)).toBeCloseTo(16.7, 6);
    });

    it('an empty track lasts 0 s', () => {
      expect(mainTrackDuration([])).toBe(0);
    });

    it('finds which item is under the playhead and how far into it', () => {
      const items = [setItemDuration(createTitleSlide('T', { id: 't' }), 8), clip('v')];
      expect(findMainItemAt(items, 0)).toEqual({ index: 0, offset: 0 });
      expect(findMainItemAt(items, 10.5)).toEqual({ index: 1, offset: 2.5 });
      expect(findMainItemAt(items, 28)).toBeNull();
    });
  });

  describe('V2 trim', () => {
    it('sets the start and end points', () => {
      expect(trimVideo(clip(), { in: 8, out: 12.5 }, lake)).toMatchObject({ in: 8, out: 12.5 });
    });

    it.each([
      [{ in: 5, out: 3 }, /end point must be after the start point/i],
      [{ in: -1, out: 3 }, /start point cannot be before 0/i],
      [{ in: 0, out: 25 }, /end point cannot be after the end of the clip \(20\.00 s\)/i],
      [{ in: 3, out: 3.05 }, /at least 0\.10 s/i],
    ])('rejects %j', (range, message) => {
      expect(() => trimVideo(clip(), range, lake)).toThrow(message);
    });

    it('does not change the clip it was given', () => {
      const original = Object.freeze(clip());
      trimVideo(original, { in: 1, out: 2 }, lake);
      expect(original).toMatchObject({ in: 0, out: 20 });
    });
  });

  describe('V14 speed', () => {
    it.each([0.25, 1, 2, 4])('accepts %f×', (speed) => {
      expect(setVideoSpeed(clip(), speed).speed).toBe(speed);
    });
    it.each([0, 0.2, 4.5, Number.NaN])('rejects %f×', (speed) => {
      expect(() => setVideoSpeed(clip(), speed)).toThrow(/between 0\.25× and 4×/);
    });
  });

  describe('durations of stills, titles and text', () => {
    it('rejects a duration under 0.10 s', () => {
      expect(() => setItemDuration(createImageClip(photo), 0.05)).toThrow(/at least 0\.10 s/i);
    });
  });

  describe('split', () => {
    it('splits a video clip at the playhead; the two parts add up to the original', () => {
      const [a, b] = splitMainItem(clip(), 3, ['a', 'b']);
      expect(a).toMatchObject({ id: 'a', in: 0, out: 3 });
      expect(b).toMatchObject({ id: 'b', in: 3, out: 20 });
      expect(itemDuration(a) + itemDuration(b)).toBeCloseTo(20, 6);
    });

    it('uses source time for sped-up clips (1 s on the timeline at 2× = 2 s of source)', () => {
      const [a, b] = splitMainItem(setVideoSpeed(clip(), 2), 1, ['a', 'b']);
      expect(a).toMatchObject({ in: 0, out: 2 });
      expect(b).toMatchObject({ in: 2, out: 20 });
    });

    it('splits stills and title slides by duration', () => {
      const [a, b] = splitMainItem(setItemDuration(createImageClip(photo), 10), 4, ['a', 'b']);
      expect([a.type, itemDuration(a), itemDuration(b)]).toEqual(['image', 4, 6]);
    });

    it('refuses to leave a part shorter than 0.10 s', () => {
      expect(() => splitMainItem(clip(), 0.05, ['a', 'b'])).toThrow(/at least 0\.10 s/i);
      expect(() => splitMainItem(clip(), 19.99, ['a', 'b'])).toThrow(/at least 0\.10 s/i);
    });
  });

  describe('join', () => {
    it('joins two parts of a split clip back into one', () => {
      const original = clip('orig');
      const [a, b] = splitMainItem(original, 7, ['a', 'b']);
      expect(joinMainItems(a, b)).toEqual({ ...original, id: 'a' });
    });

    it('joins two parts of a split still or title', () => {
      const [a, b] = splitMainItem(setItemDuration(createTitleSlide('T'), 8), 3, ['a', 'b']);
      expect(itemDuration(joinMainItems(a, b))).toBe(8);
    });

    it('refuses clips that were not split from the same piece', () => {
      const a = trimVideo(clip('a'), { in: 0, out: 3 }, lake);
      const b = trimVideo(clip('b'), { in: 5, out: 8 }, lake);
      expect(() => joinMainItems(a, b)).toThrow(/only parts of the same clip/i);
      expect(() => joinMainItems(a, createImageClip(photo))).toThrow(
        /only parts of the same clip/i,
      );
    });
  });

  describe('audio tracks: items on one track must not overlap', () => {
    const at = (start: number, id: string) => createAudioItem(music, start, { id }); // 30 s long

    it('accepts items that touch or are apart', () => {
      expect(() => assertFitsInTrack([at(0, 'a')], at(30, 'b'))).not.toThrow();
    });

    it('rejects an item that overlaps another', () => {
      expect(() => assertFitsInTrack([at(0, 'a')], at(29, 'b'))).toThrow(/overlaps/i);
    });

    it('ignores the item itself when it is being moved', () => {
      expect(() => assertFitsInTrack([at(0, 'a')], at(2, 'a'))).not.toThrow();
    });
  });
});
