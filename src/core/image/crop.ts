// V11: resize a still with constrained proportions, then crop it to the project's size from a
// 9-point anchor (like Photoshop's Canvas Size in Book B Task 11a). Pure maths plus the filter.
import { EditError } from '../model/errors.ts';
import type { TextPosition } from '../model/types.ts';

export interface Size {
  width: number;
  height: number;
}

/** Which part of the picture to keep: the same 9 places as text positions. */
export type Anchor = TextPosition;
/** Top-left corner of the kept part, in resized-picture pixels (dragged with the mouse). */
export interface CropOffset {
  x: number;
  y: number;
}

/** What the main process needs to make the picture: numbers only, it builds the filter itself. */
export interface ResizeCrop {
  resize: Size;
  crop: { x: number; y: number; width: number; height: number };
}

export interface ResizeCropPlan extends ResizeCrop {
  removed: { top: number; bottom: number; left: number; right: number };
  /** FFmpeg filter that makes the new picture. */
  filter: string;
}

/** Constrain proportions: give the width or the height, the other follows. */
export function resizeKeepingRatio(
  original: Size,
  wanted: { width: number } | { height: number },
): Size {
  return 'width' in wanted
    ? { width: wanted.width, height: Math.round((original.height * wanted.width) / original.width) }
    : {
        width: Math.round((original.width * wanted.height) / original.height),
        height: wanted.height,
      };
}

/** Smallest resize that covers the target without stretching, then the crop at `keep`. */
export function planResizeCrop(
  original: Size,
  target: Size,
  keep: Anchor | CropOffset,
): ResizeCropPlan {
  if (!(original.width > 0 && original.height > 0)) {
    throw new EditError('This picture has no size. Import it again.');
  }
  const resize =
    original.width / original.height <= target.width / target.height
      ? resizeKeepingRatio(original, { width: target.width })
      : resizeKeepingRatio(original, { height: target.height });
  const spareX = resize.width - target.width;
  const spareY = resize.height - target.height;
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  const [x, y] =
    typeof keep === 'object'
      ? [clamp(keep.x, spareX), clamp(keep.y, spareY)]
      : [
          anchorOffset(keep.endsWith('left'), keep.endsWith('right'), spareX),
          anchorOffset(keep.startsWith('top'), keep.startsWith('bottom'), spareY),
        ];
  return {
    resize,
    crop: { x, y, ...target },
    removed: { top: y, bottom: spareY - y, left: x, right: spareX - x },
    filter: resizeCropFilter({ resize, crop: { x, y, ...target } }),
  };
}

function anchorOffset(start: boolean, end: boolean, spare: number): number {
  return start ? 0 : end ? spare : Math.floor(spare / 2);
}

/** Checks the numbers (whole pixels, crop inside the resized picture) and builds the filter. */
export function resizeCropFilter({ resize, crop }: ResizeCrop): string {
  const whole = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= 16384;
  const ok =
    whole(resize.width, 1) &&
    whole(resize.height, 1) &&
    whole(crop.width, 1) &&
    whole(crop.height, 1) &&
    whole(crop.x, 0) &&
    whole(crop.y, 0) &&
    crop.x + crop.width <= resize.width &&
    crop.y + crop.height <= resize.height;
  if (!ok) throw new EditError('The crop does not fit inside the resized picture.');
  return `scale=${resize.width}:${resize.height}:flags=lanczos,crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`;
}
