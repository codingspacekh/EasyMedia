<script lang="ts">
  import type { App } from '../app/app.ts';
  import { previewAt, textLayersAt } from '../app/preview.ts';
  import { formatTime } from '../core/model/time.ts';
  import { mainTrackDuration } from '../core/model/timeline.ts';
  import { drawText } from '../core/text/draw.ts';
  import { cssFont } from '../core/text/layout.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);

  const frame = $derived(previewAt($store, $store.playhead));
  const duration = $derived(mainTrackDuration($store.history.present.timeline.main));
  let playing = $state(false);
  let video: HTMLVideoElement | undefined = $state();
  let textCanvas: HTMLCanvasElement | undefined = $state();
  const settings = $derived($store.history.present.settings);
  /** Bumped when a bundled font finishes loading, so the text is drawn again with it. */
  let fontsLoaded = $state(0);

  $effect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    const redraw = () => fontsLoaded++;
    fonts.addEventListener('loadingdone', redraw);
    return () => fonts.removeEventListener('loadingdone', redraw);
  });

  // Titles, captions and credits: the same drawing as the export, scaled with the screen.
  $effect(() => {
    void fontsLoaded;
    const ctx = textCanvas?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, settings.width, settings.height);
    const measure = (text: string, font: string) => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
    for (const layer of textLayersAt($store, $store.playhead, measure)) {
      void document.fonts?.load(cssFont(layer.style, settings.height));
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(layer.x, layer.y);
      drawText(ctx, layer.text, layer.style, settings, layer.mode);
      ctx.restore();
    }
  });

  // Keep the <video> on the right moment of the right clip.
  $effect(() => {
    if (!video || frame.kind !== 'video') return;
    video.playbackRate = frame.rate;
    video.volume = frame.volume;
    video.muted = frame.volume === 0;
    if (!playing || Math.abs(video.currentTime - frame.mediaTime) > 0.3)
      video.currentTime = frame.mediaTime;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  });

  // The playhead moves with real time while playing (approximate preview, ARCHITECTURE §7.3).
  $effect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      const next = $store.playhead + (now - last) / 1000;
      last = now;
      if (next >= duration) {
        app.setPlayhead(duration);
        playing = false;
        return;
      }
      app.setPlayhead(next);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  });

  function togglePlay(): void {
    if (!playing && $store.playhead >= duration) app.setPlayhead(0);
    playing = !playing && duration > 0;
  }
</script>

<section class="preview">
  <div class="stage">
    <div class="screen" data-preview={frame.kind}>
      {#if frame.kind === 'video'}
        <!-- The student's own clip in a live preview: a captions track does not apply here.
             The student's captions and subtitles are drawn on the canvas on top. -->
        <!-- svelte-ignore a11y_media_has_caption -->
        <video bind:this={video} src={frame.src} preload="auto"></video>
      {:else if frame.kind === 'image'}
        <img src={frame.src} alt="" />
      {:else if frame.kind === 'colour'}
        <div class="fill" style:background={frame.colour}></div>
      {:else if frame.kind === 'waiting'}
        <p>Preparing preview… {Math.round(frame.progress * 100)} %</p>
      {:else}
        <p>Nothing to show yet.</p>
      {/if}
      <canvas
        class="text"
        bind:this={textCanvas}
        width={settings.width}
        height={settings.height}
        aria-hidden="true"
      ></canvas>
    </div>
  </div>
  <div class="transport">
    <button onclick={togglePlay} disabled={duration === 0}>{playing ? 'Pause' : 'Play'}</button>
    <span class="tc">{formatTime($store.playhead)} / {formatTime(duration)}</span>
  </div>
</section>

<style>
  .preview {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stage {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    min-height: 0;
    overflow: hidden;
    /* The screen is sized from both the width AND height available (cq units), so a 16:9
       frame always fits — in a short window it used to overflow and cover the toolbar. */
    container-type: size;
  }
  .screen {
    width: min(100cqw, 100cqh * 16 / 9, 960px);
    aspect-ratio: 16 / 9;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
    overflow: hidden;
    position: relative;
  }
  .text {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  video,
  img,
  .fill {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-top: 1px solid var(--line);
    background: var(--bg-1);
  }
  .tc {
    font: 600 14px var(--mono);
  }
</style>
