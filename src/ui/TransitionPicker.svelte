<script lang="ts">
  // V9 transition picker: every transition as a small tile, in groups. A tile shows clip A
  // changing into clip B (drawn as the preview draws it); it plays while the mouse is on it.
  import {
    TRANSITION_GROUPS,
    TRANSITION_LIST,
    transitionLook,
    type LayerLook,
  } from '../core/effects/transitions/transitions.ts';

  let {
    value,
    onchange,
  }: {
    /** The chosen transition's id, or null for a plain cut. */
    value: string | null;
    onchange: (id: string | null) => void;
  } = $props();

  /** The tile playing its animation, and how far it has got. */
  let playing: { id: string; p: number } | null = $state(null);
  let frame = 0;

  function play(id: string): void {
    stop();
    const started = performance.now();
    const step = (now: number) => {
      // 0.3 s on A, 1 s changing, 0.5 s on B, then again.
      const t = ((now - started) / 1000) % 1.8;
      playing = { id, p: Math.min(1, Math.max(0, t - 0.3)) };
      frame = requestAnimationFrame(step);
    };
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(step);
  }

  function stop(): void {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    playing = null;
  }

  $effect(() => stop);

  const style = (l: LayerLook) =>
    [
      l.opacity !== undefined && `opacity:${l.opacity}`,
      l.clipPath && `clip-path:${l.clipPath}`,
      l.transform && `transform:${l.transform}`,
      l.mask && `mask-image:${l.mask}`,
      l.filter && `filter:${l.filter}`,
    ]
      .filter(Boolean)
      .join(';');
</script>

<div class="picker" role="radiogroup" aria-label="Transition">
  <button
    class="tile"
    role="radio"
    aria-checked={value === null}
    title="No transition: the next clip starts straight away (a cut)"
    onclick={() => onchange(null)}
  >
    <span class="thumb cut"><span class="a">A</span><span class="b">B</span></span>
    <span class="name">None (cut)</span>
  </button>
  {#each TRANSITION_GROUPS as group (group)}
    <div class="group">{group}</div>
    {#each TRANSITION_LIST.filter((t) => t.group === group) as t (t.id)}
      {@const look = transitionLook(t.xfade, playing?.id === t.id ? playing.p : 0.45)}
      <button
        class="tile"
        role="radio"
        aria-checked={value === t.id}
        title="{t.label}\n\nWhy? {t.why}"
        onclick={() => onchange(t.id)}
        onpointerenter={() => play(t.id)}
        onpointerleave={stop}
        onfocus={() => play(t.id)}
        onblur={stop}
      >
        <span class="thumb" style:background={look.behind ?? null} aria-hidden="true">
          <span class="a" class:above={look.above === 'from'} style={style(look.from)}>A</span>
          <span class="b" style={style(look.to)}>B</span>
        </span>
        <span class="name">{t.label}</span>
      </button>
    {/each}
  {/each}
</div>

<style>
  .picker {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
    gap: 6px;
  }
  .group {
    grid-column: 1 / -1;
    margin-top: 4px;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-3);
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    height: auto;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--bg-2);
  }
  .tile[aria-checked='true'] {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    border-radius: 3px;
    background: #000;
  }
  .a,
  .b {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
    color: #fff;
  }
  .a {
    background: linear-gradient(135deg, #e0583c, #b8325f);
  }
  .b {
    background: linear-gradient(135deg, #2f7fd8, #22a38f);
  }
  .a.above {
    z-index: 1;
  }
  .cut .b {
    clip-path: inset(0 0 0 50%);
  }
  .name {
    font-size: 10.5px;
    line-height: 1.2;
    color: var(--tx-2);
    text-align: center;
    white-space: normal;
  }
</style>
