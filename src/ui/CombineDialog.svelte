<script lang="ts">
  // Place a picture on a picture (V18): another picture, its width as a part of this one's, one of
  // nine places and a margin; saved as a new picture beside this one (F/M/25 Q2: the cropped still
  // in the bottom-left corner of credits.png, for the credits' background).
  import type { App } from '../app/app.ts';
  import { planCombine, type Placement } from '../core/image/combine.ts';
  import type { Anchor } from '../core/image/crop.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import type { MediaAsset } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import Dialog from './Dialog.svelte';
  import NumberField from './NumberField.svelte';
  import Why from './Why.svelte';

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
  /** The other pictures that are ready (their size is known). */
  const others = $derived(
    $store.history.present.media.filter(
      (m) => m.kind === 'image' && m.id !== asset.id && $store.assets[m.id]?.size,
    ),
  );
  let topId = $state('');
  const top = $derived(others.find((m) => m.id === topId) ?? others[0]);
  const topSize = $derived(top ? $store.assets[top.id]?.size : undefined);
  let placement: Placement = $state({ anchor: 'bottom-left', widthPercent: 25, margin: 0 });
  let addToTimeline = $state(false);
  let saving = $state(false);
  const plan = $derived(topSize ? planCombine(size, topSize, placement) : null);
  const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

  /** A typed size or margin, checked as the picture will be made. */
  function set(change: Partial<Placement>): string | null {
    const next = { ...placement, ...change };
    try {
      if (topSize) planCombine(size, topSize, next);
    } catch (error) {
      return (error as Error).message;
    }
    placement = next;
    return null;
  }

  async function save(): Promise<void> {
    if (!top) return;
    saving = true;
    const id = await app.combineImages(asset.id, top.id, { ...placement });
    saving = false;
    if (id === null) return;
    if (addToTimeline) app.addToTimeline(id);
    onclose();
  }
</script>

<Dialog
  label="Place a picture"
  syllabus="11.1 inserting a still image"
  width={820}
  busy={saving}
  {onclose}
>
  <p class="hint">Put another picture on {fileNameOf(asset.path)} and save both as one picture.</p>
  <Why tool="placePicture" />

  {#if !top}
    <p class="warn" role="status">
      Import the picture to place first (for example a snapshot you cropped), then open this again.
    </p>
  {:else}
    <div class="body">
      <div
        class="picture"
        style:width="min(100%, {(400 * size.width) / size.height}px)"
        style:aspect-ratio="{size.width} / {size.height}"
      >
        <img src={toMediaUrl(asset.path)} alt="" draggable="false" />
        {#if plan}
          <img
            class="top"
            src={toMediaUrl(top.path)}
            alt=""
            draggable="false"
            style:left={pct(plan.x, size.width)}
            style:top={pct(plan.y, size.height)}
            style:width={pct(plan.top.width, size.width)}
            style:height={pct(plan.top.height, size.height)}
          />
        {/if}
      </div>

      <div class="steps">
        <label for="place-top">Picture to place</label>
        <select id="place-top" value={top.id} onchange={(e) => (topId = e.currentTarget.value)}>
          {#each others as m (m.id)}
            <option value={m.id}>{fileNameOf(m.path)}</option>
          {/each}
        </select>
        <NumberField
          label="Width"
          value={placement.widthPercent}
          unit="%"
          example="25"
          commit={(n) => set({ widthPercent: n })}
        />
        <div class="grid9" role="group" aria-label="Place">
          {#each ANCHORS as [value, name] (value)}
            <button
              aria-label="Place {name}"
              aria-pressed={placement.anchor === value}
              onclick={() => set({ anchor: value })}
            ></button>
          {/each}
        </div>
        <NumberField
          label="Margin"
          value={placement.margin}
          unit="px"
          example="20"
          commit={(n) => set({ margin: n })}
        />
        {#if plan}
          <p class="hint">
            {plan.top.width} × {plan.top.height} at {plan.x}, {plan.y}
          </p>
        {/if}
        <div class="sizes"><span>Result</span><b>{size.width} × {size.height}</b></div>
      </div>
    </div>
  {/if}

  <label class="check">
    <input type="checkbox" bind:checked={addToTimeline} />
    Add to the timeline
  </label>
  <p class="hint">Saved as a new file next to {fileNameOf(asset.path)}; both originals are kept.</p>

  {#snippet buttons()}
    <button onclick={onclose}>Cancel</button>
    <button class="primary" disabled={saving || !top} onclick={save}>Save picture</button>
  {/snippet}
</Dialog>

<style>
  .body {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }
  .picture {
    position: relative;
    flex: none;
    max-width: 60%;
    background: var(--bg-2);
  }
  .picture img {
    display: block;
    width: 100%;
    height: 100%;
  }
  .picture img.top {
    position: absolute;
    outline: 1px dashed var(--accent);
  }
  .steps {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .steps label {
    color: var(--tx-2);
    font-size: 12px;
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
  .sizes {
    display: flex;
    gap: 8px;
    font-size: 12px;
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
</style>
