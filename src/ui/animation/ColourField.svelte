<script lang="ts">
  // A colour of the Properties panel (AN6): a swatch to pick from and the hex code to type, as
  // tasks give colours like #F4C8EE. Applied when the code is complete or the picker changes.
  let {
    label,
    value,
    commit,
  }: { label: string; value: string; commit: (colour: string) => string | null } = $props();

  let error: string | null = $state(null);
  const id = `colour-${Math.random().toString(36).slice(2, 9)}`;

  function fromText(event: Event): void {
    const raw = (event.currentTarget as HTMLInputElement).value.trim();
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    error = /^#[0-9a-f]{6}$/i.test(hex) ? commit(hex) : 'Type a colour such as #F4C8EE.';
  }
  function fromPicker(event: Event): void {
    error = commit((event.currentTarget as HTMLInputElement).value);
  }
</script>

<div class="field">
  <label for={id}>{label}</label>
  <div class="box">
    <input
      class="swatch"
      type="color"
      aria-label="{label} swatch"
      value={value.toLowerCase()}
      onchange={fromPicker}
    />
    <input
      {id}
      type="text"
      value={value.toUpperCase()}
      onchange={fromText}
      aria-invalid={error !== null}
    />
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
  }
  label {
    color: var(--tx-2);
    font-size: 12px;
  }
  .box {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--bg-2);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 0 6px;
  }
  .box:focus-within {
    border-color: var(--accent);
  }
  .swatch {
    width: 22px;
    height: 20px;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }
  input[type='text'] {
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
  .error {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
