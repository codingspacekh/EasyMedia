// M13 / AN7: layers and the objects in them — order, lock, hide, folders, grouping, duplicating.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createRect,
  createStar,
} from '../../../../src/core/animation/factory.ts';
import { centreOf } from '../../../../src/core/animation/geometry.ts';
import {
  addFolder,
  addLayer,
  addObject,
  drawOrder,
  duplicateObjects,
  findObject,
  groupObjects,
  moveLayer,
  moveLayerToFolder,
  moveObjectsToLayer,
  removeFolder,
  removeLayer,
  removeObjects,
  renameLayer,
  reorderObject,
  setLayer,
  ungroup,
  updateObject,
} from '../../../../src/core/animation/layers.ts';
import type { AnimationDoc } from '../../../../src/core/animation/types.ts';

const star = createStar({ x: 128, y: 102, width: 135, height: 135 });
const circle = createEllipse({ x: 0, y: 0, width: 204, height: 204 });
const rect = createRect({ x: 0, y: 0, width: 300, height: 150 });

function twoLayers(): { doc: AnimationDoc; bottom: string; top: string } {
  let doc = createAnimation({ name: 'Task 1' });
  const bottom = doc.layers[0]!.id;
  const added = addLayer(doc, 'blue_oval');
  doc = added.doc;
  doc = addObject(doc, bottom, rect);
  doc = addObject(doc, bottom, star);
  doc = addObject(doc, added.layer.id, circle);
  return { doc, bottom, top: added.layer.id };
}

describe('layers (AN7)', () => {
  it('a new layer goes on top (or above the chosen one) with the next free name', () => {
    const { doc, bottom, top } = twoLayers();
    expect(doc.layers.map((l) => l.id)).toEqual([bottom, top]);
    const { doc: d2, layer } = addLayer(doc, undefined, bottom);
    expect(layer.name).toBe('Layer 3');
    expect(d2.layers.map((l) => l.id)).toEqual([bottom, layer.id, top]);
  });

  it('the top layer draws last (in front), bottom object of a layer first; hidden layers are not drawn', () => {
    const { doc, top } = twoLayers();
    expect(drawOrder(doc).map((d) => d.object.name)).toEqual(['Rectangle', 'Star', 'Ellipse']);
    expect(drawOrder(setLayer(doc, top, { visible: false })).map((d) => d.object.name)).toEqual([
      'Rectangle',
      'Star',
    ]);
  });

  it('layers can be renamed (not to nothing), reordered, and removed — but not the last one', () => {
    const { doc, bottom, top } = twoLayers();
    expect(renameLayer(doc, top, '  green_rectangle ').layers[1]!.name).toBe('green_rectangle');
    expect(() => renameLayer(doc, top, '  ')).toThrow(/name/i);
    expect(moveLayer(doc, top, 0).layers.map((l) => l.id)).toEqual([top, bottom]);
    const one = removeLayer(doc, top);
    expect(one.layers).toHaveLength(1);
    expect(() => removeLayer(one, bottom)).toThrow(/at least one layer/);
  });

  it('a locked layer refuses new objects and edits; a hidden layer refuses edits too', () => {
    const { doc, bottom, top } = twoLayers();
    const locked = setLayer(doc, bottom, { locked: true });
    expect(() => addObject(locked, bottom, createRect({ x: 0, y: 0 }))).toThrow(/locked/);
    expect(() => updateObject(locked, star.id, (o) => ({ ...o, x: 1 }))).toThrow(/locked/);
    expect(() => removeObjects(locked, [star.id])).toThrow(/locked/);
    expect(() => updateObject(setLayer(doc, top, { visible: false }), circle.id, (o) => o)).toThrow(
      /hidden/,
    );
    expect(updateObject(doc, star.id, (o) => ({ ...o, x: 1 })).layers[0]!.objects[1]!.x).toBe(1);
  });

  it('folders hold layers; removing a folder lets its layers out', () => {
    const { doc, bottom, top } = twoLayers();
    const { doc: d2, folder } = addFolder(doc, 'stick_person');
    const d3 = moveLayerToFolder(d2, top, folder.id);
    expect(d3.layers.find((l) => l.id === top)!.folderId).toBe(folder.id);
    expect(d3.layers.find((l) => l.id === bottom)!.folderId).toBeUndefined();
    const d4 = removeFolder(d3, folder.id);
    expect(d4.folders).toEqual([]);
    expect(d4.layers.find((l) => l.id === top)!.folderId).toBeUndefined();
    expect(moveLayerToFolder(d3, top, null).layers[1]!.folderId).toBeUndefined();
  });
});

describe('objects in layers (AN7)', () => {
  it('an object added goes to the front of its layer with a name of its own', () => {
    const { doc, bottom } = twoLayers();
    const d2 = addObject(doc, bottom, createRect({ x: 5, y: 5 }));
    const names = d2.layers[0]!.objects.map((o) => o.name);
    expect(names).toEqual(['Rectangle', 'Star', 'Rectangle 2']);
    expect(addObject(d2, bottom, createRect({ x: 5, y: 5 })).layers[0]!.objects.at(-1)!.name).toBe(
      'Rectangle 3',
    );
  });

  it('findObject gives the object, its layer and its place', () => {
    const { doc, bottom } = twoLayers();
    expect(findObject(doc, star.id)).toMatchObject({ layerId: bottom, index: 1 });
    expect(findObject(doc, 'nope')).toBeNull();
  });

  it('bring forward swaps with the next object only; to front goes to the end; and back', () => {
    const { doc } = twoLayers();
    const names = (d: AnimationDoc) => d.layers[0]!.objects.map((o) => o.name);
    expect(names(reorderObject(doc, rect.id, 'forward'))).toEqual(['Star', 'Rectangle']);
    expect(names(reorderObject(doc, rect.id, 'forward'))).toEqual(['Star', 'Rectangle']);
    expect(names(reorderObject(doc, star.id, 'forward'))).toEqual(['Rectangle', 'Star']);
    expect(names(reorderObject(doc, star.id, 'back'))).toEqual(['Star', 'Rectangle']);
    const d3 = addObject(doc, doc.layers[0]!.id, createRect({ x: 1, y: 1 }));
    expect(names(reorderObject(d3, rect.id, 'front'))).toEqual([
      'Star',
      'Rectangle 2',
      'Rectangle',
    ]);
    expect(names(reorderObject(d3, d3.layers[0]!.objects[2]!.id, 'backmost'))).toEqual([
      'Rectangle 2',
      'Rectangle',
      'Star',
    ]);
  });

  it('objects can move to another layer (to its front) unless it is locked', () => {
    const { doc, top } = twoLayers();
    const d2 = moveObjectsToLayer(doc, [rect.id], top);
    expect(d2.layers[0]!.objects.map((o) => o.name)).toEqual(['Star']);
    expect(d2.layers[1]!.objects.map((o) => o.name)).toEqual(['Ellipse', 'Rectangle']);
    expect(() => moveObjectsToLayer(setLayer(doc, top, { locked: true }), [rect.id], top)).toThrow(
      /locked/,
    );
  });

  it('removeObjects takes them out of their layers', () => {
    const { doc } = twoLayers();
    const d2 = removeObjects(doc, [rect.id, circle.id]);
    expect(drawOrder(d2).map((d) => d.object.name)).toEqual(['Star']);
  });
});

describe('groups (AN13)', () => {
  it('grouping two objects in one layer makes one object enclosing both, in the place of the front one', () => {
    const { doc, bottom } = twoLayers();
    const { doc: d2, group } = groupObjects(doc, [rect.id, star.id]);
    const layer = d2.layers.find((l) => l.id === bottom)!;
    expect(layer.objects.map((o) => o.kind)).toEqual(['group']);
    expect(group).toMatchObject({ x: 0, y: 0, width: 300, height: 237 });
    expect(group.children.map((c) => c.name)).toEqual(['Rectangle', 'Star']);
    expect(group.children[1]).toMatchObject({ x: 128, y: 102 });
  });

  it('objects in different layers cannot be grouped; one object cannot either', () => {
    const { doc } = twoLayers();
    expect(() => groupObjects(doc, [rect.id, circle.id])).toThrow(/same layer/);
    expect(() => groupObjects(doc, [rect.id])).toThrow(/two or more/);
  });

  it('ungrouping puts the children back where they were, even after the group was moved and turned', () => {
    const { doc } = twoLayers();
    const { doc: d2, group } = groupObjects(doc, [rect.id, star.id]);
    const d3 = updateObject(d2, group.id, (g) => ({ ...g, x: 50, y: 60, rotation: 90 }));
    const d4 = ungroup(d3, group.id);
    const back = d4.layers[0]!.objects;
    expect(back.map((o) => o.name)).toEqual(['Rectangle', 'Star']);
    // The group's centre moved from (150, 118.5) to (200, 178.5); the star's centre (195.5, 169.5)
    // turns 90° about it: offset (45.5, 51) becomes (−51, 45.5).
    const c = centreOf(back[1]!);
    expect(c.x).toBeCloseTo(200 - 51, 6);
    expect(c.y).toBeCloseTo(178.5 + 45.5, 6);
    expect(back[1]!.rotation).toBe(90);
    expect(back[1]).toMatchObject({ width: 135, height: 135 });
  });

  it('duplicating puts copies 10 px to the right and down, just above the originals, with new ids and names', () => {
    const { doc } = twoLayers();
    const { doc: d2, ids } = duplicateObjects(doc, [star.id]);
    const objects = d2.layers[0]!.objects;
    expect(objects.map((o) => o.name)).toEqual(['Rectangle', 'Star', 'Star 2']);
    expect(objects[2]).toMatchObject({ x: 138, y: 112, width: 135, points: 5 });
    expect(ids).toEqual([objects[2]!.id]);
    expect(objects[2]!.id).not.toBe(star.id);
  });
});
