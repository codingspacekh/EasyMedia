// The animation document (AN1–AN16): a stage, layers of vector objects, pictures, guides and
// view settings. Plain, immutable, JSON-serialisable data, like the video project (ARCHITECTURE
// §5). Coordinates are stage pixels with (0, 0) at the top left, as the coursebook's rulers;
// an object's x and y are its top-left corner and it turns about its centre.
import type { Id } from '../model/types.ts';

export type { Id };

/** AN1: the stage. `length` is in frames; the UI shows seconds beside it (AN8). */
export interface Stage {
  width: number;
  height: number;
  /** Hex colour, e.g. "#F4C8EE". */
  background: string;
  fps: number;
  length: number;
}

/** AN6: how the inside of a shape (or the letters of text) is coloured. Colours are hex. */
export type Paint =
  | { kind: 'none' }
  | { kind: 'solid'; colour: string }
  /** `angle` in degrees: 0 runs left to right, 90 top to bottom. */
  | { kind: 'linear'; from: string; to: string; angle: number }
  /** From the centre outwards. */
  | { kind: 'radial'; from: string; to: string };

export type Dash = 'solid' | 'dashed' | 'dotted';

/** AN6: the outline. Width 0 draws nothing. */
export interface Stroke {
  colour: string;
  width: number;
  dash: Dash;
}

/** AN9: how a tween runs from one keyframe to the next. */
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';

/** AN9: the properties that can have keyframes. Colours are hex; `text` changes at the keyframe. */
export type TweenProperty =
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'rotation'
  | 'opacity'
  | 'fillColour'
  | 'strokeColour'
  | 'strokeWidth'
  | 'radius'
  | 'size'
  | 'text';

export type KeyValue = number | string;

/** AN9: a value fixed at a frame. `easing` shapes the tween to the next keyframe; `hold` keeps this value until it. */
export interface Keyframe {
  frame: number;
  value: KeyValue;
  easing: Easing;
  hold: boolean;
}

/**
 * AN9, AN13: one property's keyframes, sorted by frame. `repeat` plays the span from the first
 * to the last keyframe again after it ends: `'end'` until the animation ends, or n more times.
 */
export interface Track {
  property: TweenProperty;
  keyframes: Keyframe[];
  repeat?: 'end' | number;
}

/**
 * AN11: a motion path. Between `from` and `to` the object's centre follows the path (in its
 * parent's coordinates: the stage for an object on a layer), at even speed or with an equal share
 * of the time per segment, eased; before and after, it waits at the ends. Oriented, it also turns
 * with the path (a car on a road), on top of its own rotation.
 */
export interface MotionPath {
  points: PathPoint[];
  closed: boolean;
  from: number;
  to: number;
  orient: boolean;
  even: boolean;
  easing: Easing;
  /** The name of the path or shape it was taken from, for the Properties panel. */
  source?: string;
}

/** What every object has (AN6). Rotation in degrees, clockwise; opacity 0–100 %. */
interface ObjectBase {
  id: Id;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fill: Paint;
  /** Absent: no outline. */
  stroke?: Stroke;
  /** AN9: keyframes, one track per animated property. Absent or empty: the object stays still. */
  tracks?: Track[];
  /** AN11: the path the object follows; its position keyframes are not used while it has one. */
  motion?: MotionPath;
}

export interface RectObject extends ObjectBase {
  kind: 'rect';
  /** Corner radius in px. */
  radius: number;
}

export interface EllipseObject extends ObjectBase {
  kind: 'ellipse';
}

export interface StarObject extends ObjectBase {
  kind: 'star';
  points: number;
  /** The inner radius as a fraction of the outer one (0–1). */
  inner: number;
}

export interface PolygonObject extends ObjectBase {
  kind: 'polygon';
  sides: number;
}

/** One anchor of a path, in the object's own box (0, 0 = its top left), with optional handles. */
export interface PathPoint {
  x: number;
  y: number;
  /** The control point of the curve arriving here. */
  in?: { x: number; y: number };
  /** The control point of the curve leaving here. */
  out?: { x: number; y: number };
}

/** AN3: a line (two points), a pen or brush path. Points stay inside the box; resizing scales them. */
export interface PathObject extends ObjectBase {
  kind: 'path';
  points: PathPoint[];
  closed: boolean;
}

export type TextAlign = 'left' | 'centre' | 'right';

/** AN4: words in a bundled font (X2). `fill` colours the letters; `stroke` outlines them. */
export interface TextObject extends ObjectBase {
  kind: 'text';
  text: string;
  font: string;
  /** Font size in px. */
  size: number;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
}

/** AN5: an imported picture, kept in `AnimationDoc.pictures`. */
export interface PictureObject extends ObjectBase {
  kind: 'picture';
  pictureId: Id;
}

/** AN13: a group's children are placed inside its box and move, turn and scale with it. */
export interface GroupObject extends ObjectBase {
  kind: 'group';
  children: AnimObject[];
}

export type AnimObject =
  | RectObject
  | EllipseObject
  | StarObject
  | PolygonObject
  | PathObject
  | TextObject
  | PictureObject
  | GroupObject;

export type ObjectKind = AnimObject['kind'];

/** AN7: a layer. The first layer in the list is at the bottom; the last is in front. */
export interface Layer {
  id: Id;
  name: string;
  visible: boolean;
  locked: boolean;
  /** The folder it is in, if any. */
  folderId?: Id;
  /** The colour tag shown in the Layers panel. */
  colour?: string;
  /** Drawing order: the first object is at the back. */
  objects: AnimObject[];
}

export interface LayerFolder {
  id: Id;
  name: string;
  open: boolean;
}

/** AN5: a picture file used by picture objects. The path is relative to the animation file (X1). */
export interface Picture {
  id: Id;
  path: string;
  width: number;
  height: number;
}

/** AN2: guides are dragged out of the rulers; stage pixels. */
export interface Guides {
  /** Vertical guides, by their x. */
  x: number[];
  /** Horizontal guides, by their y. */
  y: number[];
}

/** AN2: rulers, grid and snapping, saved with the animation as Animate saves them. */
export interface ViewSettings {
  rulers: boolean;
  grid: { show: boolean; size: number; over: boolean };
  snap: { grid: boolean; guides: boolean; objects: boolean; pixels: boolean };
}

export interface AnimationDoc {
  /** 2 since M14 (keyframes), 3 since M15 (paths, morphs, masks); older apps refuse newer files. */
  schemaVersion: 3;
  name: string;
  stage: Stage;
  layers: Layer[];
  folders: LayerFolder[];
  pictures: Picture[];
  guides: Guides;
  view: ViewSettings;
}
