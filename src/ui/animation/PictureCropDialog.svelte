<script lang="ts">
  // Crop… a picture in Animation mode (AN5; 9626/04 O/N/19: the pearl cut from a photo). The part
  // to keep is dragged on the picture, as Video mode's "Crop to any shape" (core/image/crop.ts):
  // drag to draw it, inside it to move it, a corner to change its size. It is saved as a new
  // picture beside the old one, at its own size, and the selected object shows only that part.
  import { untrack } from 'svelte';
  import type { App } from '../../app/app.ts';
  import {
    freeRegionFromCorners,
    moveRegion,
    planFreeCrop,
    type CropRegion,
    type Point,
  } from '../../core/image/crop.ts';
  import { toMediaUrl } from '../../core/media-url.ts';
  import { fileNameOf } from '../../core/project/relocate.ts';
  import Dialog from '../Dialog.svelte';
  import Why from '../Why.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const anim = $derived(app.animation);

  const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;
  /** The picture as it was when the dialog opened. */
  const file = untrack(() => anim.selectedPictureFile());
  const size = { width: file?.width ?? 1, height: file?.height ?? 1 };
  /** The part kept: the whole picture until one is drawn. */
  let part: CropRegion = $state({ x: 0, y: 0, ...size });
  let fileName = $state('');
  let saving = $state(false);
  let picture: HTMLDivElement | undefined = $state();
  const plan = $derived(planFreeCrop(size, part));
  const stem = $derived(file ? fileNameOf(file.path).replace(/\.[^.]*$/, '') : '');
  const pct = (n: number, whole: number) => `${(n / whole) * 100}%`;

  /** A mouse position in the picture's own pixels. */
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

  function startDraw(event: MouseEvent): void {
    const fixed = toPicture(event);
    follow(event, (at) => {
      // A click without moving keeps the part there is.
      if (Math.hypot(at.x - fixed.x, at.y - fixed.y) > 4)
        part = freeRegionFromCorners(fixed, at, size);
    });
  }

  /** Inside the part it moves; the whole picture cannot move, so a new part is drawn instead. */
  function startMove(event: MouseEvent): void {
    if (part.width >= size.width - 1 && part.height >= size.height - 1) return startDraw(event);
    const from = toPicture(event);
    const start = part;
    follow(event, (at) => (part = moveRegion(start, at.x - from.x, at.y - from.y, size)));
  }

  /** Dragging a corner: the opposite corner stays where it is. */
  function startResize(event: MouseEvent, corner: string): void {
    const r = part;
    const fixed = {
      x: corner.endsWith('left') ? r.x + r.width : r.x,
      y: corner.startsWith('top') ? r.y + r.height : r.y,
    };
    follow(event, (at) => (part = freeRegionFromCorners(fixed, at, size)));
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
    part = moveRegion(part, d[0]!, d[1]!, size);
  }

  async function save(): Promise<void> {
    saving = true;
    const name = fileName.trim();
    await (name ? anim.cropPicture(part, name) : anim.cropPicture(part));
    saving = false;
    onclose();
  }
</script>

<Dialog label="Crop picture" syllabus="20.1 importing bitmaps" width={640} busy={saving} {onclose}>
  {#if file}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="picture"
      bind:this={picture}
      style:width="min(100%, {(380 * size.width) / size.height}px)"
      style:aspect-ratio="{size.width} / {size.height}"
      aria-label="Picture — drag to choose the part to keep"
      onmousedown={startDraw}
    >
      <img src={toMediaUrl(file.path)} alt="" draggable="false" />
      <div
        class="keep"
        role="button"
        tabindex="0"
        aria-label="Part to keep — drag to move"
        style:left={pct(part.x, size.width)}
        style:top={pct(part.y, size.height)}
        style:width={pct(part.width, size.width)}
        style:height={pct(part.height, size.height)}
        onmousedown={startMove}
        onkeydown={nudge}
      >
        {#each CORNERS as corner (corner)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <span
            class="handle {corner}"
            aria-label="Resize from the {corner} corner"
            onmousedown={(e) => startResize(e, corner)}
          ></span>
        {/each}
      </div>
    </div>
    <p class="keeps">Keeps {plan.crop.width} × {plan.crop.height} px</p>
    <p class="hint">
      Drag on the picture to choose the part to keep, inside it to move it, a corner to change its
      size. The darker area is cut off. The part keeps its own size and sharpness, and stays where
      it is on the stage.
    </p>
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
    <p class="hint">
      Saved as a new picture next to {fileNameOf(file.path)}, which is kept. Leave the name empty
      for
      {stem}1, {stem}2…
    </p>
  {:else}
    <p class="hint">Select a picture on the stage first.</p>
  {/if}
  <Why tool="animPicture" />
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={saving || !file} onclick={save}>Crop</button>
  {/snippet}
</Dialog>

<style>
  .picture {
    position: relative;
    overflow: hidden;
    margin: 0 auto;
    /* A checkerboard shows where the picture is already see-through. */
    background: repeating-conic-gradient(#c8c8c8 0 25%, #fff 0 50%) 0 0 / 16px 16px;
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
    /* Everything outside the part is shaded: this is what is cut off. */
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
  .keeps {
    font-size: 12.5px;
    margin: 8px 0 0;
  }
  .hint {
    color: var(--tx-3);
    font-size: 12px;
    margin: 6px 0;
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
