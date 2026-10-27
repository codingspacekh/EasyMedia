<script lang="ts">
  // Snapshot — extract a still image (V10, screen 09): choose the exact frame, hide text, pick a
  // picture format, and optionally put the still on the timeline.
  import { untrack } from 'svelte';
  import type { App } from '../app/app.ts';
  import { WHY } from '../core/effects/help.ts';
  import { formatTime } from '../core/model/time.ts';
  import { mainTrackDuration } from '../core/model/timeline.ts';
  import TimeField from './TimeField.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const store = $derived(app.store);
  const fps = $derived($store.history.present.settings.fps);
  const end = $derived(mainTrackDuration($store.history.present.timeline.main));

  const FORMATS = [
    ['png', 'PNG', 'lossless — good for using again in the video'],
    ['jpg', 'JPG', 'smaller, but lossy'],
    ['bmp', 'BMP', 'not compressed — large'],
    ['tiff', 'TIFF', 'high quality, large — for printing or editing'],
  ] as const;

  let format: (typeof FORMATS)[number][0] = $state('png');
  /** The file name, following the frame until the student types one. */
  let typedName: string | null = $state(null);
  const name = $derived(typedName ?? `Snapshot_${$store.playhead.toFixed(2)}s`);
  let hideText = $state(true);
  let addToTimeline = $state(false);
  let duration = $state(5);
  let saving = $state(false);

  // On the very end of the video there is no frame: use the last one.
  untrack(() => {
    const last = Math.max(0, end - 1 / fps);
    if ($store.playhead > last) app.setPlayhead(last);
  });

  function step(frames: number): void {
    const t = $store.playhead + frames / fps;
    app.setPlayhead(Math.min(Math.max(0, t), Math.max(0, end - 1 / fps)));
  }

  async function save(): Promise<void> {
    saving = true;
    const id = await app.snapshot({
      time: $store.playhead,
      hideText,
      addToTimeline,
      duration,
      format,
      name,
    });
    saving = false;
    if (id !== null) onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Snapshot">
    <h2>Snapshot <span class="syl">11.1 extracting a still image</span></h2>

    <div class="frame">
      <button onclick={() => step(-1)}>Previous frame</button>
      <b class="tc">{formatTime($store.playhead)}</b>
      <button onclick={() => step(1)}>Next frame</button>
    </div>
    <p class="hint">The preview shows the frame that will be saved.</p>

    <label class="check">
      <input type="checkbox" bind:checked={hideText} />
      Hide text (captions, titles, credits)
    </label>

    <label class="file-name">
      File name
      <input
        type="text"
        aria-label="File name"
        value={name}
        oninput={(e) => (typedName = e.currentTarget.value)}
      />
      <span>.{format}</span>
    </label>

    <fieldset>
      <legend>Picture format</legend>
      {#each FORMATS as [value, name, note] (value)}
        <label class="check">
          <input
            aria-label={name}
            type="radio"
            name="snapshot-format"
            checked={format === value}
            onchange={() => (format = value)}
          />
          {name}
          <span class="hint">— {note}</span>
        </label>
      {/each}
    </fieldset>

    <label class="check">
      <input type="checkbox" bind:checked={addToTimeline} />
      Add to the timeline after this clip
    </label>
    {#if addToTimeline}
      <TimeField
        label="Show it for"
        value={duration}
        commit={(t) => {
          if (t < 0.1) return 'A still must show for at least 0.1 s.';
          duration = t;
          return null;
        }}
      />
    {/if}

    <p class="hint">
      The picture goes straight into the media bin (Images). It is kept in a Snapshots folder next
      to the project{$store.projectPath
        ? ''
        : ' once you save it — until then, in EasyMedia’s own folder'}.
    </p>

    <details class="why" open>
      <summary>Why extract a still?</summary>
      <p>{WHY.snapshot}</p>
    </details>

    <div class="actions">
      <button onclick={onclose}>Cancel</button>
      <button class="primary" disabled={saving} onclick={save}>Add to media</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    padding: 70px 24px;
    z-index: 10;
    pointer-events: none;
  }
  .dialog {
    pointer-events: auto;
    width: 340px;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  h2 {
    font-size: 15px;
    margin: 0;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .frame {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  }
  .tc {
    font: 600 14px var(--mono);
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  legend {
    font-size: 12px;
    color: var(--tx-2);
    margin-bottom: 4px;
  }
  .file-name {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
  }
  .file-name input {
    flex: 1;
    min-width: 0;
    background: var(--bg-2);
    color: var(--tx-1);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    padding: 5px 8px;
  }
  .file-name span {
    color: var(--tx-3);
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12.5px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 0;
  }
  .why summary {
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
    justify-content: flex-end;
    gap: 8px;
  }
</style>
