// AN10: morphing (shape tweening). A shape keyframe holds a whole outline in the object's box,
// scaled to 0–1, so the shape tween combines with size and position tweens. Between two outlines
// the points are resampled to the same count by length and lined up (same direction round,
// starting where they are closest), then blended; at the keyframes the outline is exactly the one
// drawn, so a line that became a circle and a rectangle is the same line again at the end.
import { EditError } from '../model/errors.ts';
import { isClosed, localOutline, type Point } from './geometry.ts';
import { pointAt, polylineOf, pathLength } from './path.ts';
import type { AnimObject, ShapeValue } from './types.ts';

const POINTS = 64;

/** The object's outline in its box, scaled to 0–1 (a side of no size stays at 0). */
export function shapeOf(o: AnimObject): ShapeValue {
  if (o.kind === 'text' || o.kind === 'picture' || o.kind === 'group')
    throw new EditError('Only shapes can morph: not text, pictures or groups.');
  const w = o.width || 1;
  const h = o.height || 1;
  return { points: localOutline(o).map((p) => ({ x: p.x / w, y: p.y / h })), closed: isClosed(o) };
}

/** `n` points evenly spaced along the outline by length (closed: round it; open: end to end). */
export function resample(points: readonly Point[], closed: boolean, n: number): Point[] {
  const line = polylineOf(points, closed);
  const total = pathLength(line);
  return Array.from({ length: n }, (_, k) => {
    const { x, y } = pointAt(line, closed ? (k * total) / n : (k * total) / Math.max(1, n - 1));
    return { x, y };
  });
}

const area = (pts: readonly Point[]) =>
  pts.reduce((sum, p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    return sum + p.x * q.y - q.x * p.y;
  }, 0);

const cost = (a: readonly Point[], b: readonly Point[]) =>
  a.reduce((sum, p, i) => sum + (p.x - b[i]!.x) ** 2 + (p.y - b[i]!.y) ** 2, 0);

const turnedBy = (pts: readonly Point[], r: number) =>
  pts.map((_, i) => pts[(i + r) % pts.length]!);

/** The start (of a closed outline) that moves the points least. */
function bestStart(fixed: readonly Point[], loop: readonly Point[]): Point[] {
  let best = loop.slice();
  let lowest = Infinity;
  for (let r = 0; r < loop.length; r++) {
    const turned = turnedBy(loop, r);
    const c = cost(fixed, turned);
    if (c < lowest - 1e-12) {
      lowest = c;
      best = turned;
    }
  }
  return best;
}

function lineUp(a: ShapeValue, b: ShapeValue): [Point[], Point[]] {
  const ra = resample(a.points, a.closed, POINTS);
  let rb = resample(b.points, b.closed, POINTS);
  if (a.closed && b.closed) {
    // The same way round, so the outline does not turn inside out on the way.
    if (Math.sign(area(ra)) !== Math.sign(area(rb))) rb = [rb[0]!, ...rb.slice(1).reverse()];
    return [ra, bestStart(ra, rb)];
  }
  if (b.closed) return [ra, bestStart(ra, rb)];
  if (a.closed) return [bestStart(rb, ra), rb];
  const back = rb.slice().reverse();
  return [ra, cost(ra, back) < cost(ra, rb) ? back : rb];
}

const lined = new WeakMap<ShapeValue, WeakMap<ShapeValue, [Point[], Point[]]>>();
function linedUp(a: ShapeValue, b: ShapeValue): [Point[], Point[]] {
  let row = lined.get(a);
  if (!row) lined.set(a, (row = new WeakMap()));
  let pair = row.get(b);
  if (!pair) row.set(b, (pair = lineUp(a, b)));
  return pair;
}

/** The outline `t` (0–1) of the way from one shape to the other. */
export function morphShapes(a: ShapeValue, b: ShapeValue, t: number): ShapeValue {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const [ra, rb] = linedUp(a, b);
  return {
    points: ra.map((p, i) => ({ x: p.x + (rb[i]!.x - p.x) * t, y: p.y + (rb[i]!.y - p.y) * t })),
    closed: t < 0.5 ? a.closed : b.closed,
  };
}

export const isShapeValue = (v: unknown): v is ShapeValue =>
  typeof v === 'object' && v !== null && Array.isArray((v as ShapeValue).points);
