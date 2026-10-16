<script lang="ts">
  // Main track (V2, V3, V12): select, split, join, drag to reorder, trim handles with snapping, zoom.
  // Text track (V4, V5): titles go on the main track; captions, subtitles and credits on their own.
  // Track layout as in screen 01: headers on the left, ruler and lanes on the right.
  import type { App } from '../app/app.ts';
  import {
    joinWithNext,
    moveMainItem,
    moveTimedItem,
    setDuration,
    splitAtTime,
    trimClip,
  } from '../app/commands.ts';
  import { handleDrag, moveDrag } from '../app/timeline-edit.ts';
  import { formatTime } from '../core/model/time.ts';
  import {
    findMainItemAt,
    layoutMain,
    mainTrackDuration,
    type LaidOutItem,
  } from '../core/model/timeline.ts';
  import type { AudioItem, MainItem } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import Icon from './Icon.svelte';
  import { ui } from './ui-state.svelte.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const SNAP_PX = 8;
  const TEXT_KINDS = { caption: 'Caption', subtitle: 'Subtitle', credits: 'Credits' };

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

  /** Click or drag on the ruler to move the playhead. */
  function seek(event: MouseEvent): void {
    const ruler = event.currentTarget as HTMLElement;
    const at = (e: MouseEvent) =>
      app.setPlayhead(Math.max(0, (e.clientX - ruler.getBoundingClientRect().left) / pxPerSecond));
    at(event);
    const stop = () => {
      window.removeEventListener('mousemove', at);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', at);
    window.addEventListener('mouseup', stop);
  }

  const snapPx = $derived(ui.snap ? SNAP_PX : 0);
  const total = $derived(mainTrackDuration(project.timeline.main));
  /** The lanes are as wide as the video plus some room to add more. */
  const contentSeconds = $derived(
    Math.max(
      total,
      ...project.timeline.text.map((t) => t.start + t.duration),
      ...project.timeline.audio.flat().map((a) => a.start + a.out - a.in),
      $store.playhead,
    ) + 20,
  );
  /** Ruler labels every 1, 5, 10 or 30 s, so they never crowd. */
  const step = $derived([1, 2, 5, 10, 30, 60].find((s) => s * pxPerSecond >= 70) ?? 120);
  const labels = $derived(
    Array.from({ length: Math.floor(contentSeconds / step) + 1 }, (_, i) => i * step),
  );
  const mmss = (t: number) =>
    `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  /** The picture strip inside a clip: its thumbnail repeated, a still itself, or a title colour. */
  function strip(item: MainItem): { image?: string; colour?: string } {
    if (item.type === 'title') {
      return item.background.kind === 'colour' ? { colour: item.background.colour } : {};
    }
    const asset = project.media.find((m) => m.id === item.assetId);
    if (item.type === 'image') return asset ? { image: toMediaUrl(asset.path) } : {};
    const thumb = $store.assets[item.assetId]?.thumbPath;
    return thumb ? { image: toMediaUrl(thumb) } : {};
  }

  function soundName(item: AudioItem): string {
    const asset = project.media.find((m) => m.id === item.assetId);
    return asset ? fileNameOf(asset.path) : 'Missing file';
  }

  /** The waveform of the part of the sound that is used, mirrored around the middle (V13). */
  function waveform(item: AudioItem): { width: number; path: string } | null {
    const peaks = $store.assets[item.assetId]?.peaks;
    if (!peaks?.length) return null;
    const perSecond = 10; // the app stores 10 peaks per second
    const part = peaks.slice(Math.floor(item.in * perSecond), Math.ceil(item.out * perSecond));
    if (!part.length) return null;
    const top = part.map((p, i) => `${i},${(50 - p * 48).toFixed(1)}`);
    const bottom = part.map((p, i) => `${i},${(50 + p * 48).toFixed(1)}`).reverse();
    return { width: Math.max(1, part.length - 1), path: `M${top.join('L')}L${bottom.join('L')}Z` };
  }

  function showTransition(id: string): void {
    app.select(id);
    ui.inspectorTab = 'effects';
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
        snapPx / pxPerSecond,
        asset?.duration,
      );
      error = app.edit(
        'duration' in result ? setDuration(item.id, result.duration) : trimClip(item.id, result),
      );
    };
    window.addEventListener('mouseup', finish);
  }

  /** Live position of a caption being dragged along the text track. */
  let moving: { id: string; start: number } | null = $state(null);

  /** A caption, subtitle, credits, music or voiceover clip: where it starts and how long it lasts. */
  interface Timed {
    id: string;
    start: number;
    duration: number;
  }
  const timedAudio = (a: AudioItem): Timed => ({
    id: a.id,
    start: a.start,
    duration: a.out - a.in,
  });

  /** Drag a text or sound clip along its track (V5, V13); it snaps like the trim handles. */
  function startMove(event: MouseEvent, item: Timed): void {
    event.preventDefault();
    const startX = event.clientX;
    const targets = [
      $store.playhead,
      ...layout.flatMap((l) => [l.start, l.end]),
      ...[...project.timeline.text, ...project.timeline.audio.flat().map(timedAudio)]
        .filter((t) => t.id !== item.id)
        .flatMap((t) => [t.start, t.start + t.duration]),
    ];
    const at = (e: MouseEvent) =>
      moveDrag(
        item.start,
        item.duration,
        (e.clientX - startX) / pxPerSecond,
        targets,
        snapPx / pxPerSecond,
      );
    const move = (e: MouseEvent) => (moving = { id: item.id, start: at(e) });
    const finish = (e: MouseEvent) => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', finish);
      moving = null;
      // A click without moving only selects.
      if (Math.abs(e.clientX - startX) >= 3) error = app.edit(moveTimedItem(item.id, at(e)));
      app.select(item.id);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', finish);
  }

  function drop(targetIndex: number): void {
    if (draggingId) error = app.edit(moveMainItem(draggingId, targetIndex));
    draggingId = null;
  }
</script>

<section class="timeline">
  <div class="bar">
    <button
      class="sm"
      disabled={!canSplit}
      onclick={() => (error = app.edit(splitAtTime($store.playhead)))}
      ><Icon name="split" size={14} /> Split</button
    >
    <button
      class="sm"
      disabled={!canJoin}
      onclick={() => (error = app.edit(joinWithNext($store.selection!)))}
      ><Icon name="join" size={14} /> Join</button
    >
    <button
      class="sm"
      disabled={selectedIndex < 1}
      title="Choose how the selected clip takes over from the one before it"
      onclick={() => showTransition($store.selection!)}
      ><Icon name="transition" size={14} /> Transition</button
    >
    <button class="sm" disabled={!$store.selection} onclick={() => app.removeSelected()}
      ><Icon name="delete" size={14} /> Delete</button
    >
    <span class="vsep"></span>
    <button
      class="ghost sm snap"
      aria-pressed={ui.snap}
      title="Snap edges to the playhead and to other clips"
      onclick={() => (ui.snap = !ui.snap)}><Icon name="snap" size={14} /> Snap</button
    >
    {#if error}<span class="error" role="alert">{error}</span>{/if}
    <span class="spacer"></span>
    <span class="tc">{formatTime($store.playhead)} <small>/ {formatTime(total)}</small></span>
    <span class="vsep"></span>
    <button class="ghost sm icon-only" aria-label="Zoom out" onclick={() => zoom(0.5)}
      ><Icon name="zoomOut" size={14} /></button
    >
    <input
      class="zoom"
      type="range"
      aria-label="Timeline zoom"
      min="5"
      max="320"
      step="1"
      value={pxPerSecond}
      oninput={(e) => (pxPerSecond = Number(e.currentTarget.value))}
    />
    <button class="ghost sm icon-only" aria-label="Zoom in" onclick={() => zoom(2)}
      ><Icon name="zoomIn" size={14} /></button
    >
  </div>

  <div class="body">
    <div class="heads">
      <div class="corner">{pxPerSecond} px = 1 s</div>
      <div class="th video">
        <span class="dot"></span>
        <div>
          <div class="tn">Video</div>
          <div class="ts">Main track</div>
        </div>
      </div>
      <div class="th text">
        <span class="dot"></span>
        <div>
          <div class="tn">Text</div>
          <div class="ts">Captions · credits</div>
        </div>
      </div>
      <div class="th music">
        <span class="dot"></span>
        <div>
          <div class="tn">Music</div>
          <div class="ts">Audio 1</div>
        </div>
      </div>
      <div class="th voice">
        <span class="dot"></span>
        <div>
          <div class="tn">Voiceover</div>
          <div class="ts">Audio 2</div>
        </div>
      </div>
    </div>

    <div class="scroller">
      <div class="content" style:width="{contentSeconds * pxPerSecond}px">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="ruler" onmousedown={seek}>
          {#each labels as t (t)}
            <span style:left="{t * pxPerSecond}px">{mmss(t)}</span>
          {/each}
        </div>

        <div class="lane track video-lane">
          {#if layout.length === 0}
            <p class="empty">Add clips from the media bin to build your video.</p>
          {/if}
          {#each layout as laid, index (laid.item.id)}
            {@const item = laid.item}
            {@const look = strip(item)}
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
              <div class="cl">
                {#if item.type === 'title'}<Icon name="title" size={12} />{/if}
                <span class="name">{label(item)}</span>
                <span class="len"
                  >{(laid.end - laid.start).toFixed(2)} s{#if item.transitionIn}
                    <span class="badge" title="Transition into this clip"
                      >⇄ {item.transitionIn.duration.toFixed(1)} s</span
                    >{/if}{#if item.effects?.length || item.fade || item.panZoom}
                    <span class="badge" title="Effects">fx</span>{/if}</span
                >
              </div>
              <div
                class="strip"
                style:background-image={look.image ? `url("${look.image}")` : null}
                style:background-color={look.colour ?? null}
              ></div>
              {#if item.fade?.in}<span class="fade-in" style:width="{item.fade.in * pxPerSecond}px"
                ></span>{/if}
              {#if item.fade?.out}<span
                  class="fade-out"
                  style:width="{item.fade.out * pxPerSecond}px"
                ></span>{/if}
              {#if item.type === 'video' && item.speed !== 1}<span class="speed">{item.speed}×</span
                >{/if}
              {#if item.type === 'video'}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <span
                  class="handle start"
                  aria-label="Trim the start of {label(item)}"
                  onmousedown={(e) => startTrim(e, laid, 'start')}
                ></span>
              {/if}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="handle end"
                aria-label="Trim the end of {label(item)}"
                onmousedown={(e) => startTrim(e, laid, 'end')}
              ></span>
            </div>
          {/each}
          {#each layout as laid, index (laid.item.id)}
            {#if index > 0 && laid.item.transitionIn && laid.start < layout[index - 1]!.end}
              <!-- V9: the transition sits across the cut, as long as the clips overlap. -->
              <button
                class="xfade"
                aria-label="Change the {laid.item.transitionIn.duration.toFixed(1)} s transition"
                style:left="{laid.start * pxPerSecond}px"
                style:width="{Math.max(58, (layout[index - 1]!.end - laid.start) * pxPerSecond)}px"
                onclick={() => showTransition(laid.item.id)}
                ><Icon name="transition" size={12} />
                {laid.item.transitionIn.duration.toFixed(1)} s</button
              >
            {/if}
          {/each}
        </div>

        <div class="lane track text-track" aria-label="Text track">
          {#each project.timeline.text as item (item.id)}
            {@const name = `${TEXT_KINDS[item.kind]}: ${item.text.split('\n')[0]}`}
            <button
              class="clip text {item.kind}"
              aria-label="{name} {item.duration.toFixed(2)} s"
              aria-pressed={$store.selection === item.id}
              class:moving={moving?.id === item.id}
              style:left="{(moving?.id === item.id ? moving.start : item.start) * pxPerSecond}px"
              style:width="{item.duration * pxPerSecond}px"
              onmousedown={(e) => startMove(e, item)}
              onclick={() => app.select(item.id)}
            >
              <Icon name={item.kind === 'credits' ? 'credits' : 'caption'} size={12} />
              <span class="name">{name}</span>
            </button>
          {/each}
        </div>

        {#each [0, 1] as track (track)}
          <div
            class="lane track audio-lane"
            aria-label={track === 0 ? 'Music track' : 'Voiceover track'}
          >
            {#each project.timeline.audio[track]! as item (item.id)}
              {@const timed = timedAudio(item)}
              {@const name = soundName(item)}
              {@const wave = waveform(item)}
              <button
                class="clip sound {track === 0 ? 'music' : 'voice'}"
                aria-label="{name} {timed.duration.toFixed(2)} s"
                aria-pressed={$store.selection === item.id}
                class:moving={moving?.id === item.id}
                style:left="{(moving?.id === item.id ? moving.start : item.start) * pxPerSecond}px"
                style:width="{timed.duration * pxPerSecond}px"
                onmousedown={(e) => startMove(e, timed)}
                onclick={() => app.select(item.id)}
              >
                {#if wave}
                  <svg
                    class="wave"
                    viewBox="0 0 {wave.width} 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"><path d={wave.path} /></svg
                  >
                {/if}
                <span class="sl">
                  <Icon name={track === 0 ? 'music' : 'mic'} size={12} />
                  <span class="name">{name}</span>
                  <span class="len">starts {item.start.toFixed(2)} s</span>
                </span>
                {#if item.fadeIn}<span class="fade-in" style:width="{item.fadeIn * pxPerSecond}px"
                  ></span>{/if}
                {#if item.fadeOut}<span
                    class="fade-out"
                    style:width="{item.fadeOut * pxPerSecond}px"
                  ></span>{/if}
              </button>
            {/each}
          </div>
        {/each}

        <div class="playhead" style:left="{$store.playhead * pxPerSecond}px"></div>
      </div>
    </div>
  </div>
</section>

<style>
  .timeline {
    height: 300px;
    flex: none;
    display: flex;
    flex-direction: column;
    background: var(--bg-1);
    border-top: 1px solid var(--line);
  }
  .bar {
    height: 40px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
  }
  .snap[aria-pressed='true'] {
    color: var(--accent);
  }
  .tc {
    font: 600 13px var(--mono);
  }
  .tc small {
    color: var(--tx-3);
    font-weight: 400;
  }
  .zoom {
    width: 110px;
    accent-color: var(--accent);
  }
  .error {
    color: var(--danger);
    font-size: 12px;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .heads {
    width: 150px;
    flex: none;
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
  }
  .corner {
    height: 26px;
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 10px;
    color: var(--tx-3);
    font-size: 11px;
    border-bottom: 1px solid var(--line);
  }
  .th {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
  }
  .th.video,
  .video-lane {
    height: 76px;
  }
  .th.text,
  .text-track {
    height: 44px;
  }
  .th.music,
  .th.voice,
  .audio-lane {
    height: 46px;
  }
  .tn {
    font-weight: 600;
    font-size: 12px;
  }
  .ts {
    font-size: 10.5px;
    color: var(--tx-3);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex: none;
  }
  .th.video .dot {
    background: var(--c-video);
  }
  .th.text .dot {
    background: var(--c-text);
  }
  .th.music .dot {
    background: var(--c-music);
  }
  .th.voice .dot {
    background: var(--c-voice);
  }
  .scroller {
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }
  .content {
    position: relative;
    min-width: 100%;
  }
  .ruler {
    position: relative;
    height: 26px;
    border-bottom: 1px solid var(--line);
    cursor: pointer;
    background: repeating-linear-gradient(90deg, #2a2f39 0 1px, transparent 1px 10px) 0 18px / 100%
      8px no-repeat;
  }
  .ruler span {
    position: absolute;
    top: 0;
    bottom: 0;
    padding: 4px 0 0 4px;
    border-left: 1px solid var(--line-strong);
    font: 500 10.5px var(--mono);
    color: var(--tx-3);
    pointer-events: none;
  }
  .lane {
    position: relative;
    background: var(--bg-0);
    border-bottom: 1px solid var(--line);
  }
  .empty {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    margin: 0;
    color: var(--tx-3);
    font-size: 11.5px;
    white-space: nowrap;
  }
  .clip {
    position: absolute;
    top: 5px;
    bottom: 5px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
    border-radius: 5px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    color: #fff;
    font-size: 11px;
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
    border: 2px solid #fff;
    box-shadow: 0 0 0 2px var(--accent);
    z-index: 2;
  }
  .cl {
    height: 18px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    overflow: hidden;
    font-weight: 600;
    background: rgba(0, 0, 0, 0.28);
  }
  .cl .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .len {
    font: 500 10.5px var(--mono);
    opacity: 0.8;
  }
  .badge {
    margin-left: 4px;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.35);
  }
  .strip {
    flex: 1;
    background-repeat: repeat-x;
    background-size: auto 100%;
    opacity: 0.9;
  }
  .fade-in,
  .fade-out {
    position: absolute;
    top: 18px;
    bottom: 0;
    pointer-events: none;
  }
  .fade-in {
    left: 0;
    background: linear-gradient(to top right, rgba(0, 0, 0, 0.5) 50%, transparent 50.5%);
  }
  .fade-out {
    right: 0;
    background: linear-gradient(to top left, rgba(0, 0, 0, 0.5) 50%, transparent 50.5%);
  }
  .speed {
    position: absolute;
    right: 8px;
    bottom: 4px;
    padding: 0 4px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.45);
    font: 600 10px var(--mono);
  }
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 6px;
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
  .clip.text {
    top: 6px;
    bottom: 6px;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    background: var(--c-text);
    color: #241b00;
    font-weight: 600;
    cursor: grab;
  }
  .clip.text .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .clip.text.moving {
    cursor: grabbing;
    outline: 2px dashed #fff;
  }
  .clip.sound {
    top: 5px;
    bottom: 5px;
    flex-direction: row;
    align-items: flex-start;
    justify-content: flex-start;
    color: #06241a;
  }
  .clip.sound.music {
    background: color-mix(in srgb, var(--c-music) 35%, var(--bg-1));
  }
  .clip.sound.voice {
    background: color-mix(in srgb, var(--c-voice) 35%, var(--bg-1));
  }
  .clip.sound.moving {
    cursor: grabbing;
    outline: 2px dashed #fff;
  }
  .sl {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    font-weight: 600;
    color: #fff;
    overflow: hidden;
  }
  .sl .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wave {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
  .clip.sound.music .wave path {
    fill: var(--c-music);
  }
  .clip.sound.voice .wave path {
    fill: var(--c-voice);
  }
  .clip.sound .fade-in,
  .clip.sound .fade-out {
    top: 0;
  }
  .xfade {
    position: absolute;
    top: 30px;
    height: 24px;
    z-index: 3;
    padding: 0 6px;
    gap: 3px;
    border: 0;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.92);
    color: #1b2230;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--danger);
    pointer-events: none;
    z-index: 5;
  }
  .playhead::before {
    content: '';
    position: absolute;
    top: 0;
    left: -6px;
    border: 7px solid transparent;
    border-top: 9px solid var(--danger);
  }
</style>
