<script lang="ts">
  // Graphics mode's part of the header (M18): New image…, the canvas chip (its size, resolution
  // and background: G1, G10), zoom, Save, Undo, Redo, Send to Animation (GL3) and Export (G11).
  import type { App } from '../../app/app.ts';
  import { canRedo, canUndo } from '../../app/history.ts';
  import { TRANSPARENT } from '../../core/animation/rules.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import { graphicOf } from '../../core/graphics/document.ts';
  import { formatLength } from '../../core/graphics/units.ts';
  import Icon from '../Icon.svelte';
  import { animUi, ZOOM_STEPS } from '../animation/animation-ui.svelte.ts';
  import { ui } from '../ui-state.svelte.ts';

  let { app }: { app: App } = $props();
  const g = $derived(app.graphics);
  const store = $derived(app.graphics.store);
  const doc = $derived($store.history.present);
  const image = $derived(graphicOf(doc));
  const printed = $derived(
    image.units === 'px'
      ? ''
      : ` · ${formatLength(doc.stage.width, image.units, image.dpi).replace(` ${image.units}`, '')} × ${formatLength(doc.stage.height, image.units, image.dpi)}`,
  );

  const zoomLabel = $derived($store.zoom === 'fit' ? 'Fit' : `${Math.round($store.zoom * 100)} %`);
  function zoomBy(direction: 1 | -1): void {
    const current = $store.zoom === 'fit' ? 1 : $store.zoom;
    const next =
      direction === 1
        ? (ZOOM_STEPS.find((z) => z > current + 1e-9) ?? ZOOM_STEPS.at(-1)!)
        : ([...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? ZOOM_STEPS[0]!);
    g.setZoom(next);
  }

  function send(): void {
    if (app.sendGraphicToAnimation()) ui.mode = 'Animation';
  }
</script>

<button
  class="ghost"
  aria-label="New image"
  title="A new image: its size in px, cm, mm or inches, its resolution and background"
  onclick={() => (animUi.dialog = 'newImage')}
  ><Icon name="plus" /><span class="long">New</span></button
>
<button
  class="chip"
  aria-label="Image settings: {doc.stage.width} × {doc.stage.height} px{printed} · {image.dpi} dpi"
  title={withWhy('Canvas size, resolution and background', 'graphicImage')}
  onclick={() => (animUi.dialog = 'image')}
>
  <Icon name="image" size={14} />
  <b>{doc.stage.width} × {doc.stage.height} px</b>
  <span class="detail">{printed} · {image.dpi} dpi</span>
  <span
    class="swatch"
    class:none={doc.stage.background === TRANSPARENT}
    style:background={doc.stage.background === TRANSPARENT ? undefined : doc.stage.background}
  ></span>
  <Icon name="chevron" size={14} />
</button>
<span class="spacer"></span>
<div class="zoom" role="group" aria-label="Zoom">
  <button
    class="ghost icon-only"
    aria-label="Zoom out"
    title="Zoom out (Ctrl/Cmd −)"
    onclick={() => zoomBy(-1)}><Icon name="zoomOut" /></button
  >
  <button
    class="ghost zoomlabel"
    aria-label="Zoom to fit"
    title="Zoom to fit the window (Ctrl/Cmd 0); click for 100 %"
    onclick={() => g.setZoom($store.zoom === 'fit' ? 1 : 'fit')}>{zoomLabel}</button
  >
  <button
    class="ghost icon-only"
    aria-label="Zoom in"
    title="Zoom in (Ctrl/Cmd +)"
    onclick={() => zoomBy(1)}><Icon name="zoomIn" /></button
  >
</div>
<button
  class="ghost icon-only"
  aria-label="Save"
  title="Save the image (Ctrl/Cmd + S)"
  onclick={() => void g.save()}
>
  <Icon name="save" />
</button>
<button
  class="ghost icon-only"
  aria-label="Undo"
  title="Undo"
  disabled={!canUndo($store.history)}
  onclick={() => g.undo()}><Icon name="undo" /></button
>
<button
  class="ghost icon-only"
  aria-label="Redo"
  title="Redo"
  disabled={!canRedo($store.history)}
  onclick={() => g.redo()}><Icon name="redo" /></button
>
<button
  class="ghost"
  aria-label="Send to Animation"
  title={withWhy(
    'Send the selected objects (or the whole drawing) to Animation mode, as shapes to animate',
    'graphicSend',
  )}
  onclick={send}><Icon name="animation" /><span class="long">To Animation</span></button
>
<button
  class="primary"
  aria-label="Export"
  title={withWhy('Export the image as an SVG, a PNG or a JPG', 'graphicExport')}
  disabled={$store.busy !== null}
  onclick={() => (animUi.dialog = 'export')}
>
  <Icon name="export" /><span class="long">Export</span>
</button>

<style>
  .chip {
    cursor: pointer;
  }
  .swatch {
    width: 12px;
    height: 12px;
    border-radius: 3px;
    border: 1px solid var(--line-strong);
  }
  /* A transparent canvas: the checkerboard. */
  .swatch.none {
    background: repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 6px 6px;
  }
  .zoom {
    display: flex;
    align-items: center;
  }
  .zoomlabel {
    min-width: 52px;
    font-family: var(--mono);
    font-size: 12px;
  }
  @media (max-width: 1300px) {
    .chip .detail,
    .long {
      display: none;
    }
  }
</style>
