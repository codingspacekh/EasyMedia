<script lang="ts">
  // A number box with its unit (V14 speed ×, V17 export size px): the student types 1.25; applied
  // on Enter or when leaving the box; problems are explained right under it.
  let {
    label,
    value,
    unit,
    example,
    commit,
  }: {
    label: string;
    value: number;
    unit: string;
    /** Shown when the text is not a number: "Type a number such as …". */
    example: string;
    commit: (n: number) => string | null;
  } = $props();

  let error: string | null = $state(null);
  const id = `number-${Math.random().toString(36).slice(2, 9)}`;

  function onchange(event: Event): void {
    const text = (event.currentTarget as HTMLInputElement).value.replace(unit, '').trim();
    const n = text === '' ? NaN : Number(text);
    error = Number.isFinite(n) ? commit(n) : `Type a number such as ${example}.`;
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box">
    <input
      {id}
      type="text"
      inputmode="decimal"
      value={String(value)}
      {onchange}
      aria-invalid={error !== null}
    />
    <span class="unit">{unit}</span>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .field {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    gap: 4px 8px;
    margin-bottom: 8px;
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
    padding: 0 8px;
  }
  .box:focus-within {
    border-color: var(--accent);
  }
  input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--tx-1);
    font: 500 13px var(--mono);
    padding: 5px 0;
    outline: none;
    height: auto;
    box-shadow: none;
    border-radius: 0;
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
