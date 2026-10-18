<script lang="ts">
  // T6 task checker: the teacher sets what the exported file must be and saves it as a task
  // file for the students; a student opens it and checks an export, row by row.
  import type { LearnApp } from '../../app/learn.ts';
  import { SAMPLE_RATES, hz } from '../../core/render/audio-formats.ts';
  import { TASK_FORMATS, type TaskSpec } from '../../core/teaching/task-check.ts';
  import Icon from '../Icon.svelte';
  import LearnCard from './LearnCard.svelte';

  let { learn }: { learn: LearnApp } = $props();
  const store = $derived(learn.store);
  const spec = $derived($store.task.spec);
  const checked = $derived($store.task.checked);

  /** The task with one setting changed; an empty box means "any". */
  function change<K extends keyof TaskSpec>(key: K, value: TaskSpec[K] | undefined): void {
    const next = { ...spec };
    if (value === undefined) delete next[key];
    else next[key] = value;
    learn.setTask(next);
  }
  const number = (text: string) => (text.trim() === '' ? undefined : Number(text));
</script>

<div class="cols">
  <LearnCard title="Task" icon="file" tag="11.1 · 11.2 requirements of the audience">
    <p class="hint first">
      <b>Teachers:</b> set what the exported file must be, then save the task and give the file to your
      students. Leave a box empty to accept anything.
    </p>
    <div class="grid">
      <label class="wide"
        >Task name
        <input
          aria-label="Task name"
          value={spec.name}
          oninput={(e) => change('name', e.currentTarget.value)}
        />
      </label>
      <label
        >File format
        <select
          aria-label="File format"
          value={spec.container ?? ''}
          onchange={(e) => change('container', e.currentTarget.value || undefined)}
        >
          <option value="">Any</option>
          {#each TASK_FORMATS as f (f)}<option value={f}>{f.toUpperCase()}</option>{/each}
        </select>
      </label>
      <div class="pair">
        <label
          >Width
          <input
            aria-label="Width"
            type="number"
            min="1"
            value={spec.width ?? ''}
            onchange={(e) => change('width', number(e.currentTarget.value))}
          />
        </label>
        <label
          >Height
          <input
            aria-label="Height"
            type="number"
            min="1"
            value={spec.height ?? ''}
            onchange={(e) => change('height', number(e.currentTarget.value))}
          />
        </label>
      </div>
      <div class="pair">
        <label
          >Duration (s)
          <input
            aria-label="Duration (s)"
            type="number"
            min="0"
            step="0.1"
            value={spec.duration ?? ''}
            onchange={(e) => change('duration', number(e.currentTarget.value))}
          />
        </label>
        <label
          >± seconds
          <input
            aria-label="Tolerance (s)"
            type="number"
            min="0"
            step="0.1"
            value={spec.tolerance ?? ''}
            onchange={(e) => change('tolerance', number(e.currentTarget.value))}
          />
        </label>
      </div>
      <label
        >Channels
        <select
          aria-label="Channels"
          value={String(spec.channels ?? '')}
          onchange={(e) => change('channels', number(e.currentTarget.value) as 1 | 2 | undefined)}
        >
          <option value="">Any</option>
          <option value="1">1 · mono</option>
          <option value="2">2 · stereo</option>
        </select>
      </label>
      <label
        >Sample rate
        <select
          aria-label="Sample rate"
          value={String(spec.sampleRate ?? '')}
          onchange={(e) => change('sampleRate', number(e.currentTarget.value))}
        >
          <option value="">Any</option>
          {#each SAMPLE_RATES as r (r.rate)}<option value={String(r.rate)}>{hz(r.rate)}</option
            >{/each}
        </select>
      </label>
    </div>
    <div class="actions">
      <button onclick={() => learn.openTask()}>Open task…</button>
      <button class="primary" onclick={() => learn.saveTask()}>Save task…</button>
    </div>
  </LearnCard>

  <LearnCard title="Check an export" icon="check" tag="meeting the requirements">
    <p class="hint first">
      <b>Students:</b> open the task your teacher gave you, then choose the file you exported.
    </p>
    <button class="primary" onclick={() => learn.checkExport()}>Check a file…</button>
    {#if checked}
      <p class="verdict" class:pass={checked.pass}>
        <Icon name={checked.pass ? 'check' : 'delete'} />
        {checked.name}: {checked.pass
          ? 'Passed — it meets the task'
          : 'Not yet — see the rows marked ✗'}
      </p>
      <table>
        <thead>
          <tr><th>What</th><th>The task asks for</th><th>Your file</th><th></th></tr>
        </thead>
        <tbody>
          {#each checked.rows as row (row.label)}
            <tr class:fail={!row.pass}>
              <td>{row.label}</td>
              <td>{row.expected}</td>
              <td>{row.actual}</td>
              <td class="mark">{row.pass ? '✓' : '✗'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </LearnCard>
</div>

<style>
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    min-height: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--tx-2);
  }
  .wide {
    grid-column: 1 / -1;
  }
  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  input,
  select {
    width: 100%;
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }
  .hint {
    color: var(--tx-3);
    font-size: 12px;
    margin: 0 0 12px;
  }
  .hint b {
    color: var(--tx-2);
  }
  .verdict {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 16px 0 8px;
    font-weight: 600;
    color: var(--danger);
  }
  .verdict.pass {
    color: var(--success);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  th {
    text-align: left;
    font-size: 10.5px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tx-3);
    padding: 0 8px 6px 0;
    border-bottom: 1px solid var(--line-strong);
  }
  td {
    padding: 7px 8px 7px 0;
    border-bottom: 1px solid var(--line);
  }
  td:nth-child(2),
  td:nth-child(3) {
    font-family: var(--mono);
  }
  .mark {
    color: var(--success);
    font-weight: 700;
  }
  .fail td {
    color: var(--danger);
  }
</style>
