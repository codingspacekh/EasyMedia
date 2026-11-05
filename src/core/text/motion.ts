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
  ['slam', 'Slam down and shake'],
  ['type-on', 'Type on (left to right)'],
  ['spin', 'Spin in'],
  ['whip', 'Whip in from the right'],
];

export const EXITS: readonly [Exit, string][] = [
  ['none', 'None'],
  ['fly-left', 'Fly out to the left'],
  ['fly-right', 'Fly out to the right'],
  ['fly-up', 'Fly out of the top'],
  ['fly-down', 'Fly out of the bottom'],
  ['sink', 'Sink and fade out'],
  ['zoom', 'Zoom away'],
  ['pop', 'Pop out'],
  ['spin', 'Spin away'],
  ['whip', 'Whip off to the left'],
];

/** The smallest a zooming layer gets (FFmpeg cannot scale to nothing). */
const SMALLEST = 0.01;
/** Rise and sink move this part of the frame height; drop falls from half the height. */
const RISE = 0.1;
const DROP = 0.5;
/** Pop overshoots (ease-out-back). */
const BACK = 1.70158;
/** Slam: starts this big, lands after this part of its second, then shakes (part of the height). */
const SLAM_FROM = 3;
const SLAM_FALL = 0.5;
const SHAKE = 0.02;
const SHAKES = 4;
/** Whip: arrives (or leaves) in this part of its second. */
const WHIP = 0.6;
/** Type on: the edge starts and ends this part of the frame width beyond the words. */
const REVEAL_MARGIN = 0.02;
/** Spinning words are cut out with this part of the frame height around them (for glows). */
const SPIN_MARGIN = 0.12;

export interface TextMotion {
  opacity: number;
  /** How far the layer is moved from its place, in frame pixels. */
  x: number;
  y: number;
  /** Its size, around the middle of its words (1 = as drawn). */
  scale: number;
  /** Turned clockwise about the middle of its words, in radians. */
  rotate: number;
  /** Type on: the part of the words shown so far, from the left (1 = all). */
  reveal: number;
}

/** A rectangle in frame pixels: the words' box, or the part of the frame cut out. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
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

const spins = (effects: TextEffects) => effects.entrance === 'spin' || effects.exit === 'spin';

/**
 * The part of the frame image the export cuts out before turning it: spinning words with a
 * margin (turning the whole frame would be slow); null when nothing spins.
 */
export function motionWindow(effects: TextEffects, words: Box, frame: Size): Box | null {
  if (!spins(effects)) return null;
  const m = SPIN_MARGIN * frame.height;
  const x0 = Math.max(0, Math.floor(words.x - m));
  const y0 = Math.max(0, Math.floor(words.y - m));
  const x1 = Math.min(frame.width, Math.ceil(words.x + words.width + m));
  const y1 = Math.min(frame.height, Math.ceil(words.y + words.height + m));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Typing on: the edge's start and end, and the right side of the picture (all shown). */
function revealRange(words: Box, frame: Size, window: Box | null) {
  const left = window?.x ?? 0;
  const right = left + (window?.width ?? frame.width);
  const m = REVEAL_MARGIN * frame.width;
  return {
    from: Math.min(right, Math.max(left, words.x - m)),
    to: Math.min(right, Math.max(left, words.x + words.width + m)),
    right,
  };
}

/** Typing on: everything left of this x (frame pixels) is shown; at the end, all of it. */
export function revealEdge(reveal: number, words: Box, frame: Size, window: Box | null): number {
  const { from, to, right } = revealRange(words, frame, window);
  return reveal >= 1 ? right : from + reveal * (to - from);
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
      rotate: 0,
      reveal: 1,
    };
  }
  const { width: w, height: h } = frame;
  const u = clamp01(local / ENTRANCE_SECONDS);
  const v = clamp01((local - (duration - ENTRANCE_SECONDS)) / ENTRANCE_SECONDS);
  let x = 0;
  let y = 0;
  let scale = 1;
  let rotate = 0;
  let reveal = 1;
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
    case 'slam': {
      const fall = Math.min(u / SLAM_FALL, 1);
      const settle = clamp01((u - SLAM_FALL) / (1 - SLAM_FALL));
      scale *= SLAM_FROM - (SLAM_FROM - 1) * fall ** 2;
      opacity *= fall;
      x += SHAKE * h * Math.sin(2 * SHAKES * Math.PI * settle) * (1 - settle);
      break;
    }
    case 'type-on':
      reveal = u;
      break;
    case 'spin':
      rotate -= 2 * Math.PI * (1 - easeOut(u));
      scale *= Math.max(SMALLEST, easeOut(u));
      break;
    case 'whip':
      x += w * (1 - easeBack(Math.min(u / WHIP, 1)));
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
    case 'pop':
      scale *= Math.max(SMALLEST, easeBack(1 - v));
      break;
    case 'spin':
      rotate += 2 * Math.PI * easeIn(v);
      scale *= Math.max(SMALLEST, 1 - easeIn(v));
      break;
    case 'whip':
      x -= w * easeIn(Math.min(v / WHIP, 1));
      break;
  }
  return { opacity, x: x + 0, y: y + 0, scale, rotate: rotate + 0, reveal };
}

const num = (n: number) => String(Math.round(n * 1e6) / 1e6);

/** The export's motion of a text layer (see motionExpressions). */
export interface MotionExpressions {
  /** Where the overlay lays the (cut, turned, scaled) picture; quoted, or '0'. */
  x: string;
  y: string;
  /** For its scale filter (null: none; to be quoted). */
  scale: string | null;
  /** For a rotate filter, clockwise radians (null: nothing turns; to be quoted). */
  angle: string | null;
  /** The rotate filter's square output: wide enough for the window's diagonal. */
  size: number | null;
  /** The part of the frame picture cut out first (spinning words), or null: all of it. */
  window: Box | null;
  /** Type on: the frame x left of which the words show (to be quoted), or null. */
  edge: string | null;
  /** Seconds of an extra fade in at the start / out at the end (0: none). */
  fadeIn: number;
  fadeOut: number;
}

/**
 * The same motion for FFmpeg, for a full-frame text image laid over from `start` for
 * `duration` seconds. The image is (1) cut to `window` if there is one, (2) typing on: only
 * what is left of `edge` kept (padded on the left by the picture's width and cropped at the
 * edge, so the kept part stays in place), (3) turned by `angle` about its middle into a
 * `size` × `size` square, (4) scaled by `scale` from its corner, and (5) laid at `x`, `y`,
 * worked out so the middle of the words (`anchor`) moves exactly as the preview's. `words` is
 * the words' box (default: the whole frame).
 */
export function motionExpressions(
  effects: TextEffects,
  start: Seconds,
  duration: Seconds,
  frame: Size,
  anchor: { x: number; y: number },
  words: Box = { x: 0, y: 0, width: frame.width, height: frame.height },
): MotionExpressions {
  const { width: w, height: h } = frame;
  const u = `min(max((t-${num(start)})/${ENTRANCE_SECONDS},0),1)`;
  const v = `min(max((t-${num(start + duration - ENTRANCE_SECONDS)})/${ENTRANCE_SECONDS},0),1)`;
  const easeOutE = (e: string) => `(1-pow(1-${e},3))`;
  const easeInE = (e: string) => `pow(${e},3)`;
  const easeBackE = (e: string) => `(1+${num(BACK + 1)}*pow(${e}-1,3)+${num(BACK)}*pow(${e}-1,2))`;
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
  const angles: string[] = [];
  let reveal: string | null = null;
  let fadeIn = 0;
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
      fadeIn = ENTRANCE_SECONDS;
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
    case 'slam': {
      const fall = `min(${u}/${SLAM_FALL},1)`;
      const settle = `min(max((${u}-${SLAM_FALL})/${num(1 - SLAM_FALL)},0),1)`;
      scales.push(`${SLAM_FROM}-${SLAM_FROM - 1}*pow(${fall},2)`);
      xs.push(`${num(SHAKE * h)}*sin(${2 * SHAKES}*PI*${settle})*(1-${settle})`);
      fadeIn = SLAM_FALL * ENTRANCE_SECONDS;
      break;
    }
    case 'type-on':
      reveal = u;
      break;
    case 'spin':
      angles.push(`-2*PI*(1-${easeOutE(u)})`);
      scales.push(`max(${SMALLEST},${easeOutE(u)})`);
      break;
    case 'whip':
      xs.push(`${w}*(1-${easeBackE(`min(${u}/${WHIP},1)`)})`);
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
    case 'pop':
      scales.push(`max(${SMALLEST},${easeBackE(`(1-${v})`)})`);
      break;
    case 'spin':
      angles.push(`2*PI*${easeInE(v)}`);
      scales.push(`max(${SMALLEST},1-${easeInE(v)})`);
      break;
    case 'whip':
      xs.push(`-${w}*${easeInE(`min(${v}/${WHIP},1)`)}`);
      break;
  }
  const scale = scales.length ? scales.map((s) => `(${s})`).join('*') : null;
  const angle = angles.length ? angles.map((a) => `(${a})`).join('+') : null;
  const window = motionWindow(effects, words, frame);
  const fadeOut = effects.exit === 'sink' ? ENTRANCE_SECONDS : 0;
  const plain = { scale, angle: null, size: null, window: null, edge: null, fadeIn, fadeOut };

  if (!angle && !reveal) {
    // The scaled full-frame image is moved so the anchor stays in place.
    const axis = (moves: string[], at: number) => {
      const parts = [...(scale ? [`${num(at)}*(1-${scale})`] : []), ...moves.map((m) => `(${m})`)];
      return parts.length ? `'${parts.join('+')}'` : '0';
    };
    return { ...plain, x: axis(xs, anchor.x), y: axis(ys, anchor.y) };
  }

  // The picture cut out (window), its top-left corner in the frame (c), the edge of typing on.
  const cut = window ?? { x: 0, y: 0, width: w, height: h };
  let edge: string | null = null;
  if (reveal) {
    const { from, to, right } = revealRange(words, frame, window);
    edge = `if(gte(${reveal},1),${num(right)},${num(from)}+${reveal}*${num(to - from)})`;
  }
  const cx = edge ? `(${edge}-${cut.width})` : num(cut.x);
  const cy = num(cut.y);
  const size = angle ? Math.ceil(Math.hypot(cut.width, cut.height)) : null;
  // The overlay corner O = A + m − s·C' + s·R(c + C − A): C the cut picture's middle, C' the
  // turned square's (C without turning), R the turn; then the anchor A lands at A + m and every
  // other point p at A + m + s·R(p − A), as in the preview.
  const s = scale ? `(${scale})` : '1';
  const vx = `(${cx}+${num(cut.width / 2 - anchor.x)})`;
  const vy = `(${cy}+${num(cut.height / 2 - anchor.y)})`;
  const a = angle ? `(${angle})` : null;
  const rx = a ? `(${vx}*cos(${a})-${vy}*sin(${a}))` : vx;
  const ry = a ? `(${vx}*sin(${a})+${vy}*cos(${a}))` : vy;
  const half = (side: number) => num((size ?? side) / 2);
  const axis = (at: number, moves: string[], side: number, r: string) =>
    `'${[num(at), ...moves.map((m) => `(${m})`), `${s}*(${r}-${half(side)})`].join('+')}'`;
  return {
    ...plain,
    angle,
    size,
    window,
    edge,
    x: axis(anchor.x, xs, cut.width, rx),
    y: axis(anchor.y, ys, cut.height, ry),
  };
}
