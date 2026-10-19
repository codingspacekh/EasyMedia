<script lang="ts">
  // One-click text looks: each tile is drawn by the same code as the preview and the export, in
  // the text's own font, so it shows exactly what the words will look like.
  import type { TextStyle } from '../core/model/types.ts';
  import { drawText } from '../core/text/draw.ts';
  import { applyLook, lookOf, TEXT_LOOKS } from '../core/text/looks.ts';

  let { style, onchange }: { style: TextStyle; onchange: (lookId: string) => void } = $props();

  const current = $derived(lookOf(style));
  /** A small frame: 540 "points" in a 1080-line frame is 45 px in this 90-px tile. */
  const TILE = { width: 160, height: 90 };
  /** Bumped when a font finishes loading, so the tiles are drawn again with it. */
  let fontsLoaded = $state(0);

  $effect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const redraw = () => fontsLoaded++;
    fonts.addEventListener('loadingdone', redraw);
    return () => fonts.removeEventListener('loadingdone', redraw);
  });

  function draw(canvas: HTMLCanvasElement, id: string): void {
    void fontsLoaded;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const tile: TextStyle = {
      ...applyLook(style, id),
      size: 540,
      align: 'centre',
      position: 'centre',
    };
    ctx.clearRect(0, 0, TILE.width, TILE.height);
    drawText(ctx, 'Aa', tile, TILE, 'frame');
  }
</script>

<div class="looks" role="group" aria-label="Text look">
  {#each TEXT_LOOKS as look (look.id)}
    <button
      class="look"
      aria-pressed={current === look.id}
      aria-label={look.label}
      title="{look.label}: {look.hint}"
      onclick={() => onchange(look.id)}
    >
      <canvas
        width={TILE.width}
        height={TILE.height}
        aria-hidden="true"
        {@attach (canvas) => draw(canvas, look.id)}
      ></canvas>
      <span>{look.label}</span>
    </button>
  {/each}
</div>

<style>
  .looks {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
    gap: 6px;
  }
  .look {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 3px;
    height: auto;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-2);
  }
  .look[aria-pressed='true'] {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  canvas {
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 3px;
    /* A picture-like background, so light and dark looks both show. */
    background: linear-gradient(160deg, #5b6b82, #1d2533);
  }
  span {
    font-size: 10.5px;
    color: var(--tx-2);
    text-align: center;
  }
</style>
