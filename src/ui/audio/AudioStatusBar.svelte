<script lang="ts">
  // Audio mode status bar: what the app is doing, messages, export progress, and the tracks.
  import type { App } from '../../app/app.ts';
  import Icon from '../Icon.svelte';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const doc = $derived($store.history.present);
  const stereo = $derived(doc.tracks.some((t) => t.channelCount === 2 || t.pan !== 0));
</script>

<footer class="status">
  {#if $store.busy}<span>{$store.busy}</span>{/if}
  {#if doc.tracks.length}
    <span
      >{doc.tracks.length} track{doc.tracks.length === 1 ? '' : 's'} · {stereo ? 'stereo' : 'mono'} mix
      · {doc.rate / 1000} kHz</span
    >
  {/if}
  {#if $store.message}
    <div class="message {$store.message.kind}" role="alert">
      {$store.message.text}
      <button class="sm" onclick={() => audio.dismissMessage()}>Dismiss</button>
    </div>
  {/if}
  {#if $store.exporting.state === 'running'}
    <span>Exporting audio… {Math.round($store.exporting.progress * 100)} %</span>
    <progress max="1" value={$store.exporting.progress}></progress>
    <button class="sm" onclick={() => audio.cancelExport()}>Cancel</button>
  {:else if $store.exporting.state === 'done' && !$store.message}
    <span class="ok"><Icon name="check" size={14} /> Saved to {$store.exporting.output}</span>
  {/if}
  <span class="spacer"></span>
  <span class="hint">Space plays and stops · Ctrl/Cmd + A selects all</span>
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
  .message {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .message.error {
    color: var(--danger);
  }
  .ok {
    display: inline-flex;
    gap: 5px;
    color: var(--success);
  }
  .hint {
    color: var(--tx-3);
  }
  progress {
    width: 200px;
  }
</style>
