<script lang="ts">
  // X2 font chooser: the bundled fonts in groups, each name written in its own letters (a
  // drop-down list cannot show fonts on every computer). Opens under its button.
  import { FONT_GROUPS, FONTS } from '../core/text/fonts.ts';
  import Icon from './Icon.svelte';

  let { value, onchange }: { value: string; onchange: (font: string) => void } = $props();

  let open = $state(false);
  let root: HTMLElement | undefined = $state();

  function choose(font: string): void {
    open = false;
    if (font !== value) onchange(font);
  }

  function closeOutside(e: Event): void {
    if (open && root && !root.contains(e.target as Node)) open = false;
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && (open = false)}
  onpointerdown={closeOutside}
/>

<div class="font-picker" bind:this={root}>
  <button
    class="current"
    aria-label="Font: {value}"
    aria-expanded={open}
    title="Choose a font"
    style:font-family="'{value}'"
    onclick={() => (open = !open)}><span>{value}</span><Icon name="chevron" size={14} /></button
  >
  {#if open}
    <div class="list" role="radiogroup" aria-label="Font">
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
    position: absolute;
    z-index: 30;
    top: calc(100% + 4px);
    left: 0;
    width: 260px;
    max-height: 380px;
    overflow-y: auto;
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
