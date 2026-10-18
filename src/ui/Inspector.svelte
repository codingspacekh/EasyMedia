<script lang="ts">
  // Inspector (screens 01–04): change the selected clip or text by typing exact values
  // (V2, V4–V7, V12, V13, V14).
  import type { App } from '../app/app.ts';
  import {
    moveTimedItem,
    setClipMuted,
    setClipSpeed,
    setClipVolume,
    setDuration,
    trimClip,
    unlinkClipSound,
  } from '../app/commands.ts';
  import { newId } from '../core/model/factory.ts';
  import { itemDuration, layoutMain } from '../core/model/timeline.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import AudioInspector from './AudioInspector.svelte';
  import ClipLookInspector from './ClipLookInspector.svelte';
  import PercentField from './PercentField.svelte';
  import Icon from './Icon.svelte';
  import { ui, type InspectorTab } from './ui-state.svelte.ts';
  import TextInspector from './TextInspector.svelte';
  import TimeField from './TimeField.svelte';
  import Why from './Why.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

  const project = $derived($store.history.present);
  const laid = $derived(
    layoutMain(project.timeline.main).find((l) => l.item.id === $store.selection),
  );
  const item = $derived(laid?.item);
  const textItem = $derived(project.timeline.text.find((t) => t.id === $store.selection));
  /** A selected music or voiceover clip, with its track. */
  const sound = $derived.by(() => {
    for (const track of [0, 1] as const) {
      const found = project.timeline.audio[track].find((a) => a.id === $store.selection);
      if (found) return { item: found, track };
    }
    return null;
  });

  /** V13: the clip's sound goes onto an audio track, which is then selected. */
  function separateSound(clipId: string): void {
    const id = newId();
    actionError = app.edit(unlinkClipSound(clipId, id));
    if (!actionError) app.select(id);
  }
  const TEXT_KINDS = { caption: 'Caption', subtitle: 'Subtitle', credits: 'Credits' };
  const asset = $derived(
    item && item.type !== 'title' ? project.media.find((m) => m.id === item.assetId) : undefined,
  );
  let actionError: string | null = $state(null);

  /** The tabs each kind of item has; the student's last choice is kept when it exists here. */
  const tabs = $derived<[InspectorTab, string][]>(
    !item
      ? []
      : item.type === 'video'
        ? [
            ['clip', 'Clip'],
            ['audio', 'Audio'],
            ['effects', 'Effects'],
          ]
        : item.type === 'image'
          ? [
              ['clip', 'Clip'],
              ['effects', 'Effects'],
            ]
          : [
              ['text', 'Text'],
              ['effects', 'Effects'],
            ],
  );
  const tab = $derived(tabs.some(([t]) => t === ui.inspectorTab) ? ui.inspectorTab : tabs[0]?.[0]);

  /** A small picture of the item for the header. */
  const thumb = $derived.by(() => {
    if (!item) return null;
    if (item.type === 'title') {
      return item.background.kind === 'colour' ? { colour: item.background.colour } : null;
    }
    const status = $store.assets[item.assetId];
    if (item.type === 'image' && asset) return { url: toMediaUrl(asset.path) };
    return status?.thumbPath ? { url: toMediaUrl(status.thumbPath) } : null;
  });

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
  {#if sound}
    {#key sound.item.id}<AudioInspector {app} item={sound.item} track={sound.track} />{/key}
  {:else if textItem}
    <div class="head">
      <div class="thumb text">
        <Icon name={textItem.kind === 'credits' ? 'credits' : 'caption'} />
      </div>
      <div class="who">
        <div class="title">{textItem.text.split('\n')[0] || TEXT_KINDS[textItem.kind]}</div>
        <div class="kind">
          {TEXT_KINDS[textItem.kind]} · <span class="len">{textItem.duration.toFixed(2)} s</span>
        </div>
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
      <div
        class="thumb"
        style:background-image={thumb?.url ? `url("${thumb.url}")` : null}
        style:background-color={thumb?.colour ?? null}
      >
        {#if !thumb}<Icon name={item.type === 'title' ? 'title' : 'video'} />{/if}
      </div>
      <div class="who">
        <div class="title">
          {asset
            ? fileNameOf(asset.path)
            : item.type === 'title'
              ? item.text.split('\n')[0] || 'Title slide'
              : 'Clip'}
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
    </div>

    {#if item.type !== 'video'}
      <section>
        <h3>Duration <span class="syl">11.1</span></h3>
        <TimeField
          label="Duration"
          value={item.duration}
          commit={(t) => app.edit(setDuration(item.id, t))}
        />
        <Why tool="duration" />
      </section>
    {/if}

    <div class="tabs">
      <div class="seg small" role="tablist" aria-label="Inspector">
        {#each tabs as [value, name] (value)}
          <button role="tab" aria-selected={tab === value} onclick={() => (ui.inspectorTab = value)}
            >{name}</button
          >
        {/each}
      </div>
    </div>

    {#if item.type === 'video' && tab === 'clip'}
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
        <Why tool="trim" />
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
        <Why tool="speed" />
      </section>
    {:else if item.type === 'video' && tab === 'audio'}
      <section>
        <h3>Clip sound <span class="syl">11.1</span></h3>
        <label class="check">
          <input
            type="checkbox"
            checked={item.muted}
            onchange={(e) =>
              (actionError = app.edit(setClipMuted(item.id, e.currentTarget.checked)))}
          />
          Remove sound
        </label>
        {#if !item.muted}
          <PercentField
            label="Volume"
            value={item.volume}
            commit={(v) => app.edit(setClipVolume(item.id, v))}
          />
        {/if}
        <Why tool="clipSound" />
      </section>
      <section>
        <h3>Separate sound <span class="syl">11.1</span></h3>
        <button onclick={() => separateSound(item.id)}>Separate sound onto an audio track</button>
        {#if actionError}<p class="error" role="alert">{actionError}</p>{/if}
        <p class="hint">
          The sound becomes its own clip on the voiceover (or music) track, so it can be moved,
          trimmed or deleted without the picture.
        </p>
        <Why tool="separateSound" />
      </section>
    {:else if item.type === 'image' && tab === 'clip'}
      <p class="hint pad">
        This picture shows for the duration above. Use the Effects tab for pan & zoom, fades and
        filters.
      </p>
    {:else if item.type === 'title' && tab === 'text'}
      {#key item.id}<TextInspector {app} {item} />{/key}
    {:else if tab === 'effects'}
      {#key item.id}
        <ClipLookInspector
          {app}
          {item}
          index={project.timeline.main.findIndex((m) => m.id === item.id)}
        />
      {/key}
    {/if}
  {/if}
</aside>

<style>
  .inspector {
    width: 332px;
    flex: none;
    border-left: 1px solid var(--line);
    background: var(--bg-1);
    overflow: auto;
  }
  .empty {
    padding: 12px;
    color: var(--tx-3);
  }
  .head {
    display: flex;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border-bottom: 1px solid var(--line);
  }
  .thumb {
    width: 54px;
    height: 32px;
    flex: none;
    border-radius: 4px;
    border: 1px solid var(--line);
    background: var(--bg-3) center / cover no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
  }
  .thumb.text {
    background: var(--c-text);
    color: #241b00;
  }
  .who {
    min-width: 0;
  }
  .tabs {
    padding: 10px 12px 2px;
  }
  .tabs .seg > button {
    flex: 1;
  }
  .pad {
    padding: 4px 12px 12px;
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
