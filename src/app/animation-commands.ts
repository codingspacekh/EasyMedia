// Animation mode's editing commands (P4, M13). Each returns a Command whose `apply` builds a new
// document from the old one without changing it; the rules live in core/animation.
import { EditError } from '../core/model/errors.ts';
import {
  resizeFrom,
  rotated,
  setSize,
  type Handle,
  type Point,
} from '../core/animation/geometry.ts';
import * as layers from '../core/animation/layers.ts';
import type { MeasureText } from '../core/animation/letters.ts';
import { validateObject, validateStage } from '../core/animation/rules.ts';
import { changeFps as changeFpsIn } from '../core/animation/time.ts';
import * as tween from '../core/animation/tween.ts';
import type {
  AnimObject,
  AnimationDoc,
  Easing,
  Id,
  Layer,
  Picture,
  Stage,
  Track,
  TweenProperty,
} from '../core/animation/types.ts';
import type { Command } from './history.ts';

export type AnimCommand = Command<AnimationDoc>;

const command = (label: string, apply: (doc: AnimationDoc) => AnimationDoc): AnimCommand => ({
  label,
  apply,
});

export function addObject(layerId: Id, object: AnimObject): AnimCommand {
  return command(`Add ${object.name}`, (doc) => {
    validateObject(object);
    return layers.addObject(doc, layerId, object);
  });
}

/** Changes one object; the change is checked before it is kept. */
export function changeObject(
  id: Id,
  label: string,
  change: (object: AnimObject) => AnimObject,
): AnimCommand {
  return command(label, (doc) =>
    layers.updateObject(doc, id, (o) => {
      const next = change(o);
      validateObject(next);
      return next;
    }),
  );
}

/**
 * AN9: an edit with the playhead on `frame`. The change sees the object as it is at that frame;
 * what it changes becomes keyframes there (plain changes on a still object at frame 0). The
 * object is checked as it is kept and as it is shown at that frame.
 */
function changeAt(
  ids: readonly Id[],
  frame: number,
  label: string,
  change: (now: AnimObject) => AnimObject,
): AnimCommand {
  return command(label, (doc) =>
    ids.reduce(
      (d, id) =>
        layers.updateObject(d, id, (o) => {
          const next = tween.editAt(o, frame, change);
          validateObject(next);
          validateObject(tween.objectAt(next, frame));
          return next;
        }),
      doc,
    ),
  );
}

/** Exact numbers from the Properties panel, applied to every selected object (AN6) at the playhead. */
export function setProperties(
  ids: readonly Id[],
  patch: Partial<AnimObject>,
  frame = 0,
): AnimCommand {
  return changeAt(ids, frame, `Change ${Object.keys(patch).join(', ')}`, (o) => {
    // A new width or height keeps the top-left corner and scales a path's points.
    const sized =
      patch.width !== undefined || patch.height !== undefined
        ? setSize(o, patch.width ?? o.width, patch.height ?? o.height)
        : o;
    return { ...sized, ...patch, width: sized.width, height: sized.height } as AnimObject;
  });
}

export function moveObjects(ids: readonly Id[], dx: number, dy: number, frame = 0): AnimCommand {
  return changeAt(ids, frame, 'Move', (o) => ({ ...o, x: o.x + dx, y: o.y + dy }));
}

export function resizeObject(
  id: Id,
  handle: Handle,
  pointer: Point,
  lockRatio: boolean,
  frame = 0,
): AnimCommand {
  return changeAt([id], frame, 'Resize', (o) => resizeFrom(o, handle, pointer, { lockRatio }));
}

export function rotateObject(id: Id, degrees: number, frame = 0): AnimCommand {
  return changeAt([id], frame, 'Rotate', (o) => rotated(o, degrees));
}

/** AN4: the text becomes one object per letter; the letters' ids are known once it has run. */
export function splitText(
  id: Id,
  measure: MeasureText | undefined,
  made: (ids: Id[]) => void,
): AnimCommand {
  return command('Split into letters', (doc) => {
    const { doc: next, ids } = layers.splitText(doc, id, measure);
    made(ids);
    return next;
  });
}

// ---- keyframes (AN9, AN13) ----

export type PropertyChoice = TweenProperty | 'all';

const PROPERTY_LABEL = Object.fromEntries(tween.TWEEN_PROPERTIES.map((p) => [p.id, p.label]));

/** Changes one property's keyframes; an object with none for it is told plainly. */
function changeTrack(
  id: Id,
  property: TweenProperty,
  label: string,
  change: (track: Track) => Track,
): AnimCommand {
  return command(label, (doc) =>
    layers.updateObject(doc, id, (o) => {
      const track = tween.trackOf(o, property);
      if (!track)
        throw new EditError(`There is no keyframe for ${PROPERTY_LABEL[property]} on ${o.name}.`);
      return tween.setTrack(o, change(track));
    }),
  );
}

export const insertKeyframe = (id: Id, property: PropertyChoice, frame: number): AnimCommand =>
  command('Insert keyframe', (doc) =>
    layers.updateObject(doc, id, (o) =>
      (property === 'all' ? tween.keyableProperties(o) : [property]).reduce(
        (acc, p) => tween.insertKeyframe(acc, p, frame),
        o,
      ),
    ),
  );

export const removeKeyframe = (id: Id, property: TweenProperty, frame: number): AnimCommand =>
  changeTrack(id, property, 'Delete keyframe', (t) => tween.removeKeyframe(t, frame));

export const moveKeyframe = (
  id: Id,
  property: TweenProperty,
  frame: number,
  to: number,
): AnimCommand =>
  changeTrack(id, property, 'Move keyframe', (t) => tween.moveKeyframe(t, frame, to));

export const copyKeyframe = (
  id: Id,
  property: TweenProperty,
  frame: number,
  to: number,
): AnimCommand =>
  changeTrack(id, property, 'Copy keyframe', (t) => tween.copyKeyframe(t, frame, to));

const changeKey = (
  track: Track,
  frame: number,
  change: Partial<Pick<Track['keyframes'][number], 'easing' | 'hold'>>,
): Track => {
  if (!track.keyframes.some((k) => k.frame === frame))
    throw new EditError(`There is no keyframe on frame ${frame}.`);
  return {
    ...track,
    keyframes: track.keyframes.map((k) => (k.frame === frame ? { ...k, ...change } : k)),
  };
};

export const setEasing = (
  id: Id,
  property: TweenProperty,
  frame: number,
  easing: Easing,
): AnimCommand => changeTrack(id, property, 'Easing', (t) => changeKey(t, frame, { easing }));

export const setHold = (
  id: Id,
  property: TweenProperty,
  frame: number,
  hold: boolean,
): AnimCommand => changeTrack(id, property, 'Hold', (t) => changeKey(t, frame, { hold }));

export const setRepeat = (
  id: Id,
  property: TweenProperty,
  repeat: 'end' | number | undefined,
): AnimCommand => changeTrack(id, property, 'Repeat', (t) => tween.withRepeat(t, repeat));

/** Task 1.2: the motion runs back to the start after the last keyframe. */
export const reverse = (id: Id, property: PropertyChoice): AnimCommand =>
  property === 'all'
    ? command('Reverse', (doc) =>
        layers.updateObject(doc, id, (o) => {
          const tracks = (o.tracks ?? []).filter((t) => t.keyframes.length >= 2);
          if (tracks.length === 0)
            throw new EditError(`${o.name} does not move yet: nothing to reverse.`);
          return tracks.reduce((acc, t) => tween.setTrack(acc, tween.reversed(t)), o);
        }),
      )
    : changeTrack(id, property, 'Reverse', (t) => tween.reversed(t));

/** AN8: a new frame rate, keeping keyframes at the same times or the same frames. */
export const setFps = (fps: number, keep: 'times' | 'frames'): AnimCommand =>
  command('Frame rate', (doc) => changeFpsIn(doc, fps, keep));

export const setLength = (length: number): AnimCommand =>
  command('Length', (doc) => {
    const stage = { ...doc.stage, length };
    validateStage(stage);
    return { ...doc, stage };
  });

export function removeObjects(ids: readonly Id[]): AnimCommand {
  return command('Delete', (doc) => layers.removeObjects(doc, ids));
}

export function reorderObjects(ids: readonly Id[], how: layers.Reorder): AnimCommand {
  const labels = {
    forward: 'Bring forward',
    back: 'Send backward',
    front: 'Bring to front',
    backmost: 'Send to back',
  };
  // Front-most first for "forward", back-most first for "back", so a selection keeps its order.
  return command(labels[how], (doc) => {
    const ordered = [...ids].sort((a, b) => {
      const ia = layers.findObject(doc, a)?.index ?? 0;
      const ib = layers.findObject(doc, b)?.index ?? 0;
      return how === 'forward' || how === 'front' ? ib - ia : ia - ib;
    });
    return ordered.reduce((d, id) => layers.reorderObject(d, id, how), doc);
  });
}

export function moveObjectsToLayer(ids: readonly Id[], layerId: Id): AnimCommand {
  return command('Move to layer', (doc) => layers.moveObjectsToLayer(doc, ids, layerId));
}

/** The group's id is known once the command has run. */
export function groupObjects(ids: readonly Id[], made: (groupId: Id) => void): AnimCommand {
  return command('Group', (doc) => {
    const { doc: next, group } = layers.groupObjects(doc, ids);
    made(group.id);
    return next;
  });
}

export function ungroupObjects(ids: readonly Id[]): AnimCommand {
  return command('Ungroup', (doc) =>
    ids.reduce((d, id) => {
      const found = layers.findObject(d, id);
      return found?.object.kind === 'group' ? layers.ungroup(d, id) : d;
    }, doc),
  );
}

export function duplicateObjects(ids: readonly Id[], made: (ids: Id[]) => void): AnimCommand {
  return command(`Duplicate ${'' /* label below */}`.trim(), (doc) => {
    const { doc: next, ids: copies } = layers.duplicateObjects(doc, ids);
    made(copies);
    return next;
  });
}

/** Pasted objects go to the front of the layer, offset so they are seen, with new ids. */
export function pasteObjects(
  layerId: Id,
  objects: readonly AnimObject[],
  made: (ids: Id[]) => void,
): AnimCommand {
  return command('Paste', (doc) => {
    let next = doc;
    const ids: Id[] = [];
    for (const object of objects) {
      const { doc: d, ids: copies } = layers.duplicateObjects(
        layers.addObject(next, layerId, { ...object, id: `${object.id}.paste` }),
        [`${object.id}.paste`],
      );
      next = layers.removeObjects(d, [`${object.id}.paste`]);
      ids.push(...copies);
    }
    made(ids);
    return next;
  });
}

// ---- stage, layers, folders, guides, pictures ----

export function setStage(stage: Stage): AnimCommand {
  return command('Stage settings', (doc) => {
    validateStage(stage);
    return { ...doc, stage };
  });
}

export function addLayer(made: (layer: Layer) => void, aboveId?: Id): AnimCommand {
  return command('New layer', (doc) => {
    const { doc: next, layer } = layers.addLayer(doc, undefined, aboveId);
    made(layer);
    return next;
  });
}

export const renameLayer = (id: Id, name: string): AnimCommand =>
  command('Rename layer', (doc) => layers.renameLayer(doc, id, name));

export const removeLayer = (id: Id): AnimCommand =>
  command('Delete layer', (doc) => layers.removeLayer(doc, id));

export const moveLayer = (id: Id, index: number): AnimCommand =>
  command('Move layer', (doc) => layers.moveLayer(doc, id, index));

export const setLayer = (
  id: Id,
  change: Partial<Pick<Layer, 'visible' | 'locked' | 'colour' | 'mask'>>,
): AnimCommand =>
  command(
    change.visible !== undefined
      ? change.visible
        ? 'Show layer'
        : 'Hide layer'
      : change.locked !== undefined
        ? change.locked
          ? 'Lock layer'
          : 'Unlock layer'
        : 'Layer colour',
    (doc) => layers.setLayer(doc, id, change),
  );

export function addFolder(name: string, made: (id: Id) => void): AnimCommand {
  return command('New folder', (doc) => {
    const { doc: next, folder } = layers.addFolder(doc, name);
    made(folder.id);
    return next;
  });
}

export const renameFolder = (id: Id, name: string): AnimCommand =>
  command('Rename folder', (doc) => layers.renameFolder(doc, id, name));

export const removeFolder = (id: Id): AnimCommand =>
  command('Delete folder', (doc) => layers.removeFolder(doc, id));

export const moveLayerToFolder = (layerId: Id, folderId: Id | null): AnimCommand =>
  command('Move layer to folder', (doc) => layers.moveLayerToFolder(doc, layerId, folderId));

export type GuideAxis = 'x' | 'y';

export function addGuide(axis: GuideAxis, value: number): AnimCommand {
  return command('Add guide', (doc) => ({
    ...doc,
    guides: { ...doc.guides, [axis]: [...doc.guides[axis], value] },
  }));
}

export function moveGuide(axis: GuideAxis, index: number, value: number): AnimCommand {
  return command('Move guide', (doc) => {
    if (index < 0 || index >= doc.guides[axis].length) throw new EditError('That guide is gone.');
    return {
      ...doc,
      guides: { ...doc.guides, [axis]: doc.guides[axis].toSpliced(index, 1, value) },
    };
  });
}

export function removeGuide(axis: GuideAxis, index: number): AnimCommand {
  return command('Remove guide', (doc) => ({
    ...doc,
    guides: { ...doc.guides, [axis]: doc.guides[axis].toSpliced(index, 1) },
  }));
}

/** AN5: a picture file (once) and an object showing it. */
export function addPicture(layerId: Id, picture: Picture, object: AnimObject): AnimCommand {
  return command(`Add ${object.name}`, (doc) => {
    const known = doc.pictures.some((p) => p.id === picture.id);
    const withPicture = known ? doc : { ...doc, pictures: [...doc.pictures, picture] };
    return layers.addObject(withPicture, layerId, object);
  });
}
