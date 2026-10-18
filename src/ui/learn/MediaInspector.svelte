<script lang="ts">
  // T1 media inspector (screen 21): choose or drop any file and see what is inside it. Each row
  // explains itself when clicked.
  import type { LearnApp } from '../../app/learn.ts';
  import { FILE_VS_CONTAINER, inspect } from '../../core/teaching/inspect.ts';
  import Icon from '../Icon.svelte';
  import LearnCard from './LearnCard.svelte';

  let { learn }: { learn: LearnApp } = $props();
  const store = $derived(learn.store);
  const inspected = $derived($store.inspected);
  const rows = $derived(inspected ? inspect(inspected.info) : []);
  const size = $derived(rows.find((r) => r.label === 'File size')?.value);
  let open: string | null = $state(null);
  let over = $state(false);

  function drop(e: DragEvent): void {
    e.preventDefault();
    over = false;
    const file = e.dataTransfer?.files[0];
    const path = file && window.mve?.pathForFile(file);
    if (path) void learn.inspect(path);
  }
  const [title, ...rest] = FILE_VS_CONTAINER.split('. ');
</script>

<LearnCard title="Media inspector" icon="locate" tag="containers · codecs">
  <div
    class="drop"
    class:over
    role="group"
    aria-label="Drop a file here to inspect it"
    ondragover={(e) => {
      e.preventDefault();
      over = true;
    }}
    ondragleave={() => (over = false)}
    ondrop={drop}
  >
    <Icon name="file" size={22} />
    <div class="name">
      <b>{inspected?.name ?? 'No file yet'}</b>
      <span>Drop any file here to inspect it</span>
    </div>
    {#if size}<b class="size">{size}</b>{/if}
    <button onclick={() => learn.inspect()}>Choose a file…</button>
  </div>

  {#if rows.length}
    <table>
      <tbody>
        {#each rows as row (row.label)}
          <tr>
            <td>
              <button
                class="label"
                aria-expanded={open === row.label}
                onclick={() => (open = open === row.label ? null : row.label)}>{row.label}</button
              >
            </td>
            <td class="v">
              {row.value}
              {#if row.compression}<span class="tag {row.compression}">{row.compression}</span>{/if}
            </td>
          </tr>
          {#if open === row.label}
            <tr class="explain"><td colspan="2">{row.explain}</td></tr>
          {/if}
        {/each}
      </tbody>
    </table>
    <p class="hint">Click a row to see what it means.</p>
  {:else}
    <p class="hint">
      Choose a video, sound or picture — for example one of the coursebook files — to see its
      container, codecs, resolution, sample rate and more.
    </p>
  {/if}

  <div class="why-box">
    <Icon name="info" />
    <div><b>{title}.</b> {rest.join('. ')}</div>
  </div>
</LearnCard>

<style>
  .drop {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    align-items: center;
    padding: 12px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-l);
    background: var(--bg-2);
    color: var(--tx-3);
  }
  .drop.over {
    border-color: var(--accent);
    background: var(--accent-soft);
  }
  .name {
    flex: 1 1 150px;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name b {
    color: var(--tx-1);
    overflow-wrap: anywhere;
  }
  .drop button {
    margin-left: auto;
  }
  .name span {
    font-size: 11.5px;
  }
  .size {
    font-family: var(--mono);
    color: var(--tx-1);
  }
  table {
    width: 100%;
    margin-top: 10px;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  td {
    padding: 4px 0;
    border-bottom: 1px solid var(--line);
    vertical-align: top;
  }
  td:first-child {
    width: 130px;
  }
  .label {
    border: 0;
    background: none;
    padding: 3px 0;
    height: auto;
    color: var(--tx-2);
    text-align: left;
    cursor: help;
  }
  .label[aria-expanded='true'] {
    color: var(--accent);
  }
  .v {
    font-family: var(--mono);
    font-weight: 500;
    padding-top: 7px;
  }
  .tag {
    display: inline-block;
    margin-left: 6px;
    padding: 0 7px;
    border: 1px solid var(--line);
    border-radius: 999px;
    font: 10.5px var(--font);
    color: var(--warn);
  }
  .tag.lossless {
    color: var(--success);
  }
  .tag.uncompressed {
    color: var(--tx-2);
  }
  .explain td {
    padding: 4px 0 10px;
    color: var(--tx-2);
    font-size: 12px;
    line-height: 1.5;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
  .why-box {
    display: flex;
    gap: 10px;
    margin-top: 14px;
    padding: 12px;
    border-radius: var(--radius);
    background: rgba(79, 140, 255, 0.08);
    border: 1px solid rgba(79, 140, 255, 0.25);
    color: var(--tx-2);
    font-size: 12px;
    line-height: 1.5;
  }
  .why-box :global(.icon) {
    color: var(--accent);
    margin-top: 1px;
  }
  .why-box b {
    color: var(--tx-1);
  }
</style>
