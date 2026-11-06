// AN23 Flip and AN24 Combine shapes (M17a, from the 2022–2026 animation benchmark). Combining
// works on the shapes' outlines as the stage shows them (turned, flipped, curves as fine straight
// sides): Union makes one shape of them, Cut out takes the shapes in front out of the backmost one
// (a bite out of an apple, O/N/25), Intersect keeps only where they all overlap. The result keeps
// the backmost shape's name, colours, outline and opacity; keyframes are not kept (it is a new
// shape). Holes are kept as the path's holes (filled even-odd).
import polygonClipping, { type MultiPolygon, type Polygon, type Ring } from 'polygon-clipping';
import { EditError } from '../model/errors.ts';
import type { Id } from '../model/types.ts';
import { createPath } from './factory.ts';
import { flattenPath, flipObject, isClosed, isShape, localOutline, toStage } from './geometry.ts';
import { replaceObjects } from './layers.ts';
import type { AnimationDoc, AnimObject, PathObject } from './types.ts';

export { flipObject };

export type CombineHow = 'union' | 'cutOut' | 'intersect';

const LABELS: Record<CombineHow, string> = {
  union: 'Union',
  cutOut: 'Cut out',
  intersect: 'Intersect',
};

/** A shape's outline (and holes) on the stage, as rings for the clipping. */
function polygonOf(o: AnimObject): Polygon {
  const ring = (pts: { x: number; y: number }[]): Ring => pts.map((p) => [p.x, p.y]);
  const outer = ring(localOutline(o).map((p) => toStage(o, p)));
  const holes = o.kind === 'path' ? (o.holes ?? []) : [];
  return [outer, ...holes.map((h) => ring(flattenPath(h, true).map((p) => toStage(o, p))))];
}

/** One clipped polygon as a pen shape with holes; its closing point (the first again) dropped. */
function pathOf(polygon: Polygon, like: AnimObject): PathObject {
  const open = (r: Ring) => {
    const pts = r.map(([x, y]) => ({ x, y }));
    const [a, b] = [pts[0]!, pts.at(-1)!];
    return a.x === b.x && a.y === b.y ? pts.slice(0, -1) : pts;
  };
  const [outer, ...holes] = polygon.map(open);
  const shape = createPath(outer!, true, like.name);
  const local = (pts: { x: number; y: number }[]) =>
    pts.map((p) => ({ x: p.x - shape.x, y: p.y - shape.y }));
  return {
    ...shape,
    fill: like.fill,
    opacity: like.opacity,
    ...(like.stroke ? { stroke: like.stroke } : {}),
    ...(holes.length ? { holes: holes.map(local) } : {}),
  };
}

/** The shapes, back to front, combined: one or more new pen shapes. */
export function combineShapes(objects: readonly AnimObject[], how: CombineHow): PathObject[] {
  if (objects.length < 2)
    throw new EditError(`Select two or more shapes to ${LABELS[how].toLowerCase()}.`);
  if (!objects.every((o) => isShape(o) && isClosed(o)))
    throw new EditError(
      'Only shapes can be combined: not text, pictures, buttons, groups or open lines.',
    );
  const [back, ...front] = objects.map(polygonOf) as [Polygon, ...Polygon[]];
  const result: MultiPolygon =
    how === 'union'
      ? polygonClipping.union(back, ...front)
      : how === 'cutOut'
        ? polygonClipping.difference(back, ...front)
        : polygonClipping.intersection(back, ...front);
  if (result.length === 0)
    throw new EditError(
      how === 'intersect'
        ? 'The shapes do not overlap, so nothing would be left.'
        : 'Nothing would be left of the shape at the back.',
    );
  return result.map((polygon) => pathOf(polygon, objects[0]!));
}

/** The selected shapes (on one layer) replaced by their combination, where the back one was. */
export function combineObjects(
  doc: AnimationDoc,
  ids: readonly Id[],
  how: CombineHow,
): { doc: AnimationDoc; ids: Id[] } {
  return replaceObjects(doc, ids, (objects) => combineShapes(objects, how));
}
