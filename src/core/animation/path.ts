// AN11: path geometry for motion paths. A path (the pen's anchors and Bézier handles, or any
// shape's outline) is flattened to a polyline; along it: the length, and the point and heading at
// any distance, or at a fraction of the way — at even speed (by length) or with an equal share
// of the time for each segment. Headings are in degrees: 0 is to the right, 90 down (as the
// rotation box turns: clockwise on the screen).
import type { Point } from './geometry.ts';
import type { PathPoint } from './types.ts';

export interface Polyline {
  points: Point[];
  closed: boolean;
  /** Distance from the start to each point (and, when closed, back to the start). */
  at: number[];
}

export interface Placed {
  x: number;
  y: number;
  angle: number;
}

const bezier = (a: number, c1: number, c2: number, b: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b;
};

/** Anchors with their curves flattened finely: about one point every 2 px of the handles' reach. */
export function flattenCurves(points: readonly PathPoint[], closed: boolean): Point[] {
  const out: Point[] = [];
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push({ x: a.x, y: a.y });
    if (!a.out && !b.in) continue;
    const c1 = a.out ?? a;
    const c2 = b.in ?? b;
    const reach =
      Math.hypot(c1.x - a.x, c1.y - a.y) +
      Math.hypot(c2.x - c1.x, c2.y - c1.y) +
      Math.hypot(b.x - c2.x, b.y - c2.y);
    const steps = Math.max(8, Math.ceil(reach / 2));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      out.push({ x: bezier(a.x, c1.x, c2.x, b.x, t), y: bezier(a.y, c1.y, c2.y, b.y, t) });
    }
  }
  if (!closed && points.length) out.push({ x: points.at(-1)!.x, y: points.at(-1)!.y });
  return out;
}

export function polylineOf(points: readonly Point[], closed: boolean): Polyline {
  const pts = points.map((p) => ({ x: p.x, y: p.y }));
  const at = [0];
  const count = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < count; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    at.push(at[i]! + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return { points: pts, closed, at };
}

export const pathLength = (line: Polyline): number => line.at.at(-1) ?? 0;

const heading = (a: Point, b: Point) => {
  if (a.x === b.x && a.y === b.y) return 0;
  const deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  return deg === -180 ? 180 : deg;
};

/** Segment i runs from point i to point i + 1 (the last of a closed path back to point 0). */
const ends = (line: Polyline, i: number): [Point, Point] => [
  line.points[i]!,
  line.points[(i + 1) % line.points.length]!,
];

/** Within segment i, `share` (0–1) of the way along it. */
function onSegment(line: Polyline, i: number, share: number): Placed {
  const [a, b] = ends(line, i);
  const s = Math.max(0, Math.min(1, share));
  return { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s, angle: heading(a, b) };
}

/** The point `distance` along the path, and the heading there. */
export function pointAt(line: Polyline, distance: number): Placed {
  const segments = line.at.length - 1;
  const first = line.points[0] ?? { x: 0, y: 0 };
  if (segments <= 0) return { x: first.x, y: first.y, angle: 0 };
  const total = pathLength(line);
  if (total === 0) return { x: first.x, y: first.y, angle: 0 };
  const d = Math.max(0, Math.min(total, distance));
  let i = 0;
  while (i < segments - 1 && line.at[i + 1]! < d) i++;
  // Skip segments of no length so the heading is the way the path really goes.
  while (i < segments - 1 && line.at[i + 1] === line.at[i]) i++;
  const length = line.at[i + 1]! - line.at[i]!;
  return onSegment(line, i, length === 0 ? 1 : (d - line.at[i]!) / length);
}

/**
 * The point `fraction` (0–1) of the way along: at even speed by length, or (not even) with an
 * equal share of the time for each segment, so short segments are crossed more slowly.
 */
export function pointAtFraction(line: Polyline, fraction: number, even = true): Placed {
  const f = Math.max(0, Math.min(1, fraction));
  if (even) return pointAt(line, f * pathLength(line));
  const segments = line.at.length - 1;
  if (segments <= 0) return pointAt(line, 0);
  const where = f * segments;
  const i = Math.min(segments - 1, Math.floor(where));
  return onSegment(line, i, where - i);
}
