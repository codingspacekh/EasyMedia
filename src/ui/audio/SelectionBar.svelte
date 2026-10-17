<script lang="ts">
  // The selection bar (screen 13, A5): project rate, Selection start / end and length typed to
  // 0.01 s, the Audio position, and how many samples the selection holds.
  import type { App } from '../../app/app.ts';
  import { hz } from '../../core/render/audio-formats.ts';
  import BigTime from './BigTime.svelte';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const sel = $derived($store.selection);
  const rate = $derived($store.history.present.rate);
  const length = $derived(sel.end - sel.start);
  const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
</script>

<div class="sel-bar" role="group" aria-label="Selection">
  <div class="grp">
    <span class="k">Project rate</span>
    <span class="rate">{hz(rate)}</span>
  </div>
  <span class="vsep"></span>
  <BigTime label="Selection start" value={sel.start} commit={(t) => audio.setSelectionStart(t)} />
  <BigTime label="Selection end" value={sel.end} commit={(t) => audio.setSelectionEnd(t)} />
  <BigTime label="Length" value={length} />
  <span class="vsep"></span>
  <BigTime
    label="Audio position"
    value={$store.position}
    commit={(t) => {
      audio.setPosition(t);
      return null;
    }}
  />
  <span class="spacer"></span>
  <span class="hint">
    Selection = {length.toFixed(2)} s × {group(rate)} =
    <b>{group(Math.round(length * rate))} samples</b> per channel
  </span>
</div>

<style>
  .sel-bar {
    height: 64px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 22px;
    padding: 0 16px;
    background: var(--bg-1);
    border-top: 1px solid var(--line);
  }
  .grp {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .k {
    font-size: 10.5px;
    color: var(--tx-3);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .rate {
    font: 600 13px var(--mono);
  }
  .hint {
    font-size: 12px;
    color: var(--tx-2);
  }
  @media (max-width: 1300px) {
    .sel-bar {
      gap: 12px;
    }
    .hint {
      display: none;
    }
  }
</style>
