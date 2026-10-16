<script lang="ts">
  // Export video (screen 12; V16, V17, T7): where the video will be played, the file format and
  // compression, the settings, the estimated file size and the pros and cons of the format.
  import { untrack } from 'svelte';
  import type { App } from '../app/app.ts';
  import { WHY } from '../core/effects/help.ts';
  import {
    CONTAINERS,
    EXPORT_FPS,
    PRESETS,
    audioKbps,
    estimateSize,
    formatNotes,
    presetSettings,
    videoKbps,
    type Compression,
    type Container,
    type ExportFps,
    type ExportSettings,
    type PresetId,
    type Quality,
  } from '../core/render/formats.ts';
  import Icon, { type IconName } from './Icon.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const store = $derived(app.store);
  const project = $derived($store.history.present);

  let preset: PresetId = $state('youtube');
  let format: ExportSettings = $state(
    untrack(() => presetSettings('youtube', app.store.get().history.present.settings)),
  );
  let alsoSave = $state(true);

  const QUALITIES: Quality[] = ['low', 'medium', 'high', 'best'];
  const QUALITY_NAMES: Record<Quality, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    best: 'Best',
  };
  const ICONS: Record<PresetId, IconName> = {
    youtube: 'export',
    'mobile-medium': 'screen',
    'mobile-small': 'screen',
    'dvd-pal': 'video',
    'dvd-ntsc': 'video',
    bluray: 'screen',
    custom: 'filter',
  };

  const summary = $derived(app.exportSummary(format));
  const notes = $derived(formatNotes(format.container, format.compression));

  /** Sizes offered: the project's shape at common sizes, plus the DVD sizes. */
  const sizes = $derived.by(() => {
    const s = project.settings;
    const even = (n: number) => 2 * Math.round(n / 2);
    const byHeight = [1080, 720, 540, 480, 360].map((h) => ({
      w: even((h * s.width) / s.height),
      h,
    }));
    const list = [
      { w: s.width, h: s.height, note: 'same as project' },
      ...byHeight.map((x) => ({ ...x, note: x.h === 1080 ? 'Full HD' : x.h === 720 ? 'HD' : '' })),
      { w: 720, h: 576, note: 'DVD PAL' },
      { w: 720, h: 480, note: 'DVD NTSC' },
      { w: format.width, h: format.height, note: '' },
    ];
    return list.filter(({ w, h }, i) => list.findIndex((x) => x.w === w && x.h === h) === i);
  });

  function choosePreset(id: PresetId): void {
    preset = id;
    format = presetSettings(id, project.settings);
  }

  /** Any change by hand makes this a custom export. */
  function change(update: Partial<ExportSettings>): void {
    const next = { ...format, ...update };
    if (!CONTAINERS[next.container].lossless) next.compression = 'lossy';
    format = next;
    preset = 'custom';
  }

  function stepQuality(by: number): void {
    const i = QUALITIES.indexOf(format.quality) + by;
    if (i >= 0 && i < QUALITIES.length) change({ quality: QUALITIES[i]! });
  }

  function megabytes(bytes: number): string {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1e3))} kB`;
  }
  const sizeLabel = (s: { bytes: number; upTo: boolean }) =>
    `${s.upTo ? 'up to ' : '≈ '}${megabytes(s.bytes)}`;

  const compare = $derived.by(() => {
    const s = project.settings;
    const sized = (f: ExportSettings) => estimateSize(f, summary.duration, summary.hasAudio);
    return [
      { name: 'This export', size: summary },
      { name: 'Mobile (small)', size: sized(presetSettings('mobile-small', s)) },
      { name: 'DVD', size: sized(presetSettings('dvd-pal', s)) },
      {
        name: 'Lossless AVI',
        size: sized({ ...presetSettings('custom', s), container: 'avi', compression: 'lossless' }),
      },
    ];
  });

  const codecLine = $derived(
    format.compression === 'lossless'
      ? CONTAINERS[format.container].codecs.lossless
      : `${CONTAINERS[format.container].codecs.lossy} · ${videoKbps(format)} + ${audioKbps(format)} kbit/s`,
  );

  function exportNow(): void {
    void app.exportVideo({ format: { ...format }, alsoSaveProject: alsoSave });
    onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Export video">
    <h2>
      <Icon name="export" /> Export video <span class="syl">11.1 exporting · compressing</span>
    </h2>

    <div class="cols">
      <div class="col">
        <h3>Where will it be played?</h3>
        <div class="presets">
          {#each PRESETS as p (p.id)}
            {@const f = presetSettings(p.id, project.settings)}
            <button
              class="preset"
              aria-pressed={preset === p.id}
              onclick={() => choosePreset(p.id)}
            >
              <Icon name={ICONS[p.id]} />
              <span class="pl">
                <b>{p.label}</b>
                <small
                  >{p.id === 'custom'
                    ? p.hint
                    : `${f.width}×${f.height} · ${CONTAINERS[f.container].label}`}</small
                >
              </span>
            </button>
          {/each}
        </div>
      </div>

      <div class="col">
        <h3>File format (container)</h3>
        <div class="seg containers">
          {#each Object.entries(CONTAINERS) as [id, c] (id)}
            <button
              aria-pressed={format.container === id}
              onclick={() => change({ container: id as Container })}>{c.label}</button
            >
          {/each}
        </div>

        <h3>Compression</h3>
        <div class="compression">
          {#each [['lossy', 'Lossy', 'Removes detail you are unlikely to notice. Much smaller file.'], ['lossless', 'Lossless', 'Keeps every pixel. Available in MOV and AVI.']] as [value, name, note] (value)}
            <label
              class="radio"
              class:off={value === 'lossless' && !CONTAINERS[format.container].lossless}
            >
              <input
                type="radio"
                name="compression"
                aria-label={name}
                checked={format.compression === value}
                disabled={value === 'lossless' && !CONTAINERS[format.container].lossless}
                onchange={() => change({ compression: value as Compression })}
              />
              <span><b>{name}</b> <small>{note}</small></span>
            </label>
          {/each}
        </div>

        <h3>Settings</h3>
        <div class="grid">
          <label for="export-size">Resolution</label>
          <select
            id="export-size"
            value="{format.width}x{format.height}"
            onchange={(e) => {
              const [w, h] = e.currentTarget.value.split('x').map(Number);
              change({ width: w!, height: h! });
            }}
          >
            {#each sizes as s (`${s.w}x${s.h}`)}
              <option value="{s.w}x{s.h}">{s.w} × {s.h}{s.note ? ` (${s.note})` : ''}</option>
            {/each}
          </select>
          <label for="export-fps">Frame rate</label>
          <select
            id="export-fps"
            value={String(format.fps)}
            onchange={(e) => change({ fps: Number(e.currentTarget.value) as ExportFps })}
          >
            {#each EXPORT_FPS as fps (fps)}
              <option value={String(fps)}
                >{fps} fps{fps === project.settings.fps ? ' (same as project)' : ''}</option
              >
            {/each}
          </select>
          <span class="lbl">Codec</span>
          <span class="codec">{codecLine}</span>
          <span class="lbl">Quality</span>
          <div class="quality">
            <button
              class="sm"
              disabled={format.compression === 'lossless' || format.quality === 'low'}
              onclick={() => stepQuality(-1)}>Smaller</button
            >
            <span class="q"
              >{format.compression === 'lossless'
                ? 'Every pixel'
                : QUALITY_NAMES[format.quality]}</span
            >
            <button
              class="sm"
              disabled={format.compression === 'lossless' || format.quality === 'best'}
              onclick={() => stepQuality(1)}>Better</button
            >
          </div>
        </div>

        <div class="estimate">
          <div>
            <small>Estimated file size · {summary.duration.toFixed(1)} s</small>
            <b aria-label="Estimated file size">{sizeLabel(summary)}</b>
          </div>
          <ul aria-label="Compare sizes">
            {#each compare as row (row.name)}
              <li><span>{row.name}</span> <b>{sizeLabel(row.size)}</b></li>
            {/each}
          </ul>
        </div>

        <div class="notes">
          <b>{notes.title}</b>
          <ul>
            {#each notes.pros as pro (pro)}<li class="pro">+ {pro}</li>{/each}
            {#each notes.cons as con (con)}<li class="con">− {con}</li>{/each}
          </ul>
        </div>

        <details class="why">
          <summary>Why choose a format and size?</summary>
          <p>{WHY.export}</p>
        </details>
      </div>
    </div>

    <div class="actions">
      <label class="radio">
        <input type="checkbox" bind:checked={alsoSave} />
        Also save the project (.mve) so I can edit it later
      </label>
      <span class="spacer"></span>
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={exportNow}><Icon name="export" size={14} /> Export</button>
    </div>
  </div>
</div>

<style>
  select {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    z-index: 10;
  }
  .dialog {
    width: min(860px, calc(100vw - 40px));
    max-height: calc(100vh - 40px);
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  h2 {
    font-size: 16px;
    margin: 0;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  h3 {
    font-size: 12px;
    color: var(--tx-2);
    margin: 10px 0 6px;
  }
  .col > h3:first-child {
    margin-top: 0;
  }
  .syl {
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .cols {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 18px;
  }
  .presets {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .preset {
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 10px;
    text-align: left;
  }
  .preset[aria-pressed='true'],
  .containers button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .pl {
    display: flex;
    flex-direction: column;
  }
  .pl small,
  .radio small {
    color: var(--tx-3);
    font-size: 11px;
  }
  .containers {
    display: flex;
  }
  .containers button {
    flex: 1;
  }
  .compression {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .radio {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 12.5px;
  }
  .radio.off {
    opacity: 0.5;
  }
  .grid {
    display: grid;
    grid-template-columns: 96px 1fr;
    gap: 6px 10px;
    align-items: center;
    font-size: 12.5px;
  }
  .grid label,
  .lbl {
    color: var(--tx-2);
    font-size: 12px;
  }
  .codec {
    color: var(--tx-2);
  }
  .quality {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .q {
    min-width: 70px;
    text-align: center;
    font-weight: 600;
  }
  .estimate {
    margin-top: 12px;
    display: flex;
    gap: 16px;
    padding: 10px 12px;
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
  .estimate ul {
    flex: 1;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 11.5px;
    color: var(--tx-2);
  }
  .estimate li {
    display: flex;
    justify-content: space-between;
  }
  .notes {
    margin-top: 10px;
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
    color: var(--ok, #5fe0a5);
  }
  .con {
    color: var(--danger);
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
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .spacer {
    flex: 1;
  }
</style>
