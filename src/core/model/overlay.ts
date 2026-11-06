// V20: a picture or video over the video (a logo in a corner, picture-in-picture). The rules of
// the overlay track. Pure functions: they return new objects and never change the ones given.
import { EditError } from './errors.ts';
import { DEFAULT_STILL_DURATION, newId } from './factory.ts';
import type { Seconds } from './time.ts';
import { MIN_DURATION } from './timeline.ts';
import type { Id, MediaAsset, OverlayItem, OverlayVideo, TextPosition } from './types.ts';

const EPSILON = 1e-9;
const POSITIONS: readonly TextPosition[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'centre',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right',
];

/** How long it shows on the timeline. */
export function overlayDuration(item: OverlayItem): Seconds {
  return item.type === 'video' ? item.out - item.in : item.duration;
}

/**
 * A new picture (a logo: top right) or video (picture-in-picture: bottom right, its own sound
 * off) over the video from `start`, a quarter of the frame wide.
 */
export function createOverlayItem(
  asset: MediaAsset,
  start: Seconds,
  { id, duration }: { id?: Id; duration?: Seconds } = {},
): OverlayItem {
  const base = { id: id ?? newId(), assetId: asset.id, start, widthPercent: 25, margin: 20 };
  if (asset.kind === 'image') {
    return {
      type: 'image',
      ...base,
      duration: duration ?? DEFAULT_STILL_DURATION,
      position: 'top-right',
      opacity: 1,
    };
  }
  if (asset.kind === 'video' && asset.duration !== undefined) {
    return {
      type: 'video',
      ...base,
      in: 0,
      out: asset.duration,
      position: 'bottom-right',
      opacity: 1,
      muted: true,
      volume: 1,
    };
  }
  throw new EditError('Only a picture or a video can go over the video.');
}

/** Items on the overlay track may touch but must not overlap. */
export function assertFitsOverlayTrack(track: readonly OverlayItem[], item: OverlayItem): void {
  const end = item.start + overlayDuration(item);
  const clash = track.some(
    (o) =>
      o.id !== item.id &&
      item.start < o.start + overlayDuration(o) - EPSILON &&
      o.start < end - EPSILON,
  );
  if (clash) {
    throw new EditError(
      'This overlaps another picture or video over the video. Move it, or make one of them shorter.',
    );
  }
}

/** Plays only part of a video over the video (as V2 trims a clip). */
export function trimOverlayVideo(
  item: OverlayVideo,
  range: { in: Seconds; out: Seconds },
  asset: MediaAsset,
): OverlayVideo {
  const length = asset.duration ?? 0;
  if (range.in < 0) throw new EditError('The start point cannot be before 0.00 s.');
  if (range.out <= range.in) throw new EditError('The end point must be after the start point.');
  if (range.out > length + EPSILON) {
    throw new EditError(
      `The end point cannot be after the end of the clip (${length.toFixed(2)} s).`,
    );
  }
  return validateOverlay({ ...item, in: range.in, out: range.out });
}

/** Checks every setting of an item over the video; returns it when all is well. */
export function validateOverlay<T extends OverlayItem>(item: T): T {
  if (!(item.start >= 0)) throw new EditError('It cannot start before 0.00 s.');
  if (!(overlayDuration(item) >= MIN_DURATION - EPSILON)) {
    throw new EditError(`It must show for at least ${MIN_DURATION.toFixed(2)} s.`);
  }
  if (!POSITIONS.includes(item.position)) {
    throw new EditError('Choose one of the nine places on the screen.');
  }
  if (!(item.widthPercent >= 1 && item.widthPercent <= 100)) {
    throw new EditError('The width must be between 1 and 100 % of the video’s width.');
  }
  if (!(item.margin >= 0)) throw new EditError('The margin cannot be less than 0 pixels.');
  if (!(item.opacity >= 0 && item.opacity <= 1)) {
    throw new EditError('Opacity must be between 0 % and 100 %.');
  }
  const fadeIn = item.fadeIn ?? 0;
  const fadeOut = item.fadeOut ?? 0;
  if (!(fadeIn >= 0 && fadeOut >= 0)) throw new EditError('Fades cannot be negative.');
  if (fadeIn + fadeOut > overlayDuration(item) + EPSILON) {
    throw new EditError('The fades are longer than it is shown. Make them shorter.');
  }
  if (item.type === 'video' && !(item.volume >= 0 && item.volume <= 2)) {
    throw new EditError('Volume must be between 0 % and 200 %.');
  }
  return item;
}
