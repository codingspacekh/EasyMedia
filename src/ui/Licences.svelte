<script lang="ts">
  // Help ▸ Licences (README §17): THIRD_PARTY_LICENSES, readable without the internet.
  import Dialog from './Dialog.svelte';
  let { text, onclose }: { text: string; onclose: () => void } = $props();
</script>

<Dialog label="Licences" width={760} {onclose}>
  <p class="lead">
    EasyMedia is free software under the GNU GPL v3. It includes these parts made by others.
  </p>
  <pre>{text}</pre>
  {#snippet buttons()}
    <button class="primary" onclick={onclose}>Close</button>
  {/snippet}
</Dialog>

<style>
  .lead {
    margin: 0;
    color: var(--tx-2);
  }
  pre {
    max-height: 60vh;
    overflow: auto;
    margin: 0;
    padding: 12px;
    background: var(--bg-0);
    border: 1px solid var(--line);
    border-radius: 8px;
    font: 12px/1.45 var(--mono);
    white-space: pre-wrap;
  }
</style>
