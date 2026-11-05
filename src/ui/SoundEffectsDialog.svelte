<script lang="ts">
  // X8 the Sound effects box: the built-in sounds by group, each one to hear (Play) and to add.
  // Video mode puts it at the playhead on an effects track (V13); Audio mode adds a new track at
  // the cursor. The box stays open, so several sounds can be added one after another. With 66
  // sounds the groups are listed down the left (as the Library's categories) and a search looks
  // through every name and use.
  import type { App } from '../app/app.ts';
  import { SOUND_EFFECTS, SOUND_GROUPS, type SoundGroup } from '../core/audio/sound-effects.ts';
  import Dialog from './Dialog.svelte';
  import Icon from './Icon.svelte';

  let { app, editor, onclose }: { app: App; editor: 'Video' | 'Audio'; onclose: () => void } =
    $props();

  type Shown = SoundGroup | 'all';
  let shown: Shown = $state('all');
  let query = $state('');

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return SOUND_GROUPS.filter((group) => q || shown === 'all' || shown === group)
      .map((group) => ({
        group,
        sounds: SOUND_EFFECTS.filter(
          (s) =>
            s.group === group &&
            (!q || s.name.toLowerCase().includes(q) || s.hint.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.sounds.length);
  });
  const countOf = (group: SoundGroup) => SOUND_EFFECTS.filter((s) => s.group === group).length;

  function add(id: string): void {
    if (editor === 'Video') void app.addSoundEffect(id);
    else app.audio.addSoundEffect(id);
  }

  function close(): void {
    app.audio.stopHearing();
    onclose();
  }
</script>

<Dialog label="Sound effects" syllabus="11.2" width={720} onclose={close}>
  <p class="lead">
    {#if editor === 'Video'}
      <b>Add</b> puts the sound at the playhead on an effects track, where it can be moved, trimmed and
      made louder or quieter like music.
    {:else}
      <b>Add</b> puts the sound on a new track, starting at the cursor.
    {/if}
    Sound effects emphasise the action: use a few, at the right moments.
  </p>
  <input
    type="search"
    placeholder="Search: whoosh, applause, wrong answer…"
    aria-label="Search the sounds"
    bind:value={query}
  />
  <div class="body">
    <div class="groups" role="tablist" aria-label="Sound groups" aria-orientation="vertical">
      {#each [['all', 'All sounds', SOUND_EFFECTS.length] as const, ...SOUND_GROUPS.map((g) => [g, g, countOf(g)] as const)] as [id, name, count] (id)}
        <button
          role="tab"
          aria-selected={!query.trim() && shown === id}
          onclick={() => {
            shown = id;
            query = '';
          }}><span>{name}</span><span class="count">{count}</span></button
        >
      {/each}
    </div>
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
      {:else}
        <p class="none">Nothing found for “{query}”.</p>
      {/each}
    </div>
  </div>
  {#snippet buttons()}
    <button class="primary" onclick={close}>Close</button>
  {/snippet}
</Dialog>

<style>
  .lead {
    margin: 0 0 10px;
  }
  input[type='search'] {
    width: 100%;
    box-sizing: border-box;
  }
  .body {
    display: flex;
    gap: 12px;
    margin-top: 10px;
  }
  .groups {
    flex: none;
    width: 176px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .groups button {
    justify-content: space-between;
    gap: 6px;
    padding: 6px 10px;
    font-size: 12.5px;
    text-align: left;
    background: transparent;
    border-color: transparent;
    color: var(--tx-2);
  }
  .groups button:hover {
    background: var(--bg-2);
    color: var(--tx-1);
  }
  .groups button[aria-selected='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--tx-1);
    font-weight: 600;
  }
  .count {
    font-size: 11px;
    font-weight: 400;
    color: var(--tx-3);
    font-variant-numeric: tabular-nums;
  }
  /* One height whatever is shown, so the box does not jump; shorter in a small window. */
  .list {
    flex: 1;
    min-width: 0;
    height: min(440px, calc(100vh - 330px));
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 4px;
  }
  .none {
    margin: 0;
    color: var(--tx-3);
    font-size: 12px;
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
