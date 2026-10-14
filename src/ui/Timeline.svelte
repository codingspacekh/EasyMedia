<script lang="ts">
  import type { App } from '../app/app.ts';
  import { formatTime } from '../core/model/time.ts';
  import { layoutMain, mainTrackDuration } from '../core/model/timeline.ts';
  import type { MainItem } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const PX_PER_SECOND = 40;

  const project = $derived($store.history.present);
  const layout = $derived(layoutMain(project.timeline.main));

  function label(item: MainItem): string {
    if (item.type === 'title') return item.text || 'Title';
    const asset = project.media.find((m) => m.id === item.assetId);
    return asset ? fileNameOf(asset.path) : 'Missing file';
  }

  function seek(event: MouseEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    app.setPlayhead((event.clientX - box.left) / PX_PER_SECOND);
  }
</script>

<section class="timeline">
  <div class="bar">
    <span class="panel-h">Timeline</span>
    <button disabled={!$store.selection} onclick={() => app.removeSelected()}>Delete</button>
    <span class="spacer"></span>
    <span class="tc"
      >{formatTime($store.playhead)} / {formatTime(mainTrackDuration(project.timeline.main))}</span
    >
  </div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="ruler" onclick={seek}></div>
  <div class="track">
    {#if layout.length === 0}
      <p class="empty">Add clips from the media bin to build your video.</p>
    {/if}
    {#each layout as { item, start, end } (item.id)}
      <button
        class="clip {item.type}"
        data-item={item.id}
        aria-pressed={$store.selection === item.id}
        style:left="{start * PX_PER_SECOND}px"
        style:width="{(end - start) * PX_PER_SECOND}px"
        onclick={() => app.select(item.id)}
      >
        <span class="name">{label(item)}</span>
        <span class="len">{(end - start).toFixed(2)} s</span>
      </button>
    {/each}
    <div class="playhead" style:left="{$store.playhead * PX_PER_SECOND}px"></div>
  </div>
</section>

<style>
  .timeline {
    border-top: 1px solid var(--line);
    background: var(--bg-1);
    height: 190px;
    display: flex;
    flex-direction: column;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 0;
  }
  .bar .panel-h {
    border: 0;
  }
  .spacer {
    flex: 1;
  }
  .tc {
    font: 600 13px var(--mono);
  }
  .ruler {
    height: 20px;
    margin: 0 12px;
    background: repeating-linear-gradient(90deg, var(--line-strong) 0 1px, transparent 1px 40px);
    cursor: pointer;
  }
  .track {
    position: relative;
    flex: 1;
    margin: 0 12px 12px;
    background: var(--bg-0);
    border-radius: 6px;
    overflow-x: auto;
  }
  .empty {
    color: var(--tx-3);
    padding: 12px;
    margin: 0;
  }
  .clip {
    position: absolute;
    top: 10px;
    bottom: 10px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    overflow: hidden;
    padding: 4px 6px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    text-align: left;
    white-space: nowrap;
  }
  .clip.video {
    background: var(--c-video);
  }
  .clip.image {
    background: var(--c-image);
  }
  .clip.title {
    background: var(--c-title);
  }
  .clip[aria-pressed='true'] {
    outline: 2px solid #fff;
  }
  .len {
    font: 11px var(--mono);
    opacity: 0.8;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--danger);
    pointer-events: none;
  }
</style>
