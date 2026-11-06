<script lang="ts">
  // V20: a picture or video over the video in the preview, in the place and size the export puts
  // it (app/preview.ts overlaysAt), see-through and faded as set. A video plays its small proxy.
  import type { OverlayLayer } from '../app/preview.ts';

  let { layer, playing }: { layer: OverlayLayer; playing: boolean } = $props();
  let video: HTMLVideoElement | undefined = $state();

  // Keep the <video> on the right moment, as the main clip's is (PreviewLayer.svelte).
  $effect(() => {
    if (!video || layer.kind !== 'video') return;
    const volume = layer.volume ?? 0;
    video.volume = Math.min(1, volume);
    video.muted = volume === 0;
    const at = layer.mediaTime ?? 0;
    if (!playing || Math.abs(video.currentTime - at) > 0.3) video.currentTime = at;
    if (playing) void video.play().catch(() => {});
    else video.pause();
  });
</script>

<div
  class="overlay"
  style:left={layer.left}
  style:top={layer.top}
  style:width={layer.width}
  style:height={layer.height}
  style:opacity={layer.opacity}
>
  {#if layer.kind === 'video'}
    <!-- The student's own clip: their captions are drawn on the canvas on top. -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} src={layer.src} preload="auto"></video>
  {:else}
    <img src={layer.src} alt="" draggable="false" />
  {/if}
</div>

<style>
  .overlay {
    position: absolute;
    pointer-events: none;
  }
  img,
  video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: fill;
  }
</style>
