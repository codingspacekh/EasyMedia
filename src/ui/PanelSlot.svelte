<script lang="ts">
  // N16: a panel of an editor, at the size the student chose. Its inner edge is a splitter: drag
  // it, or focus it and use the arrow keys (Shift: bigger steps; Home / End: smallest / largest);
  // double-click puts the default size back. The button on the edge hides the panel; a hidden
  // panel leaves a thin strip that shows it again. Side panels set their width; a bottom panel
  // gets its size as --panel-size (the timeline decides which part of it that is).
  import type { Snippet } from 'svelte';
  import { PANELS, isShown, sizeOf, type PanelId } from '../app/layout.ts';
  import type { LayoutApp } from '../app/layout.ts';
  import Icon from './Icon.svelte';

  let { layout, id, children }: { layout: LayoutApp; id: PanelId; children: Snippet } = $props();
  const store = $derived(layout.store);
  const panel = $derived(PANELS[id]);
  const shown = $derived(isShown($store, id));
  const size = $derived(sizeOf($store, id));
  const side = $derived(panel.edge !== 'bottom');
  /** Growing the panel: the pointer moves right for a left panel, left for a right one, up for a bottom one. */
  const grow = $derived(panel.edge === 'left' ? 1 : -1);

  const STEP = 16;
  const BIG_STEP = 64;
  /** While dragging, the size follows the pointer; it is saved when the pointer is let go. */
  let dragging = $state<number | null>(null);
  const shownSize = $derived(dragging ?? size);
  const clampSize = (n: number) => Math.round(Math.min(panel.max, Math.max(panel.min, n)));

  function onpointerdown(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const start = side ? e.clientX : e.clientY;
    const from = size;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const move = (m: PointerEvent) => {
      dragging = clampSize(from + grow * ((side ? m.clientX : m.clientY) - start));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (dragging !== null) void layout.resize(id, dragging);
      dragging = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onkeydown(e: KeyboardEvent): void {
    const keys: Record<string, number> = side
      ? { ArrowLeft: -grow, ArrowRight: grow }
      : { ArrowUp: 1, ArrowDown: -1 };
    if (e.key in keys) {
      e.preventDefault();
      void layout.resize(id, size + keys[e.key]! * (e.shiftKey ? BIG_STEP : STEP));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      void layout.resize(id, e.key === 'Home' ? panel.min : panel.max);
    }
  }
</script>

{#snippet edge()}
  <!-- A focusable separator with a value is the WAI-ARIA window splitter: it is interactive. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="splitter"
    role="separator"
    tabindex="0"
    aria-orientation={side ? 'vertical' : 'horizontal'}
    aria-label="Resize the {panel.label}"
    aria-valuenow={shownSize}
    aria-valuemin={panel.min}
    aria-valuemax={panel.max}
    title="Drag to resize the {panel.label}; double-click for its usual size"
    {onpointerdown}
    {onkeydown}
    ondblclick={() => void layout.resize(id, panel.size)}
  >
    <button
      type="button"
      class="hide"
      aria-label="Hide the {panel.label}"
      title="Hide the {panel.label} (View menu to show it again)"
      onpointerdown={(e) => e.stopPropagation()}
      onclick={() => void layout.toggle(id)}
      ><span class="chev {panel.edge}"><Icon name="chevron" size={12} /></span></button
    >
  </div>
{/snippet}

{#if shown}
  <div
    class="slot {panel.edge}"
    class:dragging={dragging !== null}
    style:width={side ? `${shownSize}px` : null}
    style:min-width={side ? `${panel.min}px` : null}
    style:--panel-size="{shownSize}px"
  >
    {#if panel.edge !== 'left'}{@render edge()}{/if}
    <div class="content">{@render children()}</div>
    {#if panel.edge === 'left'}{@render edge()}{/if}
  </div>
{:else}
  <button
    type="button"
    class="show {panel.edge}"
    aria-label="Show the {panel.label}"
    title="Show the {panel.label}"
    onclick={() => void layout.toggle(id)}
  >
    <span class="chev {panel.edge} back"><Icon name="chevron" size={12} /></span>
    <span class="label">{panel.label}</span>
  </button>
{/if}

<style>
  .slot {
    display: flex;
    min-height: 0;
    position: relative;
  }
  .slot.left,
  .slot.right {
    flex: 0 1 auto;
    flex-direction: row;
  }
  .slot.bottom {
    flex: none;
    flex-direction: column;
    min-width: 0;
  }
  .content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .splitter {
    flex: none;
    position: relative;
    background: var(--line);
    z-index: 4;
    touch-action: none;
  }
  .left > .splitter,
  .right > .splitter {
    width: 4px;
    cursor: col-resize;
  }
  .bottom > .splitter {
    height: 4px;
    cursor: row-resize;
  }
  .splitter:hover,
  .splitter:focus-visible,
  .dragging > .splitter {
    background: var(--accent);
    outline: none;
  }
  .hide {
    position: absolute;
    width: 18px;
    height: 18px;
    padding: 0;
    border-radius: 9px;
    display: grid;
    place-items: center;
    background: var(--bg-2);
    border: 1px solid var(--line-strong);
    color: var(--tx-2);
    opacity: 0;
    transition: opacity 0.12s;
  }
  .left > .splitter .hide,
  .right > .splitter .hide {
    top: 50%;
    left: -7px;
    margin-top: -9px;
  }
  .bottom > .splitter .hide {
    left: 50%;
    top: -7px;
    margin-left: -9px;
  }
  .splitter:hover .hide,
  .splitter:focus-within .hide,
  .hide:focus-visible {
    opacity: 1;
  }
  /* The chevron icon points down: turned to point the way the panel goes when hidden. */
  .chev {
    display: inline-flex;
  }
  .chev.left {
    transform: rotate(90deg);
  }
  .chev.right {
    transform: rotate(-90deg);
  }
  .chev.bottom {
    transform: rotate(0deg);
  }
  .chev.back.left {
    transform: rotate(-90deg);
  }
  .chev.back.right {
    transform: rotate(90deg);
  }
  .chev.back.bottom {
    transform: rotate(180deg);
  }
  .show {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: var(--bg-1);
    color: var(--tx-2);
    font-size: 11px;
  }
  .show:hover {
    background: var(--bg-2);
    color: var(--tx-1);
  }
  .show.left,
  .show.right {
    width: 20px;
    flex-direction: column;
    border-left: 1px solid var(--line);
    border-right: 1px solid var(--line);
  }
  .show.left .label,
  .show.right .label {
    writing-mode: vertical-rl;
  }
  .show.bottom {
    height: 20px;
    width: 100%;
    border-top: 1px solid var(--line);
  }
</style>
