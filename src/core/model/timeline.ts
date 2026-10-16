// Timeline rules (V2, V3, V12, V14). Pure functions: they return new objects and never
// change the ones they are given.
import { EditError } from './errors.ts';
import type { Seconds } from './time.ts';
import type {
  ClipFade,
  AudioItem,
  Id,
  ImageClip,
  MainItem,
  MediaAsset,
  TextItem,
  TitleSlide,
  VideoClip,
} from './types.ts';

/** Shortest item allowed on any track. */
export const MIN_DURATION: Seconds = 0.1;
export const MIN_SPEED = 0.25;
export const MAX_SPEED = 4;
const EPSILON = 1e-9;

export interface LaidOutItem {
  item: MainItem;
  start: Seconds;
  end: Seconds;
}

export function itemDuration(item: MainItem): Seconds {
  return item.type === 'video' ? (item.out - item.in) / item.speed : item.duration;
}

/** Start and end of every main-track item: they play one after another with no gaps. */
/** How long item `index` overlaps the one before it (its transition; never longer than either). */
export function transitionOverlap(items: readonly MainItem[], index: number): Seconds {
  const item = items[index];
  const before = items[index - 1];
  if (!item?.transitionIn || !before) return 0;
  return Math.min(item.transitionIn.duration, itemDuration(before), itemDuration(item));
}

/** Where each item sits on the main track; a transition starts an item before the last one ends. */
export function layoutMain(items: readonly MainItem[]): LaidOutItem[] {
  let end = 0;
  return items.map((item, index) => {
    const start = end - transitionOverlap(items, index);
    end = start + itemDuration(item);
    return { item, start, end };
  });
}

export function mainTrackDuration(items: readonly MainItem[]): Seconds {
  return layoutMain(items).at(-1)?.end ?? 0;
}

export function findMainItemAt(
  items: readonly MainItem[],
  time: Seconds,
): { index: number; offset: Seconds } | null {
  const layout = layoutMain(items);
  const index = layout.findIndex((l) => time >= l.start && time < l.end);
  return index < 0 ? null : { index, offset: time - layout[index]!.start };
}

export function trimVideo(
  clip: VideoClip,
  range: { in: Seconds; out: Seconds },
  asset: MediaAsset,
): VideoClip {
  const length = asset.duration ?? 0;
  if (range.in < 0) throw new EditError('The start point cannot be before 0.00 s.');
  if (range.out <= range.in) throw new EditError('The end point must be after the start point.');
  if (range.out > length + EPSILON) {
    throw new EditError(
      `The end point cannot be after the end of the clip (${length.toFixed(2)} s).`,
    );
  }
  assertMinDuration((range.out - range.in) / clip.speed);
  return { ...clip, in: range.in, out: range.out };
}

export function setVideoSpeed(clip: VideoClip, speed: number): VideoClip {
  if (!(speed >= MIN_SPEED && speed <= MAX_SPEED)) {
    throw new EditError(`Speed must be between ${MIN_SPEED}× and ${MAX_SPEED}×.`);
  }
  assertMinDuration((clip.out - clip.in) / speed);
  return { ...clip, speed };
}

export function setItemDuration<T extends ImageClip | TitleSlide | TextItem>(
  item: T,
  duration: Seconds,
): T {
  assertMinDuration(duration);
  return { ...item, duration };
}

/** Splits a main-track item `offset` seconds after its start (timeline time). */
export function splitMainItem(
  item: MainItem,
  offset: Seconds,
  [idA, idB]: [Id, Id],
): [MainItem, MainItem] {
  assertMinDuration(offset);
  assertMinDuration(itemDuration(item) - offset);
  // Filters stay on both parts; the fade in, transition and pan & zoom belong to the start,
  // the fade out to the end.
  const rest = { ...item };
  delete rest.transitionIn;
  delete rest.panZoom;
  const first = item.fade ? { fade: { ...item.fade, out: 0 } } : {};
  const second = item.fade ? { fade: { ...item.fade, in: 0 } } : {};
  if (item.type === 'video' && rest.type === 'video') {
    const cut = item.in + offset * item.speed;
    return [
      { ...item, ...first, id: idA, out: cut },
      { ...rest, ...second, id: idB, in: cut },
    ];
  }
  if (item.type === 'video' || rest.type === 'video') throw new Error('unreachable');
  return [
    { ...item, ...first, id: idA, duration: offset },
    { ...rest, ...second, id: idB, duration: item.duration - offset },
  ];
}

/** The look of two joined parts: the first part's, with the second part's fade out. */
function joinedLook(a: MainItem, b: MainItem): { fade?: ClipFade } {
  return a.fade || b.fade
    ? {
        fade: {
          in: a.fade?.in ?? 0,
          out: b.fade?.out ?? 0,
          colour: a.fade?.colour ?? b.fade?.colour ?? 'black',
        },
      }
    : {};
}

/** Joins two neighbouring parts that came from splitting the same piece. Keeps the first id. */
export function joinMainItems(a: MainItem, b: MainItem): MainItem {
  const sameFilters = JSON.stringify(a.effects ?? []) === JSON.stringify(b.effects ?? []);
  if (sameFilters && a.type === 'video' && b.type === 'video' && continuesVideo(a, b)) {
    return { ...a, ...joinedLook(a, b), out: b.out };
  }
  if (sameFilters && a.type === 'image' && b.type === 'image' && a.assetId === b.assetId) {
    return { ...a, ...joinedLook(a, b), duration: a.duration + b.duration };
  }
  if (sameFilters && a.type === 'title' && b.type === 'title' && sameTitle(a, b)) {
    return { ...a, ...joinedLook(a, b), duration: a.duration + b.duration };
  }
  throw new EditError(
    'Only parts of the same clip that were split can be joined. Clips placed one after another are already joined (spliced).',
  );
}

/** How long a music or voiceover clip plays on the timeline. */
export function audioDuration(item: AudioItem): Seconds {
  return (item.out - item.in) / (item.speed ?? 1);
}

/** V13: a sound's speed, like a video clip's (V14); 1× is stored as no speed. */
export function setAudioSpeed(item: AudioItem, speed: number): AudioItem {
  if (!(speed >= MIN_SPEED && speed <= MAX_SPEED)) {
    throw new EditError(`Speed must be between ${MIN_SPEED}× and ${MAX_SPEED}×.`);
  }
  assertMinDuration((item.out - item.in) / speed);
  const changed: AudioItem = { ...item, speed };
  if (speed === 1) delete changed.speed;
  return changed;
}

/** Splits a sound `offset` seconds after its start (timeline time). */
export function splitAudioItem(
  item: AudioItem,
  offset: Seconds,
  [idA, idB]: [Id, Id],
): [AudioItem, AudioItem] {
  assertMinDuration(offset);
  assertMinDuration(audioDuration(item) - offset);
  const cut = item.in + offset * (item.speed ?? 1);
  return [
    { ...item, id: idA, out: cut, fadeOut: 0 },
    { ...item, id: idB, start: item.start + offset, in: cut, fadeIn: 0 },
  ];
}

/** Joins two sounds that came from splitting one and still play one after the other. */
export function joinAudioItems(a: AudioItem, b: AudioItem): AudioItem {
  const continues =
    a.assetId === b.assetId &&
    (a.speed ?? 1) === (b.speed ?? 1) &&
    a.volume === b.volume &&
    a.duck === b.duck &&
    Math.abs(a.out - b.in) < EPSILON &&
    Math.abs(a.start + audioDuration(a) - b.start) < EPSILON;
  if (!continues) {
    throw new EditError(
      'Only parts of the same sound that were split, and still play one after the other, can be joined.',
    );
  }
  return { ...a, out: b.out, fadeOut: b.fadeOut };
}

/** Items on one audio track may touch but must not overlap. */
export function assertFitsInTrack(track: readonly AudioItem[], item: AudioItem): void {
  const end = item.start + audioDuration(item);
  const clash = track.find(
    (o) =>
      o.id !== item.id &&
      item.start < o.start + audioDuration(o) - EPSILON &&
      o.start < end - EPSILON,
  );
  if (clash) {
    throw new EditError(
      'This audio overlaps another clip on the same track. Move it or use the other track.',
    );
  }
}

function continuesVideo(a: VideoClip, b: VideoClip): boolean {
  return (
    a.assetId === b.assetId &&
    a.speed === b.speed &&
    a.muted === b.muted &&
    a.volume === b.volume &&
    Math.abs(a.out - b.in) < EPSILON
  );
}

function sameTitle(a: TitleSlide, b: TitleSlide): boolean {
  return (
    a.text === b.text &&
    JSON.stringify(a.background) === JSON.stringify(b.background) &&
    JSON.stringify(a.style) === JSON.stringify(b.style)
  );
}

function assertMinDuration(duration: Seconds): void {
  if (duration < MIN_DURATION - EPSILON) {
    throw new EditError(
      `A clip or part of a clip must last at least ${MIN_DURATION.toFixed(2)} s.`,
    );
  }
}
