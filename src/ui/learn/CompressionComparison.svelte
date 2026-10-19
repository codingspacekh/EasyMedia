<script lang="ts">
  // T3 compression comparison, sound (screen 21): the first 10 s of the inspected file exported
  // five ways; real sizes, how much smaller than WAV, and a play button for each.
  import { AUDIO_SECONDS, type LearnApp } from '../../app/learn.ts';
  import { toMediaUrl } from '../../core/media-url.ts';
  import Icon from '../Icon.svelte';
  import LearnCard from './LearnCard.svelte';
  import { sizeText } from './size.ts';

  let { learn }: { learn: LearnApp } = $props();
  const store = $derived(learn.store);
  const inspected = $derived($store.inspected);
  const comparison = $derived($store.comparison?.kind === 'audio' ? $store.comparison : null);
  const seconds = $derived(
    Math.round(Math.min(AUDIO_SECONDS, inspected?.info.duration ?? AUDIO_SECONDS) * 10) / 10,
  );
  const most = $derived(Math.max(1, ...(comparison?.items.map((i) => i.bytes) ?? [])));
  let player: HTMLAudioElement | undefined = $state();
  let playing: string | null = $state(null);

  function toggle(path: string): void {
    if (!player) return;
    if (playing === path) {
      player.pause();
      playing = null;
      return;
    }
    player.src = toMediaUrl(path);
    playing = path;
    void player.play()?.catch(() => (playing = null));
  }
</script>

<LearnCard title="Compression comparison" icon="speed" tag="lossy · lossless" grow>
  {#if !inspected}
    <p class="hint">
      Inspect a sound or video above, then export its first {AUDIO_SECONDS} s five ways to hear and see
      what compression does.
    </p>
  {:else if !inspected.info.audio}
    <p class="hint">{inspected.name} has no sound. Inspect a sound or a video with sound.</p>
  {:else}
    <div class="top">
      <p class="hint">
        {#if comparison}
          The same {comparison.seconds} s of {inspected.name}, exported 5 ways. Press play to
          compare.
        {:else}
          Export the first {seconds} s of {inspected.name} as WAV, FLAC and MP3 at three bit rates.
        {/if}
      </p>
      <button disabled={$store.busy !== null} onclick={() => learn.compareAudio()}
        >Compare {seconds} s of the sound</button
      >
    </div>
    {#if $store.busy}<p class="busy" role="status">{$store.busy}</p>{/if}
    {#if comparison}
      <ul class="bars">
        {#each comparison.items as item (item.path)}
          <li class="bar-row">
            <button
              class="ghost sm icon-only"
              aria-label="{playing === item.path ? 'Stop' : 'Play'} {item.label}"
              onclick={() => toggle(item.path)}
              ><Icon name={playing === item.path ? 'stop' : 'play'} size={14} /></button
            >
            <span>{item.label}</span>
            <span
              class="b"
              class:lossy={!item.lossless}
              style:width="{(100 * item.bytes) / most}%"
              aria-hidden="true"
            ></span>
            <span class="v">{sizeText(item.bytes)}</span>
            <span class="s"
              >{item.saving > 0
                ? `${Math.round(item.saving * 100)} % smaller`
                : 'the original'}</span
            >
          </li>
        {/each}
      </ul>
      <p class="hint">
        Lossless files (WAV, FLAC) keep every sample. MP3 throws detail away: the lower the bit
        rate, the smaller the file — listen for the difference at 64 kbps.
      </p>
    {/if}
  {/if}
  <audio bind:this={player} onended={() => (playing = null)}></audio>
</LearnCard>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  .top .hint {
    flex: 1;
    margin: 0;
  }
  .busy {
    margin: 0 0 8px;
    font-size: 12px;
    color: var(--accent);
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 26px 118px 1fr 70px 96px;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .b {
    height: 14px;
    border-radius: 3px;
    background: var(--accent);
    min-width: 2px;
  }
  .b.lossy {
    background: var(--warn);
  }
  .v,
  .s {
    font-family: var(--mono);
    text-align: right;
    color: var(--tx-2);
  }
  .s {
    color: var(--tx-3);
    font-size: 11px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
</style>
