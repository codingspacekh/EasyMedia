<script lang="ts">
  import type { App } from '../app/app.ts';
  import { previewAt, soundsAt, textLayersAt } from '../app/preview.ts';
  import { transitionLook, type LayerLook } from '../core/effects/transitions/transitions.ts';
  import { formatTime } from '../core/model/time.ts';
  import { mainTrackDuration } from '../core/model/timeline.ts';
  import { drawText } from '../core/text/draw.ts';
  import { cssFont } from '../core/text/layout.ts';
  import Icon from './Icon.svelte';
  import PreviewLayer from './PreviewLayer.svelte';
  import PreviewSound from './PreviewSound.svelte';
  import { ui } from './ui-state.svelte.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);

  const frame = $derived(previewAt($store, $store.playhead));
  /** V9: how the two clips look part of the way through a transition. */
  const look = $derived(
    frame.kind !== 'empty' && frame.incoming
      ? transitionLook(frame.incoming.xfade, frame.incoming.progress)
      : null,
  );
  const css = (l: LayerLook | undefined) =>
    l
      ? {
          opacity: l.opacity === undefined ? null : String(l.opacity),
          clip: l.clipPath ?? null,
          transform: l.transform ?? null,
          mask: l.mask ?? null,
          filter: l.filter ?? null,
        }
      : { opacity: null, clip: null, transform: null, mask: null, filter: null };
  const out = $derived(css(look?.from));
  const into = $derived(css(look?.to));
  const sounds = $derived(soundsAt($store, $store.playhead));
  const duration = $derived(mainTrackDuration($store.history.present.timeline.main));
  let playing = $state(false);
  /** Captions, subtitles and credits; the title words of this clip and of the next one. */
  let textCanvas: HTMLCanvasElement | undefined = $state();
  let mainCanvas: HTMLCanvasElement | undefined = $state();
  let incomingCanvas: HTMLCanvasElement | undefined = $state();
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

  // Titles, captions and credits: the same drawing as the export, scaled with the screen. A
  // title's words are drawn in its clip's layer, so a transition takes them along.
  $effect(() => {
    void fontsLoaded;
    const canvases = { over: textCanvas, main: mainCanvas, incoming: incomingCanvas };
    const contexts = Object.fromEntries(
      Object.entries(canvases).map(([slot, c]) => [slot, c?.getContext('2d') ?? null]),
    ) as Record<keyof typeof canvases, CanvasRenderingContext2D | null>;
    for (const ctx of Object.values(contexts))
      ctx?.clearRect(0, 0, settings.width, settings.height);
    const measuring = contexts.over;
    if (!measuring) return;
    const measure = (text: string, font: string) => {
      measuring.font = font;
      return measuring.measureText(text).width;
    };
    for (const layer of textLayersAt($store, $store.playhead, measure)) {
      const ctx = contexts[layer.slot];
      if (!ctx) continue;
      void document.fonts?.load(cssFont(layer.style, settings.height));
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.translate(layer.x, layer.y);
      if (layer.scale !== 1) {
        // Zoom entrances and exits grow around the middle of the words, as in the export.
        ctx.translate(layer.anchor.x, layer.anchor.y);
        ctx.scale(layer.scale, layer.scale);
        ctx.translate(-layer.anchor.x, -layer.anchor.y);
      }
      drawText(ctx, layer.text, layer.style, settings, layer.mode);
      ctx.restore();
    }
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
  <div class="top">
    <span class="label">Preview</span>
    <span class="spacer"></span>
    <span
      class="chip"
      title="The preview plays small copies so it stays smooth; the export uses the original files."
      >Proxy · smooth</span
    >
    <button
      class="chip"
      aria-pressed={ui.safeArea}
      title="Keep titles and captions inside this frame so no screen cuts them off"
      onclick={() => (ui.safeArea = !ui.safeArea)}
      >Safe area {#if ui.safeArea}<Icon name="check" size={14} />{/if}</button
    >
  </div>
  <div class="stage">
    <div
      class="screen"
      data-preview={frame.kind}
      style:width="min(100cqw, 100cqh * {settings.width} / {settings.height}, 960px)"
      style:aspect-ratio="{settings.width} / {settings.height}"
    >
      {#if frame.kind === 'empty'}
        <p>Nothing to show yet.</p>
      {:else}
        {#if look?.behind}<div class="behind" style:background={look.behind}></div>{/if}
        <div
          class="outgoing"
          class:above={look?.above === 'from'}
          style:opacity={out.opacity}
          style:clip-path={out.clip}
          style:transform={out.transform}
          style:mask-image={out.mask}
          style:filter={out.filter}
        >
          <PreviewLayer {frame} {playing} />
          <canvas
            class="words"
            bind:this={mainCanvas}
            width={settings.width}
            height={settings.height}
            aria-hidden="true"
          ></canvas>
        </div>
        {#if frame.incoming}
          <!-- V9: the next clip comes in as the transition does (FFmpeg's xfade, drawn with CSS). -->
          <div
            class="incoming"
            role="img"
            aria-label={frame.incoming.transition}
            style:opacity={into.opacity}
            style:clip-path={into.clip}
            style:transform={into.transform}
            style:mask-image={into.mask}
            style:filter={into.filter}
          >
            <PreviewLayer frame={frame.incoming.frame as typeof frame} {playing} />
            <canvas
              class="words"
              bind:this={incomingCanvas}
              width={settings.width}
              height={settings.height}
              aria-hidden="true"
            ></canvas>
          </div>
        {/if}
      {/if}
      <canvas
        class="text"
        bind:this={textCanvas}
        width={settings.width}
        height={settings.height}
        aria-hidden="true"
      ></canvas>
      {#if ui.safeArea}<div class="safe" aria-hidden="true"></div>{/if}
      {#each sounds as sound (sound.itemId)}<PreviewSound {sound} {playing} />{/each}
    </div>
  </div>
  <div class="transport">
    <button
      class="ghost icon-only"
      aria-label="Go to the start"
      disabled={duration === 0}
      onclick={() => app.setPlayhead(0)}><Icon name="toStart" /></button
    >
    <button
      class="play"
      aria-label={playing ? 'Pause' : 'Play'}
      onclick={togglePlay}
      disabled={duration === 0}><Icon name={playing ? 'pause' : 'play'} size={20} /></button
    >
    <button
      class="ghost icon-only"
      aria-label="Go to the end"
      disabled={duration === 0}
      onclick={() => app.setPlayhead(duration)}><Icon name="toEnd" /></button
    >
    <span class="tc">{formatTime($store.playhead)} <small>/ {formatTime(duration)}</small></span>
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
    background: #000;
    box-shadow:
      0 0 0 1px #000,
      0 8px 30px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
    overflow: hidden;
    position: relative;
  }
  .text,
  .words {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
  .outgoing,
  .incoming,
  .behind {
    position: absolute;
    inset: 0;
  }
  .outgoing.above {
    z-index: 1;
  }
  p {
    position: relative;
  }
  .top {
    height: 38px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 12px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
  }
  .label {
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--tx-2);
  }
  .top .chip {
    height: 24px;
  }
  button.chip[aria-pressed='true'] {
    color: var(--tx-1);
    border-color: var(--accent);
  }
  .safe {
    position: absolute;
    inset: 5%;
    border: 1px dashed rgba(255, 255, 255, 0.35);
    pointer-events: none;
  }
  .transport {
    height: 54px;
    flex: none;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-top: 1px solid var(--line);
    background: var(--bg-1);
  }
  .play {
    width: 38px;
    height: 38px;
    padding: 0;
    border-radius: 50%;
    border: 0;
    background: var(--tx-1);
    color: #111;
  }
  .play:hover:not(:disabled) {
    background: #fff;
  }
  .tc {
    margin-left: 6px;
    font: 600 15px var(--mono);
    letter-spacing: 0.02em;
  }
  .tc small {
    color: var(--tx-3);
    font-weight: 400;
    font-size: 13px;
  }
</style>
