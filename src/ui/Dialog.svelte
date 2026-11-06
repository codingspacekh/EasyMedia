<script lang="ts">
  // A modal dialog: the dimmed backdrop, the box with its title and the syllabus point it teaches,
  // the content, and the buttons along the bottom. Escape closes it, but not while it is busy
  // (saving, exporting). A new dialog only writes its own content.
  import type { Snippet } from 'svelte';

  let {
    label,
    syllabus,
    width = 520,
    busy = false,
    onclose,
    children,
    buttons,
  }: {
    /** The title, also the dialog's accessible name. */
    label: string;
    syllabus?: string;
    /** The box's width in px (narrower windows shrink it). */
    width?: number;
    /** Working (saving, exporting): Escape is ignored, so work is never left half done. */
    busy?: boolean;
    onclose: () => void;
    children: Snippet;
    buttons?: Snippet;
  } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !busy && onclose()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={label} style:width="{width}px">
    <h2>
      {label}{#if syllabus}<span class="syl">{syllabus}</span>{/if}
    </h2>
    {@render children()}
    {#if buttons}<div class="buttons">{@render buttons()}</div>{/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    /* Above the panels and their menus (20); tooltips (10000) stay on top. */
    z-index: 30;
  }
  .dialog {
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-l);
    padding: 18px 20px;
  }
  h2 {
    margin: 0 0 2px;
    font-size: 15px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .syl {
    font-size: 11px;
    font-weight: 500;
    color: var(--tx-3);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }
</style>
