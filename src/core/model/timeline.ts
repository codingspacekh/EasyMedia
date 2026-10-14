// Timeline rules (V2, V3, V12, V14). Pure functions: they return new objects and never
// change the ones they are given.
import { EditError } from './errors.ts';
import type { Seconds } from './time.ts';
import type {
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
export function layoutMain(items: readonly MainItem[]): LaidOutItem[] {
  let start = 0;
  return items.map((item) => {
    const end = start + itemDuration(item);
    const laid = { item, start, end };
    start = end;
    return laid;
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
  if (item.type === 'video') {
    const cut = item.in + offset * item.speed;
    return [
      { ...item, id: idA, out: cut },
      { ...item, id: idB, in: cut },
    ];
  }
  return [
    { ...item, id: idA, duration: offset },
    { ...item, id: idB, duration: item.duration - offset },
  ];
}

/** Joins two neighbouring parts that came from splitting the same piece. Keeps the first id. */
export function joinMainItems(a: MainItem, b: MainItem): MainItem {
  if (a.type === 'video' && b.type === 'video' && continuesVideo(a, b)) {
    return { ...a, out: b.out };
  }
  if (a.type === 'image' && b.type === 'image' && a.assetId === b.assetId) {
    return { ...a, duration: a.duration + b.duration };
  }
  if (a.type === 'title' && b.type === 'title' && sameTitle(a, b)) {
    return { ...a, duration: a.duration + b.duration };
  }
  throw new EditError(
    'Only parts of the same clip that were split can be joined. Clips placed one after another are already joined (spliced).',
  );
}

/** Items on one audio track may touch but must not overlap. */
export function assertFitsInTrack(track: readonly AudioItem[], item: AudioItem): void {
  const end = item.start + (item.out - item.in);
  const clash = track.find(
    (o) =>
      o.id !== item.id &&
      item.start < o.start + (o.out - o.in) - EPSILON &&
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
