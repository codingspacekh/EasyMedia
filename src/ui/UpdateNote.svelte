<script lang="ts">
  // M17a U1–U4: the update note at the bottom of the window, as in the ZISPP Gradebook. It shows
  // only when there is something to say: a newer version (What's new, Download), its download,
  // "ready" (Restart and update, or Later: it goes in when OneEditor is next closed), a Mac's
  // .dmg in Downloads, a problem the student asked about, and once "Updated to 1.5.1".
  import type { App } from '../app/app.ts';

  let { app }: { app: App } = $props();
  const updates = $derived(app.updates);
  const view = $derived(updates.store);
  const s = $derived($view.state);
  let showNotes = $state(false);

  const shown = $derived(
    !!s &&
      s.mode !== 'off' &&
      (s.updatedTo !== null ||
        s.status === 'available' ||
        s.status === 'downloading' ||
        (s.status === 'ready' && !$view.later) ||
        s.status === 'dmg'),
  );
</script>

{#if s && shown}
  <div class="note" role="status" aria-label="Updates">
    {#if s.updatedTo !== null && s.status !== 'ready'}
      <b>Updated to {s.updatedTo}.</b>
      {#if s.updatedNotes.length}<span class="new">New: {s.updatedNotes.join(' · ')}</span>{/if}
      <button class="sm" onclick={() => updates.seen()}>OK</button>
    {:else if s.status === 'available'}
      <b>OneEditor {s.version} is out.</b>
      {#if s.notes.length}
        <button class="sm link" onclick={() => (showNotes = !showNotes)}>What's new</button>
      {/if}
      <button class="sm primary" onclick={() => updates.download()}>Download</button>
    {:else if s.status === 'downloading'}
      <span>Downloading {s.version}… {s.percent} %</span>
      <progress max="100" value={s.percent}></progress>
    {:else if s.status === 'ready'}
      <b>{s.version} is ready.</b>
      <span>It goes in when you next close OneEditor, or now:</span>
      <button class="sm primary" onclick={() => updates.install()}>Restart and update</button>
      <button class="sm" onclick={() => updates.later()}>Later</button>
    {:else if s.status === 'dmg'}
      <b>OneEditor {s.version} is in Downloads.</b>
      <span>Open it and drag OneEditor into Applications.</span>
      <button class="sm primary" onclick={() => updates.openDmg()}>Open it</button>
      <button class="sm" onclick={() => updates.showDmg()}>Show in Finder</button>
    {/if}
    {#if showNotes && s.status === 'available'}
      <ul class="notes">
        {#each s.notes as line, i (i)}<li>{line}</li>{/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  .note {
    flex: none;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    padding: 6px 12px;
    background: var(--accent-soft);
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--tx-1);
  }
  .new {
    color: var(--tx-2);
  }
  .link {
    border: 0;
    background: transparent;
    color: var(--accent);
    text-decoration: underline;
    padding: 0;
  }
  progress {
    width: 160px;
  }
  .notes {
    flex-basis: 100%;
    margin: 2px 0 0;
    padding-left: 18px;
    color: var(--tx-2);
  }
</style>
