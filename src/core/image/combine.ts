// V18: a picture placed on another picture and saved as a new one (F/M/25 Q2: "Place this image
// on the image credits.png so it looks like this"). Pure maths plus the filter; the main process
// runs it (src/main/media/engine.ts).
import { EditError } from '../model/errors.ts';
import type { Anchor, Size } from './crop.ts';

/** Where the top picture goes and how big it is. */
export interface Placement {
  /** One of the nine places, as for text and Resize & crop. */
  anchor: Anchor;
  /** Its width as a part of the background's width, 1–100 %. */
  widthPercent: number;
  /** Pixels between it and the edges it is placed against. */
  margin: number;
}

/** What the main process needs: the top picture's new size and where its top-left corner goes. */
export interface CombinePlan {
  top: Size;
  x: number;
  y: number;
}

/** The top picture at its size (keeping its shape, never bigger than the background) and place. */
export function planCombine(base: Size, top: Size, placement: Placement): CombinePlan {
  if (!(base.width > 0 && base.height > 0 && top.width > 0 && top.height > 0))
    throw new EditError('A picture has no size. Import it again.');
  const { anchor, widthPercent, margin } = placement;
  if (!(widthPercent >= 1 && widthPercent <= 100))
    throw new EditError('The size must be between 1 and 100 % of the picture’s width.');
  if (!(margin >= 0)) throw new EditError('The margin cannot be less than 0 pixels.');
  let width = Math.round((base.width * widthPercent) / 100);
  let height = Math.round((top.height * width) / top.width);
  if (height > base.height) {
    height = base.height;
    width = Math.round((top.width * height) / top.height);
  }
  const place = (start: boolean, end: boolean, spare: number) => {
    const at = start ? margin : end ? spare - margin : spare / 2;
    return Math.round(Math.min(Math.max(0, spare), Math.max(0, at)));
  };
  return {
    top: { width, height },
    x: place(anchor.endsWith('left'), anchor.endsWith('right'), base.width - width),
    y: place(anchor.startsWith('top'), anchor.startsWith('bottom'), base.height - height),
  };
}

/** FFmpeg filter: the background is input 0, the top picture input 1. */
export function combineFilter({ top, x, y }: CombinePlan): string {
  const whole = (n: number, min: number) => Number.isInteger(n) && n >= min && n <= 16384;
  if (!(whole(top.width, 1) && whole(top.height, 1) && whole(x, 0) && whole(y, 0)))
    throw new EditError('The picture could not be placed there. Choose another size or place.');
  return `[1:v]scale=${top.width}:${top.height}:flags=lanczos[top];[0:v][top]overlay=${x}:${y}:format=auto`;
}
