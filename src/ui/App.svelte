<script lang="ts">
  import { projectTitle, type App } from '../app/app.ts';
  import { canRedo, canUndo } from '../app/history.ts';
  import Inspector from './Inspector.svelte';
  import MediaBin from './MediaBin.svelte';
  import Preview from './Preview.svelte';
  import Icon from './Icon.svelte';
  import { ui } from './ui-state.svelte.ts';
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
    <h1 class="visually-hidden">EasyMedia</h1>
    <nav class="seg" aria-label="Mode">
      {#each modes as m (m)}
        <button type="button" aria-pressed={mode === m} onclick={() => (mode = m)}>
          <Icon name={m === 'Video' ? 'video' : m === 'Audio' ? 'audio' : 'learn'} />
          {m}
        </button>
      {/each}
    </nav>
    <span class="vsep"></span>
    <div class="tools">
      <button class="tool" onclick={() => app.importMedia()}><Icon name="import" />Import</button>
      <button
        class="tool"
        aria-label="Add title"
        onclick={() => {
          app.addTitle();
          ui.inspectorTab = 'text'; // a new title opens where its words are typed
        }}
      >
        <Icon name="title" />Title
      </button>
      <button class="tool" aria-label="Add caption" onclick={() => app.addText('caption')}>
        <Icon name="caption" />Caption
      </button>
      <button class="tool" aria-label="Add subtitle" onclick={() => app.addText('subtitle')}>
        <Icon name="subtitle" />Subtitle
      </button>
      <button class="tool" aria-label="Add credits" onclick={() => app.addText('credits')}>
        <Icon name="credits" />Credits
      </button>
      <button
        class="tool"
        disabled={$store.history.present.timeline.main.length === 0}
        onclick={() => (snapshotOpen = true)}><Icon name="snapshot" />Snapshot</button
      >
      <button
        class="tool"
        aria-label="Add music"
        title="Add music at the current point (the playhead)"
        onclick={() => app.addMusic()}
      >
        <Icon name="music" /><span class="long">Add music</span><span class="short">Music</span>
      </button>
    </div>
    <span class="spacer"></span>
    <button
      class="chip"
      aria-label="Project settings: {settings.aspect === 'custom'
        ? 'Custom'
        : settings.aspect} · {settings.width} × {settings.height} · {settings.fps} fps"
      onclick={() => (settingsOpen = true)}
    >
      <Icon name="screen" size={14} />
      <b>{settings.aspect === 'custom' ? 'Custom' : settings.aspect}</b>
      <span class="detail">· {settings.width} × {settings.height} · {settings.fps} fps</span>
      <Icon name="chevron" size={14} />
    </button>
    <button
      class="ghost icon-only"
      aria-label="Save"
      title="Save (Ctrl/Cmd + S)"
      onclick={() => app.save()}
    >
      <Icon name="save" />
    </button>
    <button
      class="ghost icon-only"
      aria-label="Undo"
      title="Undo"
      disabled={!canUndo($store.history)}
      onclick={() => app.undo()}><Icon name="undo" /></button
    >
    <button
      class="ghost icon-only"
      aria-label="Redo"
      title="Redo"
      disabled={!canRedo($store.history)}
      onclick={() => app.redo()}><Icon name="redo" /></button
    >
    <button
      class="primary"
      disabled={$store.exporting.state === 'running'}
      onclick={() => app.exportVideo()}
    >
      <Icon name="export" /> Export
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
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .toolbar {
    height: 56px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .seg > button {
    gap: 6px;
  }
  .tools {
    display: flex;
    gap: 2px;
  }
  .tool {
    flex-direction: column;
    gap: 2px;
    width: 62px;
    height: 44px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--tx-2);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
  }
  .tool .short {
    display: none;
  }
  .tool:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--tx-1);
  }
  .chip {
    cursor: pointer;
  }
  /* Smaller windows (down to 1100 px): narrower tools, shorter project chip. */
  @media (max-width: 1300px) {
    .tool {
      width: 50px;
      font-size: 10px;
    }
    .chip .detail,
    .tool .long {
      display: none;
    }
    .tool .short {
      display: inline;
    }
    .toolbar {
      gap: 6px;
    }
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
