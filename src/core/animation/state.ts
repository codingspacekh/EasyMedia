// AN9, AN13: the document at a frame. Every object gets its tweened values; a group's children
// are placed by the group's position, turn and size while keeping their own tweens. The whole
// chain is pure, so a test can ask for frame 36 and read off the numbers.
import { EditError } from '../model/errors.ts';
import { toStage, type Point } from './geometry.ts';
import { objectsShown } from './frames.ts';
import { objectAt } from './tween.ts';
import type { AnimObject, AnimationDoc, Id } from './types.ts';

export function stateAt(doc: AnimationDoc, frame: number): AnimationDoc {
  return {
    ...doc,
    layers: doc.layers.map((layer) => ({
      ...layer,
      // AN14: a frame-by-frame layer shows only the drawing of the keyframe at or before it.
      objects: objectsShown(layer, frame).map((o) => objectAt(o, frame)),
    })),
  };
}

/** Where an object is on the stage at a frame, with every group it is in applied. */
export interface Placement {
  /** The top-left corner, on the stage. */
  x: number;
  y: number;
  centre: Point;
  /** Its own turn plus its groups' turns, in degrees. */
  rotation: number;
}

/** The chain of objects from a top-level object down to the one with the id, or null. */
function chainTo(objects: readonly AnimObject[], id: Id): AnimObject[] | null {
  for (const o of objects) {
    if (o.id === id) return [o];
    if (o.kind === 'group') {
      const below = chainTo(o.children, id);
      if (below) return [o, ...below];
    }
  }
  return null;
}

export function placementOf(doc: AnimationDoc, id: Id, frame: number): Placement {
  let chain: AnimObject[] | null = null;
  for (const layer of stateAt(doc, frame).layers) {
    chain = chainTo(layer.objects, id);
    if (chain) break;
  }
  if (!chain) throw new EditError('That object no longer exists.');
  // Walk up: the centre as drawn in its group's box (turned about its own pivot, AN27), then
  // placed by each group in turn: the children's box has its top-left corner at the group's.
  const last = chain[chain.length - 1]!;
  let centre: Point = toStage(last, { x: last.width / 2, y: last.height / 2 });
  for (const group of chain.slice(0, -1).reverse()) centre = toStage(group, centre);
  const rotation = chain.reduce((sum, o) => sum + o.rotation, 0);
  return {
    x: centre.x - last.width / 2,
    y: centre.y - last.height / 2,
    centre,
    rotation,
  };
}
