<svelte:options namespace="svg" />

<script lang="ts">
  // AN2: the guides on the stage (inside its overlay); one being dragged follows the pointer,
  // and a new one dragged out of a ruler shows dashed.
  import type { AnimationDoc, Stage } from '../../core/animation/types.ts';

  let {
    guides,
    stage,
    dragging,
    onguide,
  }: {
    guides: AnimationDoc['guides'];
    stage: Stage;
    /** The guide being dragged (`index` null: a new one). */
    dragging: { axis: 'x' | 'y'; index: number | null; value: number } | null;
    onguide: (e: PointerEvent, axis: 'x' | 'y', index: number) => void;
  } = $props();

  /** Where guide `i` on `axis` is drawn: where it is being dragged to, or where it is. */
  const at = (axis: 'x' | 'y', i: number, value: number) =>
    dragging && dragging.axis === axis && dragging.index === i ? dragging.value : value;
</script>

{#each guides.x as gx, i (i)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <line
    class="guide"
    x1={at('x', i, gx)}
    y1={0}
    x2={at('x', i, gx)}
    y2={stage.height}
    vector-effect="non-scaling-stroke"
    onpointerdown={(e) => onguide(e, 'x', i)}
  />
{/each}
{#each guides.y as gy, i (i)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <line
    class="guide"
    x1={0}
    y1={at('y', i, gy)}
    x2={stage.width}
    y2={at('y', i, gy)}
    vector-effect="non-scaling-stroke"
    onpointerdown={(e) => onguide(e, 'y', i)}
  />
{/each}
{#if dragging && dragging.index === null}
  {#if dragging.axis === 'x'}
    <line
      class="guide new"
      x1={dragging.value}
      y1={0}
      x2={dragging.value}
      y2={stage.height}
      vector-effect="non-scaling-stroke"
    />
  {:else}
    <line
      class="guide new"
      x1={0}
      y1={dragging.value}
      x2={stage.width}
      y2={dragging.value}
      vector-effect="non-scaling-stroke"
    />
  {/if}
{/if}

<style>
  .guide {
    stroke: #28c2d1;
    stroke-width: 1;
    cursor: move;
  }
  .guide.new {
    stroke-dasharray: 4 3;
  }
</style>
