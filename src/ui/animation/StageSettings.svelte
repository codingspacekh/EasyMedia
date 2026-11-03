<script lang="ts">
  // Stage settings (AN1, AN2): size, aspect-ratio presets, colour (or none: AN21), frame rate
  // and length.
  import Dialog from '../Dialog.svelte';
  import Why from '../Why.svelte';
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import {
    aspectOf,
    FPS_CHOICES,
    presetSize,
    STAGE_PRESETS,
    TRANSPARENT,
  } from '../../core/animation/rules.ts';
  import { framesFor, secondsFor } from '../../core/animation/time.ts';
  import ColourField from './ColourField.svelte';
  import NumField from './NumField.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const current = untrack(() => app.animation.store.get().history.present.stage);
  let width = $state(current.width);
  let height = $state(current.height);
  // AN21: no background (transparent); the colour is kept to come back when it is turned off.
  let transparent = $state(current.background === TRANSPARENT);
  let colour = $state(current.background === TRANSPARENT ? '#ffffff' : current.background);
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
    const background = transparent ? TRANSPARENT : colour;
    error = app.animation.setStage({ width, height, background, fps, length });
    if (!error) onclose();
  }
</script>

<Dialog label="Stage settings" syllabus="20.1 configuring the stage" width={440} {onclose}>
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
      value={colour}
      disabled={transparent}
      commit={(c) => {
        colour = c;
        return null;
      }}
    />
    <label class="check">
      <input type="checkbox" bind:checked={transparent} />
      Transparent (no background)
    </label>
    {#if transparent}
      <p class="hint">
        PNG pictures, GIFs and the web page keep it see-through; an MP4 cannot, so it is white.
      </p>
    {/if}
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
    The stage is the area where the animation takes place: only what is on it is seen. Changing the
    frame rate keeps the length in frames: 72 frames last 3 s at 24 fps, 2.4 s at 30 fps.
  </p>
  <Why tool="stage" />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" onclick={apply}>Apply</button>
  {/snippet}
</Dialog>

<style>
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0 0 6px;
    font-size: 12px;
  }
  .presets {
    display: flex;
    gap: 6px;
    align-items: center;
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
  }
  .hint {
    margin: 0;
    color: var(--tx-2);
    font-size: 11.5px;
  }
  .error {
    margin: 0;
    color: var(--danger);
    font-size: 12px;
  }
</style>
