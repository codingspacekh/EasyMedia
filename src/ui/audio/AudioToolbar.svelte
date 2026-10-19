<script lang="ts">
  // Audio mode toolbar (screens 13, 14): transport, selection / time shift tools, editing,
  // undo, the Tracks and Effect menus, Import audio and Export.
  import type { App } from '../../app/app.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import { AUDIO_EFFECTS } from '../../core/effects/registry.ts';
  import type { AudioEffectGroup } from '../../core/effects/types.ts';
  import Icon from '../Icon.svelte';
  import { ui } from '../ui-state.svelte.ts';
  import { audioUi } from './audio-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const sel = $derived($store.selection);

  let open: 'tracks' | 'effect' | null = $state(null);
  let root: HTMLElement | undefined = $state();

  const GROUPS: AudioEffectGroup[] = [
    'Volume',
    'Time & pitch',
    'Space',
    'Frequency',
    'Repair & channels',
  ];
  const selected = $derived(
    sel.tracks.length === 0
      ? 'No track selected'
      : `${sel.tracks.length} track${sel.tracks.length === 1 ? '' : 's'} selected`,
  );

  function choose(action: () => unknown): void {
    open = null;
    void action();
  }

  function effect(id: string): void {
    const def = AUDIO_EFFECTS.find((e) => e.id === id)!;
    choose(() =>
      Object.keys(def.params).length
        ? (audioUi.dialog = { kind: 'effect', id })
        : audio.applyNow(id),
    );
  }

  function closeOutside(e: Event): void {
    if (open && root && !root.contains(e.target as Node)) open = null;
  }
</script>

<svelte:window
  onkeydown={(e) => e.key === 'Escape' && (open = null)}
  onpointerdown={closeOutside}
/>

<div class="tools" role="toolbar" aria-label="Audio tools">
  <button
    class="tbtn"
    aria-label="Skip to start"
    title="Skip to start"
    onclick={() => audio.setPosition(0)}><Icon name="toStart" /></button
  >
  {#if $store.playing}
    <button
      class="tbtn"
      aria-label="Pause"
      title="Pause (Space stops)"
      onclick={() => audio.pause()}><Icon name="pause" /></button
    >
  {:else}
    <button class="tbtn" aria-label="Play" title="Play (Space)" onclick={() => audio.play()}
      ><Icon name="play" /></button
    >
  {/if}
  <button class="tbtn" aria-label="Stop" title="Stop" onclick={() => audio.stop()}
    ><Icon name="stop" /></button
  >
  <button
    class="tbtn rec"
    aria-label="Record"
    title={audio.canRecord
      ? withWhy('Record a voiceover into a new track', 'recording')
      : 'Recording is not available here'}
    disabled={!audio.canRecord || $store.recording !== null}
    onclick={() => void audio.openRecorder()}><Icon name="record" /></button
  >
  <button
    class="tbtn"
    aria-label="Loop the selection"
    title="Loop the selection while playing"
    aria-pressed={$store.loop}
    onclick={() => audio.toggleLoop()}><Icon name="loop" /></button
  >
</div>
<span class="vsep"></span>
<div class="tools">
  <button
    class="tbtn"
    aria-label="Clip tool"
    title={withWhy(
      'Clip tool: click a clip to select it, drag it to move it, drag its edges to trim it',
      'moveClip',
    )}
    aria-pressed={audioUi.tool === 'clip'}
    onclick={() => (audioUi.tool = 'clip')}><Icon name="shift" /></button
  >
  <button
    class="tbtn"
    aria-label="Selection tool"
    title="Selection tool: drag across the sound to select part of it (for Cut, Copy and effects)"
    aria-pressed={audioUi.tool === 'select'}
    onclick={() => (audioUi.tool = 'select')}><Icon name="cursor" /></button
  >
</div>
<span class="vsep"></span>
<div class="tools">
  <button
    class="tbtn"
    aria-label="Cut"
    title={withWhy('Cut (Ctrl/Cmd + X)', 'cutCopyPaste')}
    onclick={() => audio.cut()}><Icon name="split" /></button
  >
  <button
    class="tbtn"
    aria-label="Copy"
    title={withWhy('Copy (Ctrl/Cmd + C)', 'cutCopyPaste')}
    onclick={() => audio.copy()}><Icon name="copy" /></button
  >
  <button
    class="tbtn"
    aria-label="Paste"
    title={withWhy('Paste (Ctrl/Cmd + V)', 'cutCopyPaste')}
    onclick={() => audio.paste()}><Icon name="paste" /></button
  >
  <button
    class="tbtn"
    aria-label="Trim to selection"
    title={withWhy('Trim to selection: keep only the selected sound', 'trimAudio')}
    onclick={() => audio.trimToSelection()}><Icon name="trim" /></button
  >
  <button
    class="tbtn"
    aria-label="Insert silence"
    title={withWhy('Insert silence…', 'silence')}
    onclick={() => (audioUi.dialog = { kind: 'silence' })}><Icon name="silence" /></button
  >
</div>
<span class="vsep"></span>
<button
  class="ghost icon-only"
  aria-label="Undo"
  title="Undo"
  disabled={$store.history.past.length === 0}
  onclick={() => audio.undo()}><Icon name="undo" /></button
>
<button
  class="ghost icon-only"
  aria-label="Redo"
  title="Redo"
  disabled={$store.history.future.length === 0}
  onclick={() => audio.redo()}><Icon name="redo" /></button
>
<span class="spacer"></span>
<div class="menus" bind:this={root}>
  <div class="anchor">
    <button
      aria-haspopup="menu"
      aria-expanded={open === 'tracks'}
      class:primary={open === 'tracks'}
      onclick={() => (open = open === 'tracks' ? null : 'tracks')}
      >Tracks <Icon name="chevron" size={14} /></button
    >
    {#if open === 'tracks'}
      <div class="menu" role="menu" aria-label="Tracks">
        <div class="mh">{selected}</div>
        <button
          role="menuitem"
          title={withWhy('A new empty track for one channel', 'addTrack')}
          onclick={() => choose(() => audio.addTrack(1))}>Add new mono track</button
        >
        <button
          role="menuitem"
          title={withWhy('A new empty track for two channels', 'addTrack')}
          onclick={() => choose(() => audio.addTrack(2))}>Add new stereo track</button
        >
        <button
          role="menuitem"
          title={withWhy('A sound file or the sound of a video, as a new track', 'addTrack')}
          onclick={() => choose(() => audio.importAudio())}>Import audio as new track…</button
        >
        <button
          role="menuitem"
          disabled={!audio.canRecord}
          title={withWhy('Record a voiceover into a new track', 'recording')}
          onclick={() => choose(() => audio.openRecorder())}>Record into new track</button
        >
        <div class="ms"></div>
        <button
          role="menuitem"
          title={withWhy('Show the track higher up', 'moveTrack')}
          onclick={() => choose(() => audio.moveTrack(-1))}>Move track up</button
        >
        <button
          role="menuitem"
          title={withWhy('Show the track lower down', 'moveTrack')}
          onclick={() => choose(() => audio.moveTrack(1))}>Move track down</button
        >
        <div class="ms"></div>
        <div class="mh">Align</div>
        <button
          role="menuitem"
          title={withWhy('Each selected track starts where the one above ends', 'align')}
          onclick={() => choose(() => audio.alignEndToEnd())}>Align end to end</button
        >
        <button
          role="menuitem"
          title={withWhy('The selected tracks start at the cursor', 'align')}
          onclick={() => choose(() => audio.alignStart('cursor'))}>Align start to cursor</button
        >
        <button
          role="menuitem"
          title={withWhy('The selected tracks start at 0 s', 'align')}
          onclick={() => choose(() => audio.alignStart('zero'))}>Align start to zero</button
        >
        <div class="ms"></div>
        <div class="mh">Mix</div>
        <button
          role="menuitem"
          title={withWhy('One channel instead of two', 'mono')}
          onclick={() => choose(() => audio.stereoToMono())}>Mix stereo down to mono</button
        >
        <button
          role="menuitem"
          title={withWhy('The selected tracks become one track', 'mix')}
          onclick={() => choose(() => audio.mixAndRender())}>Mix and render</button
        >
        <button
          role="menuitem"
          title={withWhy('The mix goes into a new track; the originals stay', 'mix')}
          onclick={() => choose(() => audio.mixAndRender(true))}>Mix and render to new track</button
        >
        <div class="ms"></div>
        <button
          role="menuitem"
          title={withWhy('Remove the selected tracks', 'removeTrack')}
          onclick={() => choose(() => audio.removeTracks())}>Remove track</button
        >
      </div>
    {/if}
  </div>
  <div class="anchor">
    <button
      aria-haspopup="menu"
      aria-expanded={open === 'effect'}
      class:primary={open !== 'tracks'}
      onclick={() => (open = open === 'effect' ? null : 'effect')}
      >Effect <Icon name="chevron" size={14} /></button
    >
    {#if open === 'effect'}
      <div class="menu right" role="menu" aria-label="Effect">
        <div class="mh">
          {sel.end > sel.start
            ? `Applies to ${sel.start.toFixed(2)} – ${sel.end.toFixed(2)} s`
            : 'Select some sound first'}
        </div>
        {#each GROUPS as group (group)}
          {@const effects = AUDIO_EFFECTS.filter((e) => e.group === group)}
          {#if effects.length || group === 'Repair & channels'}
            <div class="mh">{group}</div>
            {#each effects as e (e.id)}
              <button role="menuitem" onclick={() => effect(e.id)}>{e.label}</button>
            {/each}
            {#if group === 'Repair & channels'}
              <button role="menuitem" onclick={() => choose(() => audio.stereoToMono())}
                >Stereo to mono</button
              >
            {/if}
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
<button
  class="ghost icon-only"
  aria-label="Import audio"
  title="Import audio as a new track"
  onclick={() => audio.importAudio()}><Icon name="import" /></button
>
<button
  class="primary"
  disabled={$store.exporting.state === 'running'}
  onclick={() => (ui.audioExport = true)}><Icon name="export" /> Export</button
>

<style>
  .tools {
    display: flex;
    gap: 5px;
  }
  .tbtn {
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--tx-2);
    background: var(--bg-2);
    border: 1px solid var(--line);
  }
  .tbtn[aria-pressed='true'] {
    color: var(--tx-1);
    background: var(--accent-soft);
    border-color: rgba(79, 140, 255, 0.6);
  }
  .tbtn.rec {
    color: var(--danger);
  }
  .menus {
    display: flex;
    gap: 6px;
  }
  .anchor {
    position: relative;
  }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 20;
    width: 250px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    background: #20242d;
    border: 1px solid var(--line-strong);
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  .menu.right {
    left: auto;
    right: 0;
  }
  .mh {
    padding: 6px 8px 4px;
    font-size: 10.5px;
    color: var(--tx-3);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .menu button {
    justify-content: flex-start;
    height: 28px;
    padding: 0 8px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    font-size: 13px;
  }
  .menu button:hover:not(:disabled),
  .menu button:focus-visible {
    background: var(--accent);
    color: #fff;
  }
  .ms {
    height: 1px;
    margin: 5px 4px;
    background: var(--line);
  }
</style>
