// Maths for direct editing on the timeline: trim handles and snapping (M5).
import { roundTime, type Seconds } from '../core/model/time.ts';
import { itemDuration, MIN_DURATION } from '../core/model/timeline.ts';
import type { MainItem } from '../core/model/types.ts';

/** Moves `time` to the nearest target within `tolerance`, else leaves it. */
export function snap(time: Seconds, targets: readonly Seconds[], tolerance: Seconds): Seconds {
  let best = time;
  let bestDistance = tolerance;
  for (const target of targets) {
    const distance = Math.abs(target - time);
    if (distance <= bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * New start for a caption, subtitle or credits dragged by `delta` seconds. Its start or its end,
 * whichever is closer to a target, snaps to it; it never starts before 0 s.
 */
export function moveDrag(
  start: Seconds,
  duration: Seconds,
  delta: Seconds,
  targets: readonly Seconds[],
  tolerance: Seconds,
): Seconds {
  const moved = start + delta;
  const byStart = snap(moved, targets, tolerance) - moved;
  const byEnd = snap(moved + duration, targets, tolerance) - (moved + duration);
  const snapped = [byStart, byEnd].filter((d) => d !== 0);
  const shift = snapped.length ? snapped.reduce((a, b) => (Math.abs(b) < Math.abs(a) ? b : a)) : 0;
  return roundTime(Math.max(0, moved + shift));
}

/**
 * New trim for an item whose `side` handle was dragged by `delta` timeline seconds.
 * The dragged edge snaps to `targets`. Video clips return source in/out points (speed taken
 * into account, kept within the source file); stills and titles return a duration.
 */
export function handleDrag(
  item: MainItem,
  side: 'start' | 'end',
  itemStart: Seconds,
  delta: Seconds,
  targets: readonly Seconds[],
  tolerance: Seconds,
  sourceLength: Seconds = Infinity,
): { in: Seconds; out: Seconds } | { duration: Seconds } {
  const edge = side === 'start' ? itemStart : itemStart + itemDuration(item);
  const moved = snap(edge + delta, targets, tolerance) - edge;
  if (item.type !== 'video') {
    const duration = side === 'end' ? item.duration + moved : item.duration - moved;
    return { duration: roundTime(Math.max(MIN_DURATION, duration)) };
  }
  const shortest = MIN_DURATION * item.speed;
  if (side === 'start') {
    return {
      in: roundTime(Math.min(Math.max(0, item.in + moved * item.speed), item.out - shortest)),
      out: item.out,
    };
  }
  return {
    in: item.in,
    out: roundTime(
      Math.max(item.in + shortest, Math.min(sourceLength, item.out + moved * item.speed)),
    ),
  };
}
