<script lang="ts">
  import type { App } from '../app/app.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
</script>

<footer class="status">
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
</footer>

<style>
  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    padding: 4px 12px;
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
    color: var(--success);
  }
  progress {
    width: 200px;
  }
</style>
