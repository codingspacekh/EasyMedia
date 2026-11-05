// AN19: how a library item is written down — a list of named parts (rectangles, ellipses, stars,
// polygons, paths and sub-groups) in the item's own box — and how it becomes the app's objects.
// The helpers keep each item short to read; every part gets a real name ("Left wheel"), so a
// student can find it in the Layers and animate it on its own.
import {
  createEllipse,
  createGroup,
  createPath,
  createPolygon,
  createRect,
  createStar,
} from '../factory.ts';
import type { AnimObject, Paint } from '../types.ts';

export type Category =
  'cartoons' | 'school' | 'maths' | 'science' | 'biology' | 'computers' | 'icons' | 'backgrounds';

/** A colour, a two-colour gradient, or nothing. */
export type Fill = string | { from: string; to: string; angle?: number; radial?: boolean } | null;

interface Look {
  fill?: Fill;
  /** An outline: colour and width. */
  stroke?: readonly [string, number];
  opacity?: number;
}

type Box = readonly [x: number, y: number, w: number, h: number];

export type Part =
  | (Look & { name: string; rect: Box; radius?: number })
  | (Look & { name: string; ellipse: Box })
  | (Look & { name: string; star: Box; points?: number; inner?: number })
  | (Look & { name: string; polygon: Box; sides: number })
  | (Look & { name: string; path: readonly (readonly [number, number])[]; closed?: boolean })
  | { name: string; group: readonly Part[] };

export interface LibraryItem {
  id: string;
  name: string;
  category: Category;
  /** Other words it is found by ("vehicle", "weather"…). */
  keywords: readonly string[];
  /** The item's own box: every part lies inside it. */
  width: number;
  height: number;
  parts: readonly Part[];
}

// ---- shorthand for writing items ----

type Opts = Omit<Look, 'fill'> & { radius?: number };
export const rect = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Fill,
  o: Opts = {},
): Part => ({
  name,
  rect: [x, y, w, h],
  fill,
  ...o,
});
export const ellipse = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Fill,
  o: Opts = {},
): Part => ({
  name,
  ellipse: [x, y, w, h],
  fill,
  ...o,
});
export const circle = (
  name: string,
  cx: number,
  cy: number,
  r: number,
  fill: Fill,
  o: Opts = {},
): Part => ellipse(name, cx - r, cy - r, 2 * r, 2 * r, fill, o);
export const star = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: Fill,
  points = 5,
  inner = 0.5,
  o: Opts = {},
): Part => ({
  name,
  star: [x, y, w, h],
  points,
  inner,
  fill,
  ...o,
});
export const polygon = (
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  sides: number,
  fill: Fill,
  o: Opts = {},
): Part => ({
  name,
  polygon: [x, y, w, h],
  sides,
  fill,
  ...o,
});
/** A closed shape through the points. */
export const shape = (
  name: string,
  points: readonly (readonly [number, number])[],
  fill: Fill,
  o: Opts = {},
): Part => ({
  name,
  path: points,
  closed: true,
  fill,
  ...o,
});
/** An open line through the points, `width` px wide. */
export const line = (
  name: string,
  points: readonly (readonly [number, number])[],
  colour: string,
  width: number,
): Part => ({
  name,
  path: points,
  closed: false,
  fill: null,
  stroke: [colour, width],
});
export const group = (name: string, parts: readonly Part[]): Part => ({ name, group: parts });

/** Points along an ellipse's arc, from `from`° to `to`° (0° is to the right, 90° down). */
export function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  steps = 16,
): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

/** The four corners of a w × h rectangle centred on (cx, cy), turned by `deg`. */
export function turnedRect(
  cx: number,
  cy: number,
  w: number,
  h: number,
  deg: number,
): [number, number][] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x! * c - y! * s, cy + x! * s + y! * c] as [number, number]);
}

// ---- building ----

function paintOf(fill: Fill | undefined): Paint {
  if (!fill) return { kind: 'none' };
  if (typeof fill === 'string') return { kind: 'solid', colour: fill };
  return fill.radial
    ? { kind: 'radial', from: fill.from, to: fill.to }
    : { kind: 'linear', from: fill.from, to: fill.to, angle: fill.angle ?? 90 };
}

const boxOf = ([x, y, width, height]: Box) => ({ x, y, width, height });

function buildPart(p: Part): AnimObject {
  if ('group' in p) return { ...createGroup(p.group.map(buildPart)), name: p.name };
  let o: AnimObject;
  if ('rect' in p) o = { ...createRect(boxOf(p.rect)), radius: p.radius ?? 0 };
  else if ('ellipse' in p) o = createEllipse(boxOf(p.ellipse));
  else if ('star' in p)
    o = { ...createStar(boxOf(p.star)), points: p.points ?? 5, inner: p.inner ?? 0.5 };
  else if ('polygon' in p) o = { ...createPolygon(boxOf(p.polygon)), sides: p.sides };
  else
    o = createPath(
      p.path.map(([x, y]) => ({ x, y })),
      p.closed ?? true,
    );
  // The factory's default outline is dropped: a part has an outline only if it says so.
  const rest = { ...o };
  delete rest.stroke;
  return {
    ...rest,
    name: p.name,
    fill: paintOf(p.fill),
    opacity: p.opacity ?? 100,
    ...(p.stroke
      ? { stroke: { colour: p.stroke[0], width: p.stroke[1], dash: 'solid' as const } }
      : {}),
  };
}

/** The item as one group of its named parts, at its own size; new ids every time. */
export function buildItem(item: LibraryItem): AnimObject {
  return { ...createGroup(item.parts.map(buildPart)), name: item.name };
}
