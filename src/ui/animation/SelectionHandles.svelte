<svelte:options namespace="svg" />

<script lang="ts">
  // AN6: the handles of one selected object (inside the stage's overlay): a knob above it to
  // rotate, and eight squares to resize.
  import { toStage, type Handle } from '../../core/animation/geometry.ts';
  import type { AnimObject } from '../../core/animation/types.ts';
  import { handlePoints } from './stage-geometry.ts';

  let {
    object,
    zoom,
    size,
    onrotate,
    onresize,
  }: {
    /** The object as it looks now (during a drag too). */
    object: AnimObject;
    zoom: number;
    /** A handle's size, in stage pixels. */
    size: number;
    onrotate: (e: PointerEvent) => void;
    onresize: (e: PointerEvent, handle: Handle) => void;
  } = $props();

  const top = $derived(toStage(object, { x: object.width / 2, y: 0 }));
  const knob = $derived(toStage(object, { x: object.width / 2, y: -22 / zoom }));
</script>

<line
  class="sel"
  x1={top.x}
  y1={top.y}
  x2={knob.x}
  y2={knob.y}
  vector-effect="non-scaling-stroke"
/>
<!-- svelte-ignore a11y_no_static_element_interactions -->
<circle
  class="handle rotate"
  cx={knob.x}
  cy={knob.y}
  r={size / 2}
  vector-effect="non-scaling-stroke"
  aria-label="Rotate"
  onpointerdown={onrotate}
/>
{#each handlePoints(object) as [handle, p] (handle)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <rect
    class="handle"
    x={p.x - size / 2}
    y={p.y - size / 2}
    width={size}
    height={size}
    vector-effect="non-scaling-stroke"
    style:cursor="{handle}-resize"
    aria-label="Resize {handle}"
    onpointerdown={(e) => onresize(e, handle)}
  />
{/each}

<style>
  .sel {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1;
  }
  .handle {
    fill: #fff;
    stroke: var(--accent);
    stroke-width: 1;
  }
  .handle.rotate {
    cursor: grab;
  }
</style>
