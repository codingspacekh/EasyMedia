<script lang="ts">
  // One picture in the preview: a playing proxy, a still or a colour, with its look — filters
  // as a CSS filter, pan & zoom as a CSS transform, a fade as a black or white layer on top.
  import type { PreviewFrame } from '../app/preview.ts';

  let { frame, playing }: { frame: Exclude<PreviewFrame, { kind: 'empty' }>; playing: boolean } =
    $props();
  let video: HTMLVideoElement | undefined = $state();

  const look = $derived(frame.look);
  const view = $derived(look?.view);
  // The point (x, y) of the picture goes to the middle of the screen, then it is enlarged.
  const transform = $derived(
    view
      ? `scale(${view.zoom}) translate(${(0.5 - view.x) * 100}%, ${(0.5 - view.y) * 100}%)`
      : null,
  );

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
</script>

<div class="layer" style:filter={look?.filter || null}>
  <div class="view" style:transform>
    {#if frame.kind === 'video'}
      <!-- The student's own clip in a live preview: a captions track does not apply here.
           The student's captions and subtitles are drawn on the canvas on top. -->
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} src={frame.src} preload="auto"></video>
    {:else if frame.kind === 'image'}
      <img src={frame.src} alt="" />
    {:else if frame.kind === 'colour'}
      <div class="fill" style:background={frame.colour}></div>
    {:else}
      <p>Preparing preview… {Math.round(frame.progress * 100)} %</p>
    {/if}
  </div>
  {#if look?.fade}
    <div class="fade" style:background={look.fade.colour} style:opacity={look.fade.amount}></div>
  {/if}
</div>

<style>
  .layer,
  .view,
  .fade {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .fade {
    pointer-events: none;
  }
  video,
  img,
  .fill {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
</style>
