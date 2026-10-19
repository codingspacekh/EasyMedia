<script lang="ts">
  // Learn mode's status bar: what it is doing, its messages, and that the project is untouched.
  import type { LearnApp } from '../../app/learn.ts';

  let { learn }: { learn: LearnApp } = $props();
  const store = $derived(learn.store);
</script>

<footer class="status">
  {#if $store.busy}<span>{$store.busy}</span>{/if}
  {#if $store.message}
    <div class="message {$store.message.kind}" role="alert">
      {$store.message.text}
      <button onclick={() => learn.store.update((s) => ({ ...s, message: null }))}>Dismiss</button>
    </div>
  {/if}
  <span class="spacer"></span>
  <span class="note">Learn mode does not change your project</span>
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
  .note {
    color: var(--tx-3);
  }
</style>
