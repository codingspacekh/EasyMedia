<script lang="ts">
  // Animation mode toolbar: the drawing tools (AN3, AN4, AN5), rulers / grid / snapping (AN2),
  // the stage chip (AN1), zoom, Save, Undo, Redo and Export.
  import type { App } from '../../app/app.ts';
  import type { Tool } from '../../app/animation.ts';
  import { canRedo, canUndo } from '../../app/history.ts';
  import { aspectOf } from '../../core/animation/rules.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import Icon, { type IconName } from '../Icon.svelte';
  import { ui } from '../ui-state.svelte.ts';
  import { animUi, ZOOM_STEPS } from './animation-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const stage = $derived($store.history.present.stage);
  const view = $derived($store.history.present.view);

  const TOOLS: [Tool, string, IconName, string][] = [
    ['select', 'Select', 'select', 'Select, move, resize and turn objects (V)'],
    [
      'rect',
      'Rectangle',
      'rect',
      withWhy('Drag out a rectangle (R); Shift for a square', 'vectorShapes'),
    ],
    [
      'ellipse',
      'Ellipse',
      'ellipse',
      withWhy('Drag out an ellipse (E); Shift for a circle', 'vectorShapes'),
    ],
    ['star', 'Star', 'star', withWhy('Drag out a star (S)', 'vectorShapes')],
    ['polygon', 'Polygon', 'polygon', withWhy('Drag out a polygon (G)', 'vectorShapes')],
    ['line', 'Line', 'line', withWhy('Drag a straight line (L)', 'vectorShapes')],
    [
      'pen',
      'Pen',
      'pen',
      withWhy(
        'Click points for a path (P); double-click or Enter to finish, click the first point to close',
        'vectorShapes',
      ),
    ],
    ['brush', 'Brush', 'brush', withWhy('Draw freehand (B)', 'vectorShapes')],
    ['text', 'Text', 'text', withWhy('Click to add text (T)', 'animText')],
    ['picture', 'Picture', 'picture', withWhy('Click to place a picture file (I)', 'animPicture')],
  ];
  const zoomLabel = $derived($store.zoom === 'fit' ? 'Fit' : `${Math.round($store.zoom * 100)} %`);
  function zoomBy(direction: 1 | -1): void {
    const current = $store.zoom === 'fit' ? 1 : $store.zoom;
    const next =
      direction === 1
        ? (ZOOM_STEPS.find((z) => z > current + 1e-9) ?? ZOOM_STEPS.at(-1)!)
        : ([...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? ZOOM_STEPS[0]!);
    anim.setZoom(next);
  }
  const toggleView = (key: 'rulers') => anim.setView({ [key]: !view[key] });
</script>

<div class="tools" role="toolbar" aria-label="Animation tools">
  {#each TOOLS as [tool, label, icon, title] (tool)}
    <button
      class="tbtn"
      aria-label={label}
      aria-pressed={$store.tool === tool}
      {title}
      onclick={() => anim.setTool(tool)}><Icon name={icon} /></button
    >
  {/each}
</div>
<span class="vsep"></span>
<div class="tools" role="group" aria-label="Stage helpers">
  <button
    class="tbtn"
    aria-label="Rulers"
    aria-pressed={view.rulers}
    title={withWhy('Show the rulers (drag a guide out of them)', 'rulersGrid')}
    onclick={() => toggleView('rulers')}><Icon name="ruler" /></button
  >
  <button
    class="tbtn"
    aria-label="Grid"
    aria-pressed={view.grid.show}
    title={withWhy(`Show the grid (${view.grid.size} px)`, 'rulersGrid')}
    onclick={() => anim.setView({ grid: { ...view.grid, show: !view.grid.show } })}
    ><Icon name="grid" /></button
  >
  <button
    class="tbtn"
    aria-label="Snap"
    aria-pressed={view.snap.grid || view.snap.guides || view.snap.objects || view.snap.pixels}
    title={withWhy('Snap to the grid, guides and objects (hold Alt to move freely)', 'snapping')}
    onclick={() => {
      const on = !(view.snap.grid || view.snap.guides || view.snap.objects);
      anim.setView({ snap: { ...view.snap, grid: on, guides: on, objects: on } });
    }}><Icon name="snap" /></button
  >
</div>
<span class="vsep"></span>
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
  title={withWhy(
    'Export the stage as a PNG picture (video, GIF and web exports come with the timeline)',
    'animExport',
  )}
  disabled={$store.busy !== null}
  onclick={() => void anim.exportPng()}
>
  <Icon name="export" /> Export
</button>
{#if ui.mode !== 'Animation'}<span hidden></span>{/if}

<style>
  .tools {
    display: flex;
    gap: 2px;
  }
  .tbtn {
    width: 34px;
    height: 34px;
    padding: 0;
    border: 1px solid transparent;
    background: transparent;
    color: var(--tx-2);
  }
  .tbtn:hover:not(:disabled) {
    background: var(--bg-3);
    color: var(--tx-1);
  }
  .tbtn[aria-pressed='true'] {
    background: var(--bg-3);
    color: var(--tx-1);
    border-color: var(--line-strong);
  }
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
    .chip .detail {
      display: none;
    }
    .tbtn {
      width: 28px;
    }
  }
</style>
