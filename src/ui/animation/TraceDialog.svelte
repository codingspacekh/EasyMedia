<script lang="ts">
  // Trace bitmap (AN5): the selected picture becomes vector shapes. The colours, detail and
  // smoothing are tried on a small copy first, drawn as a preview with the number of shapes.
  import Dialog from '../Dialog.svelte';
  import type { App } from '../../app/app.ts';
  import type { TraceOptions, TracedRegion } from '../../core/animation/trace.ts';
  import Why from '../Why.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const anim = $derived(app.animation);

  let colours = $state(8);
  let detail = $state(60);
  let smoothing = $state(50);
  let tracing = $state(false);
  let preview = $state<{ width: number; height: number; regions: TracedRegion[] } | null>(null);
  let canvas: HTMLCanvasElement | undefined = $state();

  const options = (): TraceOptions => ({ colours, detail, smoothing });
  const shapes = $derived(preview?.regions.length ?? 0);
  const colourCount = $derived(new Set(preview?.regions.map((r) => r.colour)).size);
  const summary = $derived(
    preview
      ? `${shapes} ${shapes === 1 ? 'shape' : 'shapes'} in ${colourCount} ${colourCount === 1 ? 'colour' : 'colours'}`
      : 'Tracing a preview…',
  );

  // The newest settings win: an older preview that finishes late is ignored.
  let asked = 0;
  $effect(() => {
    const wanted = options();
    const ask = ++asked;
    void anim.tracePreview(wanted).then(
      (made) => {
        if (ask === asked) preview = made;
      },
      () => {},
    );
  });

  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas || !preview) return;
    const scale = Math.min(canvas.width / preview.width, canvas.height / preview.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.translate(
      (canvas.width - preview.width * scale) / 2,
      (canvas.height - preview.height * scale) / 2,
    );
    ctx.scale(scale, scale);
    for (const region of preview.regions) {
      const pts = region.points;
      ctx.beginPath();
      ctx.moveTo(pts[0]!.x, pts[0]!.y);
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length]!;
        const c1 = a.out ?? a;
        const c2 = b.in ?? b;
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
      });
      ctx.closePath();
      ctx.fillStyle = region.colour;
      ctx.fill();
    }
  });

  async function trace(): Promise<void> {
    tracing = true;
    await anim.traceBitmap(options());
    tracing = false;
    onclose();
  }
</script>

<Dialog label="Trace bitmap" syllabus="20.1 importing and tracing bitmaps" width={520} {onclose}>
  <div class="body">
    <div class="preview" role="img" aria-label="Preview of the traced shapes">
      <canvas bind:this={canvas} width="240" height="180" aria-hidden="true"></canvas>
    </div>
    <div class="settings">
      <label for="trace-colours">Colours</label>
      <div class="row">
        <input id="trace-colours" type="range" min="2" max="16" step="1" bind:value={colours} />
        <span class="value">{colours}</span>
      </div>
      <label for="trace-detail">Detail</label>
      <div class="row">
        <input id="trace-detail" type="range" min="0" max="100" step="5" bind:value={detail} />
        <span class="value">{detail}</span>
      </div>
      <label for="trace-smoothing">Smoothing</label>
      <div class="row">
        <input
          id="trace-smoothing"
          type="range"
          min="0"
          max="100"
          step="5"
          bind:value={smoothing}
        />
        <span class="value">{smoothing}</span>
      </div>
      <p class="count" aria-live="polite">
        {summary}
      </p>
    </div>
  </div>
  <p class="hint">
    The picture becomes vector shapes, one for each area of colour, grouped in its place, so the
    parts can be recoloured, moved and animated separately. Some detail is lost: fewer colours and
    less detail lose more, but make fewer shapes.
  </p>
  <Why tool="animTrace" />
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={tracing} onclick={trace}>Trace</button>
  {/snippet}
</Dialog>

<style>
  .body {
    display: flex;
    gap: 16px;
  }
  canvas {
    width: 240px;
    height: 180px;
    flex: none;
    border: 1px solid var(--line);
    border-radius: 4px;
    background: repeating-conic-gradient(var(--bg-2) 0 25%, var(--bg-1) 0 50%) 0 0 / 16px 16px;
  }
  .settings {
    flex: 1;
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 8px 6px;
    align-content: start;
  }
  .settings label {
    color: var(--tx-2);
    font-size: 12px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .row input {
    flex: 1;
  }
  .value {
    width: 28px;
    text-align: right;
    font-size: 12px;
    color: var(--tx-1);
    font-variant-numeric: tabular-nums;
  }
  .count {
    grid-column: 1 / -1;
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--tx-1);
  }
  .hint {
    margin: 12px 0 0;
    color: var(--tx-2);
    font-size: 11.5px;
  }
</style>
