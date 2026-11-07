// The stage's pure geometry (AN1–AN3, AN6), used by Stage.svelte and its parts: the drags the
// stage knows, what the document looks like during one, what a click or a marquee picks, the
// rulers' ticks, and the selection box and handles.
import { toPx, type Unit } from '../../core/graphics/units.ts';
import {
  createEllipse,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createStar,
} from '../../core/animation/factory.ts';
import {
  boundsOf,
  hitTest,
  moved,
  resizeFrom,
  rotated,
  toLocal,
  toStage,
  withPivot,
  type Bounds,
  type Handle,
  type Point,
} from '../../core/animation/geometry.ts';
import { drawOrder, updateObject } from '../../core/animation/layers.ts';
import { moveAnchor, moveHandle, pullHandles } from '../../core/animation/pen.ts';
import type { AnimObject, AnimationDoc, Id } from '../../core/animation/types.ts';

export type DrawTool = 'rect' | 'ellipse' | 'star' | 'polygon' | 'line';

/** What the pointer is doing on the stage, from pointer down to pointer up. */
export type StageDrag =
  | { kind: 'move'; start: Point; ids: Id[]; union: Bounds; dx: number; dy: number }
  | { kind: 'marquee'; start: Point; now: Point }
  | { kind: 'draw'; tool: DrawTool; start: Point; now: Point; square: boolean }
  | { kind: 'brush'; points: Point[] }
  | { kind: 'resize'; id: Id; handle: Handle; now: Point; lock: boolean }
  | { kind: 'rotate'; id: Id; centre: Point; degrees: number }
  /** AN27: the point the object turns about, dragged (fractions of its box). */
  | { kind: 'pivot'; id: Id; pivot: Point }
  | { kind: 'guide'; axis: 'x' | 'y'; index: number | null; value: number }
  /** AN3: a pen path's point moved, or its curve handles pulled out (Alt). */
  | { kind: 'anchor'; id: Id; index: number; now: Point; pull: boolean; moved: boolean }
  | { kind: 'curve'; id: Id; index: number; which: 'in' | 'out'; now: Point; alone: boolean };

export type DrawDrag = Extract<StageDrag, { kind: 'draw' }>;

/** Stage coordinates are kept to hundredths of a pixel. */
export const roundStage = (n: number) => Math.round(n * 100) / 100;

/** The temporary shape of a draw drag, in stage coordinates (Shift: as wide as it is high). */
export function drawnShape(d: DrawDrag): AnimObject {
  let { x: x2, y: y2 } = d.now;
  if (d.tool === 'line') return { ...createLine(d.start, d.now), id: 'temp' };
  let w = x2 - d.start.x;
  let h = y2 - d.start.y;
  if (d.square) {
    const s = Math.max(Math.abs(w), Math.abs(h));
    w = Math.sign(w || 1) * s;
    h = Math.sign(h || 1) * s;
    x2 = d.start.x + w;
    y2 = d.start.y + h;
  }
  const box = {
    x: Math.min(d.start.x, x2),
    y: Math.min(d.start.y, y2),
    width: Math.abs(w),
    height: Math.abs(h),
  };
  const make = {
    rect: createRect,
    ellipse: createEllipse,
    star: createStar,
    polygon: createPolygon,
  };
  return { ...make[d.tool](box), id: 'temp' };
}

/** An edit of one object that may no longer be there: then the document stays as it is. */
function tryUpdate(doc: AnimationDoc, id: Id, change: (o: AnimObject) => AnimObject): AnimationDoc {
  try {
    return updateObject(doc, id, change);
  } catch {
    return doc;
  }
}

/** The document as it looks during the drag; a new shape goes on top of layer `layerId`. */
export function previewDoc(doc: AnimationDoc, drag: StageDrag | null, layerId: Id): AnimationDoc {
  if (!drag) return doc;
  const withTemp = (o: AnimObject) => ({
    ...doc,
    layers: doc.layers.map((l) => (l.id === layerId ? { ...l, objects: [...l.objects, o] } : l)),
  });
  const d = drag;
  switch (d.kind) {
    case 'move':
      return d.ids.reduce((acc, id) => tryUpdate(acc, id, (o) => moved(o, d.dx, d.dy)), doc);
    case 'draw':
      return withTemp(drawnShape(d));
    case 'brush':
      return d.points.length >= 2 ? withTemp({ ...createPath(d.points, false), id: 'temp' }) : doc;
    case 'resize':
      return tryUpdate(doc, d.id, (o) => resizeFrom(o, d.handle, d.now, { lockRatio: d.lock }));
    case 'rotate':
      return tryUpdate(doc, d.id, (o) => rotated(o, d.degrees));
    case 'pivot':
      return tryUpdate(doc, d.id, (o) => withPivot(o, d.pivot));
    case 'anchor':
      if (!d.moved) return doc;
      return updateObject(doc, d.id, (o) =>
        o.kind !== 'path'
          ? o
          : d.pull
            ? pullHandles(o, d.index, d.now)
            : moveAnchor(o, d.index, d.now),
      );
    case 'curve':
      return updateObject(doc, d.id, (o) =>
        o.kind === 'path' ? moveHandle(o, d.index, d.which, d.now, !d.alone) : o,
      );
    default:
      return doc;
  }
}

/** The front-most object under the point that can be picked (its layer shown and unlocked). */
export function pickObject(doc: AnimationDoc, p: Point): AnimObject | null {
  const order = drawOrder(doc);
  for (let i = order.length - 1; i >= 0; i--) {
    const { layer, object } = order[i]!;
    if (!layer.locked && hitTest(object, p)) return object;
  }
  return null;
}

/** The box between two corners, whichever way it was dragged. */
export function marqueeBox(a: Point, b: Point): Bounds {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

/** The objects a marquee touches, back to front, leaving out locked layers. */
export function objectsInBox(doc: AnimationDoc, box: Bounds): Id[] {
  return drawOrder(doc)
    .filter(({ layer, object }) => {
      if (layer.locked) return false;
      const b = boundsOf(object);
      return (
        b.x < box.x + box.width &&
        b.x + b.width > box.x &&
        b.y < box.y + box.height &&
        b.y + b.height > box.y
      );
    })
    .map(({ object }) => object.id);
}

/** The box around several objects (they move and snap as one). */
export function unionBounds(objects: readonly AnimObject[]): Bounds {
  const bs = objects.map(boundsOf);
  const x = Math.min(...bs.map((b) => b.x));
  const y = Math.min(...bs.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...bs.map((b) => b.x + b.width)) - x,
    height: Math.max(...bs.map((b) => b.y + b.height)) - y,
  };
}

/** Fewer points for a brush stroke: drop those closer than `min` to the last kept one. */
export function simplifyStroke(points: readonly Point[], min: number): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= min)
      out.push({ x: roundStage(p.x), y: roundStage(p.y) });
  }
  return out;
}

/** AN2: the rulers' numbered step, so numbers are at least 48 screen pixels apart. */
export const rulerStep = (zoom: number) =>
  [5, 10, 20, 50, 100, 200, 500, 1000].find((s) => s * zoom >= 48) ?? 1000;

/**
 * G6 (M18): the rulers in a unit at a resolution (cm, mm, in, pt; px as AN2): the numbered step
 * in that unit, at least 48 screen pixels apart, and the same step in stage pixels.
 */
export function unitRulerStep(
  zoom: number,
  unit: Unit,
  dpi: number,
): { step: number; stepPx: number } {
  if (unit === 'px') {
    const step = rulerStep(zoom);
    return { step, stepPx: step };
  }
  const perUnit = toPx(1, unit, dpi);
  const step =
    [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000].find(
      (s) => s * perUnit * zoom >= 48,
    ) ?? 2000;
  return { step, stepPx: step * perUnit };
}

/** The numbered ticks from 0 to `length`. */
export const rulerTicks = (length: number, step: number) =>
  Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);

/** The selection box of an object, on the stage (it turns with the object). */
export const objectCorners = (o: AnimObject): Point[] =>
  [
    { x: 0, y: 0 },
    { x: o.width, y: 0 },
    { x: o.width, y: o.height },
    { x: 0, y: o.height },
  ].map((c) => toStage(o, c));

/** The eight resize handles of an object, on the stage. */
export const handlePoints = (o: AnimObject): [Handle, Point][] => [
  ['nw', toStage(o, { x: 0, y: 0 })],
  ['n', toStage(o, { x: o.width / 2, y: 0 })],
  ['ne', toStage(o, { x: o.width, y: 0 })],
  ['e', toStage(o, { x: o.width, y: o.height / 2 })],
  ['se', toStage(o, { x: o.width, y: o.height })],
  ['s', toStage(o, { x: o.width / 2, y: o.height })],
  ['sw', toStage(o, { x: 0, y: o.height })],
  ['w', toStage(o, { x: 0, y: o.height / 2 })],
];

/** AN27: the box's centre, corners and edge middles, where the point it turns about snaps. */
const BOX_POINTS: readonly Point[] = [0, 0.5, 1].flatMap((y) => [0, 0.5, 1].map((x) => ({ x, y })));

/** AN27: the box's centre, corner or edge middle within `threshold` stage pixels of p, or null. */
export function boxPivotNear(o: AnimObject, p: Point, threshold: number): Point | null {
  const near = BOX_POINTS.find((f) => {
    const q = toStage(o, { x: f.x * o.width, y: f.y * o.height });
    return Math.hypot(q.x - p.x, q.y - p.y) <= threshold;
  });
  return near ? { ...near } : null;
}

/** AN27: a stage point as the point an object turns about: fractions of its box (to 0.01 %). */
export function pivotFrom(o: AnimObject, p: Point): Point {
  const local = toLocal(o, p);
  const fraction = (v: number, size: number) =>
    size === 0 ? 0.5 : Math.round((v / size) * 10000) / 10000;
  return { x: fraction(local.x, o.width), y: fraction(local.y, o.height) };
}

/**
 * N1: gives the stage's canvas the size of the stage at this zoom on this screen (at least
 * 1 × 1). Setting a canvas's size throws its pixels away and makes it again, so it is set only
 * when it changes: a redraw per frame of playback must not do that. True when it was resized.
 */
export function sizeCanvas(
  canvas: { width: number; height: number },
  stage: { width: number; height: number },
  zoom: number,
  dpr: number,
): boolean {
  const width = Math.max(1, Math.round(stage.width * zoom * dpr));
  const height = Math.max(1, Math.round(stage.height * zoom * dpr));
  if (canvas.width === width && canvas.height === height) return false;
  canvas.width = width;
  canvas.height = height;
  return true;
}
