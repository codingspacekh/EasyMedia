// AN9, AN13: keyframes per property and the values in between (tweening). Pure functions on
// tracks and objects; the app's commands wrap them so each change is one undo step.
import { EditError } from '../model/errors.ts';
import { setSize } from './geometry.ts';
import { isColour } from './rules.ts';
import type { AnimObject, Easing, Keyframe, KeyValue, Track, TweenProperty } from './types.ts';

export const EASINGS: readonly { id: Easing; label: string; hint: string }[] = [
  { id: 'linear', label: 'Linear', hint: 'The same speed all the way' },
  { id: 'ease-in', label: 'Ease in', hint: 'Starts slowly, then speeds up' },
  { id: 'ease-out', label: 'Ease out', hint: 'Starts fast, then slows to a stop' },
  { id: 'ease-in-out', label: 'Ease in and out', hint: 'Slow at both ends' },
  { id: 'bounce', label: 'Bounce', hint: 'Lands and bounces to a stop' },
];

export const TWEEN_PROPERTIES: readonly { id: TweenProperty; label: string }[] = [
  { id: 'x', label: 'X' },
  { id: 'y', label: 'Y' },
  { id: 'width', label: 'W' },
  { id: 'height', label: 'H' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'opacity', label: 'Opacity' },
  { id: 'fillColour', label: 'Fill colour' },
  { id: 'strokeColour', label: 'Outline colour' },
  { id: 'strokeWidth', label: 'Outline width' },
  { id: 'radius', label: 'Corner radius' },
  { id: 'size', label: 'Font size' },
  { id: 'text', label: 'Words' },
];

/** The CSS-style bounce used by the text animations too: lands, then bounces smaller and smaller. */
function bounceOut(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

/** Maps the share of the way through a tween (0–1) to the share of the change. */
export function ease(easing: Easing, t: number): number {
  const u = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return u;
    case 'ease-in':
      return u * u * u;
    case 'ease-out':
      return 1 - (1 - u) ** 3;
    case 'ease-in-out':
      return u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    case 'bounce':
      return bounceOut(u);
  }
}

const hex2 = (n: number) =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0');

/** Mixes two colours in RGB, as the coursebook's colour tween; hex in, lower-case hex out. */
function mixColours(a: string, b: string, t: number): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${ca.map((v, i) => hex2(v + (cb[i]! - v) * t)).join('')}`;
}

/** The value `t` (0–1) of the way from `a` to `b`: numbers and colours blend; words switch at the end. */
export function interpolate(a: KeyValue, b: KeyValue, t: number): KeyValue {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (typeof a === 'string' && typeof b === 'string' && isColour(a) && isColour(b))
    return mixColours(a, b, t);
  return t >= 1 ? b : a;
}

/** The property's value at a frame: the first value before the first keyframe, the last after the last. */
export function valueAt(track: Track, frame: number): KeyValue {
  const keys = track.keyframes;
  if (keys.length === 0) throw new EditError('The track has no keyframes.');
  const first = keys[0]!;
  const last = keys[keys.length - 1]!;
  let f = frame;
  const period = last.frame - first.frame;
  if (track.repeat !== undefined && period > 0 && f > last.frame) {
    const plays = Math.floor((f - first.frame) / period);
    if (track.repeat === 'end' || plays <= track.repeat)
      f = first.frame + ((f - first.frame) % period);
  }
  if (f <= first.frame) return first.value;
  if (f >= last.frame) return last.value;
  let i = 0;
  while (keys[i + 1]!.frame <= f) i++;
  const from = keys[i]!;
  const to = keys[i + 1]!;
  if (from.hold) return from.value;
  const t = (f - from.frame) / (to.frame - from.frame);
  return interpolate(from.value, to.value, ease(from.easing, t));
}

const checkFrame = (frame: number): void => {
  if (!Number.isInteger(frame)) throw new EditError('A keyframe sits on a whole frame.');
  if (frame < 0) throw new EditError('A keyframe cannot be before frame 0.');
};

/** Adds a keyframe (or replaces the one on that frame), keeping the list sorted. */
export function setKeyframe(
  track: Track,
  key: { frame: number; value: KeyValue; easing?: Easing; hold?: boolean },
): Track {
  checkFrame(key.frame);
  const existing = track.keyframes.find((k) => k.frame === key.frame);
  const keyframe: Keyframe = {
    frame: key.frame,
    value: key.value,
    easing: key.easing ?? existing?.easing ?? 'linear',
    hold: key.hold ?? existing?.hold ?? false,
  };
  const keyframes = [...track.keyframes.filter((k) => k.frame !== key.frame), keyframe].sort(
    (a, b) => a.frame - b.frame,
  );
  return { ...track, keyframes };
}

const keyframeOn = (track: Track, frame: number): Keyframe => {
  const key = track.keyframes.find((k) => k.frame === frame);
  if (!key) throw new EditError(`There is no keyframe on frame ${frame}.`);
  return key;
};

export function removeKeyframe(track: Track, frame: number): Track {
  keyframeOn(track, frame);
  return { ...track, keyframes: track.keyframes.filter((k) => k.frame !== frame) };
}

export function moveKeyframe(track: Track, frame: number, toFrame: number): Track {
  const key = keyframeOn(track, frame);
  return setKeyframe(removeKeyframe(track, frame), { ...key, frame: toFrame });
}

/** Alt-drag: the keyframe is copied to another frame. */
export function copyKeyframe(track: Track, frame: number, toFrame: number): Track {
  return setKeyframe(track, { ...keyframeOn(track, frame), frame: toFrame });
}

/** Task 1.2: the keyframes are mirrored after the last one, so the motion runs back to the start. */
export function reversed(track: Track): Track {
  const keys = track.keyframes;
  if (keys.length < 2) throw new EditError('Reverse needs at least two keyframes.');
  const last = keys[keys.length - 1]!;
  const mirrored = keys
    .slice(0, -1)
    .reverse()
    .map((k) => ({ ...k, frame: last.frame + (last.frame - k.frame) }));
  return { ...track, keyframes: [...keys, ...mirrored] };
}

export function withRepeat(track: Track, repeat: 'end' | number | undefined): Track {
  if (typeof repeat === 'number' && (!Number.isInteger(repeat) || repeat < 1))
    throw new EditError('Repeat needs a whole number of times, 1 or more.');
  const rest = { ...track };
  delete rest.repeat;
  return repeat === undefined ? rest : { ...rest, repeat };
}

// ---- objects ----

export const trackOf = (object: AnimObject, property: TweenProperty): Track | undefined =>
  object.tracks?.find((t) => t.property === property);

const DEFAULT_STROKE_COLOUR = '#1e222a';

/** The object's own (un-tweened) value of a property. */
export function propertyOf(object: AnimObject, property: TweenProperty): KeyValue {
  switch (property) {
    case 'fillColour':
      return object.fill.kind === 'solid'
        ? object.fill.colour
        : object.fill.kind === 'none'
          ? '#000000'
          : object.fill.from;
    case 'strokeColour':
      return object.stroke?.colour ?? DEFAULT_STROKE_COLOUR;
    case 'strokeWidth':
      return object.stroke?.width ?? 0;
    case 'radius':
      if (object.kind !== 'rect') throw new EditError('Only a rectangle has a corner radius.');
      return object.radius;
    case 'size':
      if (object.kind !== 'text') throw new EditError('Only text has a font size.');
      return object.size;
    case 'text':
      if (object.kind !== 'text') throw new EditError('Only text has words.');
      return object.text;
    default:
      return object[property];
  }
}

const num = (v: KeyValue): number => (typeof v === 'number' ? v : Number(v));
const str = (v: KeyValue): string => String(v);

/** The object with one property set (its own value, not a keyframe). */
export function withProperty<T extends AnimObject>(
  object: T,
  property: TweenProperty,
  value: KeyValue,
): T {
  return setOne(object, property, value) as T;
}

function setOne(object: AnimObject, property: TweenProperty, value: KeyValue): AnimObject {
  switch (property) {
    case 'fillColour':
      return { ...object, fill: { kind: 'solid', colour: str(value) } };
    case 'strokeColour':
      return {
        ...object,
        stroke: {
          colour: str(value),
          width: object.stroke?.width ?? 0,
          dash: object.stroke?.dash ?? 'solid',
        },
      };
    case 'strokeWidth':
      return {
        ...object,
        stroke: {
          colour: object.stroke?.colour ?? DEFAULT_STROKE_COLOUR,
          width: num(value),
          dash: object.stroke?.dash ?? 'solid',
        },
      };
    case 'radius':
      if (object.kind !== 'rect') throw new EditError('Only a rectangle has a corner radius.');
      return { ...object, radius: num(value) };
    case 'size':
      if (object.kind !== 'text') throw new EditError('Only text has a font size.');
      return { ...object, size: num(value) };
    case 'text':
      if (object.kind !== 'text') throw new EditError('Only text has words.');
      return { ...object, text: str(value) };
    case 'width':
    case 'height': {
      const width = property === 'width' ? num(value) : object.width;
      const height = property === 'height' ? num(value) : object.height;
      return setSize(object, width, height);
    }
    default:
      return { ...object, [property]: num(value) };
  }
}

const withTrack = <T extends AnimObject>(object: T, track: Track): T => {
  const others = (object.tracks ?? []).filter((t) => t.property !== track.property);
  const tracks = track.keyframes.length === 0 ? others : [...others, track];
  return tracks.length === 0 ? stripTracks(object) : { ...object, tracks };
};

function stripTracks<T extends AnimObject>(object: T): T {
  const rest = { ...object };
  delete rest.tracks;
  return rest;
}

/**
 * Setting a property at a frame makes a keyframe. With no track yet, a change at frame 0 is
 * just the object's own value; a change later makes the track, with the first keyframe at
 * frame 0 holding the value the object had.
 */
export function setPropertyAt<T extends AnimObject>(
  object: T,
  property: TweenProperty,
  frame: number,
  value: KeyValue,
  easing?: Easing,
): T {
  checkFrame(frame);
  const current = propertyOf(object, property);
  const track = trackOf(object, property);
  if (!track) {
    if (frame === 0) return withProperty(object, property, value);
    const started: Track = {
      property,
      keyframes: [{ frame: 0, value: current, easing: easing ?? 'linear', hold: false }],
    };
    return withTrack(object, setKeyframe(started, { frame, value, easing }));
  }
  return withTrack(object, setKeyframe(track, { frame, value, easing }));
}

/** *Insert keyframe*: fixes the value the property has at that frame. */
export function insertKeyframe<T extends AnimObject>(
  object: T,
  property: TweenProperty,
  frame: number,
): T {
  checkFrame(frame);
  const track = trackOf(object, property);
  const value = track ? valueAt(track, frame) : propertyOf(object, property);
  const base: Track = track ?? { property, keyframes: [] };
  return withTrack(object, setKeyframe(base, { frame, value }));
}

export function setTrack<T extends AnimObject>(object: T, track: Track): T {
  return withTrack(object, track);
}

/** The object as it is at a frame: every track applied; a group's children too (AN13). */
export function objectAt<T extends AnimObject>(object: T, frame: number): T {
  let o: T = object;
  for (const track of object.tracks ?? []) {
    if (track.keyframes.length === 0) continue;
    o = withProperty(o, track.property, valueAt(track, frame));
  }
  if (o.kind === 'group') return { ...o, children: o.children.map((c) => objectAt(c, frame)) };
  return o;
}

/** True when any keyframe makes the object (or a part of a group) move. */
export const isAnimated = (object: AnimObject): boolean =>
  (object.tracks ?? []).some((t) => t.keyframes.length > 0) ||
  (object.kind === 'group' && object.children.some(isAnimated));
