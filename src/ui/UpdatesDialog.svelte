<script lang="ts">
  // M17a U2, U5: Help ▸ Check for Updates… — the version running, when it last looked, Check now,
  // "Download updates by itself" (off unless turned on), and what the newer version brings.
  import type { App } from '../app/app.ts';
  import Dialog from './Dialog.svelte';

  let { app }: { app: App } = $props();
  const updates = $derived(app.updates);
  const view = $derived(updates.store);
  const s = $derived($view.state);
  const when = (iso: string) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<Dialog label="Updates" width={480} onclose={() => updates.closeDialog()}>
  {#if !s}
    <p class="hint">Looking…</p>
  {:else}
    <p><b>OneEditor {s.current}</b></p>
    {#if s.mode === 'off'}
      <p class="hint">
        Updates work only in the installed app (they are off when OneEditor runs from its source
        code).
      </p>
    {:else}
      <p class="hint" role="status">
        {#if s.status === 'checking'}
          Looking for a newer version…
        {:else if s.status === 'none'}
          This is the newest version.
        {:else if s.status === 'available'}
          OneEditor {s.version} is out.
        {:else if s.status === 'downloading'}
          Downloading {s.version}… {s.percent} %
        {:else if s.status === 'ready'}
          {s.version} is ready: it goes in when you next close OneEditor.
        {:else if s.status === 'dmg'}
          OneEditor {s.version} is in Downloads.
        {:else if s.status === 'error'}
          {s.error}
        {/if}
        {#if s.checkedAt}<br />Last looked: {when(s.checkedAt)}.{/if}
      </p>
      {#if s.notes.length && s.version}
        <p>What's new in {s.version}:</p>
        <ul>
          {#each s.notes as line, i (i)}<li>{line}</li>{/each}
        </ul>
      {/if}
      <label class="check">
        <input
          type="checkbox"
          checked={s.autoDownload}
          onchange={(e) => updates.setAuto(e.currentTarget.checked)}
        />
        Download updates by itself (it still goes in only when you restart)
      </label>
    {/if}
  {/if}

  {#snippet buttons()}
    {#if s && s.mode !== 'off'}
      {#if s.status === 'available'}
        <button onclick={() => updates.download()}>Download</button>
      {:else if s.status === 'ready'}
        <button onclick={() => updates.install()}>Restart and update</button>
      {/if}
      <button
        disabled={s.status === 'checking' || s.status === 'downloading'}
        onclick={() => updates.check()}>Check now</button
      >
    {/if}
    <button class="primary" onclick={() => updates.closeDialog()}>Close</button>
  {/snippet}
</Dialog>

<style>
  .hint {
    color: var(--tx-2);
    font-size: 12px;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
    font-size: 12px;
  }
  ul {
    margin: 4px 0;
    padding-left: 18px;
    font-size: 12px;
  }
</style>
