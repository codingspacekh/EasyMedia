<script lang="ts">
  // A number box of the Properties panel (AN6): exact values typed, applied on Enter or when
  // leaving the box; a refused value is explained right under it.
  let {
    label,
    value,
    unit = '',
    step = 1,
    decimals = 0,
    commit,
    disabled = false,
  }: {
    label: string;
    value: number;
    unit?: string;
    step?: number;
    decimals?: number;
    commit: (value: number) => string | null;
    disabled?: boolean;
  } = $props();

  let error: string | null = $state(null);
  const id = `num-${Math.random().toString(36).slice(2, 9)}`;
  const shown = $derived(Number.isFinite(value) ? value.toFixed(decimals) : '');

  function onchange(event: Event): void {
    const text = (event.currentTarget as HTMLInputElement).value.trim().replace(unit, '');
    const n = text === '' ? NaN : Number(text);
    error = Number.isFinite(n) ? commit(n) : 'Type a number.';
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box" class:disabled>
    <input
      {id}
      type="text"
      inputmode="decimal"
      value={shown}
      {step}
      {disabled}
      {onchange}
      aria-invalid={error !== null}
    />
    {#if unit}<span class="unit">{unit}</span>{/if}
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: 58px 1fr;
    align-items: center;
    gap: 3px 6px;
    margin-bottom: 6px;
    min-width: 0;
  }
  label {
    color: var(--tx-2);
    font-size: 12px;
  }
  .box {
    display: flex;
    align-items: center;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 6px;
    min-width: 0;
  }
  .box.disabled {
    opacity: 0.5;
  }
  .box:focus-within {
    border-color: var(--accent);
  }
  input {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--tx-1);
    font: 500 12.5px var(--mono);
    padding: 4px 0;
    outline: none;
  }
  input[aria-invalid='true'] {
    color: var(--danger);
  }
  .unit {
    color: var(--tx-3);
    font-size: 11px;
  }
  .error {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
