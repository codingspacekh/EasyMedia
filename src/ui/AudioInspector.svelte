<script lang="ts">
  // Music or voiceover in Video mode (screen 08, V13): start, trim, volume, fades, lowering the
  // music under the voiceover, and which track it is on.
  import type { App } from '../app/app.ts';
  import { WHY } from '../core/effects/help.ts';
  import {
    moveAudioToTrack,
    moveTimedItem,
    setAudioFades,
    setAudioVolume,
    setDucking,
    trimAudio,
  } from '../app/commands.ts';
  import { mainTrackDuration } from '../core/model/timeline.ts';
  import type { AudioItem } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import Icon from './Icon.svelte';
  import PercentField from './PercentField.svelte';
  import TimeField from './TimeField.svelte';

  let { app, item, track }: { app: App; item: AudioItem; track: 0 | 1 } = $props();
  const store = $derived(app.store);
  const project = $derived($store.history.present);
  const asset = $derived(project.media.find((m) => m.id === item.assetId));
  const videoEnd = $derived(mainTrackDuration(project.timeline.main));
  const length = $derived(item.out - item.in);
  const end = $derived(Math.min(item.start + length, videoEnd));
  let actionError: string | null = $state(null);
</script>

<div class="head">
  <div class="thumb {track === 0 ? 'music' : 'voice'}">
    <Icon name={track === 0 ? 'music' : 'mic'} />
  </div>
  <div class="who">
    <div class="title">{asset ? fileNameOf(asset.path) : 'Missing file'}</div>
    <div class="kind">
      {track === 0 ? 'Music · Audio 1' : 'Voiceover · Audio 2'} ·
      <span class="len">{length.toFixed(2)} s</span>
    </div>
  </div>
</div>

<section>
  <h3>
    <Icon name="music" size={14} /> Position &amp; trim <span class="syl">11.1 adding audio</span>
  </h3>
  <TimeField
    label="Starts at"
    value={item.start}
    commit={(t) => app.edit(moveTimedItem(item.id, t))}
  />
  <div class="row">
    <button onclick={() => (actionError = app.edit(moveTimedItem(item.id, $store.playhead)))}
      >Start at the playhead</button
    >
  </div>
  {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
  <TimeField
    label="Trim start"
    value={item.in}
    commit={(t) => app.edit(trimAudio(item.id, { in: t, out: item.out }))}
  />
  <TimeField
    label="Trim end"
    value={item.out}
    commit={(t) => app.edit(trimAudio(item.id, { in: item.in, out: t }))}
  />
  <p class="hint">
    {#if item.start >= videoEnd}
      Starts after the video ends ({videoEnd.toFixed(2)} s), so it will not be heard.
    {:else}
      Plays {item.start.toFixed(2)} – {end.toFixed(2)} s{item.start + length > videoEnd + 1e-9
        ? ', ending with the video'
        : ''}.
    {/if}
  </p>
</section>

<section>
  <h3>
    <Icon name="volume" size={14} /> Volume &amp; fades <span class="syl">11.1 editing audio</span>
  </h3>
  <PercentField
    label="Volume"
    value={item.volume}
    commit={(v) => app.edit(setAudioVolume(item.id, v))}
  />
  <TimeField
    label="Fade in"
    value={item.fadeIn}
    commit={(t) => app.edit(setAudioFades(item.id, { in: t, out: item.fadeOut }))}
  />
  <TimeField
    label="Fade out"
    value={item.fadeOut}
    commit={(t) => app.edit(setAudioFades(item.id, { in: item.fadeIn, out: t }))}
  />
  {#if track === 0}
    <label class="check">
      <input
        type="checkbox"
        checked={item.duck === true}
        onchange={(e) => (actionError = app.edit(setDucking(item.id, e.currentTarget.checked)))}
      />
      Lower under voiceover (−6 dB)
    </label>
    <p class="hint">Makes the voiceover easier to hear over the music.</p>
  {/if}
</section>

<section>
  <div class="track">
    <label for="audio-track">Track</label>
    <select
      id="audio-track"
      value={String(track)}
      onchange={(e) =>
        (actionError = app.edit(moveAudioToTrack(item.id, Number(e.currentTarget.value) as 0 | 1)))}
    >
      <option value="0">Music (Audio 1)</option>
      <option value="1">Voiceover (Audio 2)</option>
    </select>
  </div>
  <p class="hint">Echo, EQ, noise reduction and pitch will be in Audio mode (a later version).</p>
  <details class="why">
    <summary>Why add music or a voiceover?</summary>
    <p>{WHY.audio}</p>
  </details>
</section>

<style>
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  .thumb {
    width: 54px;
    height: 32px;
    flex: none;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #06241a;
  }
  .thumb.music {
    background: var(--c-music);
  }
  .thumb.voice {
    background: var(--c-voice);
  }
  .who {
    min-width: 0;
  }
  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--tx-3);
    font-size: 12px;
  }
  section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    font-size: 12.5px;
    margin: 0 0 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    gap: 4px;
    margin: -2px 0 10px 104px;
  }
  .row button {
    padding: 4px 8px;
    font-size: 12px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 6px 0 0;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }
  .track {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    gap: 8px;
  }
  .track label {
    color: var(--tx-2);
    font-size: 12px;
  }
  .why summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 12px;
    margin-top: 8px;
  }
  .why p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .error {
    margin: 0 0 8px;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
