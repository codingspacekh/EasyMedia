<script lang="ts">
  // Resize & crop a still (V11, screen 10): make a photo match the project's aspect ratio without
  // stretching — the two steps of Book B Task 11a, done in the app instead of an image editor.
  // Choose the part to keep with the mouse (draw, move, resize from a corner) or a quick place.
  // Or stretch it to the project's size, or cut out any part at its own size (F/M/25 Q2: "crop
  // this still image so that only cells A1:E5 are visible").
  import { untrack } from 'svelte';
  import type { App } from '../app/app.ts';
  import {
    coverRegion,
    coversWhole,
    freeRegionFromCorners,
    moveRegion,
    planResizeCrop,
    regionFromCorners,
    type Anchor,
    type CropRegion,
    type Keep,
    type Point,
  } from '../core/image/crop.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import type { MediaAsset } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import Why from './Why.svelte';
  import Dialog from './Dialog.svelte';

  let {
    app,
    asset,
    size,
    onclose,
  }: {
    app: App;
    asset: MediaAsset;
    size: { width: number; height: number };
    onclose: () => void;
  } = $props();

  const ANCHORS: [Anchor, string][] = [
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
  const CORNERS = [
    ['top-left', 'top-left'],
    ['top-right', 'top-right'],
    ['bottom-left', 'bottom-left'],
    ['bottom-right', 'bottom-right'],
  ] as const;
  const store = $derived(app.store);
  const target = $derived({
    width: $store.history.present.settings.width,
    height: $store.history.present.settings.height,
  });
  /** One of the 9 places (the largest part), or a part chosen with the mouse. */
  let keep: Anchor | CropRegion = $state('centre');
  /**
   * V11: crop to the project's shape (no stretching), stretch it (no cropping), or cut out any part
   * at its own size (free).
   */
  let fit = $state<'crop' | 'stretch' | 'free'>('crop');
  /** The part kept by "Crop to any shape": the whole picture until one is drawn. */
  let freePart: CropRegion = $state(
    untrack(() => ({ x: 0, y: 0, width: size.width, height: size.height })),
  );
  /** The file's name without its extension; empty: the original's name, numbered. */
  let fileName = $state('');
  let addToTimeline = $state(false);
  let saving = $state(false);
  let picture: HTMLDivElement | undefined = $state();
  const chosen: Keep = $derived(
    fit === 'stretch' ? 'stretch' : fit === 'free' ? { free: freePart } : keep,
  );
  const plan = $derived(planResizeCrop(size, target, chosen));
  const region = $derived(
    fit === 'free' ? freePart : typeof keep === 'object' ? keep : coverRegion(size, target, keep),
  );
  /** The new picture's size: the project's, or the part's own (free). */
  const result = $derived(fit === 'free' ? plan.crop : target);
  /** The result inside the preview frame (the project's shape), as % of its width and height. */
  const fitted = $derived.by(() => {
    const k = result.width / result.height / (target.width / target.height);
    return { width: Math.min(100, 100 * k), height: Math.min(100, 100 / k) };
  });
  const stem = $derived(fileNameOf(asset.path).replace(/\.[^.]*$/, ''));
  const url = $derived(toMediaUrl(asset.path));
  const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

  const removedText = $derived.by(() => {
    const parts = (['top', 'bottom', 'left', 'right'] as const)
      .filter((side) => plan.removed[side] > 0)
      .map((side) => `${plan.removed[side]} px from the ${side}`);
    if (!parts.length) return 'Nothing is cut off';
    const last = parts.pop()!;
    return `Removes ${parts.length ? `${parts.join(', ')} and ${last}` : last}`;
  });

  /** A mouse position in original-picture pixels. */
  function toPicture(event: MouseEvent): Point {
    const box = picture?.getBoundingClientRect();
    const k = box && box.width > 0 ? size.width / box.width : 1;
    return { x: (event.clientX - (box?.left ?? 0)) * k, y: (event.clientY - (box?.top ?? 0)) * k };
  }

  /** Follows the mouse until it is released. */
  function follow(event: MouseEvent, update: (at: Point) => void): void {
    event.preventDefault();
    event.stopPropagation();
    const move = (e: MouseEvent) => update(toPicture(e));
    const stop = (e: MouseEvent) => {
      move(e);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
  }

  /** The part from a fixed corner to the mouse: the project's shape, or any shape (free). */
  function between(fixed: Point, at: Point): CropRegion {
    return fit === 'free'
      ? freeRegionFromCorners(fixed, at, size)
      : regionFromCorners(fixed, at, size, target);
  }

  function setRegion(next: CropRegion): void {
    if (fit === 'free') freePart = next;
    else keep = next;
  }

  /** Pressing on the picture draws a new part from that point. */
  function startDraw(event: MouseEvent): void {
    const fixed = toPicture(event);
    follow(event, (at) => {
      // A click without moving keeps the current part.
      if (Math.hypot(at.x - fixed.x, at.y - fixed.y) > 4) setRegion(between(fixed, at));
    });
  }

  /**
   * Pressing inside the part moves it; when the part is the whole picture (a snapshot already has
   * the project's shape) there is nowhere to move it, so the press draws a new part instead.
   */
  function startMove(event: MouseEvent): void {
    if (coversWhole(region, size)) return startDraw(event);
    const from = toPicture(event);
    const start = region;
    follow(event, (at) => setRegion(moveRegion(start, at.x - from.x, at.y - from.y, size)));
  }

  /** Dragging a corner: the opposite corner stays where it is. */
  function startResize(event: MouseEvent, corner: string): void {
    const r = region;
    const fixed = {
      x: corner.endsWith('left') ? r.x + r.width : r.x,
      y: corner.startsWith('top') ? r.y + r.height : r.y,
    };
    follow(event, (at) => setRegion(between(fixed, at)));
  }

  /** Arrow keys move the part too (1/100 of the picture, or 1 px with Shift). */
  function nudge(event: KeyboardEvent): void {
    const step = event.shiftKey ? 1 : size.width / 100;
    const d = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (!d) return;
    event.preventDefault();
    setRegion(moveRegion(region, d[0]!, d[1]!, size));
  }

  async function save(): Promise<void> {
    saving = true;
    const name = fileName.trim();
    const id = name
      ? await app.resizeCropImage(asset.id, chosen, name)
      : await app.resizeCropImage(asset.id, chosen);
    saving = false;
    if (id === null) return;
    if (addToTimeline) app.addToTimeline(id);
    onclose();
  }
</script>

<Dialog
  label="Resize and crop image"
  syllabus="11.1 resizing and cropping a still"
  width={900}
  busy={saving}
  {onclose}
>
  <p class="hint">
    Make {fileNameOf(asset.path)} fit the project: crop it (no stretching) or stretch it (no cropping),
    or cut out any part of it.
  </p>
  <div class="fit" role="radiogroup" aria-label="How to fit">
    <label
      ><input type="radio" name="fit" value="crop" bind:group={fit} /> Crop to fit (keeps its shape)</label
    >
    <label
      ><input type="radio" name="fit" value="stretch" bind:group={fit} /> Stretch to fit (no cropping)</label
    >
    <label
      ><input type="radio" name="fit" value="free" bind:group={fit} /> Crop to any shape (no resizing)</label
    >
  </div>
  <Why tool="resizeCrop" />

  <div class="body">
    <div class="left">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="picture"
        bind:this={picture}
        style:width="min(100%, {(440 * size.width) / size.height}px)"
        style:aspect-ratio="{size.width} / {size.height}"
        aria-label="Picture — drag to select the part to keep"
        onmousedown={startDraw}
      >
        <img src={url} alt="" draggable="false" />
        {#if fit !== 'stretch'}
          <div
            class="keep"
            role="button"
            tabindex="0"
            aria-label="Part to keep — drag to move"
            style:left={pct(region.x, size.width)}
            style:top={pct(region.y, size.height)}
            style:width={pct(region.width, size.width)}
            style:height={pct(region.height, size.height)}
            onmousedown={startMove}
            onkeydown={nudge}
          >
            {#each CORNERS as [corner, name] (corner)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <span
                class="handle {corner}"
                aria-label="Resize from the {name} corner"
                onmousedown={(e) => startResize(e, corner)}
              ></span>
            {/each}
          </div>
        {/if}
      </div>
      <p class="hint">
        Drag on the picture to choose a part, drag inside it to move it, drag a corner to change its
        size. The darker area is removed.
      </p>
    </div>

    <div class="steps">
      <div class="sizes">
        <span>Original</span><b>{size.width} × {size.height}</b>
        <span>Project</span><b>{target.width} × {target.height}</b>
      </div>
      {#if fit === 'free'}
        <h3>Crop · any shape</h3>
        <p class="hint">
          The part is cut out as it is: not resized, so it keeps its own shape and sharpness.
        </p>
        <p class="removed">{removedText}</p>
      {:else}
        <h3>Step 1 · Resize</h3>
        <div class="sizes">
          <span>Width</span><b>{plan.resize.width} px</b>
          <span>Height</span><b>{plan.resize.height} px</b>
        </div>
      {/if}
      {#if fit === 'free'}
        <!-- The steps above say it all. -->
      {:else if fit === 'stretch'}
        <p class="hint">
          Proportions not kept: the picture's shape changes to {target.width} × {target.height}.
        </p>
        <p class="removed">{removedText}</p>
      {:else}
        <p class="hint">Constrain proportions: no stretching.</p>
        <h3>Step 2 · Crop to {target.width} × {target.height}</h3>
        <div class="grid9" role="group" aria-label="Quick places (largest part)">
          {#each ANCHORS as [value, name] (value)}
            <button
              aria-label="Keep {name}"
              aria-pressed={keep === value}
              onclick={() => (keep = value)}
            ></button>
          {/each}
        </div>
        <p class="removed">{removedText}</p>
        <p class="hint">
          Keeps {Math.round(region.width)} × {Math.round(region.height)} of the original
        </p>
      {/if}
      {#if plan.enlarged}
        <p class="warn" role="status">
          This part is smaller than the video, so it is enlarged and may look blurry. Choose a
          bigger part for a sharper picture.
        </p>
      {/if}
      <div class="sizes">
        <span>Result</span><b>{result.width} × {result.height}</b>
      </div>
      <!-- One place and size whatever the part's shape: a preview that grew with the part would
           make the dialog taller and move the picture under the mouse while drawing. -->
      <div class="result-frame" style:aspect-ratio="{target.width} / {target.height}">
        <div
          class="result"
          role="img"
          aria-label="Result preview"
          style:width="{fitted.width}%"
          style:height="{fitted.height}%"
          style:background-image="url('{url}')"
          style:background-size={fit === 'stretch'
            ? '100% 100%'
            : `${(size.width / region.width) * 100}% auto`}
          style:background-position={fit === 'stretch'
            ? '0 0'
            : `${region.width < size.width ? (region.x / (size.width - region.width)) * 100 : 0}% ${
                region.height < size.height ? (region.y / (size.height - region.height)) * 100 : 0
              }%`}
        ></div>
      </div>
    </div>
  </div>

  <label class="file-name">
    File name
    <input
      type="text"
      aria-label="File name"
      placeholder="{stem}1"
      spellcheck="false"
      bind:value={fileName}
    />
  </label>
  <label class="check">
    <input type="checkbox" bind:checked={addToTimeline} />
    Add to the timeline
  </label>
  <p class="hint">
    Saved as a new file next to the original; the original is kept. Leave the name empty for {stem}1,
    {stem}2…
  </p>

  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={saving} onclick={save}>Save image</button>
  {/snippet}
</Dialog>

<style>
  .fit {
    display: flex;
    gap: 16px;
    margin: 4px 0 8px;
  }
  h3 {
    font-size: 12.5px;
    margin: 12px 0 6px;
  }
  .body {
    display: grid;
    grid-template-columns: 1fr 250px;
    gap: 18px;
    align-items: start;
  }
  .picture {
    position: relative;
    overflow: hidden;
    background: #000;
    cursor: crosshair;
    user-select: none;
  }
  .picture img {
    width: 100%;
    height: 100%;
    display: block;
    pointer-events: none;
  }
  .keep {
    position: absolute;
    border: 2px solid #fff;
    /* Everything outside the part is shaded: this is what will be removed. */
    box-shadow:
      0 0 0 1px rgba(0, 0, 0, 0.6),
      0 0 0 9999px rgba(0, 0, 0, 0.62);
    cursor: move;
  }
  .keep:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .handle {
    position: absolute;
    width: 14px;
    height: 14px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.6);
    border-radius: 2px;
  }
  .handle.top-left {
    left: -8px;
    top: -8px;
    cursor: nwse-resize;
  }
  .handle.top-right {
    right: -8px;
    top: -8px;
    cursor: nesw-resize;
  }
  .handle.bottom-left {
    left: -8px;
    bottom: -8px;
    cursor: nesw-resize;
  }
  .handle.bottom-right {
    right: -8px;
    bottom: -8px;
    cursor: nwse-resize;
  }
  .result-frame {
    width: 100%;
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .removed {
    /* Room for the longest "Removes …" (four sides), so the dialog keeps its height. */
    min-height: 3.6em;
  }
  .result {
    background-repeat: no-repeat;
    background-color: #000;
    border: 1px solid var(--line-strong);
  }
  .sizes {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 2px 8px;
    font-size: 12.5px;
  }
  .sizes span {
    color: var(--tx-3);
  }
  .grid9 {
    display: grid;
    grid-template-columns: repeat(3, 24px);
    gap: 3px;
  }
  .grid9 button {
    height: 18px;
    padding: 0;
  }
  .grid9 button[aria-pressed='true'] {
    background: var(--accent);
    border-color: var(--accent);
  }
  .hint {
    color: var(--tx-3);
    font-size: 12px;
    margin: 6px 0;
  }
  .warn {
    color: var(--warn);
    font-size: 12px;
    margin: 6px 0;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
  }
  .file-name {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
  }
  .file-name input {
    width: 260px;
  }
</style>
