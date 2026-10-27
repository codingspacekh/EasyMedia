// Animation mode's editing commands (P4, M13). Each returns a Command whose `apply` builds a new
// document from the old one without changing it; the rules live in core/animation.
import { EditError } from '../core/model/errors.ts';
import {
  moved,
  resizeFrom,
  rotated,
  setSize,
  type Handle,
  type Point,
} from '../core/animation/geometry.ts';
import * as layers from '../core/animation/layers.ts';
import { validateObject, validateStage } from '../core/animation/rules.ts';
import type {
  AnimObject,
  AnimationDoc,
  Id,
  Layer,
  Picture,
  Stage,
} from '../core/animation/types.ts';
import type { Command } from './history.ts';

export type AnimCommand = Command<AnimationDoc>;

const command = (label: string, apply: (doc: AnimationDoc) => AnimationDoc): AnimCommand => ({
  label,
  apply,
});

const objectsNamed = (doc: AnimationDoc, ids: readonly Id[]) =>
  ids.length === 1
    ? (layers.findObject(doc, ids[0]!)?.object.name ?? 'object')
    : `${ids.length} objects`;

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

/** Exact numbers from the Properties panel, applied to every selected object (AN6). */
export function setProperties(ids: readonly Id[], patch: Partial<AnimObject>): AnimCommand {
  const label = `Change ${Object.keys(patch).join(', ')}`;
  return command(label, (doc) =>
    ids.reduce(
      (d, id) =>
        layers.updateObject(d, id, (o) => {
          // A new width or height keeps the top-left corner and scales a path's points.
          const sized =
            patch.width !== undefined || patch.height !== undefined
              ? setSize(o, patch.width ?? o.width, patch.height ?? o.height)
              : o;
          const next = {
            ...sized,
            ...patch,
            width: sized.width,
            height: sized.height,
          } as AnimObject;
          validateObject(next);
          return next;
        }),
      doc,
    ),
  );
}

export function moveObjects(ids: readonly Id[], dx: number, dy: number): AnimCommand {
  return command('Move', (doc) =>
    ids.reduce((d, id) => layers.updateObject(d, id, (o) => moved(o, dx, dy)), doc),
  );
}

export function resizeObject(
  id: Id,
  handle: Handle,
  pointer: Point,
  lockRatio: boolean,
): AnimCommand {
  return changeObject(id, 'Resize', (o) => resizeFrom(o, handle, pointer, { lockRatio }));
}

export function rotateObject(id: Id, degrees: number): AnimCommand {
  return changeObject(id, 'Rotate', (o) => rotated(o, degrees));
}

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
  change: Partial<Pick<Layer, 'visible' | 'locked' | 'colour'>>,
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

export { objectsNamed };
