<script lang="ts">
  // Project settings (V1, screen 11): aspect ratio, resolution, frame rate, fit.
  import { untrack } from 'svelte';
  import type { App } from '../app/app.ts';
  import { setProjectSettings } from '../app/commands.ts';
  import { WHY } from '../core/effects/help.ts';
  import type { ProjectSettings } from '../core/model/types.ts';

  let { app, onclose }: { app: App; onclose: () => void } = $props();

  const SIZES: Record<'16:9' | '4:3', [number, number][]> = {
    '16:9': [
      [3840, 2160],
      [1920, 1080],
      [1280, 720],
      [640, 360],
    ],
    '4:3': [
      [1440, 1080],
      [960, 720],
      [640, 480],
    ],
  };
  const FITS = [
    ['letterbox', 'Fit with black bars', 'Shows the whole picture'],
    ['crop', 'Crop to fill', 'Cuts off the edges'],
    ['stretch', 'Stretch', 'Distorts the picture'],
  ] as const;

  // The dialog edits a draft copy taken when it opens; Apply sends it as one command.
  const current: ProjectSettings = untrack(() => app.store.get().history.present.settings);
  let aspect = $state(current.aspect);
  let width = $state(current.width);
  let height = $state(current.height);
  let fps = $state(current.fps);
  let fit = $state(current.fit ?? 'letterbox');
  let error: string | null = $state(null);

  function chooseAspect(next: ProjectSettings['aspect']): void {
    aspect = next;
    if (next !== 'custom' && !SIZES[next].some(([w, h]) => w === width && h === height)) {
      // Default: 1920 × 1080 for 16:9, 960 × 720 for 4:3.
      [width, height] = SIZES[next][1]!;
    }
  }

  function apply(): void {
    const next = { ...current, aspect, width: Number(width), height: Number(height), fps, fit };
    const changed = (Object.keys(next) as (keyof ProjectSettings)[]).some(
      (k) => next[k] !== current[k],
    );
    error = changed ? app.edit(setProjectSettings(next)) : null;
    if (!error) onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Project settings">
    <h2>Project settings <span class="syl">11.1 aspect ratio</span></h2>

    <fieldset>
      <legend>Aspect ratio</legend>
      {#each ['16:9', '4:3', 'Custom'] as label (label)}
        {@const value = label === 'Custom' ? 'custom' : label}
        <label class="choice">
          <input
            type="radio"
            name="aspect"
            checked={aspect === value}
            onchange={() => chooseAspect(value as ProjectSettings['aspect'])}
          />
          {label}
        </label>
      {/each}
    </fieldset>

    <fieldset>
      <legend>Resolution</legend>
      {#if aspect === 'custom'}
        <label class="size"
          >Width <input type="number" bind:value={width} min="16" max="7680" step="2" /></label
        >
        <label class="size"
          >Height <input type="number" bind:value={height} min="16" max="7680" step="2" /></label
        >
      {:else}
        {#each SIZES[aspect] as [w, h] (`${w}x${h}`)}
          <label class="choice">
            <input
              type="radio"
              name="size"
              checked={width === w && height === h}
              onchange={() => ([width, height] = [w, h])}
            />
            {w} × {h}
          </label>
        {/each}
      {/if}
    </fieldset>

    <fieldset>
      <legend>Frame rate</legend>
      {#each [24, 25, 30] as const as rate (rate)}
        <label class="choice">
          <input type="radio" name="fps" checked={fps === rate} onchange={() => (fps = rate)} />
          {rate} fps
        </label>
      {/each}
    </fieldset>

    <fieldset>
      <legend>If a clip has a different shape</legend>
      {#each FITS as [value, label, hint] (value)}
        <label class="choice">
          <input
            type="radio"
            name="fit"
            aria-label={label}
            checked={fit === value}
            onchange={() => (fit = value)}
          />
          {label} <span class="hint">{hint}</span>
        </label>
      {/each}
    </fieldset>

    <p class="why">
      <b>Why does aspect ratio matter?</b>
      {WHY.aspectRatio}
    </p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}

    <div class="actions">
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={apply}>Apply</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 9, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    width: 560px;
    max-height: 90vh;
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 18px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 12px;
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
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
  }
  legend {
    width: 100%;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--tx-3);
    margin-bottom: 6px;
  }
  .choice,
  .size {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .size input {
    width: 90px;
    background: var(--bg-2);
    color: var(--tx-1);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 4px 6px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .why {
    font-size: 12px;
    color: var(--tx-2);
    background: rgba(79, 140, 255, 0.08);
    border: 1px solid rgba(79, 140, 255, 0.25);
    border-radius: 6px;
    padding: 10px;
  }
  .error {
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
