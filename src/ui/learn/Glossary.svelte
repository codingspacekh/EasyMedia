<script lang="ts">
  // Learn mode's glossary (screens 21–22): the coursebooks' key words, searchable, and why each
  // editing tool is used (T5), in the syllabus's words.
  import { TOOLS } from '../../core/effects/help.ts';
  import { searchGlossary } from '../../core/teaching/glossary.ts';

  let { onclose }: { onclose: () => void } = $props();
  let query = $state('');
  const words = $derived(searchGlossary(query));
  const tools = $derived(
    TOOLS.filter((t) =>
      `${t.label} ${t.syllabus} ${t.why}`.toLowerCase().includes(query.trim().toLowerCase()),
    ),
  );
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Glossary">
    <div class="head">
      <h2>Glossary</h2>
      <!-- The search box is what the glossary is for. -->
      <!-- svelte-ignore a11y_autofocus -->
      <input
        type="search"
        placeholder="Find a word…"
        aria-label="Find a word"
        bind:value={query}
        autofocus
      />
      <button onclick={onclose}>Close</button>
    </div>
    <div class="body">
      {#each words as w (w.term)}
        <article>
          <h3>{w.term}</h3>
          <p>{w.meaning}</p>
        </article>
      {/each}
      {#if tools.length}
        <h2 class="sub">Why use each tool?</h2>
        {#each tools as t (t.id)}
          <article>
            <h3>{t.label} <span class="syl">{t.syllabus}</span></h3>
            <p>{t.why}</p>
          </article>
        {/each}
      {/if}
      {#if !words.length && !tools.length}
        <p class="none">No word matches “{query}”.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 9, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    width: min(720px, calc(100vw - 48px));
    max-height: calc(100vh - 80px);
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    margin: 0;
    font-size: 15px;
  }
  input {
    flex: 1;
    font: inherit;
    color: var(--tx-1);
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 5px;
    padding: 4px 6px;
  }
  .body {
    overflow: auto;
    padding: 8px 18px 18px;
  }
  article {
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    margin: 0 0 4px;
    font-size: 13px;
  }
  p {
    margin: 0;
    font-size: 12.5px;
    line-height: 1.55;
    color: var(--tx-2);
  }
  .sub {
    margin-top: 20px;
  }
  .syl {
    font-size: 10px;
    font-weight: 400;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .none {
    padding: 16px 0;
    color: var(--tx-3);
  }
</style>
