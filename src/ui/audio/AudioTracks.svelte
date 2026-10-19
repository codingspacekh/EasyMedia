<script lang="ts">
  // Audio mode tracks (screens 13, 14; A1, A2, A5): a header per track (mute, solo, gain, pan),
  // a ruler, and each track's clips with their waveforms. Clips work as on the video timeline:
  // click to select, drag to move, drag an edge to trim, Split / Join / Delete on the bar. The
  // Selection tool drags across the sound to select part of it. Only the visible part of each
  // waveform is drawn, so long sounds stay fast at any zoom.
  import type { App } from '../../app/app.ts';
  import { moveDrag, snap } from '../../app/timeline-edit.ts';
  import { docDuration } from '../../core/audio/edit.ts';
  import { waveColumns } from '../../core/audio/peaks.ts';
  import { clipEnd, clipLength, type AudioClip, type AudioTrack } from '../../core/audio/pcm.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import { formatTime } from '../../core/model/time.ts';
  import { hz } from '../../core/render/audio-formats.ts';
  import Icon from '../Icon.svelte';
  import { ui } from '../ui-state.svelte.ts';
  import { audioUi, MAX_ZOOM, MIN_ZOOM } from './audio-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const doc = $derived($store.history.present);
  const sel = $derived($store.selection);
  const pps = $derived(audioUi.pxPerSecond);

  const HEADER = 190;
  const LABEL = 18;
  const SNAP_PX = 8;
  /** A press that moves less than this is a click, not a drag. */
  const CLICK_PX = 3;
  const heightOf = (t: AudioTrack) => (t.channelCount === 2 ? 136 : 128);

  let scroller: HTMLDivElement | undefined = $state();
  let scrollLeft = $state(0);
  let viewWidth = $state(800);
  /** The playhead while playing (read from the speakers' clock every frame). */
  let live = $state(0);
  /** A clip being dragged or trimmed: where it is shown until the change is made. */
  let preview: { id: string; offset: number; in: number; out: number } | null = $state(null);

  const trackIds = $derived(doc.tracks.map((t) => t.id));
  const duration = $derived(docDuration(doc));
  const contentWidth = $derived(
    Math.ceil(Math.max(duration, sel.end, $store.position) * pps + viewWidth * 0.5),
  );
  const playhead = $derived($store.playing ? live : $store.position);
  const from = $derived(scrollLeft / pps);
  const selectedClip = $derived(
    $store.clip ? doc.tracks.flatMap((t) => t.clips).find((c) => c.id === $store.clip) : undefined,
  );
  /** Split is possible: a selected part, or a clip under the playhead on the tracks it uses. */
  const canSplit = $derived.by(() => {
    if (!selectedClip && sel.end > sel.start) return true;
    const tracks = selectedClip
      ? doc.tracks.filter((t) => t.clips.includes(selectedClip))
      : sel.tracks.length
        ? doc.tracks.filter((t) => sel.tracks.includes(t.id))
        : doc.tracks;
    const at = $store.position;
    return tracks.some((t) =>
      t.clips.some(
        (c) => at > c.offset + 0.5 / doc.rate && at < clipEnd(c, doc.rate) - 0.5 / doc.rate,
      ),
    );
  });
  const canJoin = $derived(
    selectedClip !== undefined &&
      doc.tracks.some((t) =>
        t.clips.some(
          (c) =>
            c !== selectedClip &&
            Math.abs(c.offset - clipEnd(selectedClip, doc.rate)) < 0.5 / doc.rate,
        ),
      ),
  );

  $effect(() => {
    if (!scroller || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (scroller) viewWidth = Math.max(100, scroller.clientWidth - HEADER);
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  });

  // The first sound fills the view.
  let hadTracks = false;
  $effect(() => {
    const has = doc.tracks.length > 0;
    if (has && !hadTracks && duration > 0) fit();
    hadTracks = has;
  });

  $effect(() => {
    if (!$store.playing || typeof requestAnimationFrame !== 'function') return;
    let frame = 0;
    const tick = () => {
      live = audio.currentPosition();
      // Keep the playhead in view.
      const x = live * pps;
      if (scroller && (x < scrollLeft || x > scrollLeft + viewWidth - 20))
        scroller.scrollLeft = Math.max(0, x - 40);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  });

  function zoom(to: number): void {
    const keep = from;
    audioUi.pxPerSecond = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, to));
    if (scroller) scroller.scrollLeft = keep * audioUi.pxPerSecond;
  }

  function fit(): void {
    if (duration > 0) zoom(Math.round(((viewWidth - 20) / duration) * 100) / 100);
    if (scroller) scroller.scrollLeft = 0;
  }

  /** Ruler labels never closer than 70 px. */
  const step = $derived(
    [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find(
      (s) => s * pps >= 70,
    ) ?? 1200,
  );
  const ticks = $derived.by(() => {
    const first = Math.floor(from / step);
    const last = Math.ceil((from + viewWidth / pps) / step);
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => (first + i) * step);
  });
  const tickLabel = (t: number) =>
    step < 1
      ? formatTime(t)
      : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

  const describe = (t: AudioTrack) =>
    `${t.channelCount === 2 ? 'Stereo' : 'Mono'} · ${hz(doc.rate)}${t.bits ? ` · ${t.bits}-bit` : ''}`;

  /** A clip as it is shown: moved or trimmed while it is being dragged. */
  const shown = (c: AudioClip): AudioClip =>
    preview?.id === c.id ? { ...c, offset: preview.offset, in: preview.in, out: preview.out } : c;
  const seconds = (c: AudioClip) => clipLength(c) / doc.rate;

  /**
   * Draws the visible part of a track's clips. Takes the id, not the track: a drawing effect
   * holding a track would keep its old samples in memory after every edit (N4).
   */
  function drawWave(canvas: HTMLCanvasElement, id: string): void {
    const t = doc.tracks.find((x) => x.id === id);
    const ctx = canvas.getContext('2d');
    if (!t || !ctx) return;
    const width = Math.max(1, Math.floor(viewWidth));
    const height = heightOf(t);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const area = (height - LABEL - 4) / t.channelCount;
    for (const original of t.clips) {
      const clip = shown(original);
      const x0 = (clip.offset - from) * pps;
      const x1 = x0 + seconds(clip) * pps;
      if (x1 < 0 || x0 > width) continue;
      const left = Math.max(0, x0);
      const right = Math.min(width, x1);
      ctx.fillStyle = clip.id === $store.clip ? '#1d3a2d' : '#14261e';
      ctx.fillRect(left, 2, right - left, height - 4);
      clip.source.forEach((source, c) => {
        const mid = LABEL + area * (c + 0.5);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(left, Math.round(mid), right - left, 1);
        const { min, max } = waveColumns(source.subarray(clip.in, clip.out), {
          rate: doc.rate,
          offset: clip.offset,
          from,
          pxPerSecond: pps,
          width,
        });
        ctx.fillStyle = '#33a874';
        for (let x = Math.floor(left); x < right; x++) {
          if (Number.isNaN(max[x]!)) continue;
          const top = mid - (Math.min(1, max[x]!) * area) / 2;
          const bottom = mid - (Math.max(-1, min[x]!) * area) / 2;
          ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
        }
      });
    }
  }

  // ---- mouse: clips (move, trim, select) or a selected part ----
  let drag:
    | { kind: 'select'; anchor: number }
    | {
        kind: 'move' | 'start' | 'end';
        clip: AudioClip;
        x: number;
        /** Times a dragged edge snaps to: the playhead and the edges of every other clip. */
        targets: number[];
      }
    | null = null;

  const timeAt = (e: PointerEvent, el: HTMLElement) =>
    Math.max(0, (e.clientX - el.getBoundingClientRect().left) / pps);
  const tolerance = () => (ui.snap ? SNAP_PX / pps : 0);

  function down(e: PointerEvent, t: AudioTrack): void {
    const lane = e.currentTarget as HTMLElement;
    lane.setPointerCapture?.(e.pointerId);
    const time = timeAt(e, lane);
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-clip]');
    const clip = target && t.clips.find((c) => c.id === target.dataset.clip);
    if (clip && audioUi.tool === 'clip') {
      const handle = (e.target as HTMLElement).closest<HTMLElement>('[data-edge]');
      drag = {
        kind: (handle?.dataset.edge as 'start' | 'end' | undefined) ?? 'move',
        clip,
        x: e.clientX,
        targets: [
          $store.position,
          ...doc.tracks
            .flatMap((x) => x.clips)
            .filter((c) => c.id !== clip.id)
            .flatMap((c) => [c.offset, clipEnd(c, doc.rate)]),
        ],
      };
      return;
    }
    drag = { kind: 'select', anchor: time };
    audio.selectTrack(t.id, e.shiftKey);
    audio.select({ start: time, end: time });
    audio.setPosition(time);
  }

  function move(e: PointerEvent): void {
    if (!drag) return;
    if (drag.kind === 'select') {
      audio.select({ start: drag.anchor, end: timeAt(e, e.currentTarget as HTMLElement) });
      return;
    }
    if (Math.abs(e.clientX - drag.x) < CLICK_PX && !preview) return;
    const { clip } = drag;
    const delta = (e.clientX - drag.x) / pps;
    if (drag.kind === 'move') {
      const offset = moveDrag(clip.offset, seconds(clip), delta, drag.targets, tolerance());
      preview = { id: clip.id, offset, in: clip.in, out: clip.out };
      return;
    }
    // Trimming: the edge follows the mouse, within the clip's own samples, keeping 1 sample.
    const rate = doc.rate;
    if (drag.kind === 'start') {
      const at = snap(clip.offset + delta, drag.targets, tolerance());
      const into = Math.round((at - clip.offset) * rate);
      const first = Math.max(-clip.in, Math.min(clipLength(clip) - 1, into));
      preview = {
        id: clip.id,
        offset: clip.offset + first / rate,
        in: clip.in + first,
        out: clip.out,
      };
    } else {
      const at = snap(clipEnd(clip, rate) + delta, drag.targets, tolerance());
      const out = clip.in + Math.round((at - clip.offset) * rate);
      preview = {
        id: clip.id,
        offset: clip.offset,
        in: clip.in,
        out: Math.max(clip.in + 1, Math.min(clip.source[0]!.length, out)),
      };
    }
  }

  function up(e: PointerEvent): void {
    const done = drag;
    const moved = preview;
    drag = null;
    preview = null;
    if (!done || done.kind === 'select') return;
    const { clip } = done;
    if (!moved) {
      // A click: select the clip and put the playhead there (Split then splits there).
      audio.selectClip(clip.id);
      audio.setPosition(timeAt(e, e.currentTarget as HTMLElement));
      return;
    }
    if (done.kind === 'move') audio.moveClip(clip.id, moved.offset);
    else if (done.kind === 'start') audio.trimClip(clip.id, 'start', moved.offset);
    else audio.trimClip(clip.id, 'end', moved.offset + (moved.out - moved.in) / doc.rate);
  }

  function seek(e: PointerEvent): void {
    const ruler = e.currentTarget as HTMLElement;
    audio.setPosition(timeAt(e, ruler));
    ruler.setPointerCapture?.(e.pointerId);
  }
</script>

<section class="a-tracks" aria-label="Tracks">
  <div class="bar" role="toolbar" aria-label="Clips">
    <button
      class="sm"
      disabled={!canSplit}
      title={withWhy(
        'Split the clip at the playhead (or a selected part into its own clip)',
        'splitAudio',
      )}
      onclick={() => audio.split()}><Icon name="split" size={14} /> Split</button
    >
    <button
      class="sm"
      disabled={!canJoin}
      title={withWhy('Join the selected clip with the clip right after it', 'splitAudio')}
      onclick={() => audio.join()}><Icon name="join" size={14} /> Join</button
    >
    <button
      class="sm"
      disabled={!$store.clip}
      title={withWhy('Delete the selected clip (Delete key)', 'deleteClip')}
      onclick={() => audio.deleteClip()}><Icon name="delete" size={14} /> Delete</button
    >
    <span class="vsep"></span>
    <button
      class="ghost sm snap"
      aria-pressed={ui.snap}
      title="Snap: a dragged clip or edge jumps to the playhead and to the edges of other clips"
      onclick={() => (ui.snap = !ui.snap)}><Icon name="snap" size={14} /> Snap</button
    >
    <span class="hint">
      {#if audioUi.tool === 'clip'}
        Click a clip to select it · drag it to move it · drag its edges to trim it
      {:else}
        Drag across the sound to select part of it
      {/if}
    </span>
  </div>
  <div
    class="scroller"
    bind:this={scroller}
    onscroll={() => (scrollLeft = scroller?.scrollLeft ?? 0)}
  >
    <div class="content" style:width="{HEADER + contentWidth}px">
      <div class="ruler">
        <div class="corner">
          <span>{Math.round(pps * 100) / 100} px = 1 s</span>
          <span class="zoom">
            <button
              class="ghost sm icon-only"
              aria-label="Zoom out"
              title="Zoom out"
              onclick={() => zoom(pps / 2)}><Icon name="zoomOut" size={14} /></button
            >
            <button
              class="ghost sm icon-only"
              aria-label="Zoom in"
              title="Zoom in"
              onclick={() => zoom(pps * 2)}><Icon name="zoomIn" size={14} /></button
            >
            <button
              class="ghost sm icon-only"
              aria-label="Fit to window"
              title="Fit all the sound in the window"
              onclick={fit}><Icon name="fit" size={14} /></button
            >
          </span>
        </div>
        <div
          class="scale"
          role="slider"
          tabindex="0"
          aria-label="Audio position on the ruler"
          aria-valuemin={0}
          aria-valuemax={Math.max(duration, $store.position)}
          aria-valuenow={$store.position}
          aria-valuetext={formatTime($store.position)}
          style:width="{contentWidth}px"
          onpointerdown={seek}
          onpointermove={(e) => e.buttons === 1 && audio.setPosition(timeAt(e, e.currentTarget))}
          onkeydown={(e) => {
            if (e.key === 'ArrowLeft') audio.setPosition($store.position - 1);
            if (e.key === 'ArrowRight') audio.setPosition($store.position + 1);
          }}
        >
          {#each ticks as t (t)}
            <span style:left="{t * pps}px">{tickLabel(t)}</span>
          {/each}
        </div>
      </div>

      <!-- By id: blocks holding track objects would keep old samples in memory (N4). -->
      {#each trackIds as id (id)}
        {@const t = doc.tracks.find((x) => x.id === id)!}
        {@const selected = sel.tracks.includes(t.id)}
        <div class="row" style:height="{heightOf(t)}px">
          <div class="a-th" class:selected role="group" aria-label="Track {t.name}">
            <div class="tn">
              <span class="dot"></span>
              <button class="name" onclick={(e) => audio.selectTrack(t.id, e.shiftKey)}
                >{t.name}</button
              >
              <button
                class="ghost sm icon-only"
                aria-label="Remove track {t.name}"
                title="Remove track"
                onclick={() => {
                  audio.selectTrack(t.id);
                  audio.removeTracks();
                }}><Icon name="delete" size={12} /></button
              >
            </div>
            <div class="ts">{describe(t)}</div>
            <div class="mini">
              <button
                class="sm"
                aria-label="Mute {t.name}"
                aria-pressed={$store.muted.includes(t.id)}
                onclick={() => audio.toggleMute(t.id)}>Mute</button
              >
              <button
                class="sm"
                aria-label="Solo {t.name}"
                aria-pressed={$store.solo.includes(t.id)}
                onclick={() => audio.toggleSolo(t.id)}>Solo</button
              >
            </div>
            <label class="slider">
              <span>Gain</span>
              <input
                type="range"
                min="-36"
                max="36"
                step="0.5"
                value={t.gain}
                aria-label="Gain of {t.name}"
                title="{t.gain} dB"
                onchange={(e) => audio.setTrack(t.id, { gain: Number(e.currentTarget.value) })}
              />
            </label>
            <label class="slider">
              <span>L</span>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={t.pan}
                aria-label="Pan of {t.name}"
                onchange={(e) => audio.setTrack(t.id, { pan: Number(e.currentTarget.value) })}
              />
              <span>R</span>
            </label>
          </div>
          <div
            class="a-lane"
            class:clip-tool={audioUi.tool === 'clip'}
            role="region"
            aria-label="Waveform of {t.name}"
            style:width="{contentWidth}px"
            onpointerdown={(e) => down(e, t)}
            onpointermove={move}
            onpointerup={up}
            onpointercancel={up}
          >
            <canvas
              style:width="{viewWidth}px"
              style:height="{heightOf(t)}px"
              {@attach (canvas) => drawWave(canvas, t.id)}
            ></canvas>
            {#each t.clips as original (original.id)}
              {@const clip = shown(original)}
              <div
                class="clip"
                class:selected={$store.clip === clip.id}
                class:dragging={preview?.id === clip.id}
                data-clip={clip.id}
                role="button"
                tabindex="0"
                aria-label="Clip of {t.name}, {formatTime(clip.offset)} to {formatTime(
                  clipEnd(clip, doc.rate),
                )}"
                aria-pressed={$store.clip === clip.id}
                style:left="{clip.offset * pps}px"
                style:width="{Math.max(2, seconds(clip) * pps)}px"
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    audio.selectClip(clip.id);
                  }
                }}
              >
                <div class="cl">
                  <Icon name="music" size={11} />
                  <span class="name">{t.name}</span>
                  <span class="len">{seconds(clip).toFixed(2)} s</span>
                </div>
                <span
                  class="handle start"
                  data-edge="start"
                  title="Drag to trim the start of the clip"
                  aria-hidden="true"
                ></span>
                <span
                  class="handle end"
                  data-edge="end"
                  title="Drag to trim the end of the clip"
                  aria-hidden="true"
                ></span>
              </div>
            {/each}
            {#if t.clips.length === 0}
              <span class="empty">Empty track: paste or record sound here</span>
            {/if}
            {#if selected && !$store.clip}
              <div
                class="selection"
                style:left="{sel.start * pps}px"
                style:width="{Math.max(1, (sel.end - sel.start) * pps)}px"
              ></div>
            {/if}
            <div class="playhead" style:left="{playhead * pps}px"></div>
          </div>
        </div>
      {/each}
      {#if doc.tracks.length === 0}
        <div class="start">
          <Icon name="audio" size={36} />
          <h2>Import a sound to start</h2>
          <button class="primary" onclick={() => audio.importAudio()}
            ><Icon name="import" size={16} /> Import audio…</button
          >
          <p>
            You can also use <b>Tracks ▸ Import audio as new track</b>, or press the red
            <b>Record</b> button to record a voiceover.
          </p>
          <p class="formats">MP3, WAV, M4A, AAC, FLAC, OGG, or the sound of a video file</p>
        </div>
      {/if}
    </div>
  </div>
</section>

<style>
  .a-tracks {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-0);
  }
  .bar {
    height: 40px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .snap[aria-pressed='true'] {
    color: var(--accent);
  }
  .hint {
    margin-left: 8px;
    color: var(--tx-3);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scroller {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }
  .content {
    min-width: 100%;
  }
  .ruler {
    position: sticky;
    top: 0;
    z-index: 6;
    height: 28px;
    display: flex;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
  }
  .corner {
    position: sticky;
    left: 0;
    z-index: 7;
    width: 190px;
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px 0 10px;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
    color: var(--tx-3);
    font-size: 11px;
  }
  .zoom {
    display: flex;
  }
  .scale {
    position: relative;
    cursor: pointer;
  }
  .scale span {
    position: absolute;
    top: 6px;
    font: 500 10.5px var(--mono);
    color: var(--tx-3);
    border-left: 1px solid var(--line-strong);
    padding-left: 4px;
    white-space: nowrap;
  }
  .row {
    display: flex;
    border-bottom: 1px solid var(--line);
  }
  .a-th {
    position: sticky;
    left: 0;
    z-index: 4;
    width: 190px;
    flex: none;
    padding: 8px 10px;
    background: var(--bg-2);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow: hidden;
  }
  .a-th.selected {
    background: #232a37;
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .tn {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--c-music);
    flex: none;
  }
  .name {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    padding: 0;
    border: 0;
    background: transparent;
    font-weight: 600;
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ts {
    font-size: 11px;
    color: var(--tx-3);
  }
  .mini {
    display: flex;
    gap: 4px;
  }
  .mini button {
    height: 20px;
    padding: 0 7px;
    font-size: 10.5px;
    font-weight: 600;
    color: var(--tx-2);
  }
  .mini button[aria-pressed='true'] {
    background: var(--warn);
    color: #1b1300;
    border-color: var(--warn);
  }
  .slider {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10.5px;
    color: var(--tx-3);
  }
  .slider input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
  }
  .a-lane {
    position: relative;
    flex: none;
    cursor: text;
    /* clip, not hidden: hidden would make the lane the sticky canvas's scroll box */
    overflow: clip;
  }
  .clip {
    position: absolute;
    top: 2px;
    bottom: 2px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 4px;
  }
  .a-lane.clip-tool .clip {
    cursor: grab;
  }
  .a-lane.clip-tool .clip.dragging {
    cursor: grabbing;
  }
  .a-lane:not(.clip-tool) .clip {
    pointer-events: none;
  }
  .clip.selected {
    border: 2px solid var(--accent);
  }
  .clip:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 7px;
    cursor: ew-resize;
  }
  .handle.start {
    left: -1px;
    border-radius: 4px 0 0 4px;
  }
  .handle.end {
    right: -1px;
    border-radius: 0 4px 4px 0;
  }
  .clip:hover .handle,
  .clip.selected .handle {
    background: rgba(255, 255, 255, 0.28);
  }
  canvas {
    position: sticky;
    left: 190px;
    display: block;
  }
  .cl {
    height: 16px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 7px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    white-space: nowrap;
    overflow: hidden;
    pointer-events: none;
  }
  .cl .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cl .len {
    color: rgba(255, 255, 255, 0.6);
    font-weight: 500;
  }
  .empty {
    position: absolute;
    left: 12px;
    top: 40%;
    color: var(--tx-3);
    font-size: 12px;
    pointer-events: none;
  }
  .selection {
    position: absolute;
    top: 0;
    bottom: 0;
    background: rgba(160, 190, 255, 0.22);
    border-left: 1px solid rgba(190, 210, 255, 0.8);
    border-right: 1px solid rgba(190, 210, 255, 0.8);
    pointer-events: none;
  }
  .playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--danger);
    pointer-events: none;
  }
  .start {
    position: sticky;
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    max-width: 440px;
    margin: 64px auto;
    padding: 28px 32px;
    border: 1px dashed var(--line);
    border-radius: 12px;
    background: var(--bg-1);
    color: var(--tx-3);
    text-align: center;
    line-height: 1.5;
  }
  .start h2 {
    margin: 0;
    color: var(--tx-1);
    font-size: 17px;
    font-weight: 600;
  }
  .start p {
    margin: 0;
    font-size: 13px;
  }
  .start b {
    color: var(--tx-2);
  }
  .start .formats {
    font-size: 12px;
  }
</style>
