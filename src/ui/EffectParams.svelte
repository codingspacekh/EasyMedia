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
  const entries = $derived(Object.entries(def.params).filter(([, spec]) => !spec.band));
  const bands = $derived(Object.entries(def.params).filter(([, spec]) => spec.band));
  const signed = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
</script>

{#if entries.length === 0 && bands.length === 0}
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
        <div class="row">
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
        <div class="row">
          <label for={id}>{spec.label}</label>
          <select
            {id}
            value={String(params[key] ?? spec.default)}
            onchange={(e) =>
              (error = onchange({ ...params, [key]: Number(e.currentTarget.value) }))}
          >
            {#each spec.choices as choice, i (choice)}
              <option value={String(i)}>{choice}</option>
            {/each}
          </select>
        </div>
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
    {#if bands.length}
      <!-- Graphic EQ: one vertical slider per band, bass on the left, treble on the right. -->
      <div class="bands" role="group" aria-label="Frequency bands">
        {#each bands as [key, spec] (key)}
          {@const value = params[key] ?? spec.default}
          <div class="band">
            <span class="db">{signed(value)}</span>
            <input
              type="range"
              aria-label={spec.label}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              {value}
              oninput={(e) =>
                (error = onchange({ ...params, [key]: Number(e.currentTarget.value) }))}
            />
            <span class="hz">{spec.label.replace(' Hz', '').replace(' kHz', 'k')}</span>
          </div>
        {/each}
      </div>
      <p class="ends">
        <span>← Bass</span><span>{bands[0]![1].unit ?? ''}</span><span>Treble →</span>
      </p>
    {/if}
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
  /* Choices get a row of their own: they take the width their longest name needs. */
  .row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .row button {
    white-space: nowrap;
  }
  .bands {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    padding: 6px 0 0;
  }
  .band {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .band input {
    writing-mode: vertical-lr;
    direction: rtl;
    width: 18px;
    height: 110px;
    padding: 0;
    border: 0;
    background: none;
    accent-color: var(--accent);
  }
  .db,
  .hz {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .db {
    color: var(--tx-1);
  }
  .hz {
    color: var(--tx-3);
  }
  .ends {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    margin: 0;
    color: var(--tx-3);
    font-size: 11px;
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
