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
  audioDuration,
  findMainItemAt,
  itemDuration,
  joinAudioItems,
  joinMainItems,
  layoutMain,
  mainTrackDuration,
  setAudioSpeed,
  setItemDuration,
  setVideoSpeed,
  splitAudioItem,
  splitMainItem,
  transitionOverlap,
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

describe('V9 transitions overlap the clips they join', () => {
  const still = (id: string, seconds: number) =>
    setItemDuration(createImageClip(photo, { id }), seconds);
  const dissolve = (duration: number) => ({ effectId: 'transition.dissolve', duration });

  it('Book B Task 11g: total length = sum of the clips − the transition (4.2 + 4.5 − 2 = 6.7 s)', () => {
    const items = [still('n1', 4.2), { ...still('n2', 4.5), transitionIn: dissolve(2) }];
    const [first, second] = layoutMain(items);
    expect([first!.start, first!.end]).toEqual([0, 4.2]);
    expect(second!.start).toBeCloseTo(2.2, 10);
    expect(second!.end).toBeCloseTo(6.7, 10);
    expect(mainTrackDuration(items)).toBeCloseTo(6.7, 10);
  });

  it('a transition cannot be longer than either clip, and the first clip has none', () => {
    const items = [
      { ...still('a', 1), transitionIn: dissolve(3) },
      { ...still('b', 5), transitionIn: dissolve(3) },
    ];
    expect(transitionOverlap(items, 0)).toBe(0);
    expect(transitionOverlap(items, 1)).toBe(1);
  });

  it('during a transition the playhead belongs to the clip that is ending', () => {
    const items = [still('a', 4), { ...still('b', 4), transitionIn: dissolve(1) }];
    expect(findMainItemAt(items, 3.5)).toEqual({ index: 0, offset: 3.5 });
    expect(findMainItemAt(items, 4.5)).toEqual({ index: 1, offset: 1.5 });
  });
});

describe('splitting and joining keep a clip’s effects (V7, V9, V15)', () => {
  const looked = {
    ...setItemDuration(createImageClip(photo, { id: 'p' }), 6),
    fade: { in: 1, out: 2, colour: 'black' as const },
    effects: [{ effectId: 'video.sepia', params: {} }],
    transitionIn: { effectId: 'transition.dissolve', duration: 1 },
    panZoom: { from: { zoom: 1, x: 0.5, y: 0.5 }, to: { zoom: 2, x: 0.5, y: 0.5 } },
  };

  it('both parts keep the filters; the fade in, transition and pan & zoom stay on the first, the fade out on the second', () => {
    const [a, b] = splitMainItem(looked, 3, ['a', 'b']);
    expect(a).toMatchObject({
      effects: looked.effects,
      transitionIn: looked.transitionIn,
      panZoom: looked.panZoom,
    });
    expect(a.fade).toEqual({ in: 1, out: 0, colour: 'black' });
    expect(b).toMatchObject({ effects: looked.effects });
    expect(b.fade).toEqual({ in: 0, out: 2, colour: 'black' });
    expect(b.transitionIn).toBeUndefined();
    expect(b.panZoom).toBeUndefined();
  });

  it('joining the parts back gives the original look', () => {
    const [a, b] = splitMainItem(looked, 3, ['a', 'b']);
    expect(joinMainItems(a, b)).toEqual({ ...looked, id: 'a' });
  });
});

describe('V13 sound clips: speed, split and join (like video clips)', () => {
  const sound = {
    ...createAudioItem(music, 5, { id: 'm' }),
    in: 2,
    out: 12,
    fadeIn: 1,
    fadeOut: 2,
  };

  it('a sound lasts (out − in) ÷ speed on the timeline; no speed means 1×', () => {
    expect(audioDuration(sound)).toBe(10);
    expect(audioDuration({ ...sound, speed: 2 })).toBe(5);
    expect(audioDuration({ ...sound, speed: 0.5 })).toBe(20);
  });

  it('a faster sound takes less room on its track', () => {
    const later = createAudioItem(music, 12, { id: 'later' }); // 12 s onwards
    expect(() => assertFitsInTrack([later], sound)).toThrow(/overlaps/); // 5–15 s
    expect(() => assertFitsInTrack([later], { ...sound, speed: 2 })).not.toThrow(); // 5–10 s
  });

  it('splits at a timeline offset: the first part keeps the fade in, the second the fade out', () => {
    const [a, b] = splitAudioItem({ ...sound, speed: 2 }, 3, ['a', 'b']);
    // 3 s into the clip at 2× is 6 s into the source: 2 + 6 = 8.
    expect(a).toMatchObject({ id: 'a', start: 5, in: 2, out: 8, fadeIn: 1, fadeOut: 0, speed: 2 });
    expect(b).toMatchObject({ id: 'b', start: 8, in: 8, out: 12, fadeIn: 0, fadeOut: 2, speed: 2 });
  });

  it('refuses a split that leaves a part shorter than 0.10 s', () => {
    expect(() => splitAudioItem(sound, 0.05, ['a', 'b'])).toThrow(/at least 0.10 s/);
    expect(() => splitAudioItem(sound, 9.95, ['a', 'b'])).toThrow(/at least 0.10 s/);
  });

  it('joins two parts that were split, back into one', () => {
    const [a, b] = splitAudioItem(sound, 4, ['a', 'b']);
    expect(joinAudioItems(a, b)).toEqual({ ...sound, id: 'a' });
  });

  it('refuses to join sounds that do not continue each other', () => {
    const [a, b] = splitAudioItem(sound, 4, ['a', 'b']);
    expect(() => joinAudioItems(a, { ...b, start: b.start + 1 })).toThrow(/split/); // moved apart
    expect(() => joinAudioItems(a, { ...b, volume: 0.5 })).toThrow(/split/);
    expect(() => joinAudioItems(a, { ...b, assetId: 'other' })).toThrow(/split/);
  });

  it('speed 0.25×–4×, and the sound must still last at least 0.10 s', () => {
    expect(setAudioSpeed(sound, 1.5).speed).toBe(1.5);
    expect(setAudioSpeed({ ...sound, speed: 2 }, 1)).not.toHaveProperty('speed');
    expect(() => setAudioSpeed(sound, 5)).toThrow(/0.25× and 4×/);
  });
});
