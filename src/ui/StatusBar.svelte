<script lang="ts">
  import { isDirty, type App } from '../app/app.ts';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const media = $derived($store.history.present.media.length);
  const preparing = $derived(
    Object.values($store.assets).filter((a) => a.state === 'preparing').length,
  );
</script>

<footer class="status">
  {#if media > 0}
    {#if preparing > 0}
      <span>Preparing {preparing} preview{preparing === 1 ? '' : 's'}…</span>
    {:else}
      <span class="ok"><Icon name="check" size={14} /> All previews ready</span>
    {/if}
    <span>{media} media file{media === 1 ? '' : 's'}</span>
  {/if}
  {#if $store.message}
    <div class="message {$store.message.kind}" role="alert">
      {$store.message.text}
      <button onclick={() => app.dismissMessage()}>Dismiss</button>
    </div>
  {/if}
  {#if $store.exporting.state === 'running'}
    <span>Exporting… {Math.round($store.exporting.progress * 100)} %</span>
    <progress max="1" value={$store.exporting.progress}></progress>
    <button onclick={() => app.cancelExport()}>Cancel</button>
  {:else if $store.exporting.state === 'done'}
    <span class="ok">Saved to {$store.exporting.output}</span>
  {/if}
  <span class="spacer"></span>
  <span class="saved">
    <Icon name="save" size={14} />
    {isDirty($store) ? 'Unsaved changes' : 'All changes saved'}
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
  .message {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .message.error {
    color: var(--danger);
  }
  .status > span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .ok {
    color: var(--success);
  }
  .saved {
    color: var(--tx-3);
  }
  progress {
    width: 200px;
  }
</style>
