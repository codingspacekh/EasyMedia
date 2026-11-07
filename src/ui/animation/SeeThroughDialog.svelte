<script lang="ts">
  // Make a colour see-through… (AN5; 9626/04 O/N/19: the pearl cut from its photo, on a
  // transparent background, instead of hiding the background with a mask). Click the colour in the
  // picture; the tolerance says how near a colour must be to go too. The preview, on a
  // checkerboard, is worked out as FFmpeg's colorkey will make the PNG (core/image/colour-key.ts).
  import { untrack } from 'svelte';
  import { editorOf } from './editor.ts';
  import type { App } from '../../app/app.ts';
  import type { Pixels } from '../../core/animation/trace.ts';
  import {
    colourAt,
    DEFAULT_TOLERANCE,
    seeThrough,
    type ColourKey,
  } from '../../core/image/colour-key.ts';
  import { fileNameOf } from '../../core/project/relocate.ts';
  import Dialog from '../Dialog.svelte';
  import Why from '../Why.svelte';

  let { app, onclose }: { app: App; onclose: () => void } = $props();
  const editor = editorOf(() => app);
  const anim = $derived(editor.anim);

  /** The preview is worked out on a copy this small (px on the longer side). */
  const PREVIEW_SIDE = 360;
  const file = untrack(() => anim.selectedPictureFile());
  let pixels = $state<Pixels | null>(null);
  /** The colour picked; empty until the picture is clicked. */
  let colour = $state('');
  let tolerance = $state(DEFAULT_TOLERANCE);
  let soft = $state(true);
  let fileName = $state('');
  let saving = $state(false);
  let canvas: HTMLCanvasElement | undefined = $state();
  const key = $derived<ColourKey>({ colour, tolerance, soft });
  const stem = $derived(file ? fileNameOf(file.path).replace(/\.[^.]*$/, '') : '');

  void untrack(() => anim.picturePixels(PREVIEW_SIDE)).then(
    (read) => (pixels = read),
    () => {},
  );

  // The preview: the picture with the picked colour see-through (as it is until one is picked).
  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (!ctx || !pixels) return;
    const data = colour ? seeThrough(pixels, key) : Uint8ClampedArray.from(pixels.data);
    ctx.putImageData(new ImageData(data, pixels.width, pixels.height), 0, 0);
  });

  function pick(event: MouseEvent): void {
    if (!pixels || !canvas) return;
    const box = canvas.getBoundingClientRect();
    const k = box.width > 0 ? pixels.width / box.width : 1;
    colour = colourAt(pixels, (event.clientX - box.left) * k, (event.clientY - box.top) * k);
  }

  async function save(): Promise<void> {
    saving = true;
    const name = fileName.trim();
    await (name ? anim.seeThroughPicture(key, name) : anim.seeThroughPicture(key));
    saving = false;
    onclose();
  }
</script>

<Dialog
  label="Make a colour see-through"
  syllabus="20.1 importing bitmaps"
  width={560}
  busy={saving}
  {onclose}
>
  {#if file}
    <div class="preview">
      {#if pixels}
        <canvas
          bind:this={canvas}
          width={pixels.width}
          height={pixels.height}
          aria-label="Picture — click the colour to make see-through"
          onclick={pick}
        ></canvas>
      {:else}
        <p class="hint">Reading the picture…</p>
      {/if}
    </div>
    <div class="settings">
      <span class="label">Colour</span>
      <div class="row">
        {#if colour}
          <span class="swatch" style:background={colour}></span>
          <span>{colour.toUpperCase()}</span>
        {:else}
          <span class="hint">Click the colour in the picture (the background, for a cut-out).</span>
        {/if}
      </div>
      <label for="key-tolerance">Tolerance</label>
      <div class="row">
        <input id="key-tolerance" type="range" min="1" max="100" step="1" bind:value={tolerance} />
        <span class="value">{tolerance} %</span>
      </div>
      <span></span>
      <label class="check"><input type="checkbox" bind:checked={soft} /> Soft edges</label>
    </div>
    <p class="hint">
      Colours near the one clicked go too: more tolerance takes more of a shaded background, but may
      take parts of the picture with it. Soft edges make the outline smoother.
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
      Saved as a new PNG picture (a JPG cannot be see-through) next to {fileNameOf(file.path)},
      which is kept. Leave the name empty for {stem}1.png, {stem}2.png…
    </p>
  {:else}
    <p class="hint">Select a picture on the stage first.</p>
  {/if}
  <Why tool="animPicture" />
  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={saving || !colour} onclick={save}>Make see-through</button>
  {/snippet}
</Dialog>

<style>
  .preview {
    display: flex;
    justify-content: center;
    min-height: 120px;
  }
  canvas {
    max-width: 100%;
    max-height: 360px;
    /* A checkerboard shows what is see-through. */
    background: repeating-conic-gradient(#c8c8c8 0 25%, #fff 0 50%) 0 0 / 16px 16px;
    cursor: crosshair;
  }
  .settings {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 8px 10px;
    align-items: center;
    margin-top: 12px;
  }
  .label {
    color: var(--tx-2);
  }
  .row {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .row input[type='range'] {
    flex: 1;
  }
  .value {
    min-width: 44px;
    text-align: right;
  }
  .swatch {
    width: 18px;
    height: 18px;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
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
