// AN20: one-click effects — fade, fly, zoom, bounce, spin, pulse, shake, wobble, typewriter and
// blink. An effect is nothing but keyframes from a start frame over a length, worked out from the
// object as it is at the start, so the timeline shows them and they can be changed like any
// other. What the object did before the start is kept; keyframes inside the span are replaced.
// A new effect is one entry in ANIM_EFFECTS.
import { EditError } from '../model/errors.ts';
import { pivotOf, pivotOnStage } from './geometry.ts';
import { objectAt, setTrack, trackOf } from './tween.ts';
import type { AnimObject, Easing, Keyframe, KeyValue, Stage, TweenProperty } from './types.ts';

export type EffectGroup = 'entrance' | 'exit' | 'emphasis';

/** One property's keyframes an effect sets: [share of the length 0–1, value, easing?, hold?]. */
type Key = readonly [at: number, value: KeyValue, easing?: Easing, hold?: boolean];
type Keys = Partial<Record<TweenProperty, readonly Key[]>>;

export interface AnimEffect {
  id: string;
  label: string;
  group: EffectGroup;
  /** The usual length in seconds. */
  seconds: number;
  /** Only for text objects. */
  textOnly?: boolean;
  /** The keyframes, from the object as it is at the start (`o`) and the stage's size. */
  keys(o: AnimObject, stage: Pick<Stage, 'width' | 'height'>, frames: number): Keys;
}

const fromTo = (from: KeyValue, to: KeyValue, easing: Easing = 'linear'): Key[] => [
  [0, from, easing],
  [1, to],
];

/**
 * Moves of the box that keep the point it turns about (its centre unless chosen, AN27) where it
 * is, from one size to another: it grows and shrinks about that point.
 */
function sizeKeys(
  o: AnimObject,
  sizes: readonly [at: number, scale: number][],
  easing: Easing,
): Keys {
  const c = pivotOnStage(o);
  const f = pivotOf(o);
  const at = (g: (s: number) => number) => sizes.map(([t, s]) => [t, g(s), easing] as Key);
  return {
    width: at((s) => o.width * s),
    height: at((s) => o.height * s),
    x: at((s) => c.x - o.width * s * f.x),
    y: at((s) => c.y - o.height * s * f.y),
  };
}

/** Even steps through a list of values (shake, wobble). */
const steps = (values: readonly number[], easing: Easing = 'ease-in-out'): Key[] =>
  values.map((v, i) => [i / (values.length - 1), v, easing] as Key);

const shownOpacity = (o: AnimObject) => (o.opacity > 0 ? o.opacity : 100);

export const ANIM_EFFECTS: readonly AnimEffect[] = [
  {
    id: 'fadeIn',
    label: 'Fade in',
    group: 'entrance',
    seconds: 1,
    keys: (o) => ({ opacity: fromTo(0, shownOpacity(o)) }),
  },
  {
    id: 'flyInLeft',
    label: 'Fly in from the left',
    group: 'entrance',
    seconds: 1,
    keys: (o) => ({ x: fromTo(-o.width, o.x, 'ease-out') }),
  },
  {
    id: 'flyInRight',
    label: 'Fly in from the right',
    group: 'entrance',
    seconds: 1,
    keys: (o, s) => ({ x: fromTo(s.width, o.x, 'ease-out') }),
  },
  {
    id: 'flyInTop',
    label: 'Fly in from the top',
    group: 'entrance',
    seconds: 1,
    keys: (o) => ({ y: fromTo(-o.height, o.y, 'ease-out') }),
  },
  {
    id: 'flyInBottom',
    label: 'Fly in from the bottom',
    group: 'entrance',
    seconds: 1,
    keys: (o, s) => ({ y: fromTo(s.height, o.y, 'ease-out') }),
  },
  {
    id: 'zoomIn',
    label: 'Zoom in',
    group: 'entrance',
    seconds: 1,
    keys: (o) =>
      sizeKeys(
        o,
        [
          [0, 0],
          [1, 1],
        ],
        'ease-out',
      ),
  },
  {
    id: 'bounceIn',
    label: 'Bounce in',
    group: 'entrance',
    seconds: 1.5,
    keys: (o) => ({ y: fromTo(-o.height, o.y, 'bounce') }),
  },
  {
    id: 'typewriter',
    label: 'Typewriter',
    group: 'entrance',
    seconds: 2,
    textOnly: true,
    keys: (o) => {
      const text = o.kind === 'text' ? o.text : '';
      return {
        text: [...text].map(
          (_, i) => [i / Math.max(1, text.length), text.slice(0, i + 1), 'linear', true] as Key,
        ),
      };
    },
  },
  {
    id: 'fadeOut',
    label: 'Fade out',
    group: 'exit',
    seconds: 1,
    keys: (o) => ({ opacity: fromTo(o.opacity, 0) }),
  },
  {
    id: 'flyOutLeft',
    label: 'Fly out to the left',
    group: 'exit',
    seconds: 1,
    keys: (o) => ({ x: fromTo(o.x, -o.width, 'ease-in') }),
  },
  {
    id: 'flyOutRight',
    label: 'Fly out to the right',
    group: 'exit',
    seconds: 1,
    keys: (o, s) => ({ x: fromTo(o.x, s.width, 'ease-in') }),
  },
  {
    id: 'zoomOut',
    label: 'Zoom out',
    group: 'exit',
    seconds: 1,
    keys: (o) =>
      sizeKeys(
        o,
        [
          [0, 1],
          [1, 0],
        ],
        'ease-in',
      ),
  },
  {
    id: 'spin',
    label: 'Spin',
    group: 'emphasis',
    seconds: 1,
    keys: (o) => ({ rotation: fromTo(o.rotation, o.rotation + 360) }),
  },
  {
    id: 'pulse',
    label: 'Pulse',
    group: 'emphasis',
    seconds: 1,
    keys: (o) =>
      sizeKeys(
        o,
        [
          [0, 1],
          [0.5, 1.2],
          [1, 1],
        ],
        'ease-in-out',
      ),
  },
  {
    id: 'shake',
    label: 'Shake',
    group: 'emphasis',
    seconds: 0.5,
    keys: (o) => ({ x: steps([0, -10, 10, -10, 10, 0].map((d) => o.x + d)) }),
  },
  {
    id: 'wobble',
    label: 'Wobble',
    group: 'emphasis',
    seconds: 1,
    keys: (o) => ({ rotation: steps([0, -12, 12, -8, 8, 0].map((d) => o.rotation + d)) }),
  },
  {
    id: 'blink',
    label: 'Blink',
    group: 'emphasis',
    seconds: 1,
    keys: (o, _s, frames) => {
      // Off and on every few frames (held, so it switches at once), ending on.
      const count = Math.max(2, 2 * Math.floor(frames / 6));
      const on = shownOpacity(o);
      return {
        opacity: Array.from(
          { length: count + 1 },
          (_, i) => [i / count, i % 2 === 1 ? 0 : on, 'linear', true] as Key,
        ),
      };
    },
  },
];

export const effectOf = (id: string): AnimEffect | undefined =>
  ANIM_EFFECTS.find((e) => e.id === id);

/**
 * The object with the effect's keyframes from `start` over `length` frames. Keyframes of those
 * properties inside the span are replaced; the last one before it is held until the start, so the
 * object does what it did before. Each property's first keyframe holds before the start.
 */
export function applyEffect<T extends AnimObject>(
  object: T,
  id: string,
  start: number,
  length: number,
  stage: Pick<Stage, 'width' | 'height'>,
): T {
  const effect = effectOf(id);
  if (!effect) throw new EditError('There is no effect of that name.');
  if (!(length >= 1)) throw new EditError('An effect needs to last at least one frame.');
  if (effect.textOnly && object.kind !== 'text')
    throw new EditError(`${effect.label} is only for text.`);
  const end = start + Math.round(length);
  const now = objectAt(object, start);
  let result: T = object;
  for (const [property, keys] of Object.entries(effect.keys(now, stage, Math.round(length))) as [
    TweenProperty,
    readonly Key[],
  ][]) {
    const added = new Map<number, Keyframe>();
    for (const [t, value, easing = 'linear', hold = false] of keys) {
      const frame = Math.round(start + t * (end - start));
      added.set(frame, { frame, value, easing, hold });
    }
    // The text is empty until the first letter appears.
    if (property === 'text' && start > 0)
      added.set(start - 1, { frame: start - 1, value: '', easing: 'linear', hold: true });
    const before = (trackOf(result, property)?.keyframes ?? []).filter(
      (k) => k.frame < Math.min(start, ...added.keys()),
    );
    const after = (trackOf(result, property)?.keyframes ?? []).filter((k) => k.frame > end);
    const held = before.map((k, i) => (i === before.length - 1 ? { ...k, hold: true } : k));
    const keyframes = [...held, ...added.values(), ...after].sort((a, b) => a.frame - b.frame);
    const existing = trackOf(result, property);
    result = setTrack(result, { ...(existing ?? {}), property, keyframes });
  }
  return result;
}
