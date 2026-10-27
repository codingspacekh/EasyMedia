<script lang="ts">
  // Animation mode's part of the header: the stage chip (AN1), zoom, Save, Undo, Redo and
  // Export. The drawing tools are in the tool strip beside the stage (ToolStrip.svelte), so
  // this row fits a 1100 px window without scrolling (N10).
  import type { App } from '../../app/app.ts';
  import { canRedo, canUndo } from '../../app/history.ts';
  import { aspectOf } from '../../core/animation/rules.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import Icon from '../Icon.svelte';
  import { animUi, ZOOM_STEPS } from './animation-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const stage = $derived($store.history.present.stage);

  const zoomLabel = $derived($store.zoom === 'fit' ? 'Fit' : `${Math.round($store.zoom * 100)} %`);
  function zoomBy(direction: 1 | -1): void {
    const current = $store.zoom === 'fit' ? 1 : $store.zoom;
    const next =
      direction === 1
        ? (ZOOM_STEPS.find((z) => z > current + 1e-9) ?? ZOOM_STEPS.at(-1)!)
        : ([...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? ZOOM_STEPS[0]!);
    anim.setZoom(next);
  }
</script>

<button
  class="chip"
  aria-label="Stage settings: {aspectOf(
    stage.width,
    stage.height,
  )} · {stage.width} × {stage.height} · {stage.fps} fps"
  title={withWhy('Stage size, colour, frame rate and length', 'stage')}
  onclick={() => (animUi.dialog = 'stage')}
>
  <Icon name="screen" size={14} />
  <b>{aspectOf(stage.width, stage.height)}</b>
  <span class="detail">· {stage.width} × {stage.height} · {stage.fps} fps</span>
  <span class="swatch" style:background={stage.background}></span>
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
    onclick={() => anim.setZoom($store.zoom === 'fit' ? 1 : 'fit')}>{zoomLabel}</button
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
  title="Save the animation (Ctrl/Cmd + S)"
  onclick={() => void anim.save()}
>
  <Icon name="save" />
</button>
<button
  class="ghost icon-only"
  aria-label="Undo"
  title="Undo"
  disabled={!canUndo($store.history)}
  onclick={() => anim.undo()}><Icon name="undo" /></button
>
<button
  class="ghost icon-only"
  aria-label="Redo"
  title="Redo"
  disabled={!canRedo($store.history)}
  onclick={() => anim.redo()}><Icon name="redo" /></button
>
<button
  class="primary"
  aria-label="Export"
  title={withWhy(
    'Export the animation as an MP4 video, an animated GIF, a PNG sequence, or this frame as a PNG',
    'animExport',
  )}
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
