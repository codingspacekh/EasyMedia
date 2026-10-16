<script lang="ts">
  // Side panel (screen 13): facts about the selected track — with why the uncompressed size is
  // what it is (T2 in brief) — and the History of edits (A18).
  import type { App } from '../../app/app.ts';
  import { trackDuration } from '../../core/audio/pcm.ts';
  import { hz, wavBytes } from '../../core/render/audio-formats.ts';
  import Icon from '../Icon.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.audio.store);
  const doc = $derived($store.history.present);
  const track = $derived(doc.tracks.find((t) => $store.selection.tracks.includes(t.id)));
  // Labels only: holding the steps themselves would keep their samples in memory (N4).
  const past = $derived($store.history.past.map((c) => c.label));
  const future = $derived($store.history.future.map((c) => c.label));
  const group = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const facts = $derived.by(() => {
    if (!track) return null;
    const channels = track.channels.length;
    const bits = track.bits ?? 16;
    const seconds = trackDuration(track, doc.rate);
    return {
      channels,
      bits,
      seconds,
      bytes: wavBytes(doc.rate, bits, channels, seconds) - 44,
    };
  });
</script>

<aside class="side" aria-label="Selected track">
  <div class="panel-h">Selected track</div>
  <div class="sec">
    {#if track && facts}
      <table class="props">
        <tbody>
          <tr
            ><td>Channels</td><td class="v"
              >{facts.channels} ({facts.channels === 2 ? 'stereo' : 'mono'})</td
            ></tr
          >
          <tr><td>Sample rate</td><td class="v">{hz(doc.rate)}</td></tr>
          <tr
            ><td>Sample resolution</td><td class="v"
              >{facts.bits}-bit{track.bits ? '' : ' (as on a CD)'}</td
            ></tr
          >
          <tr><td>Length</td><td class="v">{facts.seconds.toFixed(2)} s</td></tr>
          <tr><td>Uncompressed size</td><td class="v">{(facts.bytes / 1e6).toFixed(2)} MB</td></tr>
        </tbody>
      </table>
      <p class="hint">
        <b>Why this size?</b>
        {group(doc.rate)} × {facts.bits} × {facts.channels} × {facts.seconds.toFixed(2)} ÷ 8 bytes: samples
        per second × bits per sample × channels × seconds.
      </p>
    {:else}
      <p class="hint">Click a track to see its details.</p>
    {/if}
  </div>
  <div class="panel-h">History</div>
  <ol class="hist">
    {#each past as label, i (i)}
      <li class:cur={i === past.length - 1}>
        <Icon name="check" size={12} />{label}
      </li>
    {/each}
    {#each future as label, i (i)}
      <li class="fut">{label}</li>
    {/each}
    {#if past.length + future.length === 0}
      <li class="none">Nothing done yet.</li>
    {/if}
  </ol>
</aside>

<style>
  .side {
    width: 280px;
    flex: none;
    display: flex;
    flex-direction: column;
    background: var(--bg-1);
    border-left: 1px solid var(--line);
    overflow: auto;
  }
  .sec {
    padding: 8px 12px;
  }
  .props {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  .props td {
    padding: 6px 0;
    border-bottom: 1px solid var(--line);
  }
  .props td:first-child {
    color: var(--tx-2);
  }
  .v {
    font-family: var(--mono);
    font-weight: 500;
    text-align: right;
  }
  .hint {
    font-size: 12px;
    color: var(--tx-2);
    margin: 8px 0 0;
  }
  .hist {
    list-style: none;
    margin: 0;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .hist li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 26px;
    padding: 0 8px;
    border-radius: 5px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .hist li.cur {
    background: var(--accent-soft);
    color: var(--tx-1);
  }
  .hist li.fut {
    color: var(--tx-3);
    text-decoration: line-through;
  }
  @media (max-width: 1300px) {
    .side {
      width: 220px;
    }
  }
</style>
