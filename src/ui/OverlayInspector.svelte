<script lang="ts">
  // A picture or video over the video (V20: a logo in a corner, picture-in-picture): when it
  // shows, its size and place (as text is placed), how see-through it is, its fades and, for a
  // video, its trim and its own sound.
  import type { App } from '../app/app.ts';
  import {
    moveOverlayItem,
    setOverlayDuration,
    setOverlayFades,
    setOverlayOpacity,
    setOverlayPlacement,
    setOverlaySound,
    showOverlayForWholeVideo,
    trimOverlay,
  } from '../app/overlay-commands.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import { overlayDuration } from '../core/model/overlay.ts';
  import { mainTrackDuration } from '../core/model/timeline.ts';
  import type { OverlayItem, TextPosition } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import Icon from './Icon.svelte';
  import NumberField from './NumberField.svelte';
  import PercentField from './PercentField.svelte';
  import TimeField from './TimeField.svelte';
  import Why from './Why.svelte';

  let { app, item }: { app: App; item: OverlayItem } = $props();
  const PLACES: [TextPosition, string][] = [
    ['top-left', 'Top left'],
    ['top', 'Top'],
    ['top-right', 'Top right'],
    ['left', 'Left'],
    ['centre', 'Centre'],
    ['right', 'Right'],
    ['bottom-left', 'Bottom left'],
    ['bottom', 'Bottom'],
    ['bottom-right', 'Bottom right'],
  ];
  const store = $derived(app.store);
  const project = $derived($store.history.present);
  const asset = $derived(project.media.find((m) => m.id === item.assetId));
  const length = $derived(overlayDuration(item));
  const videoEnd = $derived(mainTrackDuration(project.timeline.main));
  /** The picture itself, or a video's thumbnail. */
  const thumb = $derived.by(() => {
    const path = item.type === 'image' ? asset?.path : $store.assets[item.assetId]?.thumbPath;
    return path ? toMediaUrl(path) : null;
  });
  let actionError: string | null = $state(null);
</script>

<div class="head">
  <div class="thumb" style:background-image={thumb ? `url("${thumb}")` : null}>
    {#if !thumb}<Icon name="pip" />{/if}
  </div>
  <div class="who">
    <div class="title">{asset ? fileNameOf(asset.path) : 'Missing file'}</div>
    <div class="kind">
      {item.type === 'image' ? 'Picture over the video' : 'Video over the video'} ·
      <span class="len">{length.toFixed(2)} s</span>
    </div>
  </div>
</div>

<section>
  <h3>Timing <span class="syl">11.1</span></h3>
  <TimeField
    label="Starts at"
    value={item.start}
    commit={(t) => app.edit(moveOverlayItem(item.id, t))}
  />
  <div class="row">
    <button onclick={() => (actionError = app.edit(moveOverlayItem(item.id, $store.playhead)))}
      >Start at the playhead</button
    >
  </div>
  {#if item.type === 'image'}
    <TimeField
      label="Duration"
      value={item.duration}
      commit={(t) => app.edit(setOverlayDuration(item.id, t))}
    />
    <div class="row">
      <button onclick={() => (actionError = app.edit(showOverlayForWholeVideo(item.id)))}
        >Show for the whole video</button
      >
    </div>
  {:else}
    <TimeField
      label="Start point"
      value={item.in}
      commit={(t) => app.edit(trimOverlay(item.id, { in: t, out: item.out }))}
    />
    <TimeField
      label="End point"
      value={item.out}
      commit={(t) => app.edit(trimOverlay(item.id, { in: item.in, out: t }))}
    />
  {/if}
  {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
  <p class="hint">
    {#if item.start >= videoEnd}
      Starts after the video ends ({videoEnd.toFixed(2)} s), so it will not be seen.
    {:else}
      Shows {item.start.toFixed(2)} – {Math.min(item.start + length, videoEnd).toFixed(2)} s{item.start +
        length >
      videoEnd + 1e-9
        ? ', ending with the video'
        : ''}.
    {/if}
  </p>
</section>

<section>
  <h3>Size &amp; place <span class="syl">11.1</span></h3>
  <NumberField
    label="Width"
    value={item.widthPercent}
    unit="%"
    example="25"
    commit={(n) => app.edit(setOverlayPlacement(item.id, { widthPercent: n }))}
  />
  <div class="place">
    <span class="sub" id="over-place-{item.id}">Place on the screen</span>
    <!-- A small screen: click where the picture goes (the nine places, as for text). -->
    <div class="screen" role="group" aria-labelledby="over-place-{item.id}">
      {#each PLACES as [position, name] (position)}
        <button
          aria-label={name}
          title={name}
          aria-pressed={item.position === position}
          class="spot {position}"
          onclick={() => (actionError = app.edit(setOverlayPlacement(item.id, { position })))}
          ><i aria-hidden="true"></i></button
        >
      {/each}
    </div>
  </div>
  <NumberField
    label="Margin"
    value={item.margin}
    unit="px"
    example="20"
    commit={(n) => app.edit(setOverlayPlacement(item.id, { margin: n }))}
  />
  <p class="hint">It keeps its shape. The margin is the gap to the edges it is placed against.</p>
</section>

<section>
  <h3>Opacity &amp; fades <span class="syl">11.1</span></h3>
  <PercentField
    label="Opacity"
    value={item.opacity}
    commit={(v) => app.edit(setOverlayOpacity(item.id, v))}
  />
  <TimeField
    label="Fade in"
    value={item.fadeIn ?? 0}
    commit={(t) => app.edit(setOverlayFades(item.id, { in: t, out: item.fadeOut ?? 0 }))}
  />
  <TimeField
    label="Fade out"
    value={item.fadeOut ?? 0}
    commit={(t) => app.edit(setOverlayFades(item.id, { in: item.fadeIn ?? 0, out: t }))}
  />
  <p class="hint">100 % is solid; a lower opacity lets the video show through (a watermark).</p>
</section>

{#if item.type === 'video'}
  <section>
    <h3>Its sound <span class="syl">11.1</span></h3>
    <label class="check">
      <input
        type="checkbox"
        checked={!item.muted}
        onchange={(e) =>
          (actionError = app.edit(setOverlaySound(item.id, { muted: !e.currentTarget.checked })))}
      />
      Play its sound
    </label>
    {#if !item.muted}
      <PercentField
        label="Volume"
        value={item.volume}
        commit={(v) => app.edit(setOverlaySound(item.id, { volume: v }))}
      />
    {/if}
    <p class="hint">Off at first, so it does not talk over the main video.</p>
  </section>
{/if}

<section>
  <Why tool="overlay" />
</section>

<style>
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  .thumb {
    width: 54px;
    height: 32px;
    flex: none;
    border-radius: 4px;
    border: 1px solid var(--line);
    background: var(--bg-3) center / cover no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
  }
  .who {
    min-width: 0;
  }
  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--tx-3);
    font-size: 12px;
  }
  section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    font-size: 12.5px;
    margin: 0 0 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .row {
    display: flex;
    gap: 4px;
    margin: -2px 0 10px 104px;
  }
  .row button {
    padding: 4px 8px;
    font-size: 12px;
  }
  .place {
    display: grid;
    grid-template-columns: 96px 1fr;
    align-items: center;
    gap: 8px;
    margin: 4px 0 8px;
  }
  .sub {
    color: var(--tx-2);
    font-size: 12px;
  }
  /* The screen: the frame's shape, split into thirds; the chosen spot shows a small picture. */
  .screen {
    width: 120px;
    aspect-ratio: 16 / 9;
    display: grid;
    grid-template: repeat(3, 1fr) / repeat(3, 1fr);
    padding: 3px;
    gap: 2px;
    box-sizing: border-box;
    background: var(--bg-0);
    border: 1px solid var(--line-strong);
    border-radius: 6px;
  }
  .spot {
    height: auto;
    min-width: 0;
    padding: 2px;
    display: flex;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 3px;
    color: var(--tx-3);
  }
  .spot:hover {
    background: var(--bg-3);
  }
  .spot i {
    width: 12px;
    height: 8px;
    border-radius: 1px;
    background: currentColor;
    opacity: 0.35;
  }
  .spot[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .spot[aria-pressed='true'] i {
    opacity: 1;
  }
  .spot.top-left,
  .spot.left,
  .spot.bottom-left {
    justify-content: flex-start;
  }
  .spot.top,
  .spot.centre,
  .spot.bottom {
    justify-content: center;
  }
  .spot.top-right,
  .spot.right,
  .spot.bottom-right {
    justify-content: flex-end;
  }
  .spot.top-left,
  .spot.top,
  .spot.top-right {
    align-items: flex-start;
  }
  .spot.left,
  .spot.centre,
  .spot.right {
    align-items: center;
  }
  .spot.bottom-left,
  .spot.bottom,
  .spot.bottom-right {
    align-items: flex-end;
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 6px 0 0;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 6px;
  }
  .error {
    margin: 0 0 8px;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
