// AN7, AN13: layers and the objects in them. Pure functions on the document; every one returns
// a new document (the commands wrap them, so each is one undo step).
import { EditError } from '../model/errors.ts';
import { newId } from '../model/factory.ts';
import { createGroup, createLayer } from './factory.ts';
import { moved, shiftTracks, toStage } from './geometry.ts';
import type { AnimObject, AnimationDoc, GroupObject, Id, Layer, LayerFolder } from './types.ts';

export interface Found {
  layer: Layer;
  layerId: Id;
  index: number;
  object: AnimObject;
}

export type Reorder = 'forward' | 'back' | 'front' | 'backmost';

const layerOf = (doc: AnimationDoc, id: Id): Layer => {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) throw new EditError('That layer no longer exists.');
  return layer;
};

const withLayers = (doc: AnimationDoc, layers: Layer[]): AnimationDoc => ({ ...doc, layers });

const replaceLayer = (doc: AnimationDoc, layer: Layer): AnimationDoc =>
  withLayers(
    doc,
    doc.layers.map((l) => (l.id === layer.id ? layer : l)),
  );

/** Refuses edits on a locked or hidden layer, as the coursebook's padlock. */
function editable(layer: Layer): Layer {
  if (layer.locked) throw new EditError(`${layer.name} is locked. Unlock it to change it.`);
  if (!layer.visible) throw new EditError(`${layer.name} is hidden. Show it to change it.`);
  return layer;
}

const allNames = (objects: readonly AnimObject[]): string[] =>
  objects.flatMap((o) => [o.name, ...(o.kind === 'group' ? allNames(o.children) : [])]);

/** "Star" when free, else "Star 2", "Star 3"… */
export function uniqueName(doc: AnimationDoc, name: string): string {
  const taken = new Set(doc.layers.flatMap((l) => allNames(l.objects)));
  if (!taken.has(name)) return name;
  for (let n = 2; ; n++) if (!taken.has(`${name} ${n}`)) return `${name} ${n}`;
}

// ---- layers ----

export function addLayer(
  doc: AnimationDoc,
  name?: string,
  aboveId?: Id,
): { doc: AnimationDoc; layer: Layer } {
  const layerName = name ?? `Layer ${doc.layers.length + 1}`;
  const above = aboveId ? layerOf(doc, aboveId) : undefined;
  const layer = createLayer(layerName, above?.folderId ? { folderId: above.folderId } : {});
  const at = above ? doc.layers.indexOf(above) + 1 : doc.layers.length;
  return { doc: withLayers(doc, doc.layers.toSpliced(at, 0, layer)), layer };
}

export function renameLayer(doc: AnimationDoc, id: Id, name: string): AnimationDoc {
  const trimmed = name.trim();
  if (trimmed === '') throw new EditError('Give the layer a name.');
  return replaceLayer(doc, { ...layerOf(doc, id), name: trimmed });
}

export function setLayer(
  doc: AnimationDoc,
  id: Id,
  change: Partial<Pick<Layer, 'visible' | 'locked' | 'colour'>>,
): AnimationDoc {
  return replaceLayer(doc, { ...layerOf(doc, id), ...change });
}

export function removeLayer(doc: AnimationDoc, id: Id): AnimationDoc {
  if (doc.layers.length <= 1) throw new EditError('An animation needs at least one layer.');
  layerOf(doc, id);
  return withLayers(
    doc,
    doc.layers.filter((l) => l.id !== id),
  );
}

/** Puts the layer at `index` in the list (0 = bottom). */
export function moveLayer(doc: AnimationDoc, id: Id, index: number): AnimationDoc {
  const layer = layerOf(doc, id);
  const others = doc.layers.filter((l) => l.id !== id);
  const at = Math.max(0, Math.min(others.length, index));
  return withLayers(doc, others.toSpliced(at, 0, layer));
}

// ---- folders ----

export function addFolder(
  doc: AnimationDoc,
  name: string,
): { doc: AnimationDoc; folder: LayerFolder } {
  const folder: LayerFolder = { id: newId(), name: name.trim() || 'Folder', open: true };
  return { doc: { ...doc, folders: [...doc.folders, folder] }, folder };
}

export function renameFolder(doc: AnimationDoc, id: Id, name: string): AnimationDoc {
  const trimmed = name.trim();
  if (trimmed === '') throw new EditError('Give the folder a name.');
  return {
    ...doc,
    folders: doc.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f)),
  };
}

export function setFolderOpen(doc: AnimationDoc, id: Id, open: boolean): AnimationDoc {
  return { ...doc, folders: doc.folders.map((f) => (f.id === id ? { ...f, open } : f)) };
}

export function moveLayerToFolder(
  doc: AnimationDoc,
  layerId: Id,
  folderId: Id | null,
): AnimationDoc {
  const layer = layerOf(doc, layerId);
  if (folderId !== null && !doc.folders.some((f) => f.id === folderId))
    throw new EditError('That folder no longer exists.');
  const rest = { ...layer };
  delete rest.folderId;
  return replaceLayer(doc, folderId === null ? rest : { ...rest, folderId });
}

/** Deletes the folder; its layers stay, out of any folder. */
export function removeFolder(doc: AnimationDoc, id: Id): AnimationDoc {
  return {
    ...doc,
    folders: doc.folders.filter((f) => f.id !== id),
    layers: doc.layers.map((l) => {
      if (l.folderId !== id) return l;
      const rest = { ...l };
      delete rest.folderId;
      return rest;
    }),
  };
}

// ---- objects ----

export function findObject(doc: AnimationDoc, id: Id): Found | null {
  for (const layer of doc.layers) {
    const index = layer.objects.findIndex((o) => o.id === id);
    if (index >= 0) return { layer, layerId: layer.id, index, object: layer.objects[index]! };
  }
  return null;
}

const requireObject = (doc: AnimationDoc, id: Id): Found => {
  const found = findObject(doc, id);
  if (!found) throw new EditError('That object no longer exists.');
  return found;
};

/** Adds to the front of the layer, with a name no other object has. */
export function addObject(doc: AnimationDoc, layerId: Id, object: AnimObject): AnimationDoc {
  const layer = editable(layerOf(doc, layerId));
  const named = { ...object, name: uniqueName(doc, object.name) };
  return replaceLayer(doc, { ...layer, objects: [...layer.objects, named] });
}

export function updateObject(
  doc: AnimationDoc,
  id: Id,
  change: (object: AnimObject) => AnimObject,
): AnimationDoc {
  const { layer, index, object } = requireObject(doc, id);
  editable(layer);
  const next = change(object);
  if (next === object) return doc;
  return replaceLayer(doc, { ...layer, objects: layer.objects.toSpliced(index, 1, next) });
}

export function removeObjects(doc: AnimationDoc, ids: readonly Id[]): AnimationDoc {
  const gone = new Set(ids);
  return withLayers(
    doc,
    doc.layers.map((layer) => {
      if (!layer.objects.some((o) => gone.has(o.id))) return layer;
      editable(layer);
      return { ...layer, objects: layer.objects.filter((o) => !gone.has(o.id)) };
    }),
  );
}

export function reorderObject(doc: AnimationDoc, id: Id, how: Reorder): AnimationDoc {
  const { layer, index } = requireObject(doc, id);
  editable(layer);
  const last = layer.objects.length - 1;
  const to = {
    forward: Math.min(last, index + 1),
    back: Math.max(0, index - 1),
    front: last,
    backmost: 0,
  }[how];
  if (to === index) return doc;
  const objects = layer.objects.toSpliced(index, 1);
  return replaceLayer(doc, { ...layer, objects: objects.toSpliced(to, 0, layer.objects[index]!) });
}

/** Moves objects to the front of another layer, in their drawing order. */
export function moveObjectsToLayer(
  doc: AnimationDoc,
  ids: readonly Id[],
  layerId: Id,
): AnimationDoc {
  const target = editable(layerOf(doc, layerId));
  const wanted = new Set(ids);
  const moving = doc.layers.flatMap((l) => l.objects.filter((o) => wanted.has(o.id)));
  const removed = removeObjects(doc, ids);
  const targetNow = layerOf(removed, target.id);
  return replaceLayer(removed, { ...targetNow, objects: [...targetNow.objects, ...moving] });
}

/** Bottom first: the order to draw (and the reverse order to pick). Hidden layers are left out. */
export function drawOrder(doc: AnimationDoc): { layer: Layer; object: AnimObject }[] {
  return doc.layers
    .filter((l) => l.visible)
    .flatMap((layer) => layer.objects.map((object) => ({ layer, object })));
}

// ---- groups and copies ----

/** AN13: one object from several in the same layer, placed where the front one was. */
export function groupObjects(
  doc: AnimationDoc,
  ids: readonly Id[],
): { doc: AnimationDoc; group: GroupObject } {
  if (ids.length < 2) throw new EditError('Select two or more objects to group.');
  const found = ids.map((id) => requireObject(doc, id));
  const layer = editable(found[0]!.layer);
  if (found.some((f) => f.layerId !== layer.id))
    throw new EditError('Objects can only be grouped with others in the same layer.');
  const members = found.sort((a, b) => a.index - b.index);
  const group = { ...createGroup(members.map((m) => m.object)), name: uniqueName(doc, 'Group') };
  const at = members.at(-1)!.index - (members.length - 1);
  const objects = layer.objects.filter((o) => !ids.includes(o.id)).toSpliced(at, 0, group);
  return { doc: replaceLayer(doc, { ...layer, objects }), group };
}

/**
 * The children back on the stage, where the group showed them (its move and turn applied). Their
 * own keyframes move with them; the group's own keyframes go with the group.
 */
export function ungroup(doc: AnimationDoc, id: Id): AnimationDoc {
  const { layer, index, object } = requireObject(doc, id);
  editable(layer);
  if (object.kind !== 'group') throw new EditError('That is not a group.');
  const children = object.children.map((child) => {
    const centre = toStage(object, {
      x: child.x + child.width / 2,
      y: child.y + child.height / 2,
    });
    const x = centre.x - child.width / 2;
    const y = centre.y - child.height / 2;
    return {
      ...shiftTracks(child, { x: x - child.x, y: y - child.y, rotation: object.rotation }),
      x,
      y,
      rotation: (((child.rotation + object.rotation) % 360) + 360) % 360,
    };
  });
  return replaceLayer(doc, { ...layer, objects: layer.objects.toSpliced(index, 1, ...children) });
}

function withNewIds(object: AnimObject): AnimObject {
  const copy = { ...object, id: newId() };
  return copy.kind === 'group' ? { ...copy, children: copy.children.map(withNewIds) } : copy;
}

/** Copies 10 px to the right and down, each just above its original. */
export function duplicateObjects(
  doc: AnimationDoc,
  ids: readonly Id[],
): { doc: AnimationDoc; ids: Id[] } {
  let next = doc;
  const made: Id[] = [];
  for (const id of ids) {
    const { layer, index, object } = requireObject(next, id);
    editable(layer);
    const copy = { ...moved(withNewIds(object), 10, 10), name: uniqueName(next, object.name) };
    made.push(copy.id);
    next = replaceLayer(next, { ...layer, objects: layer.objects.toSpliced(index + 1, 0, copy) });
  }
  return { doc: next, ids: made };
}
