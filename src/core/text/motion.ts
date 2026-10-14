// How a text layer looks at a moment: fade, fly-in entrance and credits scroll. The export
// builds the same rules into FFmpeg expressions (render/compile.ts); the preview uses these.
import type { Seconds } from '../model/time.ts';
import type { TextEffects } from '../model/types.ts';
import type { Size } from './draw.ts';
import { creditsY } from './layout.ts';

/** Entrances take one second. */
export const ENTRANCE_SECONDS = 1;

export interface TextMotion {
  opacity: number;
  /** Where the layer's top-left corner is in the frame. */
  x: number;
  y: number;
}

/** `local` is the time since the layer started; `credits` is given for scrolling credits. */
export function textMotion(
  effects: TextEffects,
  local: Seconds,
  duration: Seconds,
  frame: Size,
  credits?: { creditsHeight: number },
): TextMotion {
  const fadeIn = effects.fadeIn ?? 0;
  const fadeOut = effects.fadeOut ?? 0;
  const opacity = Math.max(
    0,
    Math.min(1, fadeIn > 0 ? local / fadeIn : 1, fadeOut > 0 ? (duration - local) / fadeOut : 1),
  );
  if (credits) {
    return { opacity, x: 0, y: creditsY(local, duration, frame.height, credits.creditsHeight) };
  }
  const left = local < ENTRANCE_SECONDS ? 1 - local / ENTRANCE_SECONDS : 0;
  if (left === 0) return { opacity, x: 0, y: 0 };
  const { width: w, height: h } = frame;
  switch (effects.entrance) {
    case 'fly-left':
      return { opacity, x: -w * left, y: 0 };
    case 'fly-right':
      return { opacity, x: w * left, y: 0 };
    case 'fly-up':
      return { opacity, x: 0, y: h * left };
    case 'fly-down':
      return { opacity, x: 0, y: -h * left };
    default:
      return { opacity, x: 0, y: 0 };
  }
}
