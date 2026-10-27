<script lang="ts">
  // Export animation (AN15, T7, N12): MP4, animated GIF, PNG sequence or the frame at the
  // playhead as a PNG, each with its pros and cons; the frames, the length and the estimated size
  // before exporting; then the progress, with Cancel.
  import type { App } from '../../app/app.ts';
  import { ANIMATION_FORMATS, type AnimationFormat } from '../../core/animation/export.ts';
  import { animUi } from './animation-ui.svelte.ts';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const exporting = $derived($store.exporting);
  let running = $state(false);

  const chosen = $derived(ANIMATION_FORMATS.find((f) => f.id === animUi.exportFormat)!);
  // Read again when the animation changes (the stage size or length).
  const summary = $derived.by(() => {
    void $store.history.present.stage;
    return anim.exportSummary(animUi.exportFormat);
  });

  function sizeText(bytes: number): string {
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
    return `${Math.round(bytes)} bytes`;
  }

  async function run(): Promise<void> {
    running = true;
    try {
      await anim.exportAnimation(animUi.exportFormat);
    } finally {
      running = false;
      onclose();
    }
  }

  function choose(id: AnimationFormat): void {
    animUi.exportFormat = id;
  }

  const phaseText = $derived.by(() => {
    if (!exporting) return 'Choosing where to save…';
    if (exporting.phase === 'encoding')
      return `Making the ${exporting.format === 'gif' ? 'GIF' : 'MP4'}…`;
    const done = Math.round(exporting.progress * summary.frames);
    return `Drawing frame ${Math.min(summary.frames, done + 1)} of ${summary.frames}…`;
  });
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Export animation">
    <h2>
      Export animation <span class="syl">20.1 exporting for an application and audience</span>
    </h2>

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

    <p class="summary mono">
      {summary.frames === 1
        ? `1 frame (the playhead) · about ${sizeText(summary.bytes)}`
        : `${summary.frames} frames · ${summary.seconds.toFixed(2)} s · about ${sizeText(summary.bytes)}`}
    </p>
    {#if summary.size.padded}
      <p class="note">
        MP4 needs even sizes: it will be {summary.size.width} × {summary.size.height} (one pixel added).
      </p>
    {/if}

    {#if running}
      <div class="progress">
        <span>{phaseText}</span>
        <progress max="1" value={exporting?.progress ?? 0} aria-label="Export progress"></progress>
      </div>
    {/if}

    <div class="buttons">
      {#if running}
        <button onclick={() => anim.cancelExport()}>Cancel export</button>
      {:else}
        <button onclick={onclose}>Close</button>
        <button class="primary" onclick={() => void run()}>Export file</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20;
  }
  .dialog {
    width: 520px;
    max-width: calc(100vw - 32px);
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-l);
    padding: 18px 20px;
  }
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .syl {
    font-size: 11px;
    font-weight: 500;
    color: var(--tx-3);
  }
  fieldset {
    border: none;
    margin: 0;
    padding: 0;
    display: grid;
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
    margin: 12px 0 6px;
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
    margin: 8px 0 4px;
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
    margin-top: 10px;
    font-size: 12px;
  }
  .progress progress {
    width: 100%;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 14px;
  }
</style>
