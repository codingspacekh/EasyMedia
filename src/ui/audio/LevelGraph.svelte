<script lang="ts">
  // A19: the compressor's input → output curve, and the selection's levels before and after
  // (design screen 18). Levels are in dB from −60 (silence) to 0 (full level).
  let {
    curve,
    before,
    after,
  }: {
    curve: (inputDb: number) => number;
    before: readonly number[];
    after: readonly number[];
  } = $props();

  const SIZE = 120;
  const FLOOR = -60;
  /** dB → 0…1 */
  const unit = (db: number) => Math.min(1, Math.max(0, (db - FLOOR) / -FLOOR));
  const x = (db: number) => unit(db) * SIZE;
  const y = (db: number) => SIZE - unit(db) * SIZE;
  const steps = Array.from({ length: 61 }, (_, i) => FLOOR + i);
  const path = $derived(
    steps.map((db, i) => `${i ? 'L' : 'M'}${x(db).toFixed(1)},${y(curve(db)).toFixed(1)}`).join(''),
  );
  // Where the curve leaves the "no change" line.
  const threshold = $derived(steps.find((db) => Math.abs(curve(db) - db) > 0.01) ?? null);

  /** Mirrored bars, as a waveform: each level as a bar around the middle of its strip. */
  const bars = (levels: readonly number[], top: number, height: number) =>
    levels.map((db, i) => {
      const h = Math.max(1, unit(db) * height);
      return { x: (i / levels.length) * 100, w: 100 / levels.length, y: top + (height - h) / 2, h };
    });
</script>

<div class="graphs">
  <svg
    role="img"
    aria-label="Input → output curve"
    viewBox={`-14 -4 ${SIZE + 18} ${SIZE + 18}`}
    class="curve"
  >
    <rect x="0" y="0" width={SIZE} height={SIZE} class="frame" />
    <line x1="0" y1={SIZE} x2={SIZE} y2="0" class="same" />
    {#if threshold !== null}
      <line x1={x(threshold)} y1="0" x2={x(threshold)} y2={SIZE} class="mark" />
      <text x={x(threshold) - 3} y="10" text-anchor="end" class="label">threshold</text>
    {/if}
    <path d={path} class="line" data-testid="curve" />
    <text x={SIZE / 2} y={SIZE + 12} text-anchor="middle" class="label">input level →</text>
    <text
      x="-6"
      y={SIZE / 2}
      text-anchor="middle"
      class="label"
      transform={`rotate(-90 -6 ${SIZE / 2})`}>output →</text
    >
  </svg>
  <div class="levels" role="img" aria-label="Levels before and after">
    <span>Before</span>
    <svg viewBox="0 0 100 44" preserveAspectRatio="none">
      {#each bars(before, 0, 44) as b, i (i)}
        <rect x={b.x} y={b.y} width={b.w * 0.8} height={b.h} class="before" />
      {/each}
    </svg>
    <span>After · more even</span>
    <svg viewBox="0 0 100 44" preserveAspectRatio="none">
      {#each bars(after, 0, 44) as b, i (i)}
        <rect x={b.x} y={b.y} width={b.w * 0.8} height={b.h} class="after" />
      {/each}
    </svg>
  </div>
</div>

<style>
  .graphs {
    display: grid;
    grid-template-columns: 132px 1fr;
    gap: 12px;
    align-items: center;
  }
  .curve {
    width: 132px;
    height: 132px;
  }
  .levels {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 10.5px;
    color: var(--tx-3);
  }
  .levels svg {
    width: 100%;
    height: 44px;
  }
  .frame {
    fill: var(--bg-0);
    stroke: var(--line-strong);
  }
  .same {
    stroke: var(--tx-3);
    stroke-dasharray: 3 3;
  }
  .mark {
    stroke: var(--tx-3);
    stroke-dasharray: 1 2;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }
  .label {
    font-size: 8.5px;
    fill: var(--tx-3);
  }
  .before {
    fill: var(--tx-3);
  }
  .after {
    fill: var(--accent);
  }
</style>
