<script lang="ts">
  // G11 (M18): Export image: SVG, PNG or JPG with what each is good for; the whole image, the
  // selected objects, or each selected object in a file of its own; the size (the canvas, a width
  // or height in px, a %, or a printed width at a resolution); JPG quality and background.
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import { TRANSPARENT } from '../../core/animation/rules.ts';
  import { graphicOf } from '../../core/graphics/document.ts';
  import {
    exportPixels,
    FORMAT_INFO,
    GRAPHIC_FORMATS,
    imageOfObjects,
    type ExportSize,
    type ExportWhat,
    type GraphicFormat,
  } from '../../core/graphics/export.ts';
  import { UNITS, type Unit } from '../../core/graphics/units.ts';
  import { EditError } from '../../core/model/errors.ts';
  import Dialog from '../Dialog.svelte';
  import Why from '../Why.svelte';
  import ColourField from '../animation/ColourField.svelte';
  import { animUi } from '../animation/animation-ui.svelte.ts';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const opened = untrack(() => app.graphics.store.get());
  const doc = opened.history.present;
  const settings = graphicOf(doc);
  const selected = opened.selection.length;

  let format: GraphicFormat = $state(animUi.graphicFormat);
  // The whole image unless the student chooses otherwise: a shape just drawn is still selected.
  let what: ExportWhat = $state('image');
  let sizeBy: ExportSize['by'] = $state('canvas');
  let px = $state(doc.stage.width);
  let percent = $state(100);
  let printWidth = $state(10);
  let printUnit: Unit = $state(settings.units === 'px' ? 'cm' : settings.units);
  let printDpi = $state(settings.dpi >= 150 ? settings.dpi : 300);
  let quality = $state(90);
  let background = $state(doc.stage.background === TRANSPARENT ? '#ffffff' : doc.stage.background);
  let busy = $state(false);

  const size = $derived.by((): ExportSize => {
    switch (sizeBy) {
      case 'width':
        return { by: 'width', px };
      case 'height':
        return { by: 'height', px };
      case 'percent':
        return { by: 'percent', percent };
      case 'print':
        return { by: 'print', width: printWidth, unit: printUnit, dpi: printDpi };
      default:
        return { by: 'canvas' };
    }
  });
  /** What one file will be, in pixels (for the selection: its own box), or why it cannot. */
  const result = $derived.by(() => {
    try {
      const base = what === 'selection' && selected ? imageOfObjects(doc, opened.selection) : doc;
      return { ...exportPixels(base.stage, settings.dpi, size), error: null };
    } catch (e) {
      return { width: 0, height: 0, dpi: 0, error: e instanceof EditError ? e.message : String(e) };
    }
  });
  const info = $derived(FORMAT_INFO[format]);

  async function run(): Promise<void> {
    animUi.graphicFormat = format;
    busy = true;
    const made = await app.graphics.exportImage({
      format,
      what,
      size,
      ...(format === 'jpg' ? { quality, background } : {}),
    });
    busy = false;
    if (made) onclose();
  }
</script>

<Dialog
  label="Export image"
  syllabus="19.1 exporting an image in different file formats"
  width={520}
  {busy}
  {onclose}
>
  <div class="formats" role="radiogroup" aria-label="Format">
    {#each GRAPHIC_FORMATS as f (f)}
      <label class="format" class:on={format === f}>
        <input type="radio" name="graphic-format" value={f} bind:group={format} />
        <b>{f.toUpperCase()}</b>
        <span>{FORMAT_INFO[f].kind === 'vector' ? 'vector' : FORMAT_INFO[f].compression}</span>
      </label>
    {/each}
  </div>
  <p class="about"><b>{info.label}.</b> {info.about}</p>

  <div class="field">
    <label for="export-what">Export</label>
    <select id="export-what" bind:value={what}>
      <option value="image">The whole image</option>
      <option value="selection" disabled={!selected}>The selected objects, cropped to them</option>
      <option value="each" disabled={!selected}
        >Each selected object in a file of its own (named after it)</option
      >
    </select>
  </div>

  <div class="field">
    <label for="export-size">Size</label>
    <select id="export-size" bind:value={sizeBy}>
      <option value="canvas">As it is ({doc.stage.width} × {doc.stage.height} px)</option>
      <option value="width">A width in pixels</option>
      <option value="height">A height in pixels</option>
      <option value="percent">A percentage</option>
      <option value="print">A printed width at a resolution</option>
    </select>
  </div>
  {#if sizeBy === 'width' || sizeBy === 'height'}
    <div class="field">
      <label for="export-px">{sizeBy === 'width' ? 'Width' : 'Height'}</label>
      <div class="row">
        <input id="export-px" type="number" min="1" step="1" bind:value={px} />
        <span class="unit">px, the other side in proportion</span>
      </div>
    </div>
  {:else if sizeBy === 'percent'}
    <div class="field">
      <label for="export-percent">Scale</label>
      <div class="row">
        <input id="export-percent" type="number" min="1" step="1" bind:value={percent} />
        <span class="unit">%</span>
      </div>
    </div>
  {:else if sizeBy === 'print'}
    <div class="field">
      <label for="export-print">Width</label>
      <div class="row">
        <input id="export-print" type="number" min="0.1" step="0.1" bind:value={printWidth} />
        <select aria-label="Printed width unit" bind:value={printUnit}>
          {#each UNITS.filter((u) => u !== 'px') as u (u)}<option value={u}>{u}</option>{/each}
        </select>
        <span class="unit">at</span>
        <input
          aria-label="Resolution"
          type="number"
          min="10"
          max="1200"
          step="1"
          bind:value={printDpi}
        />
        <span class="unit">dpi</span>
      </div>
    </div>
  {/if}

  {#if format === 'jpg'}
    <div class="field">
      <label for="export-quality">Quality</label>
      <div class="row">
        <input id="export-quality" type="range" min="1" max="100" step="1" bind:value={quality} />
        <span class="unit">{quality}</span>
      </div>
    </div>
    <p class="hint">
      Lower quality makes a smaller file and loses more detail (lossy compression).
    </p>
    {#if doc.stage.background === TRANSPARENT || what !== 'image'}
      <ColourField
        label="Background"
        value={background}
        commit={(c) => {
          background = c;
          return null;
        }}
      />
      <p class="hint">A JPG cannot be see-through: transparent parts become this colour.</p>
    {/if}
  {/if}

  <p class="made" aria-live="polite">
    {#if result.error}
      <span class="error">{result.error}</span>
    {:else if format === 'svg'}
      Vector shapes{sizeBy === 'print'
        ? `, ${printWidth} ${printUnit} wide`
        : settings.units !== 'px' && sizeBy === 'canvas'
          ? `, at its printed size`
          : ''}: sharp at any size.
    {:else}
      {what === 'each' ? 'Each file' : 'The file'}{what === 'each' ? ' fits its object' : ''}:
      <b>{result.width} × {result.height} px</b> at {result.dpi} dpi{#if info.transparency && (doc.stage.background === TRANSPARENT || what !== 'image')},
        see-through where nothing is drawn{/if}.
    {/if}
  </p>
  <Why tool="graphicExport" />
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={!!result.error || busy} onclick={() => void run()}
      >Export…</button
    >
  {/snippet}
</Dialog>

<style>
  .formats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }
  .format {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .format.on {
    border-color: var(--accent);
  }
  .format span {
    color: var(--tx-3);
    margin-left: auto;
  }
  .about {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--tx-2);
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
  select {
    width: 100%;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row input[type='number'] {
    width: 80px;
  }
  .row select {
    width: auto;
  }
  .unit {
    color: var(--tx-2);
    font-size: 12px;
  }
  .made {
    margin: 8px 0 4px;
    font-size: 12.5px;
  }
  .hint {
    margin: 0 0 6px;
    color: var(--tx-2);
    font-size: 11.5px;
  }
  .error {
    color: var(--danger);
    font-size: 12px;
  }
</style>
