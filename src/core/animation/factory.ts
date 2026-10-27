// Creates animation documents and objects with the defaults students expect (P12).
import { EditError } from '../model/errors.ts';
import { newId } from '../model/factory.ts';
import { FONTS } from '../text/fonts.ts';
import { fileNameOf } from '../project/relocate.ts';
import { shiftTracks } from './geometry.ts';
import type {
  AnimObject,
  AnimationDoc,
  EllipseObject,
  GroupObject,
  Layer,
  PathObject,
  Picture,
  PictureObject,
  PolygonObject,
  RectObject,
  StarObject,
  Stroke,
  TextObject,
} from './types.ts';

export const DEFAULT_FILL = '#9aa4b2';
export const DEFAULT_STROKE: Stroke = { colour: '#1e222a', width: 2, dash: 'solid' };
export const DEFAULT_TEXT_SIZE = 48;
/** A text box's height per px of font size, until the screen measures the words. */
export const LINE_HEIGHT = 1.2;
export const DEFAULT_FONT = FONTS[0]!.name;

export interface Box {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export function createLayer(name: string, extra: Partial<Layer> = {}): Layer {
  return { id: newId(), name, visible: true, locked: false, objects: [], ...extra };
}

export function createAnimation({ name }: { name: string }): AnimationDoc {
  return {
    schemaVersion: 2,
    name,
    stage: { width: 1280, height: 720, background: '#ffffff', fps: 24, length: 120 },
    layers: [createLayer('Layer 1')],
    folders: [],
    pictures: [],
    guides: { x: [], y: [] },
    view: {
      rulers: false,
      grid: { show: false, size: 10, over: false },
      snap: { grid: true, guides: true, objects: true, pixels: false },
    },
  };
}

function base(name: string, box: Box) {
  return {
    id: newId(),
    name,
    x: box.x,
    y: box.y,
    width: box.width ?? 100,
    height: box.height ?? 100,
    rotation: 0,
    opacity: 100,
    fill: { kind: 'solid' as const, colour: DEFAULT_FILL },
    stroke: { ...DEFAULT_STROKE },
  };
}

export function createRect(box: Box): RectObject {
  return { kind: 'rect', radius: 0, ...base('Rectangle', box) };
}

export function createEllipse(box: Box): EllipseObject {
  return { kind: 'ellipse', ...base('Ellipse', box) };
}

export function createStar(box: Box): StarObject {
  return { kind: 'star', points: 5, inner: 0.5, ...base('Star', box) };
}

export function createPolygon(box: Box): PolygonObject {
  return { kind: 'polygon', sides: 6, ...base('Polygon', box) };
}

/** A line between two stage points: an open path whose box is the two points' bounds. */
export function createLine(
  from: { x: number; y: number },
  to: { x: number; y: number },
): PathObject {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  return {
    kind: 'path',
    closed: false,
    points: [
      { x: from.x - x, y: from.y - y },
      { x: to.x - x, y: to.y - y },
    ],
    ...base('Line', { x, y, width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) }),
    fill: { kind: 'none' },
  };
}

/** A pen or brush path from points in stage coordinates. */
export function createPath(
  points: { x: number; y: number }[],
  closed: boolean,
  name = closed ? 'Shape' : 'Path',
): PathObject {
  if (points.length < 2) throw new EditError('A path needs at least two points.');
  const x = Math.min(...points.map((p) => p.x));
  const y = Math.min(...points.map((p) => p.y));
  const width = Math.max(...points.map((p) => p.x)) - x;
  const height = Math.max(...points.map((p) => p.y)) - y;
  return {
    kind: 'path',
    closed,
    points: points.map((p) => ({ x: p.x - x, y: p.y - y })),
    ...base(name, { x, y, width, height }),
    ...(closed ? {} : { fill: { kind: 'none' as const } }),
  };
}

/** Roughly how wide a line of text is before the screen measures it (about 0.55 em a letter). */
export const roughTextWidth = (text: string, size: number): number =>
  Math.max(1, ...text.split('\n').map((line) => line.length)) * size * 0.55;

export function createText(
  text: string,
  options: { x: number; y: number; size?: number; font?: string },
): TextObject {
  const size = options.size ?? DEFAULT_TEXT_SIZE;
  const lines = text.split('\n').length;
  return {
    kind: 'text',
    text,
    font: options.font ?? DEFAULT_FONT,
    size,
    bold: false,
    italic: false,
    align: 'left',
    ...base(text.trim() === '' ? 'Text' : text.split('\n')[0]!.trim(), {
      x: options.x,
      y: options.y,
      width: roughTextWidth(text, size),
      height: size * LINE_HEIGHT * lines,
    }),
    fill: { kind: 'solid', colour: '#000000' },
    stroke: undefined,
  };
}

export function createPicture(picture: Picture, at: { x: number; y: number }): PictureObject {
  return {
    kind: 'picture',
    pictureId: picture.id,
    ...base(fileNameOf(picture.path), {
      x: at.x,
      y: at.y,
      width: picture.width,
      height: picture.height,
    }),
    fill: { kind: 'none' },
    stroke: undefined,
  };
}

/** AN13: one object made of several; the children's positions become relative to the group. */
export function createGroup(children: readonly AnimObject[]): GroupObject {
  if (children.length === 0) throw new EditError('A group needs at least one object.');
  const x = Math.min(...children.map((c) => c.x));
  const y = Math.min(...children.map((c) => c.y));
  const width = Math.max(...children.map((c) => c.x + c.width)) - x;
  const height = Math.max(...children.map((c) => c.y + c.height)) - y;
  return {
    kind: 'group',
    children: children.map((c) => ({
      ...shiftTracks(c, { x: -x, y: -y }),
      x: c.x - x,
      y: c.y - y,
    })),
    ...base('Group', { x, y, width, height }),
    fill: { kind: 'none' },
    stroke: undefined,
  };
}
