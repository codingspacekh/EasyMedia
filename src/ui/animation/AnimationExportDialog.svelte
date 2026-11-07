<script lang="ts">
  // Export animation (AN15, T7, N12): MP4, AVI, MOV, animated GIF, an HTML web animation, PNG
  // sequence or the frame at the playhead as a PNG or SVG, each with its pros and cons; another
  // width (the height in proportion) and a range of frames; the frames, the length and the
  // estimated size before exporting; then the progress, with Cancel. AN8: a GIF or web page loops
  // or plays once. AN28: whether the animation's sounds go into the file.
  import type { App } from '../../app/app.ts';
  import { editorOf } from './editor.ts';
  import {
    ANIMATION_FORMATS,
    carriesSound,
    hasRange,
    hasSize,
    type AnimationExportOptions,
    type AnimationFormat,
  } from '../../core/animation/export.ts';
  import { parseFrame } from '../../core/animation/time.ts';
  import Dialog from '../Dialog.svelte';
  import { ui } from '../ui-state.svelte.ts';
  import { animUi } from './animation-ui.svelte.ts';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);
  const store = $derived(editor.anim.store);
  const exporting = $derived($store.exporting);
  const stage = $derived($store.history.present.stage);
  /** AN8: saved with the animation; a GIF and the web page stop on the last frame. */
  const once = $derived(stage.playOnce === true);
  const ends = $derived(animUi.exportFormat === 'gif' || animUi.exportFormat === 'html');
  let running = $state(false);

  // ---- AN15: another width and a range of frames (empty: the stage's width, every frame) ----
  let widthText = $state('');
  let fromText = $state('');
  let toText = $state('');
  /** What was typed, as export options; a value that cannot be read is passed on to be explained. */
  const options = $derived.by((): AnimationExportOptions => {
    const out: AnimationExportOptions = {};
    const width = widthText.trim();
    if (width !== '') out.width = /^\d+$/.test(width) ? Number(width) : NaN;
    const from = fromText.trim() === '' ? 0 : parseFrame(fromText, stage.fps);
    const to = toText.trim() === '' ? stage.length - 1 : parseFrame(toText, stage.fps);
    if (fromText.trim() !== '' || toText.trim() !== '') {
      out.from = from ?? NaN;
      out.to = to ?? NaN;
    }
    return out;
  });
  const sized = $derived(hasSize(animUi.exportFormat));
  const ranged = $derived(hasRange(animUi.exportFormat));

  const chosen = $derived(ANIMATION_FORMATS.find((f) => f.id === animUi.exportFormat)!);
  // Read again when the animation changes (the stage size or length, its sounds).
  const summary = $derived.by(() => {
    void $store.history.present.stage;
    void $store.history.present.sounds;
    return anim.exportSummary(animUi.exportFormat, options);
  });

  /** AN28: what happens to the animation's sounds in this format. */
  const soundNote = $derived.by(() => {
    const n = summary.sounds;
    if (n === 0) return null;
    const its = n === 1 ? 'Its sound' : `Its ${n} sounds`;
    if (animUi.exportFormat === 'html')
      return `${its} ${n === 1 ? 'goes' : 'go'} inside the page. A browser plays sound only after a click, so the page shows “Click to play with sound” first.`;
    if (carriesSound(animUi.exportFormat))
      return `${its} ${n === 1 ? 'goes' : 'go'} into the video, each at its time.`;
    const what = animUi.exportFormat === 'gif' ? 'A GIF' : 'A picture';
    return `${what} has no sound: the animation’s ${n === 1 ? 'sound is' : `${n} sounds are`} left out. Choose MP4, AVI, MOV or HTML to keep ${n === 1 ? 'it' : 'them'}.`;
  });

  function sizeText(bytes: number): string {
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
    return `${Math.round(bytes)} bytes`;
  }

  async function run(): Promise<void> {
    running = true;
    try {
      await anim.exportAnimation(animUi.exportFormat, undefined, {
        ...(sized && options.width !== undefined ? { width: options.width } : {}),
        ...(ranged && options.from !== undefined
          ? { from: options.from, to: options.to ?? stage.length - 1 }
          : {}),
      });
    } finally {
      running = false;
      onclose();
    }
  }

  /** M14: an MP4 beside the animation file, put on the video timeline; Video mode is shown. */
  async function sendToVideo(): Promise<void> {
    running = true;
    let sent = false;
    try {
      sent = await app.sendAnimationToVideo();
    } finally {
      running = false;
      onclose();
      if (sent) ui.mode = 'Video';
    }
  }

  function choose(id: AnimationFormat): void {
    animUi.exportFormat = id;
  }

  const phaseText = $derived.by(() => {
    if (!exporting && $store.busy && animUi.exportFormat === 'html') return 'Making the web page…';
    if (!exporting) return 'Choosing where to save…';
    if (exporting.phase === 'encoding')
      return `Making the ${exporting.format === 'gif' ? 'GIF' : exporting.format.toUpperCase()}…`;
    const done = Math.round(exporting.progress * summary.frames);
    return `Drawing frame ${Math.min(summary.frames, done + 1)} of ${summary.frames}…`;
  });
</script>

<Dialog
  label="Export animation"
  syllabus="20.1 exporting for an application and audience"
  width={600}
  busy={running || !!exporting}
  {onclose}
>
  <fieldset disabled={running}>
    <legend class="sr-only">Format</legend>
    {#each ANIMATION_FORMATS as f (f.id)}
      <label class="format" class:on={f.id === animUi.exportFormat}>
        <input
          type="radio"
          name="anim-format"
          value={f.id}
          checked={f.id === animUi.exportFormat}
          onchange={() => choose(f.id)}
        />
        <span class="name">{f.label}</span>
        <span class="use">{f.use}</span>
      </label>
    {/each}
  </fieldset>

  <div class="detail">
    <ul class="pros" aria-label="Pros">
      {#each chosen.pros as p (p)}<li>{p}</li>{/each}
    </ul>
    <ul class="cons" aria-label="Cons">
      {#each chosen.cons as c (c)}<li>{c}</li>{/each}
    </ul>
  </div>

  {#if sized || ranged}
    <div class="choices">
      {#if sized}
        <label class="choice"
          ><span class="cap">Width</span>
          <input
            class="num"
            aria-label="Width in pixels"
            placeholder={String(stage.width)}
            title="Another width in pixels (the height is kept in proportion). Empty: the stage’s width"
            disabled={running}
            bind:value={widthText}
          />
          <span class="hint">px → {summary.size.width} × {summary.size.height}</span>
        </label>
      {/if}
      {#if ranged}
        <span class="choice" role="group" aria-label="Frames"
          ><span class="cap">Frames</span>
          <input
            class="num"
            aria-label="From frame"
            placeholder="0"
            title="The first frame exported: a frame (24) or a time (1 s). Empty: frame 0"
            disabled={running}
            bind:value={fromText}
          />
          <span class="hint">to</span>
          <input
            class="num"
            aria-label="To frame"
            placeholder={String(stage.length - 1)}
            title="The last frame exported (it is exported too). Empty: the last frame"
            disabled={running}
            bind:value={toText}
          />
          {#if fromText || toText}
            <button
              class="sm"
              disabled={running}
              onclick={() => {
                fromText = '';
                toText = '';
              }}>Whole animation</button
            >
          {/if}
        </span>
      {/if}
    </div>
  {/if}

  {#if ends}
    <div class="ends" role="radiogroup" aria-label="When it ends">
      <span class="cap">When it ends</span>
      <label>
        <input
          type="radio"
          name="anim-ends"
          checked={!once}
          disabled={running}
          onchange={() => anim.setPlayOnce(false)}
        />
        Loop: play again and again
      </label>
      <label>
        <input
          type="radio"
          name="anim-ends"
          checked={once}
          disabled={running}
          onchange={() => anim.setPlayOnce(true)}
        />
        Play once and stop on the last frame
      </label>
    </div>
  {:else if animUi.exportFormat === 'mp4' || animUi.exportFormat === 'avi' || animUi.exportFormat === 'mov'}
    <p class="summary">
      A video plays once and stops at its end; whether it plays again is up to the video player.
    </p>
  {/if}

  {#if soundNote}
    <p class="summary sound" class:lost={!carriesSound(animUi.exportFormat)}>{soundNote}</p>
  {/if}

  {#if summary.error}
    <p class="note" role="alert">{summary.error}</p>
  {:else}
    <p class="summary mono">
      {summary.frames === 1
        ? `1 frame (the playhead) · about ${sizeText(summary.bytes)}`
        : `${summary.frames} frames · ${summary.seconds.toFixed(2)} s · about ${sizeText(summary.bytes)}`}
    </p>
  {/if}
  {#if summary.size.padded}
    <p class="note">
      {animUi.exportFormat.toUpperCase()} needs even sizes: it will be {summary.size.width} × {summary
        .size.height} (one pixel added).
    </p>
  {/if}

  {#if running}
    <div class="progress">
      <span>{phaseText}</span>
      <progress max="1" value={exporting?.progress ?? 0} aria-label="Export progress"></progress>
    </div>
  {/if}

  {#snippet buttons()}
    {#if running}
      <button onclick={() => anim.cancelExport()}>Cancel export</button>
    {:else}
      <button
        class="send"
        title="Save an MP4 (with its sounds) beside the animation file and put it on the video timeline"
        onclick={() => void sendToVideo()}>Send to Video mode</button
      >
      <button onclick={onclose}>Close</button>
      <button class="primary" disabled={summary.error !== null} onclick={() => void run()}
        >Export file</button
      >
    {/if}
  {/snippet}
</Dialog>

<style>
  fieldset {
    border: none;
    margin: 0;
    padding: 0;
    display: grid;
    /* Eight formats: two columns, so the dialog fits a small window. */
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .format {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 8px;
    align-items: center;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    cursor: pointer;
  }
  .format.on {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .name {
    font-weight: 600;
  }
  .use {
    grid-column: 2;
    color: var(--tx-2);
    font-size: 12px;
  }
  .detail {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    font-size: 12px;
  }
  .detail ul {
    margin: 0;
    padding-left: 16px;
  }
  .pros li::marker {
    content: '+ ';
    color: var(--success);
  }
  .cons li::marker {
    content: '− ';
    color: var(--warn);
  }
  .summary {
    margin: 0;
    color: var(--tx-2);
    font-size: 12px;
  }
  .note {
    margin: 0;
    color: var(--warn);
    font-size: 12px;
  }
  .progress {
    display: grid;
    gap: 4px;
    font-size: 12px;
  }
  .progress progress {
    width: 100%;
  }
  .send {
    margin-right: auto;
  }
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
    align-items: center;
    font-size: 12px;
  }
  .choice {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .choice .cap {
    color: var(--tx-2);
  }
  .choice .num {
    width: 64px;
  }
  .hint {
    color: var(--tx-2);
    font-family: var(--mono);
  }
  .sound.lost {
    color: var(--warn);
  }
  .ends {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    align-items: center;
    font-size: 12px;
  }
  .ends .cap {
    color: var(--tx-2);
  }
  .ends label {
    display: flex;
    gap: 6px;
    align-items: center;
    cursor: pointer;
  }
</style>
