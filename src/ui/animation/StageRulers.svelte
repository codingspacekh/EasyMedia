<script lang="ts">
  // AN2: the rulers above and left of the stage, in stage pixels, with the pointer marked; a
  // guide is dragged out of them.
  import type { Stage } from '../../core/animation/types.ts';
  import { animUi } from './animation-ui.svelte.ts';
  import type { Unit } from '../../core/graphics/units.ts';
  import { unitRulerStep } from './stage-geometry.ts';

  let {
    stage,
    zoom,
    padX,
    padY,
    size,
    onguide,
    units = 'px',
    dpi = 96,
  }: {
    stage: Stage;
    zoom: number;
    /** The space left and right of the stage, and above and below it. */
    padX: number;
    padY: number;
    /** The rulers' thickness. */
    size: number;
    /** A guide dragged out: from the top ruler a horizontal one (y), from the left a vertical one (x). */
    onguide: (e: PointerEvent, axis: 'x' | 'y') => void;
    /** G6 (M18): Graphics mode's rulers are in the image's units at its resolution. */
    units?: Unit;
    dpi?: number;
  } = $props();

  const ruler = $derived(unitRulerStep(zoom, units, dpi));
  const minor = $derived(ruler.stepPx / 5);
  /** Each numbered tick: where it is (stage px) and what it says (in the unit). */
  function ticks(length: number): { at: number; label: string }[] {
    const n = Math.floor(length / ruler.stepPx + 1e-9) + 1;
    return Array.from({ length: n }, (_, i) => ({
      at: i * ruler.stepPx,
      label: `${Math.round(i * ruler.step * 10) / 10}`,
    }));
  }
</script>

<div class="corner" style:width="{size}px" style:height="{size}px"></div>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  class="ruler top"
  style:left="{size}px"
  width={stage.width * zoom + 2 * padX}
  height={size}
  aria-label="Horizontal ruler"
  onpointerdown={(e) => onguide(e, 'y')}
>
  {#each ticks(stage.width) as { at: t, label } (t)}
    <line x1={padX + t * zoom} y1={size - 8} x2={padX + t * zoom} y2={size} />
    <text x={padX + t * zoom + 2} y={9}>{label}</text>
    {#if minor * zoom >= 5}
      {#each [1, 2, 3, 4] as m (m)}
        <line
          x1={padX + (t + m * minor) * zoom}
          y1={size - 4}
          x2={padX + (t + m * minor) * zoom}
          y2={size}
        />
      {/each}
    {/if}
  {/each}
  {#if animUi.pointer}
    <line
      class="mark"
      x1={padX + animUi.pointer.x * zoom}
      y1={0}
      x2={padX + animUi.pointer.x * zoom}
      y2={size}
    />
  {/if}
</svg>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<svg
  class="ruler left"
  style:top="{size}px"
  width={size}
  height={stage.height * zoom + 2 * padY}
  aria-label="Vertical ruler"
  onpointerdown={(e) => onguide(e, 'x')}
>
  {#each ticks(stage.height) as { at: t, label } (t)}
    <line x1={size - 8} y1={padY + t * zoom} x2={size} y2={padY + t * zoom} />
    <text x={-(padY + t * zoom) - 2} y={9} transform="rotate(-90)" text-anchor="end">{label}</text>
    {#if minor * zoom >= 5}
      {#each [1, 2, 3, 4] as m (m)}
        <line
          x1={size - 4}
          y1={padY + (t + m * minor) * zoom}
          x2={size}
          y2={padY + (t + m * minor) * zoom}
        />
      {/each}
    {/if}
  {/each}
  {#if animUi.pointer}
    <line
      class="mark"
      x1={0}
      y1={padY + animUi.pointer.y * zoom}
      x2={size}
      y2={padY + animUi.pointer.y * zoom}
    />
  {/if}
</svg>

<style>
  .corner {
    position: absolute;
    left: 0;
    top: 0;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    z-index: 2;
  }
  .ruler {
    position: absolute;
    background: var(--bg-1);
    z-index: 1;
    cursor: crosshair;
    user-select: none;
  }
  .ruler.top {
    top: 0;
    border-bottom: 1px solid var(--line);
  }
  .ruler.left {
    left: 0;
    border-right: 1px solid var(--line);
  }
  .ruler line {
    stroke: var(--tx-3);
    stroke-width: 1;
  }
  .ruler line.mark {
    stroke: var(--accent);
  }
  .ruler text {
    fill: var(--tx-3);
    font-size: 9px;
    font-family: var(--mono);
  }
</style>
