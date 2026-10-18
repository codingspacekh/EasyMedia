<script lang="ts">
  // T2 audio file-size calculator (screen 21): sample rate × resolution × channels × length,
  // worked step by step, with "What if…" bars. Starts with Book A Question 5a.
  import { SAMPLE_RATES, hz } from '../../core/render/audio-formats.ts';
  import { audioFileSize, whatIf } from '../../core/teaching/file-size.ts';
  import LearnCard from './LearnCard.svelte';

  let sampleRate = $state(44100);
  let bits = $state(16);
  let channels = $state(1);
  let seconds = $state(120);
  const spec = $derived({ sampleRate, bits, channels, seconds });
  const size = $derived(audioFileSize(spec));
  const options = $derived(whatIf(spec));
  const most = $derived(Math.max(...options.map((o) => o.mb)));
  const minutes = $derived(
    seconds >= 60 && seconds % 60 === 0
      ? ` (${seconds / 60} min)`
      : seconds > 60
        ? ` (${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s)`
        : '',
  );
  const mb = (n: number) => `${n.toFixed(1)} MB`;
</script>

<LearnCard title="Audio file-size calculator" icon="calc" tag="sampling rate · resolution">
  <div class="inputs">
    <label>
      <span class="label-s">Sample rate</span>
      <select aria-label="Sample rate" bind:value={sampleRate}>
        {#each SAMPLE_RATES as r (r.rate)}
          <option value={r.rate}>{hz(r.rate)}</option>
        {/each}
      </select>
    </label>
    <div>
      <span class="label-s">Sample resolution</span>
      <div class="seg small" role="group" aria-label="Sample resolution">
        {#each [8, 16, 24, 32] as b (b)}
          <button aria-pressed={bits === b} onclick={() => (bits = b)}
            >{b === 32 ? '32-bit' : b}</button
          >
        {/each}
      </div>
    </div>
    <div>
      <span class="label-s">Channels</span>
      <div class="seg small" role="group" aria-label="Channels">
        <button aria-pressed={channels === 1} onclick={() => (channels = 1)}>1 · mono</button>
        <button aria-pressed={channels === 2} onclick={() => (channels = 2)}>2 · stereo</button>
      </div>
    </div>
    <label>
      <span class="label-s">Length</span>
      <span class="field">
        <input
          aria-label="Length (seconds)"
          type="number"
          min="1"
          max="36000"
          value={seconds}
          onchange={(e) => {
            const v = Number(e.currentTarget.value);
            if (v > 0) seconds = v;
          }}
        />
        <span class="u">s{minutes}</span>
      </span>
    </label>
  </div>

  <div class="label-s gap">Working</div>
  {#each size.steps as step (step.label)}
    <div class="calc-step"><span>{step.label}</span><span>{step.working}</span></div>
  {/each}
  <div class="result">
    <span>File size</span><span class="big">≈ {mb(size.mb)}</span>
  </div>

  <div class="label-s gap">What if…</div>
  <ul class="bars">
    {#each options as o (o.label)}
      <li class="bar-row">
        <span>{o.label}</span>
        <span
          class="b"
          class:more={o.mb > options[0]!.mb}
          class:less={o.mb < options[0]!.mb}
          style:width="{(100 * o.mb) / most}%"
          aria-hidden="true"
        ></span>
        <span class="v">{mb(o.mb)}</span>
      </li>
    {/each}
  </ul>
  <p class="hint">Doubling the sample rate <b>or</b> the resolution doubles the file size.</p>
</LearnCard>

<style>
  .inputs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .label-s {
    display: block;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tx-3);
    margin-bottom: 8px;
  }
  .gap {
    margin-top: 18px;
  }
  select,
  .field input {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  select {
    width: 100%;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .field input {
    width: 90px;
  }
  .u {
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .calc-step {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    background: var(--bg-2);
    font: 500 12.5px var(--mono);
  }
  .calc-step + .calc-step {
    margin-top: 6px;
  }
  .calc-step span:first-child {
    color: var(--tx-2);
    font-family: var(--font);
    white-space: nowrap;
  }
  .calc-step span:last-child {
    text-align: right;
  }
  .result {
    margin-top: 12px;
    padding: 14px;
    border-radius: 10px;
    background: var(--accent-soft);
    border: 1px solid rgba(79, 140, 255, 0.4);
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    color: var(--tx-2);
  }
  .big {
    font: 700 26px var(--mono);
    color: var(--tx-1);
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 110px 1fr 64px;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }
  .b {
    height: 14px;
    border-radius: 3px;
    background: var(--accent);
  }
  .b.more {
    background: var(--warn);
  }
  .b.less {
    background: var(--success);
  }
  .v {
    font-family: var(--mono);
    text-align: right;
    color: var(--tx-2);
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
  .hint b {
    color: var(--tx-2);
  }
</style>
