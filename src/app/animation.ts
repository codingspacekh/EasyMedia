// Animation mode's use cases (M13–M16b, AN1–AN20): its own document, history, file and selection.
// The UI only calls these and shows the store; errors become a message (or a reason a field
// shows). Each area is a module in ./animation/ sharing one context (the store, running commands
// as undo steps, the player); this file puts them together. A new feature is a new module, or
// one more action in the module of its area.
import { createAnimationContext } from './animation/context.ts';
import { documentActions } from './animation/document.ts';
import { drawingActions } from './animation/drawing.ts';
import { exportActions } from './animation/exporting.ts';
import { fileActions } from './animation/files.ts';
import { graphicActions } from './animation/graphic.ts';
import { pictureActions } from './animation/pictures.ts';
import { soundActions } from './animation/sounds.ts';
import type { AnimationDeps } from './animation/state.ts';
import { timelineActions } from './animation/timeline.ts';

export {
  animationTitle,
  isAnimationDirty,
  type AnimationDeps,
  type AnimationExporting,
  type AnimationState,
  type Loop,
  type ShapeKind,
  type Tool,
} from './animation/state.ts';
export { TRACE_MAX_SIDE, TRACE_PREVIEW_SIDE } from './animation/pictures.ts';
export { ANIMATION_KIND, GRAPHIC_KIND, type EditorKind } from './animation/kind.ts';

export function createAnimationApp(deps: AnimationDeps) {
  const ctx = createAnimationContext(deps);
  const { stopAutosave, ...files } = fileActions(ctx);
  return {
    store: ctx.store,
    ...files,
    ...exportActions(ctx),
    ...pictureActions(ctx),
    ...soundActions(ctx),
    ...drawingActions(ctx),
    ...timelineActions(ctx),
    ...documentActions(ctx),
    ...graphicActions(ctx, files.startWith),
    /** M18: an animation's app, or Graphics mode's. */
    kind: ctx.kind,
    dispose(): void {
      ctx.pause();
      stopAutosave();
    },
  };
}

export type AnimationApp = ReturnType<typeof createAnimationApp>;
