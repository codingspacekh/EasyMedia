<script lang="ts">
  // T5: "Why use this?" under a tool's heading, in the syllabus's words (design screen 23).
  import { WHY, type ToolId } from '../core/effects/help.ts';

  let { tool }: { tool: ToolId } = $props();
</script>

<details class="why">
  <summary>Why use this?</summary>
  <p>{WHY[tool]}</p>
</details>

<style>
  summary {
    cursor: pointer;
    color: var(--accent);
    font-size: 11.5px;
  }
  p {
    margin: 4px 0 0;
    font-size: 11.5px;
    color: var(--tx-2);
  }
</style>
