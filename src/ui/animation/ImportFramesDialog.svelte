<script lang="ts">
  // Import frames (AN14, stop motion): the rate is chosen first, then the folder of pictures. The
  // pictures are shown in the order of their names, each held for its frames, on a new layer.
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import Why from '../Why.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const fps = $derived($store.history.present.stage.fps);

  // 12 pictures a second (the coursebook's usual stop motion rate), or the stage's rate if lower.
  let rate = $state(untrack(() => Math.min(12, fps)));
  const held = $derived(rate > 0 ? Math.round((fps / rate) * 100) / 100 : 0);
  let importing = $state(false);

  async function choose(): Promise<void> {
    importing = true;
    await anim.importFrames(rate);
    importing = false;
    onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Import frames">
    <h2>Import frames <span class="syl">20.1 stop motion</span></h2>
    <label class="rate"
      >Pictures a second
      <input
        type="number"
        min="1"
        max={fps}
        step="1"
        aria-label="Pictures a second"
        bind:value={rate}
      /></label
    >
    <p class="count">
      Each picture is held for {held}
      {held === 1 ? 'frame' : 'frames'} of the stage’s {fps} fps.
    </p>
    <p class="hint">
      Choose a folder of photographs or drawings (PNG, JPG, GIF, BMP or SVG). They are shown in the
      order of their names — name them frame01, frame02… — on a layer of their own; the stage is
      made longer if they need more time.
    </p>
    <Why tool="animStopMotion" />
    <div class="buttons">
      <button onclick={onclose}>Cancel</button>
      <button class="primary" disabled={importing || !(rate >= 1 && rate <= fps)} onclick={choose}
        >Choose folder…</button
      >
    </div>
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
    z-index: 20;
  }
  .dialog {
    width: 440px;
    max-width: calc(100vw - 32px);
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-l);
    padding: 18px 20px;
  }
  h2 {
    margin: 0 0 12px;
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
  .rate {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--tx-2);
    font-size: 12px;
  }
  .rate input {
    width: 64px;
  }
  .count {
    margin: 8px 0 0;
    font-size: 12px;
    color: var(--tx-1);
  }
  .hint {
    margin: 12px 0 0;
    color: var(--tx-2);
    font-size: 11.5px;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
</style>
