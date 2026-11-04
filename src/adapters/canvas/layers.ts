// Group opacity on a browser canvas (StageCanvas.withLayer): a see-through group's parts are
// drawn at full strength on a second canvas of the same size and transform, which is then put
// down at the group's opacity, so where the parts overlap the group is no darker. Chromium has
// no canvas layers (beginLayer) yet. One layer per depth of groups, kept for the next frame.
import type { StageCanvas } from '../../core/animation/draw.ts';

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** The canvas with withLayer added; unchanged where there is no OffscreenCanvas. */
export function withLayers<C extends object>(ctx: C): C {
  return addLayers(ctx as unknown as Context2D, 0, []) as unknown as C;
}

function addLayers<C extends Context2D>(ctx: C, depth: number, pool: OffscreenCanvas[]): C {
  if (typeof OffscreenCanvas === 'undefined' || 'withLayer' in ctx) return ctx;
  const withLayer = (alpha: number, draw: (layer: StageCanvas) => void) => {
    const { width, height } = ctx.canvas;
    let canvas = pool[depth];
    if (!canvas || canvas.width !== width || canvas.height !== height)
      canvas = pool[depth] = new OffscreenCanvas(width, height);
    const layer = canvas.getContext('2d')!;
    layer.reset();
    layer.setTransform(ctx.getTransform());
    draw(addLayers(layer, depth + 1, pool) as unknown as StageCanvas);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
  };
  return Object.assign(ctx, { withLayer });
}
