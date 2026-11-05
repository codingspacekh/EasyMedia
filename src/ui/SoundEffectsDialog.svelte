<script lang="ts">
  // X8 the Sound effects box: the built-in sounds by group, each one to hear (Play) and to add.
  // Video mode puts it at the playhead on an effects track (V13); Audio mode adds a new track at
  // the cursor. The box stays open, so several sounds can be added one after another.
  import type { App } from '../app/app.ts';
  import { SOUND_EFFECTS, SOUND_GROUPS } from '../core/audio/sound-effects.ts';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  let { app, editor, onclose }: { app: App; editor: 'Video' | 'Audio'; onclose: () => void } =
    $props();

  const groups = SOUND_GROUPS.map((group) => ({
    group,
    sounds: SOUND_EFFECTS.filter((s) => s.group === group),
  }));

  function add(id: string): void {
    if (editor === 'Video') void app.addSoundEffect(id);
    else app.audio.addSoundEffect(id);
  }

  function close(): void {
    app.audio.stopHearing();
    onclose();
  }
</script>

<Dialog label="Sound effects" syllabus="11.2" width={600} onclose={close}>
  <p class="lead">
    {#if editor === 'Video'}
      <b>Add</b> puts the sound at the playhead on an effects track, where it can be moved, trimmed and
      made louder or quieter like music.
    {:else}
      <b>Add</b> puts the sound on a new track, starting at the cursor.
    {/if}
    Sound effects emphasise the action: use a few, at the right moments.
  </p>
  <div class="list">
    {#each groups as { group, sounds } (group)}
      <h3>{group}</h3>
      {#each sounds as s (s.id)}
        <div class="row">
          <button
            class="play"
            aria-label="Play {s.name}"
            title="Hear it"
            onclick={() => app.audio.hearSoundEffect(s.id)}><Icon name="play" size={14} /></button
          >
          <div class="text">
            <div class="name">{s.name}</div>
            <div class="hint">{s.hint}</div>
          </div>
          <button aria-label="Add {s.name}" onclick={() => add(s.id)}>Add</button>
        </div>
      {/each}
    {/each}
  </div>
  {#snippet buttons()}
    <button class="primary" onclick={close}>Close</button>
  {/snippet}
</Dialog>

<style>
  .lead {
    margin: 0 0 10px;
  }
  .list {
    max-height: min(60vh, 480px);
    overflow-y: auto;
    padding-right: 4px;
  }
  h3 {
    margin: 12px 0 4px;
    font-size: 12px;
    color: var(--tx-2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  h3:first-child {
    margin-top: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 0;
    border-bottom: 1px solid var(--line);
  }
  .play {
    flex: none;
    width: 30px;
    height: 30px;
    padding: 0;
    display: grid;
    place-items: center;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-weight: 600;
  }
  .hint {
    color: var(--tx-2);
    font-size: 12px;
  }
</style>
