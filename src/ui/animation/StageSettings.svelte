<script lang="ts">
  // Stage settings (AN1, AN2): size, aspect-ratio presets, colour, frame rate and length.
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { aspectOf, FPS_CHOICES, presetSize, STAGE_PRESETS } from '../../core/animation/rules.ts';
  import { framesFor, secondsFor } from '../../core/animation/time.ts';
  import { WHY } from '../../core/effects/help.ts';
  import ColourField from './ColourField.svelte';
  import NumField from './NumField.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const current = untrack(() => app.animation.store.get().history.present.stage);
  let width = $state(current.width);
  let height = $state(current.height);
  let background = $state(current.background);
  let fps = $state(current.fps);
  let length = $state(current.length);
  let error: string | null = $state(null);
  const ratio = $derived(aspectOf(width, height));
  const seconds = $derived(secondsFor(length, fps));

  function choose(preset: (typeof STAGE_PRESETS)[number]): void {
    // Keep the width the student has and set the height to match, unless it is the default.
    const size =
      width === 1280 && height === 720
        ? { width: preset.width, height: preset.height }
        : presetSize(preset.ratio, { width });
    width = size.width;
    height = size.height;
  }

  function apply(): void {
    error = app.animation.setStage({ width, height, background, fps, length });
    if (!error) onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Stage settings">
    <h2>Stage settings <span class="syl">20.1 configuring the stage</span></h2>
    <div class="presets" role="group" aria-label="Aspect ratio">
      {#each STAGE_PRESETS as preset (preset.ratio)}
        <button
          class="sm"
          aria-pressed={ratio === preset.ratio}
          title={preset.use}
          onclick={() => choose(preset)}>{preset.ratio}</button
        >
      {/each}
      <span class="now">Now {ratio}</span>
    </div>
    <div class="grid">
      <NumField
        label="Width"
        value={width}
        unit="px"
        commit={(v) => {
          width = v;
          return null;
        }}
      />
      <NumField
        label="Height"
        value={height}
        unit="px"
        commit={(v) => {
          height = v;
          return null;
        }}
      />
      <ColourField
        label="Colour"
        value={background}
        commit={(c) => {
          background = c;
          return null;
        }}
      />
      <div class="field">
        <label for="stage-fps">Frame rate</label>
        <div class="row">
          <select
            id="stage-fps"
            value={String(fps)}
            onchange={(e) => (fps = Number((e.currentTarget as HTMLSelectElement).value))}
          >
            {#each FPS_CHOICES as f (f)}<option value={String(f)}>{f} fps</option>{/each}
            {#if !FPS_CHOICES.includes(fps)}<option value={String(fps)}>{fps} fps</option>{/if}
          </select>
        </div>
      </div>
      <NumField
        label="Length"
        value={length}
        unit="frames"
        commit={(v) => {
          length = Math.round(v);
          return null;
        }}
      />
      <NumField
        label="= seconds"
        value={seconds}
        unit="s"
        decimals={2}
        commit={(v) => {
          length = Math.max(1, framesFor(v, fps));
          return null;
        }}
      />
    </div>
    <p class="hint">
      The stage is the area where the animation takes place: only what is on it is seen. Changing
      the frame rate keeps the length in frames: 72 frames last 3 s at 24 fps, 2.4 s at 30 fps.
    </p>
    <details class="why">
      <summary>Why use this?</summary>
      <p>{WHY.stage}</p>
    </details>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="buttons">
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={apply}>Apply</button>
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
    width: 440px;
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
  .presets {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 12px;
  }
  .presets .now {
    margin-left: auto;
    color: var(--tx-2);
    font-size: 12px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 16px;
  }
  .field {
    display: grid;
    grid-template-columns: 58px 1fr;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .field label {
    color: var(--tx-2);
    font-size: 12px;
  }
  select {
    width: 100%;
    font: inherit;
    background: var(--bg-2);
    color: var(--tx-1);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 4px 6px;
  }
  .hint {
    margin: 8px 0 0;
    color: var(--tx-2);
    font-size: 11.5px;
  }
  .why summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 11.5px;
    margin-top: 8px;
  }
  .why p {
    margin: 4px 0 0;
    font-size: 11.5px;
    color: var(--tx-2);
  }
  .error {
    margin: 8px 0 0;
    color: var(--danger);
    font-size: 12px;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
</style>
