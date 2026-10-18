<script lang="ts">
  // Video compression & quality (screen 22, Book B 11.1.19): the same video lossless, as a
  // high-quality MP4 and at two smaller sizes, shown at the same size on screen — estimates
  // first, then real files made from the inspected video (T3). And what makes a file bigger.
  import { VIDEO_SECONDS, type LearnApp } from '../../app/learn.ts';
  import { toMediaUrl } from '../../core/media-url.ts';
  import { group } from '../../core/teaching/file-size.ts';
  import { PICTURE_SIZES, videoSizeExamples } from '../../core/teaching/format-guide.ts';
  import LearnCard from './LearnCard.svelte';
  import { sizeText } from './size.ts';

  let { learn }: { learn: LearnApp } = $props();
  const store = $derived(learn.store);
  const inspected = $derived($store.inspected?.info.kind === 'video' ? $store.inspected : null);
  const comparison = $derived($store.comparison?.kind === 'video' ? $store.comparison : null);
  const source = $derived.by(() => {
    const v = inspected?.info.video;
    return v
      ? {
          picture: {
            width: v.width,
            height: v.height,
            fps: v.fps && v.fps <= 25 ? 25 : 30,
          } as const,
          duration: inspected!.info.duration ?? 10,
          name: inspected!.name,
        }
      : { picture: { width: 1920, height: 1080, fps: 30 } as const, duration: 40.7, name: null };
  });
  const examples = $derived(videoSizeExamples(source.picture, source.duration));
  const mostPixels = PICTURE_SIZES.at(-1)!.width * PICTURE_SIZES.at(-1)!.height;
  let videos: HTMLVideoElement[] = $state([]);

  /**
   * A simple scene drawn with as few pixels as the example has (compared with the full-size
   * video), then stretched to the tile's size, so the smaller pictures look blocky.
   */
  function scene(canvas: HTMLCanvasElement, share: number) {
    const draw = (part: number) => {
      canvas.width = Math.max(16, Math.round(284 * Math.min(1, part)));
      canvas.height = Math.round((canvas.width * 160) / 284);
      const g = canvas.getContext('2d');
      if (!g) return;
      const W = canvas.width;
      const H = canvas.height;
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#6fa8dc');
      sky.addColorStop(1, '#d6e9f5');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#f7d774';
      g.beginPath();
      g.arc(W * 0.78, H * 0.25, H * 0.1, 0, 2 * Math.PI);
      g.fill();
      g.fillStyle = '#3d7a4f';
      g.beginPath();
      g.moveTo(0, H * 0.75);
      g.quadraticCurveTo(W * 0.3, H * 0.5, W * 0.6, H * 0.72);
      g.quadraticCurveTo(W * 0.8, H * 0.82, W, H * 0.66);
      g.lineTo(W, H);
      g.lineTo(0, H);
      g.fill();
      g.fillStyle = '#2b5f8a';
      g.fillRect(0, H * 0.86, W, H * 0.14);
      g.strokeStyle = '#1b1b1b';
      g.lineWidth = Math.max(1, W / 140);
      g.beginPath();
      g.moveTo(W * 0.3, H * 0.3);
      g.quadraticCurveTo(W * 0.33, H * 0.26, W * 0.36, H * 0.3);
      g.quadraticCurveTo(W * 0.39, H * 0.26, W * 0.42, H * 0.3);
      g.stroke();
    };
    draw(share);
    return { update: draw };
  }

  function playAll(): void {
    for (const v of videos) {
      if (!v) continue;
      v.currentTime = 0;
      void v.play()?.catch(() => {});
    }
  }
</script>

<LearnCard title="Video compression & quality" icon="monitor" tag="11.1 compression">
  {#if comparison && inspected}
    <div class="top">
      <p class="hint">
        The same {comparison.seconds} s of {inspected.name}, shown at the same size on screen:
      </p>
      <button onclick={playAll}>Play all</button>
    </div>
    <div class="tiles">
      {#each comparison.items as item, i (item.path)}
        <figure>
          {#if item.still}
            <img src={toMediaUrl(item.still)} alt="One frame of the lossless file" />
          {:else}
            <video
              bind:this={videos[i]}
              src={toMediaUrl(item.path)}
              preload="auto"
              muted
              loop
              playsinline
            ></video>
          {/if}
          <figcaption>
            <span class="line">
              <span><b>{item.label.split(' · ')[0]}</b> · {item.label.split(' · ')[1]}</span>
              <span class="v">{sizeText(item.bytes)}</span>
            </span>
            {#if item.still}
              <span class="note">
                Video players cannot play this lossless file, so one exact frame of it is shown.
                Lossless files are for keeping and editing, not for watching.
              </span>
            {/if}
          </figcaption>
        </figure>
      {/each}
    </div>
  {:else}
    <p class="hint">
      The same {source.duration.toFixed(1)} s video{source.name ? ` (${source.name})` : ''}, shown
      at the same size on screen (estimated sizes):
    </p>
    <div class="tiles">
      {#each examples as e (e.label + e.width)}
        <figure>
          <canvas use:scene={e.width / source.picture.width} aria-hidden="true"></canvas>
          <figcaption>
            <span class="line">
              <span><b>{e.label}</b> · {e.width} × {e.height}</span>
              <span class="v">≈ {e.upTo ? 'up to ' : ''}{sizeText(e.bytes)}</span>
            </span>
          </figcaption>
        </figure>
      {/each}
    </div>
  {/if}
  {#if inspected}
    <button class="make" disabled={$store.busy !== null} onclick={() => learn.compareVideo()}
      >Make real files from {inspected.name}</button
    >
    {#if $store.busy}<span class="busy" role="status">{$store.busy}</span>{/if}
  {:else}
    <p class="hint">
      Inspect a video on the <i>Inspector & sampling</i> tab to export its first {VIDEO_SECONDS} s these
      four ways and watch them side by side.
    </p>
  {/if}

  <div class="label-s">What makes a video file bigger?</div>
  <ul class="bars">
    {#each PICTURE_SIZES as p (p.name)}
      <li class="bar-row">
        <span>{p.name} {p.width} × {p.height}</span>
        <span class="b" style:width="{(100 * p.width * p.height) / mostPixels}%" aria-hidden="true"
        ></span>
        <span class="v">{group(p.width * p.height)} px</span>
      </li>
    {/each}
  </ul>
  <p class="hint">
    More <b>pixels per frame</b>, more <b>frames per second</b> (30 fps needs twice the data of 15
    fps) and a longer <b>duration</b> all increase the size. Lossy compression shrinks it, but too much
    causes blocky, blurred pictures — and a small picture shown on a big screen looks pixelated.
  </p>
</LearnCard>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .top .hint {
    flex: 1;
  }
  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 10px;
  }
  figure {
    margin: 0;
  }
  canvas,
  img,
  video {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 4px;
    background: #000;
    image-rendering: pixelated;
    object-fit: contain;
  }
  figcaption {
    display: block;
    margin-top: 6px;
    font-size: 12px;
    color: var(--tx-2);
  }
  figcaption b {
    color: var(--tx-1);
  }
  .v {
    font: 600 12px var(--mono);
    color: var(--tx-1);
    white-space: nowrap;
  }
  .line {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .note {
    display: block;
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--tx-3);
  }
  .make {
    margin-top: 12px;
  }
  .busy {
    margin-left: 10px;
    font-size: 12px;
    color: var(--accent);
  }
  .label-s {
    margin: 16px 0 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--tx-3);
  }
  .bars {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 150px 1fr 100px;
    align-items: center;
    gap: 10px;
    font-size: 12px;
  }
  .b {
    height: 14px;
    border-radius: 3px;
    background: var(--accent);
    min-width: 2px;
  }
  .bar-row .v {
    text-align: right;
    font-weight: 500;
    color: var(--tx-2);
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
  .hint b {
    color: var(--tx-2);
  }
</style>
