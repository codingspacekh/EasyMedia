<script lang="ts">
  // A percentage box (volume, V13): the student types 80 for 80 %; the value is a factor (0.8).
  // Applied on Enter or when leaving the box; problems are explained right under it.
  let {
    label,
    value,
    commit,
  }: { label: string; value: number; commit: (factor: number) => string | null } = $props();

  let error: string | null = $state(null);
  const id = `percent-${Math.random().toString(36).slice(2, 9)}`;

  function onchange(event: Event): void {
    const text = (event.currentTarget as HTMLInputElement).value.replace('%', '').trim();
    const percent = text === '' ? NaN : Number(text);
    error = Number.isFinite(percent) ? commit(percent / 100) : 'Type a number such as 80.';
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box">
    <input
      {id}
      type="text"
      inputmode="decimal"
      value={Math.round(value * 100)}
      {onchange}
      aria-invalid={error !== null}
    />
    <span class="unit">%</span>
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
