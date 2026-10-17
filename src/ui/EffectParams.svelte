<script lang="ts">
  // Settings generated from an effect's parameter schema (P7): no hand-built form per effect.
  import type { EffectDef, Params } from '../core/effects/types.ts';

  let {
    def,
    params,
    onchange,
  }: {
    def: Pick<EffectDef, 'id' | 'params'>;
    params: Params;
    /** Returns an error message when the new settings cannot be used. */
    onchange: (params: Params) => string | null;
  } = $props();

  let error: string | null = $state(null);
  const entries = $derived(Object.entries(def.params));
</script>

{#if entries.length === 0}
  <p class="hint">This effect has no settings.</p>
{:else}
  <div class="params">
    {#each entries as [key, spec] (key)}
      {@const id = `${def.id}-${key}`}
      {#if spec.toggle}
        <label class="toggle" for={id}>
          <input
            {id}
            type="checkbox"
            checked={(params[key] ?? spec.default) === 1}
            onchange={(e) =>
              (error = onchange({ ...params, [key]: e.currentTarget.checked ? 1 : 0 }))}
          />
          {spec.label}
        </label>
      {:else if spec.choices && spec.choices.length <= 3}
        <!-- A row of its own: the buttons take the width they need, on one line each. -->
        <div class="buttons">
          <span class="label" id={`${id}-label`}>{spec.label}</span>
          <div class="seg small" role="group" aria-labelledby={`${id}-label`}>
            {#each spec.choices as choice, i (choice)}
              <button
                type="button"
                aria-pressed={(params[key] ?? spec.default) === i}
                onclick={() => (error = onchange({ ...params, [key]: i }))}>{choice}</button
              >
            {/each}
          </div>
        </div>
      {:else if spec.choices}
        <label for={id}>{spec.label}</label>
        <select
          {id}
          class="choice"
          value={String(params[key] ?? spec.default)}
          onchange={(e) => (error = onchange({ ...params, [key]: Number(e.currentTarget.value) }))}
        >
          {#each spec.choices as choice, i (choice)}
            <option value={String(i)}>{choice}</option>
          {/each}
        </select>
      {:else}
        <label for={id}>{spec.label}</label>
        <input
          {id}
          type="number"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={params[key] ?? spec.default}
          onchange={(e) => (error = onchange({ ...params, [key]: Number(e.currentTarget.value) }))}
        />
        <span class="unit">{spec.unit ?? ''}</span>
      {/if}
    {/each}
  </div>
{/if}
{#if error}<p class="error" role="alert">{error}</p>{/if}

<style>
  .params {
    display: grid;
    grid-template-columns: 1fr 72px 18px;
    gap: 4px 6px;
    align-items: center;
    font-size: 12px;
  }
  label,
  .label {
    color: var(--tx-2);
  }
  .choice {
    grid-column: 2 / -1;
  }
  .buttons {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .buttons button {
    white-space: nowrap;
  }
  .toggle {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--tx-1);
  }
  input,
  select {
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 3px 6px;
  }
  .unit,
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
  }
  .hint,
  .error {
    margin: 4px 0 0;
  }
  .error {
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
