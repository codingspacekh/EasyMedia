<script lang="ts">
  // Export audio (screen 20; A15–A17, T7): format, sample rate, bit rate (constant / variable),
  // channels (force mono), resolution, tags, the estimated size compared with WAV, and the
  // advantages and disadvantages of the chosen format.
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { WHY } from '../../core/effects/help.ts';
  import {
    AUDIO_FORMATS,
    SAMPLE_RATES,
    audioFormatNotes,
    bitDepthsFor,
    bitRatesFor,
    defaultAudioExport,
    hz,
    sampleRatesFor,
    type AudioExportSettings,
    type AudioFormat,
    type AudioTags,
  } from '../../core/render/audio-formats.ts';
  import Icon from '../Icon.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const audio = $derived(app.audio);

  let settings: AudioExportSettings = $state(
    untrack(() => {
      const doc = app.audio.store.get().history.present;
      return defaultAudioExport({
        rate: doc.rate,
        channels: doc.tracks.some((t) => t.channels.length === 2) ? 2 : 1,
      });
    }),
  );

  const info = $derived(AUDIO_FORMATS[settings.format]);
  const rates = $derived(sampleRatesFor(settings.format));
  const bitRates = $derived(bitRatesFor(settings.format, settings.sampleRate));
  const depths = $derived(bitDepthsFor(settings.format));
  const summary = $derived(audio.exportSummary(settings));
  const notes = $derived(audioFormatNotes(settings.format));
  const mb = (bytes: number) => `${(bytes / 1e6).toFixed(2)} MB`;
  const TAGS: [keyof AudioTags, string][] = [
    ['title', 'Title'],
    ['artist', 'Artist'],
    ['album', 'Album'],
    ['year', 'Year'],
    ['comment', 'Comments (credits)'],
  ];

  /** A change, then anything the new format or rate cannot have is put right. */
  function change(update: Partial<AudioExportSettings>): void {
    const next = { ...settings, ...update };
    const allowed = sampleRatesFor(next.format);
    if (!allowed.includes(next.sampleRate))
      next.sampleRate = allowed.filter((r) => r <= next.sampleRate).at(-1) ?? allowed[0]!;
    const kbps = bitRatesFor(next.format, next.sampleRate);
    if (kbps.length && !kbps.includes(next.bitRate))
      next.bitRate = kbps.filter((k) => k <= next.bitRate).at(-1) ?? kbps[0]!;
    if (next.format !== 'mp3') next.mode = 'cbr';
    const bits = bitDepthsFor(next.format);
    if (bits.length && !bits.includes(next.bitDepth)) next.bitDepth = 16;
    settings = next;
  }

  function exportNow(): void {
    void audio.exportAudio($state.snapshot(settings));
    onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Export audio">
    <h2>
      <Icon name="export" /> Export audio <span class="syl">11.2 exporting · sample rates</span>
    </h2>

    <h3>Format</h3>
    <div class="row">
      <div class="seg" role="group" aria-label="Format">
        {#each Object.entries(AUDIO_FORMATS) as [id, f] (id)}
          <button
            aria-pressed={settings.format === id}
            onclick={() => change({ format: id as AudioFormat })}>{f.label}</button
          >
        {/each}
      </div>
      <span class="chip">{info.lossless ? 'Lossless' : 'Lossy'}</span>
      <span class="hint">{info.description}</span>
    </div>

    <h3>Sample rate</h3>
    <div class="rates" role="group" aria-label="Sample rate">
      {#each SAMPLE_RATES as r (r.rate)}
        <button
          class="card"
          aria-pressed={settings.sampleRate === r.rate}
          disabled={!rates.includes(r.rate)}
          title={rates.includes(r.rate) ? r.hint : `${info.label} cannot use ${hz(r.rate)}`}
          onclick={() => change({ sampleRate: r.rate })}
        >
          <b>{hz(r.rate)}</b><small>{r.hint}</small>
        </button>
      {/each}
    </div>

    <div class="grid">
      {#if bitRates.length}
        <span class="lbl">Bit rate</span>
        <div class="seg small" role="group" aria-label="Bit rate">
          {#each bitRates as k (k)}
            <button aria-pressed={settings.bitRate === k} onclick={() => change({ bitRate: k })}
              >{k} kbps</button
            >
          {/each}
        </div>
        <span class="lbl">Mode</span>
        <div class="row">
          <label
            ><input
              type="radio"
              name="mode"
              checked={settings.mode === 'cbr'}
              onchange={() => change({ mode: 'cbr' })}
            /> Constant</label
          >
          <label
            ><input
              type="radio"
              name="mode"
              checked={settings.mode === 'vbr'}
              disabled={settings.format !== 'mp3'}
              onchange={() => change({ mode: 'vbr' })}
            /> Variable</label
          >
          {#if settings.format !== 'mp3'}<span class="hint">Variable: MP3 only</span>{/if}
        </div>
      {/if}
      <span class="lbl">Channels</span>
      <div class="seg small" role="group" aria-label="Channels">
        <button aria-pressed={settings.channels === 2} onclick={() => change({ channels: 2 })}
          >Stereo</button
        >
        <button aria-pressed={settings.channels === 1} onclick={() => change({ channels: 1 })}
          >Mono</button
        >
      </div>
      <span class="lbl">Resolution</span>
      <div class="row">
        <div class="seg small" role="group" aria-label="Resolution">
          {#each [16, 24, 32] as const as bits (bits)}
            <button
              aria-pressed={depths.length > 0 && settings.bitDepth === bits}
              disabled={!depths.includes(bits)}
              onclick={() => change({ bitDepth: bits })}>{bits}-bit</button
            >
          {/each}
        </div>
        <span class="hint">WAV and FLAC only</span>
      </div>
    </div>

    <div class="estimate">
      <div>
        <small>Estimated size · {summary.duration.toFixed(1)} s</small>
        <b aria-label="Estimated file size"
          >{summary.upTo ? 'up to ' : '≈ '}{mb(summary.bytes)}{summary.about ? ' (about)' : ''}</b
        >
      </div>
      <p>
        Same audio as <b>WAV</b> (lossless, 16-bit): <b>{mb(summary.wavBytes)}</b>.
        {#if !info.lossless && summary.bytes > 0}
          <br />{info.label} is about {Math.round(summary.wavBytes / summary.bytes)}× smaller.
        {/if}
      </p>
    </div>

    <div class="notes">
      <b>{notes.title}</b>
      <ul>
        {#each notes.pros as pro (pro)}<li class="pro">+ {pro}</li>{/each}
        {#each notes.cons as con (con)}<li class="con">− {con}</li>{/each}
      </ul>
    </div>

    <details class="tags">
      <summary>Tags (title, artist…)</summary>
      {#if !info.tags}
        <p class="hint">AAC files cannot hold tags: choose M4A to keep them.</p>
      {/if}
      <div class="grid">
        {#each TAGS as [key, label] (key)}
          <label class="lbl" for="tag-{key}">{label}</label>
          <input
            id="tag-{key}"
            type="text"
            value={settings.tags[key] ?? ''}
            disabled={!info.tags}
            oninput={(e) => (settings.tags = { ...settings.tags, [key]: e.currentTarget.value })}
          />
        {/each}
      </div>
    </details>

    <details class="why">
      <summary>Why choose a format, rate and size?</summary>
      <p>{WHY.audioExport}</p>
    </details>

    <div class="actions">
      <span class="spacer"></span>
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={exportNow}><Icon name="export" size={14} /> Export</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    z-index: 30;
  }
  .dialog {
    width: min(640px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  h2 {
    margin: 0;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3 {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .syl {
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
  }
  .rates {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }
  .card {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 6px 10px;
    text-align: left;
  }
  .card small {
    color: var(--tx-3);
    font-size: 11px;
  }
  .card[aria-pressed='true'],
  .seg > button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .grid {
    display: grid;
    grid-template-columns: 110px 1fr;
    gap: 6px 10px;
    align-items: center;
    margin-top: 6px;
  }
  .lbl {
    color: var(--tx-2);
    font-size: 12px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
  }
  input[type='text'] {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  .estimate {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 10px 12px;
    margin-top: 6px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--bg-2);
  }
  .estimate > div {
    display: flex;
    flex-direction: column;
  }
  .estimate small {
    color: var(--tx-3);
    font-size: 11px;
  }
  .estimate > div > b {
    font-size: 22px;
  }
  .estimate p {
    margin: 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .notes {
    font-size: 12px;
  }
  .notes ul {
    margin: 6px 0 0;
    padding: 0;
    list-style: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px 12px;
  }
  .pro {
    color: #5fe0a5;
  }
  .con {
    color: var(--danger);
  }
  summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 12px;
  }
  .why p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 6px;
  }
  .spacer {
    flex: 1;
  }
</style>
