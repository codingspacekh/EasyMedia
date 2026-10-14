// V11: resize a still with constrained proportions, then crop it to the project's size — from a
// 9-point anchor (like Photoshop's Canvas Size in Book B Task 11a) or from a part the student
// selects with the mouse. Pure maths plus the filter.
import { EditError } from '../model/errors.ts';
import type { TextPosition } from '../model/types.ts';

export interface Size {
  width: number;
  height: number;
}

/** Which part of the picture to keep: the same 9 places as text positions. */
export type Anchor = TextPosition;
/** A part of the original picture with the project's shape, in original pixels (mouse selection). */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Point {
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
  /** The picture had to be made bigger than it is: it may look blurry. */
  enlarged: boolean;
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
  keep: Anchor | CropRegion,
): ResizeCropPlan {
  assertHasSize(original);
  if (typeof keep === 'object') return planFromRegion(original, target, keep);
  const resize =
    original.width / original.height <= target.width / target.height
      ? resizeKeepingRatio(original, { width: target.width })
      : resizeKeepingRatio(original, { height: target.height });
  const spareX = resize.width - target.width;
  const spareY = resize.height - target.height;
  const x = anchorOffset(keep.endsWith('left'), keep.endsWith('right'), spareX);
  const y = anchorOffset(keep.startsWith('top'), keep.startsWith('bottom'), spareY);
  return finish(original, target, resize, x, y);
}

/**
 * The same two steps for a part chosen with the mouse: resize so that the part becomes exactly
 * the project size (bigger than the original when zooming in), then crop the part out.
 */
export function planFromRegion(original: Size, target: Size, region: CropRegion): ResizeCropPlan {
  assertHasSize(original);
  const k = target.width / region.width;
  const resize = { width: Math.round(original.width * k), height: Math.round(original.height * k) };
  const clamp = (v: number, max: number) => Math.min(max, Math.max(0, Math.round(v)));
  const x = clamp(region.x * k, resize.width - target.width);
  const y = clamp(region.y * k, resize.height - target.height);
  return finish(original, target, resize, x, y);
}

function finish(original: Size, target: Size, resize: Size, x: number, y: number): ResizeCropPlan {
  const crop = { x, y, ...target };
  return {
    resize,
    crop,
    removed: {
      top: y,
      bottom: resize.height - target.height - y,
      left: x,
      right: resize.width - target.width - x,
    },
    enlarged: resize.width > original.width,
    filter: resizeCropFilter({ resize, crop }),
  };
}

/** The largest part with the project's shape, placed at `anchor` (what the 9 buttons choose). */
export function coverRegion(original: Size, target: Size, anchor: Anchor): CropRegion {
  const aspect = target.width / target.height;
  const width = Math.min(original.width, original.height * aspect);
  const height = width / aspect;
  const spareX = original.width - width;
  const spareY = original.height - height;
  const place = (start: boolean, end: boolean, spare: number) =>
    start ? 0 : end ? spare : spare / 2;
  return {
    x: place(anchor.endsWith('left'), anchor.endsWith('right'), spareX),
    y: place(anchor.startsWith('top'), anchor.startsWith('bottom'), spareY),
    width,
    height,
  };
}

/** Moves the part by (dx, dy) original pixels, keeping it inside the picture. */
export function moveRegion(region: CropRegion, dx: number, dy: number, original: Size): CropRegion {
  return {
    ...region,
    x: Math.min(original.width - region.width, Math.max(0, region.x + dx)),
    y: Math.min(original.height - region.height, Math.max(0, region.y + dy)),
  };
}

/**
 * A part with the project's shape, from a fixed corner to the mouse (drawing a new part, or
 * dragging a corner handle). It stays inside the picture and is at least 1/20 of its width.
 */
export function regionFromCorners(
  fixed: Point,
  pointer: Point,
  original: Size,
  target: Size,
): CropRegion {
  const aspect = target.width / target.height;
  const right = pointer.x >= fixed.x;
  const down = pointer.y >= fixed.y;
  const roomX = right ? original.width - fixed.x : fixed.x;
  const roomY = (down ? original.height - fixed.y : fixed.y) * aspect;
  const wanted = Math.max(Math.abs(pointer.x - fixed.x), Math.abs(pointer.y - fixed.y) * aspect);
  const width = Math.min(roomX, roomY, Math.max(original.width / 20, wanted));
  const height = width / aspect;
  return {
    x: right ? fixed.x : fixed.x - width,
    y: down ? fixed.y : fixed.y - height,
    width,
    height,
  };
}

function assertHasSize(original: Size): void {
  if (!(original.width > 0 && original.height > 0)) {
    throw new EditError('This picture has no size. Import it again.');
  }
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
