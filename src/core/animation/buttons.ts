// AN18: buttons that control the animation (workbook Task 4: Pause and Continue; also Restart and
// Go to frame). A click on the stage finds the object on top at that point, as a browser does:
// a button covered by a picture or shape in front of it, faded out, or on a hidden layer cannot
// be clicked. Pure: the HTML player and Test (in the app) both ask here.
import { hitTest, toLocal, type Point } from './geometry.ts';
import { stateAt } from './state.ts';
import type { AnimObject, AnimationDoc, ButtonAction, ButtonObject } from './types.ts';

export interface ButtonActionInfo {
  id: ButtonAction;
  label: string;
  /** What it does, for the Properties panel. */
  hint: string;
}

export const BUTTON_ACTIONS: readonly ButtonActionInfo[] = [
  { id: 'pause', label: 'Pause', hint: 'Stops the animation on the frame shown' },
  { id: 'continue', label: 'Continue', hint: 'Plays on from the frame where it stopped' },
  { id: 'restart', label: 'Restart', hint: 'Plays the animation again from the start' },
  { id: 'goto', label: 'Go to frame', hint: 'Jumps to a frame and goes on as before' },
];

/** The object on top at a point among these (a group's own objects inside it), or null. */
function topAt(objects: readonly AnimObject[], p: Point): AnimObject | null {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i]!;
    if (o.opacity <= 0) continue;
    if (o.kind === 'group') {
      const inside = topAt(o.children, toLocal(o, p));
      if (inside) return inside;
      continue;
    }
    if (hitTest(o, p)) return o;
  }
  return null;
}

/** The button clicked at a stage point at a frame, or null when the click is not on one. */
export function buttonAt(doc: AnimationDoc, frame: number, p: Point): ButtonObject | null {
  const { layers } = stateAt(doc, frame);
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]!;
    // A mask is not drawn: it cannot be clicked, nor hide what is under it.
    if (!layer.visible || layer.mask) continue;
    const top = topAt(layer.objects, p);
    if (top) return top.kind === 'button' ? top : null;
  }
  return null;
}
