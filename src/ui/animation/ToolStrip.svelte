<script lang="ts">
  // The tool strip beside the stage (as Animate's and Hype's toolboxes): the drawing tools
  // (AN3, AN4, AN5) and the rulers / grid / snapping toggles (AN2). Vertical, so the header
  // never grows wider than the window.
  import type { App } from '../../app/app.ts';
  import type { Tool } from '../../app/animation.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import Icon, { type IconName } from '../Icon.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
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
  const snapping = $derived(
    view.snap.grid || view.snap.guides || view.snap.objects || view.snap.pixels,
  );
</script>

<div class="strip">
  <div class="tools" role="toolbar" aria-label="Animation tools" aria-orientation="vertical">
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
  <div class="hsep"></div>
  <div class="tools" role="group" aria-label="Stage helpers">
    <button
      class="tbtn"
      aria-label="Rulers"
      aria-pressed={view.rulers}
      title={withWhy('Show the rulers (drag a guide out of them)', 'rulersGrid')}
      onclick={() => anim.setView({ rulers: !view.rulers })}><Icon name="ruler" /></button
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
      aria-pressed={snapping}
      title={withWhy('Snap to the grid, guides and objects (hold Alt to move freely)', 'snapping')}
      onclick={() => {
        const on = !(view.snap.grid || view.snap.guides || view.snap.objects);
        anim.setView({ snap: { ...view.snap, grid: on, guides: on, objects: on } });
      }}><Icon name="snap" /></button
    >
  </div>
</div>

<style>
  .strip {
    width: 44px;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
    overflow: auto;
  }
  .tools {
    display: flex;
    flex-direction: column;
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
  .hsep {
    width: 24px;
    height: 1px;
    background: var(--line);
  }
  /* Short windows: smaller buttons so every tool stays reachable without scrolling. */
  @media (max-height: 700px) {
    .tbtn {
      width: 30px;
      height: 30px;
    }
  }
</style>
