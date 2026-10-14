<script lang="ts">
  // Resize & crop a still (V11, screen 10): make a photo match the project's aspect ratio without
  // stretching — the two steps of Book B Task 11a, done in the app instead of an image editor.
  import type { App } from '../app/app.ts';
  import { planResizeCrop, type Anchor } from '../core/image/crop.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import type { MediaAsset } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';

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
  const store = $derived(app.store);
  const target = $derived({
    width: $store.history.present.settings.width,
    height: $store.history.present.settings.height,
  });
  let anchor: Anchor = $state('centre');
  let addToTimeline = $state(false);
  let saving = $state(false);
  const plan = $derived(planResizeCrop(size, target, anchor));

  const removedText = $derived.by(() => {
    const parts = (['top', 'bottom', 'left', 'right'] as const)
      .filter((side) => plan.removed[side] > 0)
      .map((side) => `${plan.removed[side]} px from the ${side}`);
    return parts.length ? `Removes ${parts.join(' and ')}` : 'Nothing is cut off';
  });

  async function save(): Promise<void> {
    saving = true;
    const id = await app.resizeCropImage(asset.id, anchor);
    saving = false;
    if (id === null) return;
    if (addToTimeline) app.addToTimeline(id);
    onclose();
  }
</script>

<div class="backdrop">
  <div class="dialog" role="dialog" aria-modal="true" aria-label="Resize and crop image">
    <h2>Resize &amp; crop image <span class="syl">11.1 resizing and cropping a still</span></h2>
    <p class="hint">
      Make {fileNameOf(asset.path)} fit the project without stretching it. Choose which part to keep:
      the darker area is removed.
    </p>

    <div class="body">
      <div
        class="picture"
        style:aspect-ratio="{plan.resize.width} / {plan.resize.height}"
        aria-hidden="true"
      >
        <img src={toMediaUrl(asset.path)} alt="" />
        <div
          class="keep"
          style:left="{(plan.crop.x / plan.resize.width) * 100}%"
          style:top="{(plan.crop.y / plan.resize.height) * 100}%"
          style:width="{(plan.crop.width / plan.resize.width) * 100}%"
          style:height="{(plan.crop.height / plan.resize.height) * 100}%"
        ></div>
      </div>

      <div class="steps">
        <div class="sizes">
          <span>Original</span><b>{size.width} × {size.height}</b>
          <span>Project</span><b>{target.width} × {target.height}</b>
        </div>
        <h3>Step 1 · Resize</h3>
        <div class="sizes">
          <span>Width</span><b>{plan.resize.width} px</b>
          <span>Height</span><b>{plan.resize.height} px</b>
        </div>
        <p class="hint">Constrain proportions: no stretching.</p>
        <h3>Step 2 · Crop to {target.width} × {target.height}</h3>
        <div class="grid9" role="group" aria-label="Part to keep">
          {#each ANCHORS as [value, name] (value)}
            <button
              aria-label="Keep {name}"
              aria-pressed={anchor === value}
              onclick={() => (anchor = value)}
            ></button>
          {/each}
        </div>
        <p>{removedText}</p>
        <div class="sizes">
          <span>Result</span><b>{target.width} × {target.height}</b>
        </div>
      </div>
    </div>

    <label class="check">
      <input type="checkbox" bind:checked={addToTimeline} />
      Add to the timeline
    </label>
    <p class="hint">Saved as a new file next to the original; the original is kept.</p>

    <div class="actions">
      <button onclick={onclose}>Cancel</button>
      <button class="primary" disabled={saving} onclick={save}>Save image</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(6, 7, 9, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }
  .dialog {
    width: 640px;
    max-height: 90vh;
    overflow: auto;
    background: var(--bg-1);
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    padding: 18px;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 8px;
    display: flex;
    gap: 8px;
    align-items: center;
  }
  h3 {
    font-size: 12.5px;
    margin: 12px 0 6px;
  }
  .syl {
    font-size: 10px;
    font-weight: 600;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .body {
    display: grid;
    grid-template-columns: 1fr 230px;
    gap: 16px;
    align-items: start;
  }
  .picture {
    position: relative;
    max-height: 340px;
    max-width: 100%;
    overflow: hidden;
    background: #000;
  }
  .picture img {
    width: 100%;
    height: 100%;
    display: block;
    filter: brightness(0.35);
  }
  .keep {
    position: absolute;
    outline: 2px solid var(--accent);
    background: transparent;
    backdrop-filter: brightness(2.85);
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
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 12px;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }
</style>
