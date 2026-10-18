<script lang="ts">
  // T4 sampling visualiser (screen 21, Book A Activity 11.28): an analogue wave, the samples
  // taken from it and what is stored, with the sample table as in the book. Students can move
  // the wave's points to draw their own.
  import {
    BOOK_A_WAVE,
    WAVE_LENGTH,
    WAVE_TOP,
    distance,
    levels,
    sampleWave,
    waveAt,
  } from '../../core/teaching/sampling.ts';
  import { group } from '../../core/teaching/file-size.ts';
  import LearnCard from './LearnCard.svelte';

  const W = 420;
  const H = 180;
  const PAD = 14;
  const x = (t: number) => PAD + (t / WAVE_LENGTH) * (W - 2 * PAD);
  const y = (v: number) => H - PAD - (v / WAVE_TOP) * (H - 2 * PAD);
  const step = WAVE_LENGTH / (BOOK_A_WAVE.length - 1);

  let points = $state([...BOOK_A_WAVE]);
  let count = $state(10);
  let bits = $state(8);
  let drawing = $state(false);
  let svg: SVGSVGElement | undefined = $state();

  const samples = $derived(sampleWave(points, count, bits));
  const away = $derived(distance(points, samples));
  const original = $derived(
    Array.from({ length: 201 }, (_, i) => {
      const t = (i / 200) * WAVE_LENGTH;
      return `${i ? 'L' : 'M'}${x(t).toFixed(1)} ${y(waveAt(points, t)).toFixed(1)}`;
    }).join(' '),
  );
  const stored = $derived(
    `M${x(0)} ${y(0)} ` +
      samples.map((s) => `H${x(s.time).toFixed(1)} V${y(s.value).toFixed(1)}`).join(' ') +
      ` H${x(WAVE_LENGTH)}`,
  );
  const show = (v: number) => String(Math.round(v * 10) / 10);
  const clamp = (v: number) => Math.min(WAVE_TOP, Math.max(0, Math.round(v * 10) / 10));

  function setPoint(i: number, v: number): void {
    points[i] = clamp(v);
  }

  function dragPoint(i: number, e: PointerEvent): void {
    if (!svg) return;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const move = (m: PointerEvent) => {
      const box = svg!.getBoundingClientRect();
      const py = ((m.clientY - box.top) / box.height) * H;
      setPoint(i, ((H - PAD - py) / (H - 2 * PAD)) * WAVE_TOP);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function keyPoint(i: number, e: KeyboardEvent): void {
    const by = e.shiftKey ? 0.1 : 0.5;
    if (e.key === 'ArrowUp') setPoint(i, points[i]! + by);
    else if (e.key === 'ArrowDown') setPoint(i, points[i]! - by);
    else return;
    e.preventDefault();
  }
</script>

<LearnCard title="Sampling visualiser" icon="audio" tag="11.2 sampling rate · resolution">
  <div class="graph">
    <svg
      bind:this={svg}
      viewBox="0 0 {W} {H}"
      role="img"
      aria-label="The original sound wave (dashed) and what is stored (blue)"
    >
      {#each [0, 5, 10] as v (v)}
        <line class="grid" x1={x(0)} x2={x(WAVE_LENGTH)} y1={y(v)} y2={y(v)} />
        <text class="axis" x={2} y={y(v) + 3}>{v}</text>
      {/each}
      <path class="original" d={original} />
      <path class="stored" d={stored} />
      {#each samples as s (s.time)}
        <circle class="dot" cx={x(s.time)} cy={y(s.value)} r="3" />
      {/each}
      {#if drawing}
        {#each points as v, i (i)}
          <circle
            class="handle"
            cx={x(i * step)}
            cy={y(v)}
            r="6"
            role="slider"
            tabindex="0"
            aria-label="Point at {show(i * step)} s"
            aria-valuemin={0}
            aria-valuemax={WAVE_TOP}
            aria-valuenow={v}
            onpointerdown={(e) => dragPoint(i, e)}
            onkeydown={(e) => keyPoint(i, e)}
          />
        {/each}
      {/if}
    </svg>
  </div>

  <div class="row">
    <label for="sv-rate">Sample rate</label>
    <input id="sv-rate" type="range" min="2" max="40" step="1" bind:value={count} />
    <span class="val">{count} samples</span>
  </div>
  <div class="row">
    <label for="sv-bits">Resolution</label>
    <input id="sv-bits" type="range" min="1" max="8" step="1" bind:value={bits} />
    <span class="val">{bits}-bit · {group(levels(bits))} levels</span>
  </div>

  <div class="table">
    <table>
      <tbody>
        <tr>
          <th scope="row">Sample value</th>
          {#each samples as s (s.time)}<td data-kind="value">{show(s.value)}</td>{/each}
        </tr>
        <tr>
          <th scope="row">Time sample</th>
          {#each samples as s (s.time)}<td>{show(s.time)}</td>{/each}
        </tr>
      </tbody>
    </table>
  </div>

  <p class="distance">
    Average difference from the original: <b data-testid="distance">{away.toFixed(2)}</b>
  </p>
  <div class="actions">
    <button aria-pressed={!drawing} onclick={() => ((points = [...BOOK_A_WAVE]), (drawing = false))}
      >Book A Figure 11.23</button
    >
    <button aria-pressed={drawing} onclick={() => (drawing = true)}>Draw your own</button>
  </div>
  <p class="hint">
    <span class="dash">- - -</span> original analogue sound ·
    <span class="line">━</span> what is stored. Move the sliders right and the blue line gets closer
    to the original, but the file gets bigger.
    {#if drawing}Drag the points (or use the ↑ ↓ keys) to draw your own wave.{/if}
  </p>
</LearnCard>

<style>
  .graph {
    border: 1px solid var(--line);
    border-radius: var(--radius-l);
    background: var(--bg-2);
    padding: 8px;
  }
  svg {
    display: block;
    width: 100%;
    height: auto;
    touch-action: none;
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .axis {
    fill: var(--tx-3);
    font: 9px var(--mono);
  }
  .original {
    fill: none;
    stroke: var(--tx-2);
    stroke-width: 1.5;
    stroke-dasharray: 4 3;
  }
  .stored {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2.2;
  }
  .dot {
    fill: var(--accent);
  }
  .handle {
    fill: var(--bg-1);
    stroke: var(--warn);
    stroke-width: 2;
    cursor: ns-resize;
  }
  .handle:focus {
    outline: none;
    stroke: var(--tx-1);
  }
  .row {
    display: grid;
    grid-template-columns: 90px 1fr 150px;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .val {
    font: 500 12px var(--mono);
    text-align: right;
    color: var(--tx-1);
  }
  .table {
    overflow-x: auto;
    margin-top: 12px;
  }
  table {
    border-collapse: collapse;
    font: 500 11.5px var(--mono);
  }
  th {
    text-align: left;
    font: 600 11px var(--font);
    color: var(--tx-1);
    background: rgba(60, 207, 142, 0.18);
    padding: 4px 8px;
    border: 1px solid var(--line-strong);
    white-space: nowrap;
  }
  td {
    padding: 4px 6px;
    border: 1px solid var(--line-strong);
    text-align: center;
    min-width: 30px;
  }
  .distance {
    margin: 10px 0 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .distance b {
    font-family: var(--mono);
    color: var(--tx-1);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .actions button[aria-pressed='true'] {
    border-color: var(--accent);
    color: var(--tx-1);
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
  .dash {
    color: var(--tx-2);
  }
  .line {
    color: var(--accent);
  }
</style>
