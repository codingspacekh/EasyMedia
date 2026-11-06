// V19: turning a clip or picture a quarter, half or three quarters, and flipping it. The export
// does it with FFmpeg before the picture is fitted to the frame; the preview turns the proxy with
// a CSS transform in a box of the turned shape, so both show the same picture.
import type { ClipTurn } from '../model/types.ts';

/** A turn of 90° or 270°: the picture's width and height swap. */
export const isQuarterTurn = (t: ClipTurn): boolean => t.turn === 90 || t.turn === 270;

/** The size of the picture once it is turned (used to fit it to the frame). */
export function turnedSize(
  size: { width: number; height: number },
  t: ClipTurn,
): { width: number; height: number } {
  return isQuarterTurn(t)
    ? { width: size.height, height: size.width }
    : { width: size.width, height: size.height };
}

/**
 * FFmpeg filters that turn and flip the picture, or '' for none. A half turn is a flip both ways,
 * so it is joined with the flips (180° and flipped across = flipped upside down).
 */
export function turnFilter(t: ClipTurn): string {
  const half = t.turn === 180;
  const across = half !== (t.flipH === true);
  const upDown = half !== (t.flipV === true);
  return [
    t.turn === 90 ? 'transpose=clock' : t.turn === 270 ? 'transpose=cclock' : '',
    across ? 'hflip' : '',
    upDown ? 'vflip' : '',
  ]
    .filter(Boolean)
    .join(',');
}

/** How the preview turns a picture: a CSS transform and the size of its box in the frame. */
export interface TurnStyle {
  transform: string;
  /** The box's width and height as a % of the frame's: the frame turned a quarter, or the frame. */
  width: string;
  height: string;
}

const percent = (n: number) => `${Number((n * 100).toFixed(3))}%`;

/** The preview's turn for a frame of the project's size, or null when the picture is as filmed. */
export function turnStyle(t: ClipTurn, frame: { width: number; height: number }): TurnStyle | null {
  if (!t.turn && !t.flipH && !t.flipV) return null;
  const quarter = isQuarterTurn(t);
  // CSS applies the last function first: turn, then flip across the screen as it is seen.
  return {
    transform: `scale(${t.flipH ? -1 : 1}, ${t.flipV ? -1 : 1}) rotate(${t.turn ?? 0}deg)`,
    width: quarter ? percent(frame.height / frame.width) : '100%',
    height: quarter ? percent(frame.width / frame.height) : '100%',
  };
}

const TURNS = { 90: '90° clockwise', 180: '180°', 270: '90° anticlockwise' } as const;

/** How a clip is turned, in words for the inspector. */
export function turnLabel(t: ClipTurn): string {
  const flips = [t.flipH && 'horizontally', t.flipV && 'vertically'].filter(Boolean).join(' and ');
  const parts = [t.turn ? `Turned ${TURNS[t.turn]}` : '', flips ? `flipped ${flips}` : ''].filter(
    Boolean,
  );
  if (!parts.length) return 'Not turned or flipped';
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
