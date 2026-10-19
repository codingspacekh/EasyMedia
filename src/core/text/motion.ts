// How a text layer looks at a moment: fades, an entrance in the first second, an exit in the
// last, and the credits scroll. The preview uses textMotion; the export uses motionExpressions,
// the same rules written as FFmpeg expressions (tests check that both give the same numbers).
import type { Seconds } from '../model/time.ts';
import type { Entrance, Exit, TextEffects } from '../model/types.ts';
import type { Size } from './draw.ts';
import { creditsY } from './layout.ts';

/** Entrances and exits take one second. */
export const ENTRANCE_SECONDS = 1;

export const ENTRANCES: readonly [Entrance, string][] = [
  ['none', 'None'],
  ['fly-left', 'Fly in from the left'],
  ['fly-right', 'Fly in from the right'],
  ['fly-up', 'Fly in from the bottom'],
  ['fly-down', 'Fly in from the top'],
  ['rise', 'Rise and fade in'],
  ['drop', 'Drop and bounce'],
  ['zoom', 'Zoom in'],
  ['pop', 'Pop'],
];

export const EXITS: readonly [Exit, string][] = [
  ['none', 'None'],
  ['fly-left', 'Fly out to the left'],
  ['fly-right', 'Fly out to the right'],
  ['fly-up', 'Fly out of the top'],
  ['fly-down', 'Fly out of the bottom'],
  ['sink', 'Sink and fade out'],
  ['zoom', 'Zoom away'],
];

/** The smallest a zooming layer gets (FFmpeg cannot scale to nothing). */
const SMALLEST = 0.01;
/** Rise and sink move this part of the frame height; drop falls from half the height. */
const RISE = 0.1;
const DROP = 0.5;
/** Pop overshoots (ease-out-back). */
const BACK = 1.70158;

export interface TextMotion {
  opacity: number;
  /** How far the layer is moved from its place, in frame pixels. */
  x: number;
  y: number;
  /** Its size, around the middle of its words (1 = as drawn). */
  scale: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (u: number) => 1 - (1 - u) ** 3;
const easeIn = (w: number) => w ** 3;
const easeBack = (u: number) => 1 + (BACK + 1) * (u - 1) ** 3 + BACK * (u - 1) ** 2;
/** Ease-out-bounce: lands, bounces three times smaller and smaller. */
function bounce(u: number): number {
  const n = 7.5625;
  const d = 2.75;
  if (u < 1 / d) return n * u * u;
  if (u < 2 / d) return n * (u - 1.5 / d) ** 2 + 0.75;
  if (u < 2.5 / d) return n * (u - 2.25 / d) ** 2 + 0.9375;
  return n * (u - 2.625 / d) ** 2 + 0.984375;
}

/**
 * `local` is the time since the layer started; `credits` is given for scrolling credits. A
 * zoom grows around the middle of the words (the caller scales around it).
 */
export function textMotion(
  effects: TextEffects,
  local: Seconds,
  duration: Seconds,
  frame: Size,
  credits?: { creditsHeight: number },
): TextMotion {
  const fadeIn = effects.fadeIn ?? 0;
  const fadeOut = effects.fadeOut ?? 0;
  let opacity = Math.max(
    0,
    Math.min(1, fadeIn > 0 ? local / fadeIn : 1, fadeOut > 0 ? (duration - local) / fadeOut : 1),
  );
  if (credits) {
    return {
      opacity,
      x: 0,
      y: creditsY(local, duration, frame.height, credits.creditsHeight),
      scale: 1,
    };
  }
  const { width: w, height: h } = frame;
  const u = clamp01(local / ENTRANCE_SECONDS);
  const v = clamp01((local - (duration - ENTRANCE_SECONDS)) / ENTRANCE_SECONDS);
  let x = 0;
  let y = 0;
  let scale = 1;
  switch (effects.entrance) {
    case 'fly-left':
      x -= w * (1 - u);
      break;
    case 'fly-right':
      x += w * (1 - u);
      break;
    case 'fly-up':
      y += h * (1 - u);
      break;
    case 'fly-down':
      y -= h * (1 - u);
      break;
    case 'rise':
      y += RISE * h * (1 - easeOut(u));
      opacity *= u;
      break;
    case 'drop':
      y -= DROP * h * (1 - bounce(u));
      break;
    case 'zoom':
      scale *= Math.max(SMALLEST, easeOut(u));
      break;
    case 'pop':
      scale *= Math.max(SMALLEST, easeBack(u));
      break;
  }
  switch (effects.exit) {
    case 'fly-left':
      x -= w * v;
      break;
    case 'fly-right':
      x += w * v;
      break;
    case 'fly-up':
      y -= h * v;
      break;
    case 'fly-down':
      y += h * v;
      break;
    case 'sink':
      y += RISE * h * easeIn(v);
      opacity *= 1 - v;
      break;
    case 'zoom':
      scale *= Math.max(SMALLEST, 1 - easeIn(v));
      break;
  }
  return { opacity, x: x + 0, y: y + 0, scale };
}

const num = (n: number) => String(Math.round(n * 1e6) / 1e6);

/**
 * The same motion for FFmpeg, for a full-frame text image laid over from `start` for
 * `duration` seconds: `scale` (null: none; to be quoted) for its scale filter, and `x` / `y`
 * (quoted) for its overlay
 * (the scaled image is moved so the anchor stays in place). Rise and sink also fade the words
 * over their second (`fadeIn` / `fadeOut`: an extra fade filter, as the preview multiplies).
 */
export function motionExpressions(
  effects: TextEffects,
  start: Seconds,
  duration: Seconds,
  frame: Size,
  anchor: { x: number; y: number },
): { x: string; y: string; scale: string | null; fadeIn: boolean; fadeOut: boolean } {
  const { width: w, height: h } = frame;
  const u = `min(max((t-${num(start)})/${ENTRANCE_SECONDS},0),1)`;
  const v = `min(max((t-${num(start + duration - ENTRANCE_SECONDS)})/${ENTRANCE_SECONDS},0),1)`;
  const easeOutE = (e: string) => `(1-pow(1-${e},3))`;
  const easeInE = (e: string) => `pow(${e},3)`;
  const bounceE = (e: string) => {
    const n = 7.5625;
    const d = 2.75;
    const c = (k: number) => String(k / d); // full precision: the preview uses exact values
    return (
      `if(lt(${e},${c(1)}),${n}*pow(${e},2),` +
      `if(lt(${e},${c(2)}),${n}*pow(${e}-${c(1.5)},2)+0.75,` +
      `if(lt(${e},${c(2.5)}),${n}*pow(${e}-${c(2.25)},2)+0.9375,` +
      `${n}*pow(${e}-${c(2.625)},2)+0.984375)))`
    );
  };
  const xs: string[] = [];
  const ys: string[] = [];
  const scales: string[] = [];
  switch (effects.entrance) {
    case 'fly-left':
      xs.push(`-${w}*(1-${u})`);
      break;
    case 'fly-right':
      xs.push(`${w}*(1-${u})`);
      break;
    case 'fly-up':
      ys.push(`${h}*(1-${u})`);
      break;
    case 'fly-down':
      ys.push(`-${h}*(1-${u})`);
      break;
    case 'rise':
      ys.push(`${num(RISE * h)}*(1-${easeOutE(u)})`);
      break;
    case 'drop':
      ys.push(`-${num(DROP * h)}*(1-${bounceE(u)})`);
      break;
    case 'zoom':
      scales.push(`max(${SMALLEST},${easeOutE(u)})`);
      break;
    case 'pop':
      scales.push(`max(${SMALLEST},1+${num(BACK + 1)}*pow(${u}-1,3)+${num(BACK)}*pow(${u}-1,2))`);
      break;
  }
  switch (effects.exit) {
    case 'fly-left':
      xs.push(`-${w}*${v}`);
      break;
    case 'fly-right':
      xs.push(`${w}*${v}`);
      break;
    case 'fly-up':
      ys.push(`-${h}*${v}`);
      break;
    case 'fly-down':
      ys.push(`${h}*${v}`);
      break;
    case 'sink':
      ys.push(`${num(RISE * h)}*${easeInE(v)}`);
      break;
    case 'zoom':
      scales.push(`max(${SMALLEST},1-${easeInE(v)})`);
      break;
  }
  const scale = scales.length ? scales.map((s) => `(${s})`).join('*') : null;
  const axis = (moves: string[], at: number) => {
    const parts = [...(scale ? [`${num(at)}*(1-${scale})`] : []), ...moves.map((m) => `(${m})`)];
    return parts.length ? `'${parts.join('+')}'` : '0';
  };
  return {
    x: axis(xs, anchor.x),
    y: axis(ys, anchor.y),
    scale,
    fadeIn: effects.entrance === 'rise',
    fadeOut: effects.exit === 'sink',
  };
}
