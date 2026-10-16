<script lang="ts">
  // A time box of the selection bar (A5, N8): accepts 19.1, 00:19.10 or 1:17.20; shows mm:ss.ss.
  // A read-only box (the selection length) has no `commit`.
  import { formatTime, parseTime } from '../../core/model/time.ts';

  let {
    label,
    value,
    commit,
  }: { label: string; value: number; commit?: (seconds: number) => string | null } = $props();

  let error: string | null = $state(null);
  const id = `bigtime-${Math.random().toString(36).slice(2, 9)}`;

  function onchange(event: Event): void {
    const seconds = parseTime((event.currentTarget as HTMLInputElement).value);
    error = seconds === null ? 'Type a time such as 19.1 or 00:19.10.' : commit!(seconds);
  }
</script>

<div class="grp">
  <label class="k" for={id}>{label}</label>
  <input
    {id}
    class="bigtc"
    type="text"
    inputmode="decimal"
    value={formatTime(value)}
    readonly={!commit}
    aria-invalid={error !== null}
    {onchange}
  />
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

<style>
  .grp {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .k {
    font-size: 10.5px;
    color: var(--tx-3);
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .bigtc {
    width: 112px;
    font: 600 15px var(--mono);
    color: var(--tx-1);
    padding: 3px 8px;
    background: var(--bg-0);
    border: 1px solid var(--line);
    border-radius: 4px;
  }
  .bigtc:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-soft);
    outline: none;
  }
  .bigtc[readonly] {
    color: var(--tx-2);
  }
  .bigtc[aria-invalid='true'] {
    color: var(--danger);
  }
  .error {
    position: absolute;
    top: 100%;
    left: 0;
    width: 240px;
    margin: 2px 0 0;
    color: var(--danger);
    font-size: 11px;
  }
</style>
