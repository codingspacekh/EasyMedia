<script lang="ts">
  // Inspector (screens 01–04): change the selected clip or text by typing exact values
  // (V2, V4–V7, V12, V13, V14).
  import type { App } from '../app/app.ts';
  import {
    moveTimedItem,
    setClipMuted,
    setClipSpeed,
    setDuration,
    trimClip,
  } from '../app/commands.ts';
  import { itemDuration, layoutMain } from '../core/model/timeline.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import TextInspector from './TextInspector.svelte';
  import TimeField from './TimeField.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

  const project = $derived($store.history.present);
  const laid = $derived(
    layoutMain(project.timeline.main).find((l) => l.item.id === $store.selection),
  );
  const item = $derived(laid?.item);
  const textItem = $derived(project.timeline.text.find((t) => t.id === $store.selection));
  const TEXT_KINDS = { caption: 'Caption', subtitle: 'Subtitle', credits: 'Credits' };
  const asset = $derived(
    item && item.type !== 'title' ? project.media.find((m) => m.id === item.assetId) : undefined,
  );
  let actionError: string | null = $state(null);

  /** Source time under the playhead, for "set to playhead". */
  function sourceTimeAtPlayhead(): number | null {
    if (!laid || laid.item.type !== 'video') return null;
    const t = $store.playhead;
    if (t < laid.start || t > laid.end) return null;
    return laid.item.in + (t - laid.start) * laid.item.speed;
  }

  function setFromPlayhead(side: 'in' | 'out'): void {
    if (!item || item.type !== 'video') return;
    const t = sourceTimeAtPlayhead();
    actionError =
      t === null
        ? 'Move the playhead over this clip first.'
        : app.edit(
            trimClip(item.id, {
              in: side === 'in' ? t : item.in,
              out: side === 'out' ? t : item.out,
            }),
          );
  }
</script>

<aside class="inspector">
  <div class="panel-h">Inspector</div>
  {#if textItem}
    <div class="head">
      <div class="title">{textItem.text.split('\n')[0] || TEXT_KINDS[textItem.kind]}</div>
      <div class="kind">
        {TEXT_KINDS[textItem.kind]} · <span class="len">{textItem.duration.toFixed(2)} s</span>
      </div>
    </div>
    <section>
      <h3>Timing <span class="syl">11.4</span></h3>
      <TimeField
        label="Starts at"
        value={textItem.start}
        commit={(t) => app.edit(moveTimedItem(textItem.id, t))}
      />
      <TimeField
        label="Duration"
        value={textItem.duration}
        commit={(t) => app.edit(setDuration(textItem.id, t))}
      />
    </section>
    {#key textItem.id}<TextInspector {app} item={textItem} />{/key}
  {:else if !item}
    <p class="empty">Select a clip on the timeline to change it.</p>
  {:else}
    <div class="head">
      <div class="title">
        {asset ? fileNameOf(asset.path) : item.type === 'title' ? 'Title slide' : 'Clip'}
      </div>
      <div class="kind">
        {item.type === 'video'
          ? 'Video clip'
          : item.type === 'image'
            ? 'Still image'
            : 'Title slide'} ·
        <span class="len">{itemDuration(item).toFixed(2)} s</span>
      </div>
    </div>

    {#if item.type === 'video'}
      <section>
        <h3>Trim <span class="syl">11.1</span></h3>
        <TimeField
          label="Start point"
          value={item.in}
          commit={(t) => app.edit(trimClip(item.id, { in: t, out: item.out }))}
        />
        <TimeField
          label="End point"
          value={item.out}
          commit={(t) => app.edit(trimClip(item.id, { in: item.in, out: t }))}
        />
        <div class="row">
          <button onclick={() => setFromPlayhead('in')}>Set start to playhead</button>
          <button onclick={() => setFromPlayhead('out')}>Set end to playhead</button>
        </div>
        {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
      </section>

      <section>
        <h3>Speed <span class="syl">11.1</span></h3>
        <div class="speeds">
          {#each SPEEDS as speed (speed)}
            <button
              aria-pressed={item.speed === speed}
              onclick={() => (actionError = app.edit(setClipSpeed(item.id, speed)))}
              >{speed}×</button
            >
          {/each}
        </div>
        <p class="hint">
          Source {(item.out - item.in).toFixed(2)} s ÷ {item.speed} = {itemDuration(item).toFixed(
            2,
          )} s on the timeline
        </p>
      </section>

      <section>
        <h3>Sound <span class="syl">11.1</span></h3>
        <label class="check">
          <input
            type="checkbox"
            checked={item.muted}
            onchange={(e) =>
              (actionError = app.edit(setClipMuted(item.id, e.currentTarget.checked)))}
          />
          Remove sound
        </label>
      </section>
    {:else}
      <section>
        <h3>Duration <span class="syl">11.1</span></h3>
        <TimeField
          label="Duration"
          value={item.duration}
          commit={(t) => app.edit(setDuration(item.id, t))}
        />
      </section>
      {#if item.type === 'title'}
        {#key item.id}<TextInspector {app} {item} />{/key}
      {/if}
    {/if}
  {/if}
</aside>

<style>
  .inspector {
    width: 300px;
    border-left: 1px solid var(--line);
    background: var(--bg-1);
    overflow: auto;
  }
  .empty {
    padding: 12px;
    color: var(--tx-3);
  }
  .head {
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  .title {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kind {
    color: var(--tx-3);
    font-size: 12px;
  }
  section {
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
  }
  h3 {
    font-size: 12.5px;
    margin: 0 0 8px;
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .syl {
    font-size: 10px;
    color: var(--tx-3);
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    padding: 0 4px;
  }
  .row,
  .speeds {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }
  .row button,
  .speeds button {
    padding: 4px 8px;
    font-size: 12px;
  }
  .speeds button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
  }
  .hint {
    color: var(--tx-3);
    font-size: 11.5px;
    margin: 8px 0 0;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .error {
    margin: 6px 0 0;
    color: var(--danger);
    font-size: 11.5px;
  }
</style>
