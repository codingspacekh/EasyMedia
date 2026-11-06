// AN5 Crop… and Make a colour see-through… on a picture in Animation mode (9626/04 O/N/19: the
// pearl cut from a photo, on a transparent background). The new picture file is made beside the
// old one (core/image); here the object is changed to show it: a crop keeps the part kept where it
// was on the stage, at the same scale, turned, flipped and skewed as before.
import { EditError } from '../model/errors.ts';
import type { CropRegion } from '../image/crop.ts';
import { moved, placedAt, toStage } from './geometry.ts';
import { trackOf } from './tween.ts';
import type { Picture, PictureObject, Track } from './types.ts';

/**
 * Refuses a picture that cannot be changed here: an SVG (FFmpeg cannot read it) or a stop motion
 * (AN14: its picture changes on the timeline). `done` says what would be done: "cropped".
 */
export function checkPictureEditable(o: PictureObject, file: Picture, done: string): void {
  if (/\.svg$/i.test(file.path))
    throw new EditError(`Only a PNG, JPG, GIF or BMP picture can be ${done}, not an SVG.`);
  if (trackOf(o, 'picture'))
    throw new EditError(
      `This picture changes during the animation (stop motion), so it cannot be ${done} here.`,
    );
}

const scaledTrack = (t: Track, k: number): Track => ({
  ...t,
  keyframes: t.keyframes.map((f) => ({ ...f, value: Number(f.value) * k })),
});

/**
 * The object showing `to`, the `region` of `from` (in its pixels) cut out: the part stays where the
 * stage showed it, at the same scale. Its motion moves with it and its size keyframes shrink by
 * the same amount (worked out from its own size: a part of a picture that grows stays close).
 */
export function croppedPicture(
  o: PictureObject,
  from: Picture,
  region: CropRegion,
  to: Picture,
): PictureObject {
  const kx = from.width > 0 ? region.width / from.width : 1;
  const ky = from.height > 0 ? region.height / from.height : 1;
  const width = o.width * kx;
  const height = o.height * ky;
  // The kept part's top-left corner stays where the stage showed it (turned about its pivot, AN27).
  const corner = toStage(o, {
    x: (region.x * o.width) / from.width,
    y: (region.y * o.height) / from.height,
  });
  const at = placedAt({ ...o, width, height }, { x: 0, y: 0 }, corner);
  const shifted = moved(o, at.x - o.x, at.y - o.y);
  const tracks = shifted.tracks?.map((t) =>
    t.property === 'width' ? scaledTrack(t, kx) : t.property === 'height' ? scaledTrack(t, ky) : t,
  );
  return { ...shifted, pictureId: to.id, width, height, ...(tracks ? { tracks } : {}) };
}
