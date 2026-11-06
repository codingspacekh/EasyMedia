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
  /**
   * AN8, AN15: true: a GIF and the web page play once and stop on the last frame. Absent: they
   * play again and again (as every animation did before the choice existed).
   */
  playOnce?: boolean;
}

/** AN6: a colour between a gradient's first and last, `at` % of the way along (0–100). */
export interface GradientStop {
  at: number;
  colour: string;
}

/**
 * AN6: how the inside of a shape (or the letters of text) is coloured. Colours are hex. A
 * gradient runs from `from` to `to`, through its `stops` (absent: none, as in older files).
 */
export type Paint =
  | { kind: 'none' }
  | { kind: 'solid'; colour: string }
  /** `angle` in degrees: 0 runs left to right, 90 top to bottom. */
  | { kind: 'linear'; from: string; to: string; angle: number; stops?: GradientStop[] }
  /** From its centre outwards: `cx`, `cy` in % of the box (absent: 50, the middle). */
  | { kind: 'radial'; from: string; to: string; stops?: GradientStop[]; cx?: number; cy?: number };

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
  /** AN25: the skews, in degrees (absent on an object: 0). */
  | 'skewX'
  | 'skewY'
  | 'opacity'
  | 'fillColour'
  | 'strokeColour'
  | 'strokeWidth'
  | 'radius'
  | 'size'
  | 'text'
  | 'shape'
  /** AN14: the picture a picture object shows (stop motion); it changes at the keyframe. */
  | 'picture';

/** AN10: a shape keyframe's outline, in the object's box scaled to 0–1. */
export interface ShapeValue {
  points: { x: number; y: number }[];
  closed: boolean;
}

export type KeyValue = number | string | ShapeValue;

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
  /**
   * AN23: mirrored in its own box, left to right (flipX) or top to bottom (flipY), after its turn.
   * Absent: not flipped. Text and pictures are mirrored too, as Animate's Flip does.
   */
  flipX?: boolean;
  flipY?: boolean;
  /**
   * AN25: slanted in its own box, in degrees (−80 to 80), before its flip and turn: skewX leans
   * it as italic letters lean (its top to the right), skewY drops its right side. Absent: 0.
   */
  skewX?: number;
  skewY?: number;
  /**
   * AN27: the point it turns about (Animate's transformation point), as fractions of its box from
   * its top-left corner: { x: 0.5, y: 1 } is the middle of its bottom edge (a meter's needle, a
   * pendulum). It may lie outside the box (a moon going round the Earth). Its flip and skew are
   * about it too, and on a motion path it is this point that follows the path. Absent: the centre.
   */
  pivot?: { x: number; y: number };
  /** AN9: keyframes, one track per animated property. Absent or empty: the object stays still. */
  tracks?: Track[];
  /**
   * AN11: the paths the object follows, in frame order, never overlapping (Task 6: out along one,
   * back along another). Before the first it waits at its start, between two at the end of the one
   * before, after the last at its end. Its position keyframes are not used while it has paths.
   */
  paths?: MotionPath[];
  /**
   * AN14: on a frame-by-frame layer, the keyframe (frame) of the drawing the object belongs to;
   * it is shown from that frame until the layer's next keyframe.
   */
  drawing?: number;
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
  /**
   * AN24: holes cut out of a closed shape (Combine ▸ Cut out), each an outline in the same box,
   * filled even-odd. Absent: no holes.
   */
  holes?: PathPoint[][];
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
  /**
   * AN26: the words bent along an arc, −100 to 100: up like a rainbow when more than 0, down like
   * a smile when less; at ±100 the widest line closes into a circle. Absent: 0, straight.
   */
  curve?: number;
}

/** AN5: an imported picture, kept in `AnimationDoc.pictures`. */
export interface PictureObject extends ObjectBase {
  kind: 'picture';
  pictureId: Id;
}

/** AN18: what a button does when it is clicked (in the HTML page and in Test). */
export type ButtonAction = 'pause' | 'continue' | 'restart' | 'goto';

/**
 * AN18: a button (workbook Task 4: Pause and Continue). Its box is filled and outlined as a shape;
 * the label is drawn in the middle in the bundled Inter, `size` px, in `colour`.
 */
export interface ButtonObject extends ObjectBase {
  kind: 'button';
  label: string;
  action: ButtonAction;
  /** For "Go to frame": the frame to go to. */
  frame?: number;
  size: number;
  colour: string;
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
  | ButtonObject
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
  /** AN12: a mask: its shapes restrict what is seen of the layer directly beneath it. */
  mask?: boolean;
  /**
   * AN14: a frame-by-frame layer: the frames where a new drawing starts, sorted, the first 0.
   * Each drawing (the objects whose `drawing` is that frame) is held until the next one.
   */
  drawings?: number[];
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

/**
 * AN28: a sound in the animation (a secondary component, syllabus 20.1): a sound file (its path
 * relative to the animation file, X1) or a built-in sound effect (X8), heard from the frame
 * `start`. Several sounds may overlap: they are mixed.
 */
export interface AnimSound {
  id: Id;
  /** What the timeline shows: the file's name or the sound effect's. */
  name: string;
  path: string;
  /** X8: the built-in sound effect it was made from; made again if its file has gone. */
  effect?: string;
  /** The whole file's length in seconds. */
  duration: number;
  /** The frame it starts at. */
  start: number;
  /** Trim: the seconds of the file skipped at its start. Absent: 0. */
  offset?: number;
  /** Trim: the seconds heard. Absent: to the end of the file. */
  length?: number;
  /** 0–200 %; 100 is the file as it is. */
  volume: number;
  /** Seconds of fading in and out. Absent: none. */
  fadeIn?: number;
  fadeOut?: number;
  /** Not heard (kept for later). Absent: heard. */
  muted?: boolean;
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
  /**
   * 2 since M14 (keyframes), 3 since M15 (paths, morphs, masks), 4 since M16 (buttons, stop
   * motion and frame-by-frame layers); older apps refuse newer files.
   */
  schemaVersion: 4;
  name: string;
  stage: Stage;
  layers: Layer[];
  folders: LayerFolder[];
  pictures: Picture[];
  /** AN28: absent when there are none, so older versions of the app still open the file. */
  sounds?: AnimSound[];
  guides: Guides;
  view: ViewSettings;
}
