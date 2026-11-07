<script lang="ts">
  // G1, G10 (M18): New image… and Image settings: the canvas's width and height in px, cm, mm,
  // in or pt; its resolution (dpi), which turns a printed size into pixels; its background (a
  // colour, or transparent); presets for the sizes the papers ask for (A4, 10 cm, 200 px logos).
  // A new image starts empty; the settings change the canvas of the one open (the drawing stays
  // where it is).
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { TRANSPARENT } from '../../core/animation/rules.ts';
  import {
    canvasPixels,
    graphicOf,
    IMAGE_PRESETS,
    type ImagePreset,
  } from '../../core/graphics/document.ts';
  import {
    fromPx,
    PRINT_DPI,
    roundIn,
    SCREEN_DPI,
    UNIT_NAMES,
    UNITS,
    type Unit,
  } from '../../core/graphics/units.ts';
  import { EditError } from '../../core/model/errors.ts';
  import Dialog from '../Dialog.svelte';
  import Why from '../Why.svelte';
  import ColourField from '../animation/ColourField.svelte';
  import NumField from '../animation/NumField.svelte';

  let { app, mode, onclose }: { app: App; mode: 'new' | 'edit'; onclose: () => void } = $props();
  const doc = untrack(() => app.graphics.store.get().history.present);
  const isNew = untrack(() => mode === 'new');
  const settings = graphicOf(doc);
  const startUnits: Unit = isNew ? 'px' : settings.units;
  let units: Unit = $state(startUnits);
  let dpi = $state(isNew ? SCREEN_DPI : settings.dpi);
  let width = $state(
    isNew ? 1280 : roundIn(fromPx(doc.stage.width, startUnits, settings.dpi), startUnits),
  );
  let height = $state(
    isNew ? 720 : roundIn(fromPx(doc.stage.height, startUnits, settings.dpi), startUnits),
  );
  let name = $state(isNew ? 'Untitled' : doc.name);
  let transparent = $state(!isNew && doc.stage.background === TRANSPARENT);
  let colour = $state(
    isNew || doc.stage.background === TRANSPARENT ? '#ffffff' : doc.stage.background,
  );
  let error: string | null = $state(null);

  /** The canvas this makes, in pixels, or why it cannot be made. */
  const pixels = $derived.by(() => {
    try {
      return { ...canvasPixels({ width, height, units, dpi }), error: null };
    } catch (e) {
      return { width: 0, height: 0, error: e instanceof EditError ? e.message : String(e) };
    }
  });

  function choose(preset: ImagePreset): void {
    units = preset.units;
    dpi = preset.dpi;
    width = preset.width;
    height = preset.height;
  }

  /**
   * Another unit: the same size shown in it. The pixels are read once, first: `pixels` follows
   * `width`, so read after the width changes it is the new width in the old unit.
   */
  function changeUnits(next: Unit): void {
    const now = pixels;
    if (!now.error) {
      width = roundIn(fromPx(now.width, next, dpi), next);
      height = roundIn(fromPx(now.height, next, dpi), next);
    }
    units = next;
  }

  async function apply(): Promise<void> {
    const background = transparent ? TRANSPARENT : colour;
    if (mode === 'new') {
      error = await app.graphics.newImage({
        name: name.trim() || 'Untitled',
        size: { width, height, units, dpi },
        background,
      });
    } else if (pixels.error) {
      error = pixels.error;
    } else {
      error = app.graphics.setImage({
        width: pixels.width,
        height: pixels.height,
        dpi,
        units,
        background,
      });
    }
    if (!error) onclose();
  }
</script>

<Dialog
  label={mode === 'new' ? 'New image' : 'Image settings'}
  syllabus="19.1 image resolutions"
  width={500}
  {onclose}
>
  <div class="presets" role="group" aria-label="Sizes">
    {#each IMAGE_PRESETS as preset (preset.name)}
      <button
        class="sm"
        title={preset.use}
        aria-pressed={units === preset.units &&
          dpi === preset.dpi &&
          width === preset.width &&
          height === preset.height}
        onclick={() => choose(preset)}>{preset.name}</button
      >
    {/each}
  </div>
  <div class="grid">
    {#if mode === 'new'}
      <div class="field wide">
        <label for="image-name">Name</label>
        <input id="image-name" class="text" bind:value={name} />
      </div>
    {/if}
    <NumField
      label="Width"
      value={width}
      unit={units}
      decimals={units === 'px' ? 0 : 2}
      commit={(v) => {
        width = v;
        return null;
      }}
    />
    <NumField
      label="Height"
      value={height}
      unit={units}
      decimals={units === 'px' ? 0 : 2}
      commit={(v) => {
        height = v;
        return null;
      }}
    />
    <div class="field">
      <label for="image-units">Units</label>
      <select
        id="image-units"
        value={units}
        onchange={(e) => changeUnits((e.currentTarget as HTMLSelectElement).value as Unit)}
      >
        {#each UNITS as u (u)}<option value={u}>{UNIT_NAMES[u]} ({u})</option>{/each}
      </select>
    </div>
    <div class="field">
      <label for="image-dpi">Resolution</label>
      <div class="row">
        <input
          id="image-dpi"
          type="number"
          min="10"
          max="1200"
          step="1"
          value={dpi}
          onchange={(e) => (dpi = Number((e.currentTarget as HTMLInputElement).value))}
        />
        <span class="unit">dpi</span>
      </div>
    </div>
    <ColourField
      label="Background"
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
  </div>
  <p class="made" aria-live="polite">
    {#if pixels.error}
      <span class="error">{pixels.error}</span>
    {:else}
      The canvas is <b>{pixels.width} × {pixels.height} pixels</b>{#if units !== 'px'}, {width} ×
        {height}
        {units} printed at {dpi} dpi{/if}.
    {/if}
  </p>
  <p class="hint">
    {dpi >= PRINT_DPI
      ? `${dpi} dpi suits print: each inch holds ${dpi} pixels, so the printed picture is sharp.`
      : dpi < 150
        ? `${dpi} dpi suits a screen; printed, it would look blocky (pixelated). Choose 300 dpi for print.`
        : `${dpi} dpi: enough for a screen, a little soft in print (300 dpi is usual).`}
    {#if mode === 'edit'}The drawing stays where it is: a bigger canvas adds room on the right and
      below.{/if}
  </p>
  <Why tool="graphicImage" />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={!!pixels.error} onclick={() => void apply()}
      >{mode === 'new' ? 'Create' : 'Apply'}</button
    >
  {/snippet}
</Dialog>

<style>
  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 16px;
  }
  .wide {
    grid-column: 1 / -1;
  }
  .field {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }
  .field label {
    color: var(--tx-2);
    font-size: 12px;
  }
  select,
  input.text {
    width: 100%;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row input {
    width: 80px;
  }
  .unit {
    color: var(--tx-2);
    font-size: 12px;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin: 0 0 6px;
    font-size: 12px;
  }
  .made {
    margin: 8px 0 4px;
    font-size: 12.5px;
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
