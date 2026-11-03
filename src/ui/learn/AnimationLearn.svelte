<script lang="ts">
  // Learn ▸ Animation (AN17, syllabus 20.1): the types of animation with their advantages and
  // disadvantages, the principles, the components and animation variables, and a frame-rate
  // demonstration — the same motion at 5, 12 and 24 fps side by side.
  import { onDestroy } from 'svelte';
  import {
    ANIMATION_TYPES,
    COMPONENTS,
    DEMO_RATES,
    PRINCIPLES,
    demoFrames,
    demoPosition,
    type LearnTopic,
  } from '../../core/teaching/animation.ts';
  import LearnCard from './LearnCard.svelte';

  // ---- the frame-rate demonstration ----
  let playing = $state(true);
  let seconds = $state(0);
  let raf = 0;
  let started = performance.now();
  function tick(now: number): void {
    seconds = (now - started) / 1000;
    raf = requestAnimationFrame(tick);
  }
  function setPlaying(on: boolean): void {
    playing = on;
    if (on) {
      started = performance.now() - seconds * 1000;
      raf = requestAnimationFrame(tick);
    } else cancelAnimationFrame(raf);
  }
  if (typeof requestAnimationFrame === 'function') raf = requestAnimationFrame(tick);
  onDestroy(() => cancelAnimationFrame(raf));
</script>

{#snippet topics(list: readonly LearnTopic[])}
  {#each list as t (t.id)}
    <article class="topic" aria-label={t.title}>
      <h4>{t.title}</h4>
      {#each t.text as para (para)}<p>{para}</p>{/each}
      {#if t.where}<p class="where"><b>Try it:</b> {t.where}</p>{/if}
    </article>
  {/each}
{/snippet}

<div class="col">
  <LearnCard title="Types of animation" icon="animation" tag="20.1 animation types and methods">
    <table>
      <thead>
        <tr>
          <th scope="col">Type</th>
          <th scope="col">How it is made</th>
          <th scope="col">Advantages</th>
          <th scope="col">Disadvantages</th>
        </tr>
      </thead>
      <tbody>
        {#each ANIMATION_TYPES as t (t.id)}
          <tr>
            <th scope="row">{t.name}</th>
            <td
              >{t.how}{#if t.inApp}<span class="where"><b>Try it:</b> {t.inApp}</span>{/if}</td
            >
            <td
              ><ul>
                {#each t.advantages as a (a)}<li class="plus">{a}</li>{/each}
              </ul></td
            >
            <td
              ><ul>
                {#each t.disadvantages as d (d)}<li class="minus">{d}</li>{/each}
              </ul></td
            >
          </tr>
        {/each}
      </tbody>
    </table>
  </LearnCard>

  <LearnCard title="Frame rate" icon="speed" tag="20.1 timings">
    <p class="lead">
      The same ball crossing in 2 seconds, drawn at three frame rates. It moves only when a new
      frame is shown: at 5 fps it jumps in 10 big steps; at 24 fps its 48 small steps look smooth.
    </p>
    <div class="demo">
      {#each DEMO_RATES as fps (fps)}
        <div class="lane" role="img" aria-label="{fps} fps: {demoFrames(fps)} frames in 2 seconds">
          <span class="rate">{fps} fps</span>
          <div class="track">
            <span class="ball" style:left="calc((100% - 26px) * {demoPosition(fps, seconds)})"
            ></span>
          </div>
          <span class="count">{demoFrames(fps)} frames</span>
        </div>
      {/each}
    </div>
    <button class="sm" onclick={() => setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</button>
  </LearnCard>
</div>

<div class="col">
  <LearnCard title="Principles of animation" icon="tracks" tag="20.1 the basic principles">
    {@render topics(PRINCIPLES)}
  </LearnCard>
  <LearnCard
    title="Components and animation variables"
    icon="layers"
    tag="20.1 components and variables"
  >
    {@render topics(COMPONENTS)}
  </LearnCard>
</div>

<style>
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  thead th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tx-3);
    padding: 0 8px 8px 0;
    border-bottom: 1px solid var(--line-strong);
  }
  td,
  tbody th {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
    color: var(--tx-2);
    line-height: 1.45;
    text-align: left;
  }
  tbody th {
    color: var(--tx-1);
    font-weight: 650;
    white-space: nowrap;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li::before {
    font-weight: 700;
    margin-right: 5px;
  }
  .plus::before {
    content: '+';
    color: var(--success);
  }
  .minus::before {
    content: '−';
    color: var(--danger);
  }
  .where {
    display: block;
    margin-top: 6px;
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .topic h4 {
    margin: 0 0 4px;
    font-size: 13px;
    color: var(--tx-1);
  }
  .topic p {
    margin: 0 0 6px;
    color: var(--tx-2);
    font-size: 12px;
    line-height: 1.5;
  }
  .topic + .topic {
    margin-top: 12px;
  }
  .lead {
    margin: 0 0 10px;
    color: var(--tx-2);
    font-size: 12px;
    line-height: 1.5;
  }
  .demo {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 10px;
  }
  .lane {
    display: grid;
    grid-template-columns: 52px 1fr 72px;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .rate {
    font-family: var(--mono);
    color: var(--tx-1);
  }
  .count {
    color: var(--tx-3);
  }
  .track {
    position: relative;
    height: 26px;
    border-radius: 13px;
    background: var(--bg-2);
    padding: 0 13px;
  }
  .ball {
    position: absolute;
    top: 3px;
    width: 20px;
    height: 20px;
    margin-left: 3px;
    border-radius: 50%;
    background: var(--accent);
  }
</style>
