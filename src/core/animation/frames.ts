// AN14: stop motion and frame-by-frame animation, as the coursebook describes them. Stop motion:
// a folder of photographs shown one after another, each held for its frames — one picture object
// whose `picture` keyframes (held) change the photograph. Frame-by-frame: a layer where every
// keyframe holds its own drawing (the objects drawn at that frame), shown until the next keyframe;
// the drawings before and after can be seen faintly (onion skin) while drawing.
import { EditError } from '../model/errors.ts';
import { newId } from '../model/factory.ts';
import { fileNameOf } from '../project/relocate.ts';
import { createPicture } from './factory.ts';
import { objectAt } from './tween.ts';
import type {
  AnimObject,
  AnimationDoc,
  Id,
  Keyframe,
  Layer,
  Picture,
  PictureObject,
  Stage,
} from './types.ts';

// ---- stop motion ----

/**
 * Where each of `count` pictures starts when they are shown at `rate` pictures a second on a
 * stage of `fps` frames a second, and how many frames they take together. A rate that does not
 * divide the stage's is spread as evenly as whole frames allow.
 */
export function stopMotionTiming(
  count: number,
  rate: number,
  fps: number,
): { starts: number[]; length: number } {
  if (count < 1) throw new EditError('There are no pictures to import.');
  if (!(rate >= 1 && rate <= fps))
    throw new EditError(`Choose a rate between 1 and ${fps} pictures a second (the stage's fps).`);
  const each = fps / rate;
  return {
    starts: Array.from({ length: count }, (_, i) => Math.round(i * each)),
    length: Math.round(count * each),
  };
}

/** A folder's files in the order people read them: frame2 before frame10, case ignored. */
export function sortByName(paths: readonly string[]): string[] {
  const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
  return [...paths].sort(
    (a, b) => collator.compare(fileNameOf(a), fileNameOf(b)) || (a < b ? -1 : 1),
  );
}

/**
 * *Import frames…*: one picture object showing the pictures in turn, a held keyframe for each, at
 * `rate` pictures a second; as big as the first picture, made smaller to fit the stage, centred.
 */
export function stopMotion(
  pictures: readonly Picture[],
  rate: number,
  stage: Pick<Stage, 'width' | 'height' | 'fps'>,
): PictureObject {
  const { starts } = stopMotionTiming(pictures.length, rate, stage.fps);
  const first = pictures[0]!;
  const scale = Math.min(1, stage.width / first.width, stage.height / first.height);
  const width = Math.round(first.width * scale);
  const height = Math.round(first.height * scale);
  const object = createPicture(first, {
    x: Math.round((stage.width - width) / 2),
    y: Math.round((stage.height - height) / 2),
  });
  const keyframes: Keyframe[] = pictures.map((p, i) => ({
    frame: starts[i]!,
    value: p.id,
    easing: 'linear',
    hold: true,
  }));
  return {
    ...object,
    name: 'Stop motion',
    width,
    height,
    tracks: [{ property: 'picture', keyframes }],
  };
}

// ---- frame-by-frame layers ----

export const isFrameByFrame = (layer: Layer): boolean => layer.drawings !== undefined;

/** The layer as a frame-by-frame layer: what is on it becomes the first drawing (frame 0). */
export function toFrameByFrame(layer: Layer): Layer {
  if (isFrameByFrame(layer)) return layer;
  return { ...layer, drawings: [0], objects: layer.objects.map((o) => ({ ...o, drawing: 0 })) };
}

const drawingOf = (o: AnimObject): number => o.drawing ?? 0;

/** The keyframe of the drawing shown at a frame; undefined on an ordinary layer. */
export function drawingAt(layer: Layer, frame: number): number | undefined {
  if (!layer.drawings) return undefined;
  let shown = layer.drawings[0] ?? 0;
  for (const start of layer.drawings) if (start <= frame) shown = start;
  return shown;
}

/** The objects shown at a frame: all of them on an ordinary layer, else the drawing's. */
export function objectsShown(layer: Layer, frame: number): AnimObject[] {
  const drawing = drawingAt(layer, frame);
  return drawing === undefined
    ? layer.objects
    : layer.objects.filter((o) => drawingOf(o) === drawing);
}

function withNewIds(object: AnimObject): AnimObject {
  const copy = { ...object, id: newId() };
  return copy.kind === 'group' ? { ...copy, children: copy.children.map(withNewIds) } : copy;
}

/**
 * A keyframe at `frame`: a blank one (*Insert blank keyframe*), or a copy of the drawing shown
 * there to change a little (*Duplicate frame*, as a flick book's next page).
 */
export function addDrawing(layer: Layer, frame: number, how: 'blank' | 'copy'): Layer {
  if (!layer.drawings)
    throw new EditError(`${layer.name} is not a frame-by-frame layer. Make it one first.`);
  if (!Number.isInteger(frame) || frame < 0)
    throw new EditError('A keyframe needs a whole frame number, 0 or more.');
  if (layer.drawings.includes(frame))
    throw new EditError(`There is already a keyframe on frame ${frame}.`);
  const copies =
    how === 'copy'
      ? objectsShown(layer, frame).map((o) => ({ ...withNewIds(o), drawing: frame }))
      : [];
  return {
    ...layer,
    drawings: [...layer.drawings, frame].sort((a, b) => a - b),
    objects: [...layer.objects, ...copies],
  };
}

/** Removes a keyframe and its drawing; the first keyframe stays, emptied. */
export function removeDrawing(layer: Layer, frame: number): Layer {
  if (!layer.drawings?.includes(frame))
    throw new EditError(`There is no keyframe on frame ${frame}.`);
  const objects = layer.objects.filter((o) => drawingOf(o) !== frame);
  if (frame === layer.drawings[0]) return { ...layer, objects };
  return { ...layer, drawings: layer.drawings.filter((f) => f !== frame), objects };
}

/** Onion skin: the drawings just before and just after the one shown, as they are at the frame. */
export function onionSkin(
  layer: Layer,
  frame: number,
): { before: AnimObject[]; after: AnimObject[] } {
  const drawings = layer.drawings;
  const shown = drawingAt(layer, frame);
  if (!drawings || shown === undefined) return { before: [], after: [] };
  const i = drawings.indexOf(shown);
  const objectsOf = (start: number | undefined) =>
    start === undefined
      ? []
      : layer.objects.filter((o) => drawingOf(o) === start).map((o) => objectAt(o, frame));
  return { before: objectsOf(drawings[i - 1]), after: objectsOf(drawings[i + 1]) };
}

/**
 * An object put on a layer at a frame (drawn, pasted, moved there): on a frame-by-frame layer it
 * joins the drawing shown; on an ordinary layer it belongs to no drawing.
 */
export function placeIn<T extends AnimObject>(layer: Layer, object: T, frame: number): T {
  const drawing = drawingAt(layer, frame);
  if (drawing !== undefined) return { ...object, drawing };
  if (object.drawing === undefined) return object;
  const rest = { ...object };
  delete rest.drawing;
  return rest;
}

/** True when the object is on the stage at the frame (not in another drawing of its layer). */
export function isShown(doc: AnimationDoc, id: Id, frame: number): boolean {
  for (const layer of doc.layers) {
    const object = layer.objects.find((o) => o.id === id);
    if (object)
      return drawingAt(layer, frame) === undefined || objectsShown(layer, frame).includes(object);
  }
  return false;
}
