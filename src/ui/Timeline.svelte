<script lang="ts">
  // Main track (V2, V3, V12): select, split, join, drag to reorder, trim handles with snapping, zoom.
  import type { App } from '../app/app.ts';
  import {
    joinWithNext,
    moveMainItem,
    setDuration,
    splitAtTime,
    trimClip,
  } from '../app/commands.ts';
  import { handleDrag } from '../app/timeline-edit.ts';
  import { formatTime } from '../core/model/time.ts';
  import {
    findMainItemAt,
    layoutMain,
    mainTrackDuration,
    type LaidOutItem,
  } from '../core/model/timeline.ts';
  import type { MainItem } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const SNAP_PX = 8;

  let pxPerSecond = $state(40);
  let draggingId: string | null = $state(null);
  let error: string | null = $state(null);

  const project = $derived($store.history.present);
  const layout = $derived(layoutMain(project.timeline.main));
  const canSplit = $derived(findMainItemAt(project.timeline.main, $store.playhead) !== null);
  const selectedIndex = $derived(project.timeline.main.findIndex((m) => m.id === $store.selection));
  const canJoin = $derived(selectedIndex >= 0 && selectedIndex < project.timeline.main.length - 1);

  function label(item: MainItem): string {
    if (item.type === 'title') return item.text || 'Title';
    const asset = project.media.find((m) => m.id === item.assetId);
    return asset ? fileNameOf(asset.path) : 'Missing file';
  }

  function seek(event: MouseEvent): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    app.setPlayhead((event.clientX - box.left) / pxPerSecond);
  }

  function zoom(factor: number): void {
    pxPerSecond = Math.min(320, Math.max(5, pxPerSecond * factor));
  }

  /** Drag a trim handle: on release, trim (videos) or change the duration (stills, titles). */
  function startTrim(event: MouseEvent, laid: LaidOutItem, side: 'start' | 'end'): void {
    event.stopPropagation();
    event.preventDefault();
    const startX = event.clientX;
    const others = layout
      .filter((l) => l.item.id !== laid.item.id)
      .flatMap((l) => [l.start, l.end]);
    const finish = (up: MouseEvent) => {
      window.removeEventListener('mouseup', finish);
      const { item } = laid;
      const asset =
        item.type === 'title' ? undefined : project.media.find((m) => m.id === item.assetId);
      const result = handleDrag(
        item,
        side,
        laid.start,
        (up.clientX - startX) / pxPerSecond,
        [$store.playhead, ...others],
        SNAP_PX / pxPerSecond,
        asset?.duration,
      );
      error = app.edit(
        'duration' in result ? setDuration(item.id, result.duration) : trimClip(item.id, result),
      );
    };
    window.addEventListener('mouseup', finish);
  }

  function drop(targetIndex: number): void {
    if (draggingId) error = app.edit(moveMainItem(draggingId, targetIndex));
    draggingId = null;
  }
</script>

<section class="timeline">
  <div class="bar">
    <span class="panel-h">Timeline</span>
    <button disabled={!canSplit} onclick={() => (error = app.edit(splitAtTime($store.playhead)))}
      >Split</button
    >
    <button disabled={!canJoin} onclick={() => (error = app.edit(joinWithNext($store.selection!)))}
      >Join</button
    >
    <button disabled={!$store.selection} onclick={() => app.removeSelected()}>Delete</button>
    {#if error}<span class="error" role="alert">{error}</span>{/if}
    <span class="spacer"></span>
    <span class="tc"
      >{formatTime($store.playhead)} / {formatTime(mainTrackDuration(project.timeline.main))}</span
    >
    <button aria-label="Zoom out" onclick={() => zoom(0.5)}>−</button>
    <button aria-label="Zoom in" onclick={() => zoom(2)}>+</button>
  </div>
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="ruler" style:background-size="{pxPerSecond}px 100%" onclick={seek}></div>
  <div class="track">
    {#if layout.length === 0}
      <p class="empty">Add clips from the media bin to build your video.</p>
    {/if}
    {#each layout as laid, index (laid.item.id)}
      {@const item = laid.item}
      <div
        class="clip {item.type}"
        role="button"
        tabindex="0"
        draggable="true"
        data-item={item.id}
        aria-label="{label(item)} {(laid.end - laid.start).toFixed(2)} s"
        aria-pressed={$store.selection === item.id}
        style:left="{laid.start * pxPerSecond}px"
        style:width="{(laid.end - laid.start) * pxPerSecond}px"
        onclick={() => app.select(item.id)}
        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && app.select(item.id)}
        ondragstart={(e) => {
          draggingId = item.id;
          e.dataTransfer?.setData('text/plain', item.id);
        }}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
          e.preventDefault();
          drop(index);
        }}
      >
        {#if item.type === 'video'}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="handle start"
            aria-label="Trim the start of {label(item)}"
            onmousedown={(e) => startTrim(e, laid, 'start')}
          ></span>
        {/if}
        <span class="name">{label(item)}</span>
        <span class="len">{(laid.end - laid.start).toFixed(2)} s</span>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="handle end"
          aria-label="Trim the end of {label(item)}"
          onmousedown={(e) => startTrim(e, laid, 'end')}
        ></span>
      </div>
    {/each}
    <div class="playhead" style:left="{$store.playhead * pxPerSecond}px"></div>
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
  .error {
    color: var(--danger);
    font-size: 12px;
  }
  .ruler {
    height: 20px;
    margin: 0 12px;
    background-image: linear-gradient(90deg, var(--line-strong) 0 1px, transparent 1px);
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
    justify-content: center;
    overflow: hidden;
    padding: 4px 10px;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    white-space: nowrap;
    cursor: grab;
    user-select: none;
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
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: ew-resize;
    background: rgba(255, 255, 255, 0.25);
  }
  .handle.start {
    left: 0;
  }
  .handle.end {
    right: 0;
  }
  .clip[aria-pressed='true'] .handle {
    background: rgba(255, 255, 255, 0.9);
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
