<script lang="ts">
  // One-click effects (AN20) for the selected objects, from the playhead: an entrance, an exit or
  // an emphasis, and how long it lasts. Only keyframes are added, so the timeline shows them and
  // they can be changed there afterwards.
  import type { App } from '../../app/app.ts';
  import { ANIM_EFFECTS, effectOf, type EffectGroup } from '../../core/animation/effects.ts';
  import { timeLabel } from '../../core/animation/time.ts';
  import Why from '../Why.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const stage = $derived($store.history.present.stage);

  const GROUPS: { id: EffectGroup; label: string }[] = [
    { id: 'entrance', label: 'Come in' },
    { id: 'exit', label: 'Go out' },
    { id: 'emphasis', label: 'Draw attention' },
  ];
  let chosen = $state('fadeIn');
  let seconds = $state(1);
  let error: string | null = $state(null);
  const effect = $derived(effectOf(chosen));

  function choose(id: string): void {
    chosen = id;
    seconds = effectOf(id)?.seconds ?? 1;
    error = null;
  }
</script>

<div class="sec effects">
  <h4>Effects <span class="syl">20.1 tweening</span></h4>
  <div class="field">
    <label for="effect-choice">Effect</label>
    <select
      id="effect-choice"
      value={chosen}
      onchange={(e) => choose((e.currentTarget as HTMLSelectElement).value)}
    >
      {#each GROUPS as g (g.id)}
        <optgroup label={g.label}>
          {#each ANIM_EFFECTS.filter((e) => e.group === g.id) as e (e.id)}
            <option value={e.id}>{e.label}{e.textOnly ? ' (text)' : ''}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </div>
  <div class="field">
    <label for="effect-seconds">Lasts (s)</label>
    <input id="effect-seconds" type="number" min="0.1" max="60" step="0.1" bind:value={seconds} />
  </div>
  <button
    class="sm primary"
    title="Add the {effect?.label ??
      'effect'} to the selected objects, starting at the playhead ({timeLabel(
      $store.frame,
      stage.fps,
    )})"
    onclick={() => (error = anim.applyEffect(chosen, Number(seconds)))}>Add effect</button
  >
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <p class="hint">
    Starts at the playhead ({timeLabel($store.frame, stage.fps)}). It adds keyframes you can change
    on the timeline; Undo takes it away.
  </p>
  <Why tool="animEffects" />
</div>

<style>
  .sec {
    padding: 8px 0 10px;
    border-bottom: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h4 {
    margin: 0 0 2px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--tx-2);
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .syl {
    font-size: 10px;
    font-weight: 500;
    color: var(--tx-3);
  }
  .field {
    display: grid;
    grid-template-columns: 70px 1fr;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .field input {
    width: 80px;
  }
  button {
    align-self: flex-start;
  }
  .hint {
    margin: 0;
    font-size: 11.5px;
    color: var(--tx-3);
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--danger);
  }
</style>
