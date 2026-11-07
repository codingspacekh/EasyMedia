<script lang="ts">
  // Animation mode's status bar: the pointer's coordinates (AN2), what the last move snapped
  // to, the zoom, messages, and whether the animation is saved.
  import { isAnimationDirty } from '../../app/animation.ts';
  import { editorOf } from './editor.ts';
  import type { App } from '../../app/app.ts';
  import Icon from '../Icon.svelte';
  import { graphicOf } from '../../core/graphics/document.ts';
  import { formatLength } from '../../core/graphics/units.ts';
  import { animUi } from './animation-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);
  const store = $derived(editor.anim.store);
  /** G6 (M18): Graphics mode gives the pointer in the image's units ("3.5 cm"). */
  const image = $derived(editor.still ? graphicOf($store.history.present) : null);
  const coord = (px: number): string =>
    !image || image.units === 'px' ? `${px}` : formatLength(px, image.units, image.dpi);
</script>

<footer class="status">
  <span class="coords" aria-label="Pointer position">
    {#if animUi.pointer}x {coord(animUi.pointer.x)}, y {coord(animUi.pointer.y)}{:else}x –, y –{/if}
  </span>
  {#if animUi.snapped}<span class="snap"
      ><Icon name="snap" size={13} /> Snapped to {animUi.snapped}</span
    >{/if}
  {#if $store.busy}<span>{$store.busy}</span>{/if}
  {#if $store.message}
    <div class="message {$store.message.kind}" role="alert">
      {$store.message.text}
      <button onclick={() => anim.dismissMessage()}>Dismiss</button>
    </div>
  {/if}
  <span class="spacer"></span>
  <span class="note">{$store.selection.length} selected</span>
  <span class="saved">
    <Icon name="save" size={14} />
    {isAnimationDirty($store) ? 'Unsaved changes' : 'All changes saved'}
  </span>
</footer>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 30px;
    padding: 2px 14px;
    font-size: 11.5px;
    background: #0d0f13;
    border-top: 1px solid var(--line);
    color: var(--tx-2);
  }
  .coords {
    font-family: var(--mono);
    min-width: 120px;
  }
  .snap {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
  }
  .message {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .message.error {
    color: var(--danger);
  }
  .note {
    color: var(--tx-3);
  }
  .saved {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--tx-3);
  }
</style>
