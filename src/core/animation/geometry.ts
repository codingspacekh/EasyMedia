// AN3, AN6: the shapes as points — outlines, bounds, centres, hit-testing, moving, resizing from
// handles and turning. Every object is a box (x, y, width, height) turned about its centre;
// "local" coordinates are inside the box before the turn, with (0, 0) at its top-left corner.
import type { AnimObject, MotionPath, PathPoint } from './types.ts';

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The eight resize handles, named by compass point. */
export type Handle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';

const ELLIPSE_STEPS = 64;
const CORNER_STEPS = 8;
const CURVE_STEPS = 16;
/** How close to an outline (px) counts as touching it. */
const TOUCH = 3;

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Turns a vector by `deg` clockwise (the screen's y points down, as the canvas does). */
function turn(v: Point, deg: number): Point {
  const c = Math.cos(rad(deg));
  const s = Math.sin(rad(deg));
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export const centreOf = (o: AnimObject): Point => ({
  x: o.x + o.width / 2,
  y: o.y + o.height / 2,
});

/** A local point (inside the unturned box) on the stage. */
export function toStage(o: AnimObject, local: Point): Point {
  const c = centreOf(o);
  const v = turn({ x: local.x - o.width / 2, y: local.y - o.height / 2 }, o.rotation);
  return { x: c.x + v.x, y: c.y + v.y };
}

/** A stage point inside the unturned box. */
export function toLocal(o: AnimObject, p: Point): Point {
  const c = centreOf(o);
  const v = turn({ x: p.x - c.x, y: p.y - c.y }, -o.rotation);
  return { x: v.x + o.width / 2, y: v.y + o.height / 2 };
}

/** Points around an ellipse that fills a box, from the right, clockwise. */
function ellipsePoints(w: number, h: number, steps = ELLIPSE_STEPS): Point[] {
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    return { x: w / 2 + (w / 2) * Math.cos(a), y: h / 2 + (h / 2) * Math.sin(a) };
  });
}

/** `n` points on the ellipse of the box starting at the top, clockwise; a star alternates radii. */
function radialPoints(w: number, h: number, n: number, inner = 1): Point[] {
  const count = inner === 1 ? n : 2 * n;
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (i / count) * 2 * Math.PI;
    const r = i % 2 === 0 ? 1 : inner;
    return { x: w / 2 + (w / 2) * r * Math.cos(a), y: h / 2 + (h / 2) * r * Math.sin(a) };
  });
}

function roundedRectPoints(w: number, h: number, radius: number): Point[] {
  const r = Math.min(radius, w / 2, h / 2);
  if (r <= 0)
    return [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ];
  const corners: [Point, number][] = [
    [{ x: w - r, y: r }, -Math.PI / 2],
    [{ x: w - r, y: h - r }, 0],
    [{ x: r, y: h - r }, Math.PI / 2],
    [{ x: r, y: r }, Math.PI],
  ];
  return corners.flatMap(([c, start]) =>
    Array.from({ length: CORNER_STEPS + 1 }, (_, i) => {
      const a = start + (i / CORNER_STEPS) * (Math.PI / 2);
      return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) };
    }),
  );
}

/** A path's anchors with its curves flattened. */
export function flattenPath(points: readonly PathPoint[], closed: boolean): Point[] {
  const out: Point[] = [];
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push({ x: a.x, y: a.y });
    if (!a.out && !b.in) continue;
    const c1 = a.out ?? a;
    const c2 = b.in ?? b;
    for (let s = 1; s < CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      const u = 1 - t;
      out.push({
        x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
        y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
      });
    }
  }
  if (!closed && points.length) {
    const last = points.at(-1)!;
    out.push({ x: last.x, y: last.y });
  }
  return out;
}

/** The outline in local coordinates: one polyline (closed unless the object is an open path). */
export function localOutline(o: AnimObject): Point[] {
  const { width: w, height: h } = o;
  switch (o.kind) {
    case 'rect':
      return roundedRectPoints(w, h, o.radius);
    case 'ellipse':
      return ellipsePoints(w, h);
    case 'star':
      return radialPoints(w, h, o.points, o.inner);
    case 'polygon':
      return radialPoints(w, h, o.sides);
    case 'path':
      return flattenPath(o.points, o.closed);
    default:
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
  }
}

export const isClosed = (o: AnimObject): boolean => o.kind !== 'path' || o.closed;

/** The outline on the stage, turned. One polyline per object (lists, for masks and groups later). */
export function outlineOf(o: AnimObject): Point[][] {
  return [localOutline(o).map((p) => toStage(o, p))];
}

export function boundsOf(o: AnimObject): Bounds {
  const pts = outlineOf(o).flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToPolyline(p: Point, pts: readonly Point[], closed: boolean): number {
  let best = Infinity;
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++)
    best = Math.min(best, distanceToSegment(p, pts[i]!, pts[(i + 1) % pts.length]!));
  return best;
}

function insidePolygon(p: Point, pts: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!;
    const b = pts[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * Whether a stage point touches the object: inside a filled shape, a text box, a picture or a
 * group; or on the outline (within its stroke, at least 3 px) of any shape.
 */
export function hitTest(o: AnimObject, p: Point): boolean {
  const [pts] = outlineOf(o);
  if (!pts || pts.length === 0) return false;
  if (o.kind === 'text' || o.kind === 'picture' || o.kind === 'group') return insidePolygon(p, pts);
  const reach = Math.max(TOUCH, (o.stroke?.width ?? 0) / 2);
  if (distanceToPolyline(p, pts, isClosed(o)) <= reach) return true;
  return o.fill.kind !== 'none' && isClosed(o) && insidePolygon(p, pts);
}

/**
 * AN9: adds to every keyframe of the x, y or rotation track, so an object's motion goes where
 * the object goes (moved, duplicated, grouped, ungrouped).
 */
export function shiftTracks<T extends AnimObject>(
  o: T,
  by: { x?: number; y?: number; rotation?: number },
): T {
  const withPath =
    o.motion && (by.x || by.y)
      ? { ...o, motion: shiftedMotion(o.motion, by.x ?? 0, by.y ?? 0) }
      : o;
  if (!withPath.tracks) return withPath;
  return {
    ...withPath,
    tracks: withPath.tracks.map((t) => {
      const d =
        t.property === 'x' || t.property === 'y' || t.property === 'rotation' ? by[t.property] : 0;
      if (!d) return t;
      return {
        ...t,
        keyframes: t.keyframes.map((k) =>
          typeof k.value === 'number' ? { ...k, value: k.value + d } : k,
        ),
      };
    }),
  };
}

/** AN11: a motion path moved by (dx, dy), handles and all. */
export function shiftedMotion(m: MotionPath, dx: number, dy: number): MotionPath {
  const by = (p: Point) => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...m,
    points: m.points.map((p) => ({
      ...by(p),
      ...(p.in ? { in: by(p.in) } : {}),
      ...(p.out ? { out: by(p.out) } : {}),
    })),
  };
}

/** Moves the object and the whole of its motion. */
export const moved = <T extends AnimObject>(o: T, dx: number, dy: number): T => ({
  ...shiftTracks(o, { x: dx, y: dy }),
  x: o.x + dx,
  y: o.y + dy,
});

const norm = (deg: number) => ((deg % 360) + 360) % 360;

export const rotated = <T extends AnimObject>(o: T, deg: number): T => ({
  ...o,
  rotation: norm(deg),
});

/** The rotation handle's angle: straight up from the centre is 0°, clockwise. */
export function angleOf(centre: Point, p: Point): number {
  return norm((Math.atan2(p.x - centre.x, -(p.y - centre.y)) * 180) / Math.PI);
}

export const snapAngle = (deg: number, step: number): number => norm(Math.round(deg / step) * step);

/** Scales a path's points with its box (a 0 px side scales by 1: no division by zero). */
function scaledPoints(
  points: readonly PathPoint[],
  from: { width: number; height: number },
  to: { width: number; height: number },
): PathPoint[] {
  const sx = from.width === 0 ? 1 : to.width / from.width;
  const sy = from.height === 0 ? 1 : to.height / from.height;
  const s = (p: Point) => ({ x: p.x * sx, y: p.y * sy });
  return points.map((p) => ({
    ...s(p),
    ...(p.in ? { in: s(p.in) } : {}),
    ...(p.out ? { out: s(p.out) } : {}),
  }));
}

/** A new size with the top-left corner kept; a path's points scale with its box. */
export function setSize<T extends AnimObject>(o: T, width: number, height: number): T {
  const sized = { ...o, width, height };
  if (o.kind === 'path') return { ...sized, points: scaledPoints(o.points, o, { width, height }) };
  if (o.kind === 'group') {
    // AN13: a group's children scale with it, keeping their places inside it.
    const sx = o.width === 0 ? 1 : width / o.width;
    const sy = o.height === 0 ? 1 : height / o.height;
    return {
      ...sized,
      children: o.children.map((c) =>
        setSize({ ...c, x: c.x * sx, y: c.y * sy }, c.width * sx, c.height * sy),
      ),
    };
  }
  return sized;
}

/**
 * Resizes by dragging a handle to a stage point: the opposite edge (or corner) stays where it
 * is, even when the object is turned. With the ratio locked, the larger change wins.
 */
export function resizeFrom<T extends AnimObject>(
  o: T,
  handle: Handle,
  pointer: Point,
  { lockRatio }: { lockRatio: boolean },
): T {
  const local = toLocal(o, pointer);
  const west = handle.includes('w');
  const north = handle.includes('n');
  const east = handle.includes('e');
  const south = handle.includes('s');
  let width = Math.max(0, east ? local.x : west ? o.width - local.x : o.width);
  let height = Math.max(0, south ? local.y : north ? o.height - local.y : o.height);
  if (lockRatio && o.width > 0 && o.height > 0) {
    const sx = east || west ? width / o.width : 0;
    const sy = north || south ? height / o.height : 0;
    const s = Math.max(sx, sy);
    width = o.width * s;
    height = o.height * s;
  }
  // The fixed point, in the old box and in the new one, must land on the same stage point.
  const fixedOld = { x: west ? o.width : 0, y: north ? o.height : 0 };
  const fixedNew = { x: west ? width : 0, y: north ? height : 0 };
  const anchor = toStage(o, fixedOld);
  const v = turn({ x: width / 2 - fixedNew.x, y: height / 2 - fixedNew.y }, o.rotation);
  const centre = { x: anchor.x + v.x, y: anchor.y + v.y };
  return setSize({ ...o, x: centre.x - width / 2, y: centre.y - height / 2 }, width, height);
}
