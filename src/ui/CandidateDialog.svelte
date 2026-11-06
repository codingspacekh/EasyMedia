<script lang="ts">
  // File ▸ Candidate Details…: the centre number, candidate number and name the 9626 papers ask
  // for. Saved, every Save and Export box suggests the papers' file name (app/candidate.ts).
  import { untrack } from 'svelte';
  import type { App } from '../app/app.ts';
  import type { Candidate } from '../core/exam-name.ts';
  import { examName } from '../core/exam-name.ts';
  import Dialog from './Dialog.svelte';

  let { app }: { app: App } = $props();
  const candidate = $derived(app.candidate);
  // The boxes start with the saved details.
  const saved = untrack(() => app.candidate.store.get().candidate);
  let centre = $state(saved?.centre ?? '');
  let number = $state(saved?.number ?? '');
  let name = $state(saved?.name ?? '');
  let error: { field: keyof Candidate; error: string } | null = $state(null);

  const example = $derived(
    examName('Gas', {
      centre: centre.trim().toUpperCase() || 'ZZ999',
      number: number.trim() || '9999',
      name: '',
    }),
  );

  async function save() {
    error = await candidate.set({ centre, number, name });
    if (!error) candidate.closeDialog();
  }

  async function clear() {
    await candidate.clear();
    candidate.closeDialog();
  }

  const FIELDS = [
    { id: 'centre', label: 'Centre number', hint: 'e.g. ZZ999' },
    { id: 'number', label: 'Candidate number', hint: 'e.g. 9999' },
    { id: 'name', label: 'Your name', hint: 'for "edited by" text' },
  ] as const;
</script>

<Dialog label="Candidate details" width={460} onclose={() => candidate.closeDialog()}>
  <p class="lead">
    Exam papers ask for files named with your centre and candidate number. Type them once: every
    Save and Export box then suggests the name, for example <b>{example}</b>.
  </p>
  {#each FIELDS as f (f.id)}
    <div class="field">
      <label for="candidate-{f.id}">{f.label}</label>
      {#if f.id === 'centre'}
        <input
          id="candidate-centre"
          bind:value={centre}
          placeholder={f.hint}
          autocomplete="off"
          aria-invalid={error?.field === 'centre'}
        />
      {:else if f.id === 'number'}
        <input
          id="candidate-number"
          bind:value={number}
          placeholder={f.hint}
          inputmode="numeric"
          autocomplete="off"
          aria-invalid={error?.field === 'number'}
        />
      {:else}
        <input
          id="candidate-name"
          bind:value={name}
          placeholder={f.hint}
          aria-invalid={error?.field === 'name'}
        />
      {/if}
      {#if error?.field === f.id}<p class="error" role="alert">{error.error}</p>{/if}
    </div>
  {/each}
  <p class="hint">Kept on this computer only. Clear them before another student uses it.</p>
  {#snippet buttons()}
    {#if saved}<button onclick={() => void clear()}>Clear</button>{/if}
    <button onclick={() => candidate.closeDialog()}>Cancel</button>
    <button class="primary" onclick={() => void save()}>Save</button>
  {/snippet}
</Dialog>

<style>
  .lead {
    margin: 0 0 12px;
  }
  .field {
    display: grid;
    grid-template-columns: 130px 1fr;
    align-items: center;
    gap: 4px 8px;
    margin-bottom: 8px;
  }
  label {
    color: var(--tx-2);
    font-size: 12px;
  }
  .error {
    grid-column: 2;
    margin: 0;
    color: var(--danger);
    font-size: 11.5px;
  }
  .hint {
    color: var(--tx-2);
    font-size: 12px;
    margin: 8px 0 0;
  }
</style>
