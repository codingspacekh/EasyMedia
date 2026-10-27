// AN11: making and attaching motion paths. A path is taken from any object on the stage: a pen
// path keeps its anchors and curves; any other shape gives its outline (closed). The points are
// stage coordinates, so the path is where the student drew it, turned as it is shown.
import { EditError } from '../model/errors.ts';
import { outlineOf, toStage } from './geometry.ts';
import type { AnimObject, MotionPath } from './types.ts';

const DEFAULTS = { from: 0, to: 24, orient: false, even: true, easing: 'linear' as const };

export function motionFrom(source: AnimObject, options: Partial<MotionPath> = {}): MotionPath {
  if (source.kind === 'path') {
    const at = (p: { x: number; y: number }) => toStage(source, p);
    return {
      ...DEFAULTS,
      points: source.points.map((p) => ({
        ...at(p),
        ...(p.in ? { in: at(p.in) } : {}),
        ...(p.out ? { out: at(p.out) } : {}),
      })),
      closed: source.closed,
      source: source.name,
      ...options,
    };
  }
  const [outline] = outlineOf(source);
  return { ...DEFAULTS, points: outline ?? [], closed: true, source: source.name, ...options };
}

/** The object follows the path; without one (undefined) it goes back to its own keyframes. */
export function withMotion<T extends AnimObject>(object: T, motion: MotionPath | undefined): T {
  if (!motion) {
    const rest = { ...object };
    delete rest.motion;
    return rest;
  }
  if (!Number.isInteger(motion.from) || !Number.isInteger(motion.to) || motion.from < 0)
    throw new EditError('A path runs between two whole frames, from frame 0 on.');
  if (motion.to <= motion.from) throw new EditError('The path must start before it ends.');
  if (motion.points.length < 2) throw new EditError('A path needs at least two points.');
  return { ...object, motion };
}
