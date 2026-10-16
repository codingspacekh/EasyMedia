<script lang="ts">
  // Audio mode tracks (screens 13, 14; A1, A2, A5): a header per track (mute, solo, gain, pan),
  // a ruler, and the waveform of each track. Only the visible part of each waveform is drawn,
  // so long sounds stay fast at any zoom. Drag to select, or move a track with the time shift tool.
  import type { App } from '../../app/app.ts';
  import { docDuration } from '../../core/audio/edit.ts';
  import { waveColumns } from '../../core/audio/peaks.ts';
  import { trackDuration, type AudioTrack } from '../../core/audio/pcm.ts';
  import { formatTime } from '../../core/model/time.ts';
  import { hz } from '../../core/render/audio-formats.ts';
  import Icon from '../Icon.svelte';
  import { audioUi, MAX_ZOOM, MIN_ZOOM } from './audio-ui.svelte.ts';

  let { app }: { app: App } = $props();
  const audio = $derived(app.audio);
  const store = $derived(app.audio.store);
  const doc = $derived($store.history.present);
  const sel = $derived($store.selection);
  const pps = $derived(audioUi.pxPerSecond);

  const HEADER = 190;
  const LABEL = 18;
  const heightOf = (t: AudioTrack) => (t.channels.length === 2 ? 136 : 128);

  let scroller: HTMLDivElement | undefined = $state();
  let scrollLeft = $state(0);
  let viewWidth = $state(800);
  /** The playhead while playing (read from the speakers' clock every frame). */
  let live = $state(0);
  /** A track being dragged with the time shift tool, before the move is committed. */
  let shifted: { id: string; offset: number } | null = $state(null);

  const trackIds = $derived(doc.tracks.map((t) => t.id));
  const duration = $derived(docDuration(doc));
  const contentWidth = $derived(
    Math.ceil(Math.max(duration, sel.end, $store.position) * pps + viewWidth * 0.5),
  );
  const playhead = $derived($store.playing ? live : $store.position);
  const from = $derived(scrollLeft / pps);

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
    `${t.channels.length === 2 ? 'Stereo' : 'Mono'} · ${hz(doc.rate)}${t.bits ? ` · ${t.bits}-bit` : ''}`;

  const offsetOf = (t: AudioTrack) => (shifted?.id === t.id ? shifted.offset : t.offset);

  /**
   * Draws the visible part of a track's waveform. Takes the id, not the track: a drawing
   * effect holding a track would keep its old samples in memory after every edit (N4).
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
    const offset = offsetOf(t);
    const x0 = (offset - from) * pps;
    const x1 = x0 + trackDuration(t, doc.rate) * pps;
    if (x1 < 0 || x0 > width) return;
    ctx.fillStyle = '#14261e';
    ctx.fillRect(Math.max(0, x0), 2, Math.min(width, x1) - Math.max(0, x0), height - 4);
    const area = (height - LABEL - 4) / t.channels.length;
    t.channels.forEach((channel, c) => {
      const mid = LABEL + area * (c + 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(Math.max(0, x0), Math.round(mid), Math.min(width, x1) - Math.max(0, x0), 1);
      const { min, max } = waveColumns(channel, {
        rate: doc.rate,
        offset,
        from,
        pxPerSecond: pps,
        width,
      });
      ctx.fillStyle = '#33a874';
      for (let x = 0; x < width; x++) {
        if (Number.isNaN(max[x]!)) continue;
        const top = mid - (Math.min(1, max[x]!) * area) / 2;
        const bottom = mid - (Math.max(-1, min[x]!) * area) / 2;
        ctx.fillRect(x, top, 1, Math.max(1, bottom - top));
      }
    });
  }

  // ---- mouse: select, or time shift ----
  let drag:
    | { kind: 'select'; anchor: number }
    | { kind: 'shift'; id: string; start: number; offset: number }
    | null = null;

  const timeAt = (e: PointerEvent, el: HTMLElement) =>
    Math.max(0, (e.clientX - el.getBoundingClientRect().left) / pps);

  function down(e: PointerEvent, t: AudioTrack): void {
    const lane = e.currentTarget as HTMLElement;
    lane.setPointerCapture?.(e.pointerId);
    const time = timeAt(e, lane);
    if (audioUi.tool === 'shift') {
      drag = { kind: 'shift', id: t.id, start: time, offset: t.offset };
      shifted = { id: t.id, offset: t.offset };
      audio.selectTrack(t.id);
      return;
    }
    drag = { kind: 'select', anchor: time };
    audio.selectTrack(t.id, e.shiftKey);
    audio.select({ start: time, end: time });
    audio.setPosition(time);
  }

  function move(e: PointerEvent): void {
    if (!drag) return;
    const time = timeAt(e, e.currentTarget as HTMLElement);
    if (drag.kind === 'select') audio.select({ start: drag.anchor, end: time });
    else shifted = { id: drag.id, offset: Math.max(0, drag.offset + time - drag.start) };
  }

  function up(): void {
    if (drag?.kind === 'shift' && shifted && shifted.offset !== drag.offset)
      audio.timeShift(shifted.id, shifted.offset);
    drag = null;
    shifted = null;
  }

  function seek(e: PointerEvent): void {
    const ruler = e.currentTarget as HTMLElement;
    audio.setPosition(timeAt(e, ruler));
    ruler.setPointerCapture?.(e.pointerId);
  }
</script>

<section class="a-tracks" aria-label="Tracks">
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
            class:shift={audioUi.tool === 'shift'}
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
            {#if t.channels[0]!.length > 0}
              <div
                class="cl"
                style:left="{offsetOf(t) * pps}px"
                style:width="{trackDuration(t, doc.rate) * pps}px"
              >
                <Icon name="music" size={11} />
                {t.name}
              </div>
            {:else}
              <span class="empty">Empty track: paste sound here</span>
            {/if}
            {#if selected}
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
        <p class="start">
          <Icon name="audio" size={28} />
          Import a sound to start: <b>Import audio</b> on the toolbar, or
          <b>Tracks ▸ Import audio as new track</b>. MP3, WAV, M4A, AAC, FLAC, OGG and the sound of
          video files can be opened.
        </p>
      {/if}
    </div>
  </div>
</section>

<style>
  .a-tracks {
    flex: 1;
    min-width: 0;
    display: flex;
    background: var(--bg-0);
  }
  .scroller {
    flex: 1;
    min-width: 0;
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
  .a-lane.shift {
    cursor: ew-resize;
  }
  canvas {
    position: sticky;
    left: 190px;
    display: block;
  }
  .cl {
    position: absolute;
    top: 3px;
    height: 16px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 7px;
    font-size: 11px;
    font-weight: 600;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px 4px 0 0;
    white-space: nowrap;
    overflow: hidden;
    pointer-events: none;
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
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 640px;
    margin: 40px auto;
    padding: 0 20px;
    color: var(--tx-2);
    position: sticky;
    left: 0;
  }
</style>
