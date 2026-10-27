// AN9, AN13: the document at a frame. Every object gets its tweened values; a group's children
// are placed by the group's position, turn and size while keeping their own tweens. The whole
// chain is pure, so a test can ask for frame 36 and read off the numbers.
import { EditError } from '../model/errors.ts';
import { centreOf, type Point } from './geometry.ts';
import { objectAt } from './tween.ts';
import type { AnimObject, AnimationDoc, Id } from './types.ts';

export function stateAt(doc: AnimationDoc, frame: number): AnimationDoc {
  return {
    ...doc,
    layers: doc.layers.map((layer) => ({
      ...layer,
      objects: layer.objects.map((o) => objectAt(o, frame)),
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

const turn = (p: Point, deg: number): Point => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

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
  // Walk down: each group places its child's centre relative to its own centre, turned.
  let origin: Point = { x: 0, y: 0 };
  let rotation = 0;
  let centre: Point = { x: 0, y: 0 };
  for (const o of chain) {
    const local = centreOf(o);
    const placed = turn({ x: local.x - origin.x, y: local.y - origin.y }, rotation);
    centre = { x: centre.x + placed.x, y: centre.y + placed.y };
    rotation += o.rotation;
    // The children's box has its top-left corner at the group's top-left corner.
    origin = { x: o.width / 2, y: o.height / 2 };
  }
  const last = chain[chain.length - 1]!;
  return {
    x: centre.x - last.width / 2,
    y: centre.y - last.height / 2,
    centre,
    rotation,
  };
}
