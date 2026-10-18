<script lang="ts">
  // An effect's dialog, generated from its parameter schema (P7): the settings, a note or warning,
  // the syllabus point and "Why use this?" (T5), Preview (A18), Cancel and Apply.
  import { untrack } from 'svelte';
  import type { Params, ParamSpec } from '../../core/effects/types.ts';
  import EffectParams from '../EffectParams.svelte';
  import Icon from '../Icon.svelte';
  import LevelGraph from './LevelGraph.svelte';

  let {
    id,
    title,
    syllabus,
    why,
    params: schema,
    initial,
    appliesTo,
    note,
    link,
    preview,
    apply,
    step1,
    levels,
    onclose,
  }: {
    id: string;
    title: string;
    syllabus: string;
    why: string;
    params: Record<string, ParamSpec>;
    initial: Params;
    appliesTo: string;
    note?: (params: Params) => string | null;
    link?: (params: Params, changed: string) => Params;
    preview?: (params: Params) => string | null;
    /** Returns why it cannot be applied, or null (the dialog then closes). */
    apply: (params: Params) => string | null;
    /** A13: a first step before the settings (Get noise profile, as Audacity). */
    step1?: {
      /** The time range the profile was taken from, or null. */
      taken: string | null;
      /** Returns why it failed, or null (the dialog then closes so the student can select). */
      take: () => string | null;
    };
    /** A19: the input → output curve and the selection's levels before / after. */
    levels?: {
      curve: (params: Params) => (inputDb: number) => number;
      shape: (params: Params, levelsDb: readonly number[]) => number[];
      before: readonly number[];
    };
    onclose: () => void;
  } = $props();

  // The dialog starts from the settings it was given.
  let params: Params = $state(untrack(() => ({ ...initial })));
  let error: string | null = $state(null);
  let showWhy = $state(false);
  const line = $derived(note?.(params) ?? null);

  function change(next: Params): string | null {
    const key = Object.keys(next).find((k) => next[k] !== params[k]);
    params = key && link ? link(next, key) : next;
    error = null;
    return null;
  }

  function onTake(): void {
    error = step1!.take();
    if (!error) onclose();
  }

  function onApply(): void {
    error = apply({ ...params });
    if (!error) onclose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label={title}>
    <h2>{title} <span class="syl">{syllabus}</span></h2>
    {#if step1}
      <section class="step" aria-labelledby={`${id}-step1`}>
        <h3 id={`${id}-step1`}>Step 1 · Get a noise profile</h3>
        <p>Select a part that has only background noise (hiss, hum, fan), then click the button.</p>
        <div class="take">
          <button onclick={onTake}>Get noise profile</button>
          <span class="hint"
            >{step1.taken ? `Profile taken from ${step1.taken}` : 'No profile yet'}</span
          >
        </div>
      </section>
      <section class="step" aria-labelledby={`${id}-step2`}>
        <h3 id={`${id}-step2`}>Step 2 · Select the sound to clean, then reduce</h3>
        <EffectParams def={{ id, params: schema }} {params} onchange={change} />
      </section>
    {:else}
      <EffectParams def={{ id, params: schema }} {params} onchange={change} />
    {/if}
    {#if levels}
      <LevelGraph
        curve={levels.curve(params)}
        before={levels.before}
        after={levels.shape(params, levels.before)}
      />
    {/if}
    {#if line}<p class="note">{line}</p>{/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="why">
      <button class="ghost sm" aria-expanded={showWhy} onclick={() => (showWhy = !showWhy)}
        ><Icon name="learn" size={14} /> Why use this?</button
      >
      {#if showWhy}<p>{why}</p>{/if}
    </div>
    <div class="actions">
      {#if preview}
        <button onclick={() => (error = preview({ ...params }))}
          ><Icon name="play" size={12} /> Preview</button
        >
      {/if}
      <span class="hint">Applies to {appliesTo}</span>
      <span class="spacer"></span>
      <button onclick={onclose}>Cancel</button>
      <button class="primary" onclick={onApply}>Apply</button>
    </div>
  </div>
</div>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .step h3 {
    margin: 0;
    font-size: 12.5px;
    color: var(--tx-1);
  }
  .step p {
    margin: 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .take {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .backdrop {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    z-index: 30;
  }
  .dialog {
    width: min(460px, calc(100vw - 40px));
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  h2 {
    margin: 0;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .syl {
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--warn);
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--danger);
  }
  .why p {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--tx-2);
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .hint {
    font-size: 11.5px;
    color: var(--tx-3);
  }
  .spacer {
    flex: 1;
  }
</style>
