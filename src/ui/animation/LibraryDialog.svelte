<script lang="ts">
  // The library (AN19): cartoons, school, maths, physics and chemistry, biology, computers and
  // IT, icons and symbols, and backgrounds, drawn as the app's own vector shapes. Search, choose
  // a category, click one to place it (a background goes on a layer of its own at the bottom).
  // Each thumbnail is drawn by the same code as the stage.
  import Dialog from '../Dialog.svelte';
  import { editorOf } from './editor.ts';
  import type { App } from '../../app/app.ts';
  import { drawObject, type StageCanvas } from '../../core/animation/draw.ts';
  import { withLayers } from '../../adapters/canvas/layers.ts';
  import {
    LIBRARY_CATEGORIES,
    buildItem,
    searchLibrary,
    type Category,
    type LibraryItem,
  } from '../../core/animation/library/index.ts';
  import Why from '../Why.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);

  let query = $state('');
  let category = $state<Category>('cartoons');
  let error: string | null = $state(null);
  const items = $derived(searchLibrary(query, query.trim() ? undefined : category));

  const THUMB = 84;

  /** Draws the item into its thumbnail, scaled to fit. */
  function thumbnail(canvas: HTMLCanvasElement, item: LibraryItem) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    const built = buildItem(item);
    const scale = Math.min((THUMB - 8) / built.width, (THUMB - 8) / built.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    const placed = {
      ...built,
      x: (THUMB / scale - built.width) / 2,
      y: (THUMB / scale - built.height) / 2,
    };
    drawObject(withLayers(ctx) as unknown as StageCanvas, placed);
  }

  function place(item: LibraryItem): void {
    error = anim.addFromLibrary(item.id);
    if (!error) onclose();
  }
</script>

<Dialog label="Library" syllabus="20.1 creating vector objects" width={700} {onclose}>
  <input
    type="search"
    placeholder="Search: car, skeleton, circuit, logic gate…"
    aria-label="Search the library"
    bind:value={query}
  />
  <!-- The categories down the left, so there is room for more of them; the pictures beside. -->
  <div class="body">
    <div class="cats" role="tablist" aria-label="Categories" aria-orientation="vertical">
      {#each LIBRARY_CATEGORIES as c (c.id)}
        <button
          role="tab"
          aria-selected={!query.trim() && category === c.id}
          onclick={() => {
            category = c.id;
            query = '';
          }}>{c.label}</button
        >
      {/each}
    </div>
    <div class="grid" role="group" aria-label="Library items">
      {#each items as item (item.id)}
        <button
          class="item"
          aria-label="Add {item.name}"
          title={item.category === 'backgrounds'
            ? `Add ${item.name} behind everything, on a layer of its own`
            : `Add ${item.name} to the middle of the stage`}
          onclick={() => place(item)}
        >
          <canvas
            width={THUMB}
            height={THUMB}
            aria-hidden="true"
            {@attach (c) => thumbnail(c as HTMLCanvasElement, item)}
          ></canvas>
          <span>{item.name}</span>
        </button>
      {:else}
        <p class="none">Nothing found for “{query}”.</p>
      {/each}
    </div>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <p class="hint">
    Every item is made of shapes grouped together: select it and Ungroup, or open the group, to
    recolour or animate a part on its own.
  </p>
  <Why tool="animLibrary" />
  {#snippet buttons()}<button onclick={onclose}>Close</button>{/snippet}
</Dialog>

<style>
  .body {
    display: flex;
    gap: 10px;
    min-height: 0;
  }
  .cats {
    flex: none;
    width: 150px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cats button {
    justify-content: flex-start;
    text-align: left;
    padding: 6px 10px;
    font-size: 12.5px;
    background: transparent;
    border-color: transparent;
    color: var(--tx-2);
  }
  .cats button:hover {
    background: var(--bg-2);
    color: var(--tx-1);
  }
  .cats button[aria-selected='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--tx-1);
    font-weight: 600;
  }
  .grid {
    flex: 1;
    min-width: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
    /* One height for every category and search, so the box does not jump: only the pictures
       scroll. Shorter in a small window, so the box still fits (1100 × 700). */
    height: min(420px, calc(100vh - 330px));
    align-content: start;
    overflow: auto;
    overscroll-behavior: contain;
    padding: 2px;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 4px;
    height: auto;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: 8px;
    font-size: 12px;
    color: var(--tx-1);
  }
  .item:hover,
  .item:focus-visible {
    border-color: var(--accent);
  }
  canvas {
    width: 84px;
    height: 84px;
    border-radius: 4px;
    /* Blue-grey, so white items (a cloud, a speech bubble) still show. */
    background: repeating-conic-gradient(#d5dfea 0 25%, #e6edf5 0 50%) 0 0 / 12px 12px;
  }
  .none,
  .hint {
    margin: 0;
    font-size: 12px;
    color: var(--tx-3);
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--danger);
  }
</style>
