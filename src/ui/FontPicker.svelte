<script lang="ts">
  // X2 font chooser: the bundled fonts in groups, each name written in its own letters (a
  // drop-down list cannot show fonts on every computer). The list is placed on the window, not in
  // the panel, so the panel neither cuts it off nor scrolls to make room (issues/video-1.png):
  // under its button, or above it when there is more room there. The wheel over the list scrolls
  // only the list; the wheel anywhere else closes it.
  import { FONT_GROUPS, FONTS } from '../core/text/fonts.ts';
  import Icon from './Icon.svelte';

  let { value, onchange }: { value: string; onchange: (font: string) => void } = $props();

  const WIDTH = 260;
  const TALLEST = 380;
  const MARGIN = 8;

  let open = $state(false);
  let root: HTMLElement | undefined = $state();
  let list: HTMLElement | undefined = $state();
  let place = $state({ left: 0, top: 0, bottom: 0, maxHeight: TALLEST, up: false });
  /** Where the button was when the list was placed under (or over) it. */
  let at = { x: 0, y: 0 };

  function toggle(): void {
    if (!open && root) {
      const r = root.getBoundingClientRect();
      at = { x: r.left, y: r.top };
      const below = innerHeight - r.bottom - MARGIN;
      const above = r.top - MARGIN;
      const up = below < Math.min(TALLEST, 200) && above > below;
      place = {
        left: Math.max(MARGIN, Math.min(r.left, innerWidth - WIDTH - MARGIN)),
        top: r.bottom + 4,
        bottom: innerHeight - r.top + 4,
        maxHeight: Math.min(TALLEST, (up ? above : below) - 4),
        up,
      };
    }
    open = !open;
  }

  function choose(font: string): void {
    open = false;
    if (font !== value) onchange(font);
  }

  function closeOutside(e: Event): void {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }

  /** The wheel off the list closes it (the panel then scrolls as usual). */
  function closeOnWheel(e: Event): void {
    if (open && !(list && list.contains(e.target as Node))) open = false;
  }

  /** The panel scrolling the button away would leave the list behind: it closes. (A scroll
   *  event can arrive a frame late, for a scroll made before the list opened: the button has
   *  not moved since, so the list stays.) */
  function closeOnScroll(): void {
    if (!open || !root) return;
    const r = root.getBoundingClientRect();
    if (Math.abs(r.left - at.x) > 1 || Math.abs(r.top - at.y) > 1) open = false;
  }

  $effect(() => {
    if (!open) return;
    const wheel = { capture: true, passive: true } as const;
    document.addEventListener('scroll', closeOnScroll, true);
    document.addEventListener('wheel', closeOnWheel, wheel);
    return () => {
      document.removeEventListener('scroll', closeOnScroll, true);
      document.removeEventListener('wheel', closeOnWheel, wheel);
    };
  });
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && (open = false)}
  onpointerdown={closeOutside}
  onresize={() => (open = false)}
/>
<div class="font-picker" bind:this={root}>
  <button
    class="current"
    aria-label="Font: {value}"
    aria-expanded={open}
    title="Choose a font"
    style:font-family="'{value}'"
    onclick={toggle}><span>{value}</span><Icon name="chevron" size={14} /></button
  >
  {#if open}
    <div
      class="list"
      role="radiogroup"
      aria-label="Font"
      bind:this={list}
      style:left="{place.left}px"
      style:top={place.up ? null : `${place.top}px`}
      style:bottom={place.up ? `${place.bottom}px` : null}
      style:max-height="{place.maxHeight}px"
    >
      {#each FONT_GROUPS as group (group)}
        <div class="group">{group}</div>
        {#each FONTS.filter((f) => f.group === group) as font (font.name)}
          <button
            role="radio"
            aria-checked={font.name === value}
            title={font.hint}
            style:font-family="'{font.name}'"
            onclick={() => choose(font.name)}>{font.name}</button
          >
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .font-picker {
    position: relative;
  }
  .current {
    width: 100%;
    justify-content: space-between;
    font-size: 14px;
  }
  .current span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .list {
    /* On the window (placed by toggle()), above the panels and the timeline. */
    position: fixed;
    z-index: 30;
    width: 260px;
    overflow-y: auto;
    /* Scrolling past either end of the list does not scroll the panel behind it. */
    overscroll-behavior: contain;
    padding: 6px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    background: var(--bg-2);
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5);
  }
  .group {
    grid-column: 1 / -1;
    margin: 4px 2px 0;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-3);
  }
  .list button {
    justify-content: flex-start;
    height: 34px;
    padding: 0 8px;
    font-size: 15px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .list button[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
</style>
