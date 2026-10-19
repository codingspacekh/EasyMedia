<script lang="ts">
  // Fades, filters, pan & zoom and the transition into a clip, picture or title (screens 05–07;
  // V7, V8, V9, V15). Every tool explains why it is used (T5).
  import type { App } from '../app/app.ts';
  import {
    addEffect,
    removeEffect,
    setEffectParams,
    setFade,
    setPanZoom,
    setTransition,
  } from '../app/commands.ts';
  import { WHY } from '../core/effects/help.ts';
  import { PAN_ZOOM_PRESETS } from '../core/effects/panzoom.ts';
  import { EFFECTS, effectById, transitionById } from '../core/effects/registry.ts';
  import { itemDuration } from '../core/model/timeline.ts';
  import type { MainItem, PanZoom, PanZoomFrame } from '../core/model/types.ts';
  import EffectParams from './EffectParams.svelte';
  import TimeField from './TimeField.svelte';
  import TransitionPicker from './TransitionPicker.svelte';

  let { app, item, index }: { app: App; item: MainItem; index: number } = $props();
  let error: string | null = $state(null);

  const fade = $derived(item.fade ?? { in: 0, out: 0, colour: 'black' as const });
  const length = $derived(itemDuration(item));
  const QUICK = [0.5, 1, 1.5, 2];

  const edit = (command: Parameters<App['edit']>[0]) => (error = app.edit(command));

  function choosePanZoom(value: string): void {
    const preset = PAN_ZOOM_PRESETS.find((p) => p.id === value);
    edit(
      setPanZoom(item.id, preset ? { from: preset.from, to: preset.to, preset: preset.id } : null),
    );
  }

  function changePanZoom(change: Partial<PanZoom>): string | null {
    if (!item.panZoom) return null;
    const next: PanZoom = { ...item.panZoom, ...change };
    // Changing the frames makes it a custom pan & zoom; changing only the times keeps the preset.
    if (change.from || change.to) delete next.preset;
    return (error = app.edit(setPanZoom(item.id, next)));
  }

  function changeFrame(which: 'from' | 'to', key: keyof PanZoomFrame, percent: number): void {
    if (!item.panZoom) return;
    changePanZoom({ [which]: { ...item.panZoom[which], [key]: percent / 100 } });
  }

  const FRAME_FIELDS: [keyof PanZoomFrame, string][] = [
    ['zoom', 'zoom'],
    ['x', 'across'],
    ['y', 'down'],
  ];
</script>

{#snippet why(text: string)}
  <details class="why">
    <summary>Why use this?</summary>
    <p>{text}</p>
  </details>
{/snippet}

<section>
  <h3>Fade <span class="syl">11.1 fading</span></h3>
  <TimeField
    label="Fade in"
    value={fade.in}
    commit={(t) => app.edit(setFade(item.id, { ...fade, in: t }))}
  />
  <TimeField
    label="Fade out"
    value={fade.out}
    commit={(t) => app.edit(setFade(item.id, { ...fade, out: t }))}
  />
  <div class="row" role="radiogroup" aria-label="Fade colour">
    <span class="hint">Fade to</span>
    {#each ['black', 'white'] as const as colour (colour)}
      <label class="check">
        <input
          type="radio"
          name="fade-colour-{item.id}"
          checked={fade.colour === colour}
          onchange={() => edit(setFade(item.id, { ...fade, colour }))}
        />
        {colour === 'black' ? 'Black' : 'White'}
      </label>
    {/each}
  </div>
  {@render why(WHY.fade)}
</section>

<section>
  <h3>Filters &amp; colour <span class="syl">11.1 filters</span></h3>
  <div class="chips">
    {#each EFFECTS as def (def.id)}
      <button aria-label="Add {def.label}" onclick={() => edit(addEffect(item.id, def.id))}>
        + {def.label}
      </button>
    {/each}
  </div>
  {#each item.effects ?? [] as effect, i (i)}
    {@const def = effectById(effect.effectId)}
    {#if def}
      <div class="effect">
        <div class="effect-head">
          <b>{def.label}</b>
          <button aria-label="Remove {def.label}" onclick={() => edit(removeEffect(item.id, i))}
            >Remove</button
          >
        </div>
        <EffectParams
          {def}
          params={effect.params}
          onchange={(params) => app.edit(setEffectParams(item.id, i, params))}
        />
        {@render why(def.why)}
      </div>
    {/if}
  {/each}
  <p class="hint">To change only part of a clip, Split it first and select that part.</p>
  {@render why(WHY.filters)}
</section>

<section>
  <h3>Pan &amp; zoom <span class="syl">11.1 pan and zoom</span></h3>
  <select
    aria-label="Pan and zoom"
    value={item.panZoom ? (item.panZoom.preset ?? 'custom') : 'none'}
    onchange={(e) => choosePanZoom(e.currentTarget.value)}
  >
    <option value="none">None</option>
    {#each PAN_ZOOM_PRESETS as preset (preset.id)}
      <option value={preset.id}>{preset.label}</option>
    {/each}
    {#if item.panZoom && !item.panZoom.preset}<option value="custom">Custom</option>{/if}
  </select>
  {#if item.panZoom}
    {@const pz = item.panZoom}
    <div class="frames">
      {#each [['from', 'Start'], ['to', 'End']] as const as [which, name] (which)}
        {#each FRAME_FIELDS as [key, word] (key)}
          <label class="num">
            {name}
            {word}
            <input
              aria-label="{name} {word}"
              type="number"
              min={key === 'zoom' ? 100 : 0}
              max={key === 'zoom' ? 400 : 100}
              step="1"
              value={Math.round(pz[which][key] * 100)}
              onchange={(e) => changeFrame(which, key, Number(e.currentTarget.value))}
            />
            <span class="hint">%</span>
          </label>
        {/each}
      {/each}
    </div>
    <TimeField
      label="Starts at (in the clip)"
      value={pz.start ?? 0}
      commit={(t) => changePanZoom({ start: t })}
    />
    <TimeField
      label="Ends at (in the clip)"
      value={pz.end ?? length}
      commit={(t) => changePanZoom({ end: t })}
    />
  {/if}
  {@render why(WHY.panZoom)}
</section>

{#if index > 0}
  {@const current = item.transitionIn}
  <section>
    <h3>Transition into this clip <span class="syl">11.1 transitions</span></h3>
    <TransitionPicker
      value={current?.effectId ?? null}
      onchange={(id) =>
        edit(
          setTransition(item.id, id ? { effectId: id, duration: current?.duration ?? 1 } : null),
        )}
    />
    {#if current}
      <TimeField
        label="Transition length"
        value={current.duration}
        commit={(t) => app.edit(setTransition(item.id, { ...current, duration: t }))}
      />
      <div class="chips">
        {#each QUICK as seconds (seconds)}
          <button
            aria-pressed={current.duration === seconds}
            onclick={() => edit(setTransition(item.id, { ...current, duration: seconds }))}
            >{seconds} s</button
          >
        {/each}
      </div>
    {/if}
    {@render why(
      current ? (transitionById(current.effectId)?.why ?? WHY.transition) : WHY.transition,
    )}
  </section>
{/if}

{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h3 {
    font-size: 12.5px;
    margin: 0;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .row,
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }
  .chips button {
    padding: 3px 8px;
    font-size: 11.5px;
  }
  .chips button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .check {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 12px;
  }
  select,
  input[type='number'] {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  .effect {
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .effect-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  .effect-head button {
    padding: 2px 8px;
    font-size: 11px;
  }
  .frames {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px 6px;
  }
  .num {
    display: flex;
    flex-direction: column;
    font-size: 11px;
    color: var(--tx-2);
  }
  .num input {
    width: 100%;
    box-sizing: border-box;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 0;
  }
  .why summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 11.5px;
  }
  .why p {
    margin: 4px 0 0;
    font-size: 11.5px;
    color: var(--tx-2);
  }
  .error {
    margin: 0;
    padding: 0 12px 10px;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
