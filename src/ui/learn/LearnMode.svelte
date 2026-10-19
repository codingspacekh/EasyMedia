<script lang="ts">
  // Learn mode (screens 21–22 and the task checker): theory tools that never change the project.
  import type { App } from '../../app/app.ts';
  import { ui } from '../ui-state.svelte.ts';
  import CompressionComparison from './CompressionComparison.svelte';
  import FileSizeCalculator from './FileSizeCalculator.svelte';
  import FormatGuide from './FormatGuide.svelte';
  import Glossary from './Glossary.svelte';
  import MediaInspector from './MediaInspector.svelte';
  import SamplingVisualiser from './SamplingVisualiser.svelte';
  import TaskChecker from './TaskChecker.svelte';
  import VideoQuality from './VideoQuality.svelte';

  let { app }: { app: App } = $props();
  const learn = $derived(app.learn);
</script>

<div class="learn {ui.learnTab}" role="tabpanel">
  {#if ui.learnTab === 'inspect'}
    <MediaInspector {learn} />
    <FileSizeCalculator />
    <div class="stack">
      <SamplingVisualiser />
      <CompressionComparison {learn} />
    </div>
  {:else if ui.learnTab === 'formats'}
    <FormatGuide />
    <VideoQuality {learn} />
  {:else}
    <TaskChecker {learn} />
  {/if}
</div>
{#if ui.glossary}<Glossary onclose={() => (ui.glossary = false)} />{/if}

<style>
  .learn {
    flex: 1;
    display: grid;
    gap: 16px;
    padding: 16px;
    align-items: start;
    min-height: 0;
    overflow: auto;
    background: var(--bg-0);
  }
  .inspect {
    grid-template-columns: minmax(320px, 400px) minmax(0, 1fr) minmax(0, 1fr);
  }
  .formats {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  }
  .task {
    grid-template-columns: minmax(0, 1fr);
  }
  /* Wide content (a 40-sample table) scrolls inside its card instead of widening the column. */
  .stack {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
    min-width: 0;
  }
  /* Smaller windows (down to 1100 px): the inspector tab in two columns. */
  @media (max-width: 1300px) {
    .inspect {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .inspect > .stack {
      grid-column: 1 / -1;
    }
  }
</style>
