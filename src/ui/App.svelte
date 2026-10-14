<script lang="ts">
  import { projectTitle, type App } from '../app/app.ts';
  import { canRedo, canUndo } from '../app/history.ts';
  import Inspector from './Inspector.svelte';
  import MediaBin from './MediaBin.svelte';
  import Preview from './Preview.svelte';
  import ProjectSettings from './ProjectSettings.svelte';
  import SnapshotDialog from './SnapshotDialog.svelte';
  import StatusBar from './StatusBar.svelte';
  import Timeline from './Timeline.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const modes = ['Video', 'Audio', 'Learn'] as const;
  let mode: (typeof modes)[number] = $state('Video');
  let settingsOpen = $state(false);
  let snapshotOpen = $state(false);
  const settings = $derived($store.history.present.settings);

  $effect.pre(() => {
    document.title = projectTitle($store);
  });
</script>

<div class="app">
  <header class="toolbar">
    <h1>EasyMedia</h1>
    <nav aria-label="Mode">
      {#each modes as m (m)}
        <button type="button" aria-pressed={mode === m} onclick={() => (mode = m)}>{m}</button>
      {/each}
    </nav>
    <button onclick={() => app.importMedia()}>Import</button>
    <button disabled={!canUndo($store.history)} onclick={() => app.undo()}>Undo</button>
    <button disabled={!canRedo($store.history)} onclick={() => app.redo()}>Redo</button>
    <button onclick={() => app.save()}>Save</button>
    <button
      disabled={$store.history.present.timeline.main.length === 0}
      onclick={() => (snapshotOpen = true)}>Snapshot</button
    >
    <span class="spacer"></span>
    <button class="chip" onclick={() => (settingsOpen = true)}>
      {settings.aspect === 'custom' ? 'Custom' : settings.aspect} · {settings.width} × {settings.height}
      ·
      {settings.fps} fps
    </button>
    <button
      class="primary"
      disabled={$store.exporting.state === 'running'}
      onclick={() => app.exportVideo()}
    >
      Export
    </button>
  </header>
  {#if mode === 'Video'}
    <main class="workspace">
      <MediaBin {app} />
      <Preview {app} />
      <Inspector {app} />
    </main>
    <Timeline {app} />
  {:else}
    <main class="workspace later">
      <p>{mode} mode arrives in a later milestone.</p>
    </main>
  {/if}
  <StatusBar {app} />
  {#if settingsOpen}<ProjectSettings {app} onclose={() => (settingsOpen = false)} />{/if}
  {#if snapshotOpen}<SnapshotDialog {app} onclose={() => (snapshotOpen = false)} />{/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  h1 {
    font-size: 15px;
    margin: 0 8px 0 0;
  }
  nav {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    margin-right: 8px;
    border-radius: 8px;
    background: var(--bg-0);
  }
  nav button {
    border: 0;
    background: transparent;
    color: var(--tx-2);
  }
  nav button[aria-pressed='true'] {
    background: var(--bg-3);
    color: var(--tx-1);
  }
  .spacer {
    flex: 1;
  }
  .chip {
    border-radius: 999px;
    color: var(--tx-2);
    font-size: 12px;
  }
  .workspace {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .later {
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
  }
</style>
