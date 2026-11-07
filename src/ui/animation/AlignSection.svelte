<script lang="ts">
  // G5 (M18): Align and Distribute in the Properties panel, in Graphics and Animation modes:
  // edges and centres lined up with the selection, the first object chosen, or the canvas (one
  // object is lined up with the canvas), and three or more spaced evenly.
  import type { App } from '../../app/app.ts';
  import type { AlignEdge, AlignTo, DistributeBy } from '../../core/graphics/align.ts';
  import Icon, { type IconName } from '../Icon.svelte';
  import Why from '../Why.svelte';
  import { editorOf } from './editor.ts';

  let { app, count }: { app: App; count: number } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);

  let to: AlignTo = $state('selection');
  let by: DistributeBy = $state('centres');
  const where = $derived(editor.still ? 'canvas' : 'stage');

  const EDGES: [AlignEdge, string, IconName][] = [
    ['left', 'Align left edges', 'alignLeft'],
    ['centre', 'Align centres (across)', 'alignCentre'],
    ['right', 'Align right edges', 'alignRight'],
    ['top', 'Align top edges', 'alignTop'],
    ['middle', 'Align middles (down)', 'alignMiddle'],
    ['bottom', 'Align bottom edges', 'alignBottom'],
  ];
</script>

<div class="sec">
  <h4>Align <span class="syl">19.1 alignment and distribution</span></h4>
  <div class="cells six" role="group" aria-label="Align">
    {#each EDGES as [edge, label, icon] (edge)}
      <button
        class="sm"
        aria-label={label}
        title={count === 1 ? `${label} with the ${where}` : label}
        onclick={() => anim.align(edge, to)}><Icon name={icon} size={14} /></button
      >
    {/each}
  </div>
  <div class="field">
    <label for="align-to">Relative to</label>
    <select id="align-to" bind:value={to} disabled={count === 1}>
      <option value="selection">The selected objects</option>
      <option value="first">The first one selected</option>
      <option value="canvas">The {where}</option>
    </select>
  </div>
  {#if count === 1}
    <p class="hint">One object lines up with the {where}.</p>
  {/if}
  <div class="line">
    <span class="cap">Distribute</span>
    <div class="cells two-up" role="group" aria-label="Distribute">
      <button
        class="sm"
        aria-label="Distribute across"
        title="Space three or more evenly from left to right"
        disabled={count < 3}
        onclick={() => anim.distribute('horizontal', by)}
        ><Icon name="distributeH" size={14} /> Across</button
      >
      <button
        class="sm"
        aria-label="Distribute down"
        title="Space three or more evenly from top to bottom"
        disabled={count < 3}
        onclick={() => anim.distribute('vertical', by)}
        ><Icon name="distributeV" size={14} /> Down</button
      >
    </div>
  </div>
  <div class="field">
    <label for="distribute-by">Space</label>
    <select id="distribute-by" bind:value={by} disabled={count < 3}>
      <option value="centres">Centres the same distance apart</option>
      <option value="gaps">The same gap between them</option>
    </select>
  </div>
  <Why tool="graphicAlign" />
</div>

<style>
  /* The Properties panel's own look (its styles are its own: Svelte scopes them). */
  .sec {
    padding: 8px 0 10px;
    border-bottom: 1px solid var(--line);
  }
  h4 {
    margin: 0 0 8px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--tx-2);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .syl {
    font-size: 10px;
    font-weight: 500;
    color: var(--tx-3);
  }
  .field,
  .line {
    display: grid;
    grid-template-columns: 58px 1fr;
    align-items: center;
    gap: 3px 6px;
    margin-bottom: 6px;
    min-width: 0;
  }
  .field label,
  .cap {
    color: var(--tx-2);
    font-size: 12px;
  }
  select {
    width: 100%;
  }
  .hint {
    margin: 0 0 6px;
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .cells {
    display: grid;
    gap: 4px;
    min-width: 0;
    margin-bottom: 6px;
  }
  .cells.six {
    grid-template-columns: repeat(6, 1fr);
  }
  .cells.two-up {
    grid-template-columns: repeat(2, 1fr);
    margin-bottom: 0;
  }
  .cells button {
    justify-content: center;
    min-width: 0;
    padding-left: 4px;
    padding-right: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
