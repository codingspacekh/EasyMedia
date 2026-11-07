<script lang="ts">
  import { projectTitle, type App } from '../app/app.ts';
  import { canRedo, canUndo } from '../app/history.ts';
  import Inspector from './Inspector.svelte';
  import MediaBin from './MediaBin.svelte';
  import Preview from './Preview.svelte';
  import Icon from './Icon.svelte';
  import { ui } from './ui-state.svelte.ts';
  import ProjectSettings from './ProjectSettings.svelte';
  import ExportDialog from './ExportDialog.svelte';
  import SnapshotDialog from './SnapshotDialog.svelte';
  import StatusBar from './StatusBar.svelte';
  import Timeline from './Timeline.svelte';
  import Tooltip from './Tooltip.svelte';
  import Licences from './Licences.svelte';
  import About from './About.svelte';
  import UpdateNote from './UpdateNote.svelte';
  import UpdatesDialog from './UpdatesDialog.svelte';
  import CandidateDialog from './CandidateDialog.svelte';
  import SoundEffectsDialog from './SoundEffectsDialog.svelte';
  import Welcome from './Welcome.svelte';
  import AudioMode from './audio/AudioMode.svelte';
  import AudioStatusBar from './audio/AudioStatusBar.svelte';
  import AudioToolbar from './audio/AudioToolbar.svelte';
  import LearnMode from './learn/LearnMode.svelte';
  import LearnStatusBar from './learn/LearnStatusBar.svelte';
  import AnimationMode from './animation/AnimationMode.svelte';
  import AnimationStatusBar from './animation/AnimationStatusBar.svelte';
  import AnimationToolbar from './animation/AnimationToolbar.svelte';
  import { animationTitle, GRAPHIC_KIND } from '../app/animation.ts';
  import GraphicsMode from './graphics/GraphicsMode.svelte';
  import GraphicsToolbar from './graphics/GraphicsToolbar.svelte';
  import EditorScope from './graphics/EditorScope.svelte';
  import { EDITORS, leaveLearn, type LearnTab } from './ui-state.svelte.ts';
  import Glossary from './learn/Glossary.svelte';
  import PanelSlot from './PanelSlot.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const animStore = $derived(app.animation.store);
  const graphicStore = $derived(app.graphics.store);
  const updatesView = $derived(app.updates.store);
  const candidateView = $derived(app.candidate.store);
  const MODE_ICONS = {
    Video: 'video',
    Audio: 'audio',
    Animation: 'animation',
    Graphics: 'graphics',
  } as const;
  const LEARN_TABS: [LearnTab, string][] = [
    ['inspect', 'Inspector & sampling'],
    ['formats', 'Formats & compression'],
    ['animation', 'Animation'],
    ['task', 'Task checker'],
  ];
  let settingsOpen = $state(false);
  let snapshotOpen = $state(false);
  let exportOpen = $state(false);
  const settings = $derived($store.history.present.settings);

  $effect.pre(() => {
    document.title =
      ui.mode === 'Animation'
        ? `${animationTitle($animStore)} — OneEditor`
        : ui.mode === 'Graphics'
          ? `${animationTitle($graphicStore, GRAPHIC_KIND)} — OneEditor`
          : projectTitle($store);
  });
</script>

<div class="app">
  <header class="toolbar">
    <h1 class="visually-hidden">OneEditor</h1>
    {#if ui.mode === 'Learn'}
      <!-- N15: Learn fills the window; Back returns to the editor it was opened from. -->
      <button type="button" class="back" onclick={leaveLearn}
        ><span class="arrow"><Icon name="chevron" size={14} /></span>Back to {ui.learnFrom}</button
      >
    {:else}
      <nav class="seg" aria-label="Mode">
        {#each EDITORS as m (m)}
          <button
            type="button"
            title={m}
            aria-pressed={ui.mode === m}
            onclick={() => (ui.mode = m)}
          >
            <Icon name={MODE_ICONS[m]} />
            <span class="mode-name">{m}</span>
          </button>
        {/each}
      </nav>
    {/if}
    <span class="vsep"></span>
    {#if ui.mode === 'Audio'}
      <AudioToolbar {app} />
    {:else if ui.mode === 'Animation'}
      <AnimationToolbar {app} />
    {:else if ui.mode === 'Graphics'}
      <GraphicsToolbar {app} />
    {:else if ui.mode === 'Learn'}
      <div class="seg small" role="tablist" aria-label="Learn">
        {#each LEARN_TABS as [tab, label] (tab)}
          <button role="tab" aria-selected={ui.learnTab === tab} onclick={() => (ui.learnTab = tab)}
            >{label}</button
          >
        {/each}
      </div>
      <span class="spacer"></span>
      <button onclick={() => (ui.glossary = true)}><Icon name="help" size={14} /> Glossary</button>
    {:else}
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
        <button
          class="tool"
          aria-label="Sound effects"
          title="Built-in sound effects: add one at the playhead"
          onclick={() => (ui.soundEffects = true)}
        >
          <Icon name="sfx" /><span class="long">Sound FX</span><span class="short">Sounds</span>
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
        onclick={() => {
          if ($store.history.present.timeline.main.length === 0) void app.exportVideo();
          else exportOpen = true;
        }}
      >
        <Icon name="export" /> Export
      </button>
    {/if}
  </header>
  {#if ui.mode === 'Video'}
    <main class="workspace">
      <PanelSlot layout={app.layout} id="video.bin"><MediaBin {app} /></PanelSlot>
      <Preview {app} />
      <PanelSlot layout={app.layout} id="video.inspector"><Inspector {app} /></PanelSlot>
    </main>
    <PanelSlot layout={app.layout} id="video.timeline"><Timeline {app} /></PanelSlot>
  {:else if ui.mode === 'Audio'}
    <main class="workspace">
      <AudioMode {app} />
    </main>
  {:else if ui.mode === 'Animation'}
    <main class="workspace">
      <AnimationMode {app} />
    </main>
  {:else if ui.mode === 'Graphics'}
    <main class="workspace">
      <GraphicsMode {app} />
    </main>
  {:else}
    <main class="workspace">
      <LearnMode {app} />
    </main>
  {/if}
  <UpdateNote {app} />
  {#if ui.mode === 'Audio'}
    <AudioStatusBar {app} />
  {:else if ui.mode === 'Learn'}
    <LearnStatusBar learn={app.learn} />
  {:else if ui.mode === 'Animation'}
    <AnimationStatusBar {app} />
  {:else if ui.mode === 'Graphics'}
    <EditorScope {app}><AnimationStatusBar {app} /></EditorScope>
  {:else}
    <StatusBar {app} />
  {/if}
  {#if settingsOpen}<ProjectSettings {app} onclose={() => (settingsOpen = false)} />{/if}
  {#if snapshotOpen}<SnapshotDialog {app} onclose={() => (snapshotOpen = false)} />{/if}
  {#if exportOpen}<ExportDialog {app} onclose={() => (exportOpen = false)} />{/if}
  {#if ui.glossary}<Glossary onclose={() => (ui.glossary = false)} />{/if}
  {#if $updatesView.dialog}<UpdatesDialog {app} />{/if}
  {#if $candidateView.dialog}<CandidateDialog {app} />{/if}
  {#if ui.soundEffects && (ui.mode === 'Video' || ui.mode === 'Audio' || ui.mode === 'Animation')}
    <SoundEffectsDialog {app} editor={ui.mode} onclose={() => (ui.soundEffects = false)} />
  {/if}
  {#if $store.licences !== null}
    <Licences text={$store.licences} onclose={() => app.closeLicences()} />
  {:else if $store.about}
    <About {app} />
  {:else if $store.welcome}
    <Welcome {app} />
  {/if}
</div>
<Tooltip />

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
    min-width: 0;
    /* Too wide a header is cut off at the side (N10) but not below it: the Tracks and Effect
       menus open downwards from here (issues/audio-2.png). */
    overflow-x: clip;
    overflow-y: visible;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .seg > button {
    gap: 6px;
  }
  .back {
    gap: 6px;
  }
  /* The chevron points down: turned to point back. */
  .back .arrow {
    display: inline-flex;
    transform: rotate(90deg);
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
    /* N10: four modes and a full toolbar do not fit at 1100 px (Audio's Export went past the
       edge on Windows): the modes not chosen show their icon, named by the tooltip and, for
       screen readers, by their hidden name. */
    .seg > button[aria-pressed='false'] {
      padding: 0 8px;
    }
    .seg > button[aria-pressed='false'] .mode-name {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
  .workspace {
    flex: 1;
    display: flex;
    min-height: 0;
  }
</style>
