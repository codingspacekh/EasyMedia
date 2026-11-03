<script lang="ts">
  // T5, N17: "Why use this?" — under a tool's heading, in the syllabus's words, arranged to read at
  // a glance: the short answer first, then its reasons as points, and the syllabus point it is for.
  // A registry tool is named by `tool`; an effect or transition passes its own `text`.
  import { WHY, explain, toolById, type ToolId } from '../core/effects/help.ts';
  import Icon from './Icon.svelte';

  let {
    tool,
    text,
    title = 'Why use this?',
    syllabus,
    open = false,
  }: {
    tool?: ToolId;
    text?: string;
    title?: string;
    syllabus?: string;
    open?: boolean;
  } = $props();

  const explained = $derived(explain(text ?? (tool ? WHY[tool] : '')));
  const point = $derived(syllabus ?? (tool ? toolById(tool)?.syllabus : undefined));
</script>

<details class="why" {open}>
  <summary><Icon name="help" size={13} /><span>{title}</span></summary>
  <div class="body">
    <p class="answer">{explained.answer}</p>
    {#if explained.reasons.length}
      <ul>
        {#each explained.reasons as reason (reason)}<li>{reason}</li>{/each}
      </ul>
    {/if}
    {#if point}<p class="syl">Syllabus {point}</p>{/if}
  </div>
</details>

<style>
  .why {
    font-size: 13px;
    line-height: 1.55;
  }
  summary {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    color: var(--accent);
    font-size: 12.5px;
    font-weight: 600;
    list-style: none;
    border-radius: 4px;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  summary:hover span {
    text-decoration: underline;
  }
  summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .body {
    margin-top: 6px;
    padding: 9px 11px;
    border-left: 3px solid var(--accent);
    border-radius: 0 6px 6px 0;
    background: var(--accent-soft, rgba(79, 140, 255, 0.1));
    max-width: 62ch;
  }
  .answer {
    margin: 0;
    color: var(--tx-1);
    font-weight: 500;
  }
  ul {
    margin: 6px 0 0;
    padding-left: 18px;
    color: var(--tx-1);
    opacity: 0.88;
  }
  li + li {
    margin-top: 3px;
  }
  .syl {
    margin: 7px 0 0;
    font-size: 11.5px;
    color: var(--tx-2);
  }
</style>
