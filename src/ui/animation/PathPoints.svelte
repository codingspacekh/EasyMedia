<svelte:options namespace="svg" />

<script lang="ts">
  // AN3: a selected pen path's points and curve handles (inside the stage's overlay), shown
  // instead of the box's handles: drag a point, Alt-drag for a curve, Alt-click for a corner,
  // double-click to remove; drag a curve handle (Alt: that side alone).
  import { anchorsOnStage } from '../../core/animation/pen.ts';
  import type { PathObject } from '../../core/animation/types.ts';

  let {
    path,
    size,
    onanchor,
    oncurve,
    onremove,
  }: {
    /** The path as it looks now (during a drag too). */
    path: PathObject;
    /** A handle's size, in stage pixels (points are a little smaller). */
    size: number;
    onanchor: (e: PointerEvent, index: number) => void;
    oncurve: (e: PointerEvent, index: number, which: 'in' | 'out') => void;
    onremove: (e: MouseEvent, index: number) => void;
  } = $props();
</script>

{#each anchorsOnStage(path) as a, i (i)}
  {#each [['in', a.in], ['out', a.out]] as const as [which, h] (which)}
    {#if h}
      <line class="curve" x1={a.x} y1={a.y} x2={h.x} y2={h.y} vector-effect="non-scaling-stroke" />
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <circle
        class="handle curve-handle"
        cx={h.x}
        cy={h.y}
        r={size / 2.5}
        vector-effect="non-scaling-stroke"
        aria-label="Curve handle"
        onpointerdown={(e) => oncurve(e, i, which)}
      />
    {/if}
  {/each}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <rect
    class="handle anchor"
    x={a.x - size / 2.5}
    y={a.y - size / 2.5}
    width={(2 * size) / 2.5}
    height={(2 * size) / 2.5}
    vector-effect="non-scaling-stroke"
    aria-label="Point {i + 1}"
    onpointerdown={(e) => onanchor(e, i)}
    ondblclick={(e) => onremove(e, i)}
  >
    <title
      >Drag to move · Alt-drag for a curve · Alt-click for a corner · double-click to remove</title
    >
  </rect>
{/each}

<style>
  .handle {
    fill: #fff;
    stroke: var(--accent);
    stroke-width: 1;
  }
  .handle.anchor {
    fill: var(--accent);
    stroke: #fff;
    cursor: move;
  }
  .handle.curve-handle {
    cursor: crosshair;
  }
  .curve {
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 3 2;
  }
</style>
