<script lang="ts">
  // Help ▸ Licences (README §17): THIRD_PARTY_LICENSES, readable without the internet.
  let { text, onclose }: { text: string; onclose: () => void } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Licences">
    <h2>Licences</h2>
    <p class="lead">
      EasyMedia is free software under the GNU GPL v3. It includes these parts made by others.
    </p>
    <pre>{text}</pre>
    <div class="actions">
      <button class="primary" onclick={onclose}>Close</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 9, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  .dialog {
    width: 760px;
    max-width: calc(100vw - 32px);
    height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 18px 20px;
  }
  h2 {
    font-size: 16px;
    margin: 0 0 4px;
  }
  .lead {
    margin: 0 0 10px;
    color: var(--tx-2);
  }
  pre {
    flex: 1;
    overflow: auto;
    margin: 0 0 12px;
    padding: 12px;
    background: var(--bg-0);
    border: 1px solid var(--line);
    border-radius: 8px;
    font: 12px/1.45 var(--mono);
    white-space: pre-wrap;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
