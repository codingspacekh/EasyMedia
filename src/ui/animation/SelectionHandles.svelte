<svelte:options namespace="svg" />

<script lang="ts">
  // AN6: the handles of one selected object (inside the stage's overlay): a knob above it to
  // rotate, and eight squares to resize. AN27: a dot with a cross at the point it turns about,
  // dragged to move the point and double-clicked to put it back in the centre.
  import { pivotOnStage, toStage, type Handle } from '../../core/animation/geometry.ts';
  import type { AnimObject } from '../../core/animation/types.ts';
  import { handlePoints } from './stage-geometry.ts';

  let {
    object,
    zoom,
    size,
    onrotate,
    onresize,
    onpivot,
    oncentre,
  }: {
    /** The object as it looks now (during a drag too). */
    object: AnimObject;
    zoom: number;
    /** A handle's size, in stage pixels. */
    size: number;
    onrotate: (e: PointerEvent) => void;
    onresize: (e: PointerEvent, handle: Handle) => void;
    onpivot: (e: PointerEvent) => void;
    oncentre: (e: MouseEvent) => void;
  } = $props();

  /** Below this size on the screen the dot would cover the object: its point is typed instead. */
  const SMALLEST = 32;
  const pivot = $derived(pivotOnStage(object));
  const showPivot = $derived(Math.max(object.width, object.height) * zoom >= SMALLEST);

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
{#if showPivot}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <g class="pivot" aria-label="Turn about point" onpointerdown={onpivot} ondblclick={oncentre}>
    <title>The point it turns about: drag to move it, double-click to centre it</title>
    <circle cx={pivot.x} cy={pivot.y} r={size * 0.6} vector-effect="non-scaling-stroke" />
    <line
      x1={pivot.x - size}
      y1={pivot.y}
      x2={pivot.x + size}
      y2={pivot.y}
      vector-effect="non-scaling-stroke"
    />
    <line
      x1={pivot.x}
      y1={pivot.y - size}
      x2={pivot.x}
      y2={pivot.y + size}
      vector-effect="non-scaling-stroke"
    />
  </g>
{/if}

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
  .pivot {
    cursor: move;
  }
  .pivot circle {
    fill: rgba(255, 255, 255, 0.7);
    stroke: var(--accent);
    stroke-width: 1.5;
  }
  .pivot line {
    stroke: var(--accent);
    stroke-width: 1;
  }
</style>
