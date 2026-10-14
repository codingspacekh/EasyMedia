<script lang="ts">
  // Media bin (screen 01): every imported file as a card with a picture, its length and size.
  // Add puts it on the timeline; pictures can be resized & cropped (V11); missing files located (P6).
  import type { App, AssetStatus } from '../app/app.ts';
  import { toMediaUrl } from '../core/media-url.ts';
  import type { MediaAsset } from '../core/model/types.ts';
  import { fileNameOf } from '../core/project/relocate.ts';
  import CropDialog from './CropDialog.svelte';
  import Icon from './Icon.svelte';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);
  const FILTERS = [
    ['all', 'All'],
    ['video', 'Video'],
    ['image', 'Images'],
    ['audio', 'Audio'],
  ] as const;
  let filter: (typeof FILTERS)[number][0] = $state('all');
  let cropping: { asset: MediaAsset; size: { width: number; height: number } } | null =
    $state(null);

  const project = $derived($store.history.present);
  const shown = $derived(project.media.filter((m) => filter === 'all' || m.kind === filter));
  const used = $derived(
    new Set(
      project.timeline.main.flatMap((m) =>
        m.type === 'title'
          ? m.background.kind === 'colour'
            ? []
            : [m.background.assetId]
          : [m.assetId],
      ),
    ),
  );

  /** 0:20 style length for the badge. */
  const length = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

  function meta(asset: MediaAsset, status: AssetStatus | undefined): string {
    const parts: string[] = [];
    const size = status?.size;
    if (asset.kind === 'video' && size) parts.push(`${size.height}p`);
    if (asset.kind === 'video' && status?.fps) parts.push(`${Math.round(status.fps)} fps`);
    if (asset.kind === 'image' && size) parts.push(`${size.width}×${size.height}`);
    if (asset.kind === 'audio') parts.push('sound');
    if (used.has(asset.id)) parts.push('used');
    return parts.join(' · ') || asset.kind;
  }

  function picture(asset: MediaAsset, status: AssetStatus | undefined): string | null {
    if (asset.kind === 'image') return toMediaUrl(asset.path);
    if (asset.kind === 'video' && status?.thumbPath) return toMediaUrl(status.thumbPath);
    return null;
  }
</script>

<aside class="bin">
  <div class="panel-h">
    Media
    <span class="spacer"></span>
    <button
      class="ghost sm icon-only"
      aria-label="Add media files"
      title="Import"
      onclick={() => app.importMedia()}
    >
      <Icon name="plus" size={14} />
    </button>
  </div>
  <div class="tabs">
    <div class="seg small" role="group" aria-label="Show">
      {#each FILTERS as [value, name] (value)}
        <button aria-pressed={filter === value} onclick={() => (filter = value)}>{name}</button>
      {/each}
    </div>
  </div>
  {#if project.media.length === 0}
    <button class="drop" aria-label="Choose media files to add" onclick={() => app.importMedia()}>
      <Icon name="import" size={20} />
      No media yet — click Import to add videos, pictures or sound.
    </button>
  {/if}
  <ul class="grid">
    {#each shown as asset (asset.id)}
      {@const name = fileNameOf(asset.path)}
      {@const status = $store.assets[asset.id]}
      {@const src = picture(asset, status)}
      <li class="media" class:failed={status?.state === 'failed'}>
        <div class="thumb {asset.kind}" style:background-image={src ? `url("${src}")` : null}>
          {#if asset.kind === 'audio'}<Icon name="music" size={20} />{/if}
          {#if asset.kind === 'image'}
            <span class="badge"><Icon name="image" size={12} /></span>
          {:else if asset.duration !== undefined}
            <span class="badge">{length(asset.duration)}</span>
          {/if}
          {#if !status}
            <span class="badge r">Checking…</span>
          {:else if status.state === 'preparing'}
            <span class="badge r warn">Preparing preview {Math.round(status.progress * 100)} %</span
            >
          {/if}
          <div class="actions">
            {#if status?.state === 'failed'}
              <button class="sm" aria-label={`Locate ${name}`} onclick={() => app.locate(asset.id)}
                >Locate…</button
              >
            {:else}
              <button
                class="sm icon-only add"
                aria-label={`Add ${name} to the timeline`}
                title="Add to the timeline"
                onclick={() => app.addToTimeline(asset.id)}><Icon name="plus" size={14} /></button
              >
              {#if asset.kind === 'image' && status?.size}
                {@const size = status.size}
                <button
                  class="sm icon-only"
                  aria-label={`Resize and crop ${name}`}
                  title="Resize & crop…"
                  onclick={() => (cropping = { asset, size })}
                  ><Icon name="crop" size={14} /></button
                >
              {/if}
            {/if}
          </div>
        </div>
        <div class="name" title={name}>{name}</div>
        <div class="meta">
          {#if status?.state === 'failed'}<span class="error"
              >{status.message ?? 'Cannot be used'}</span
            >{:else}{meta(asset, status)}{/if}
        </div>
      </li>
    {/each}
  </ul>
</aside>
{#if cropping}
  <CropDialog {app} asset={cropping.asset} size={cropping.size} onclose={() => (cropping = null)} />
{/if}

<style>
  .bin {
    width: 264px;
    flex: none;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
    min-height: 0;
  }
  .tabs {
    padding: 10px 12px 6px;
  }
  .drop {
    margin: 8px 12px;
    padding: 16px 12px;
    flex-direction: column;
    border: 1.5px dashed var(--line-strong);
    border-radius: var(--radius-l);
    background: transparent;
    color: var(--tx-3);
    font-size: 12px;
    text-align: center;
  }
  .grid {
    list-style: none;
    margin: 0;
    padding: 8px 12px 12px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 10px;
    overflow: auto;
    align-content: start;
  }
  .media {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .thumb {
    position: relative;
    height: 64px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--bg-3) center / cover no-repeat;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--tx-3);
    overflow: hidden;
  }
  .thumb.audio {
    background-color: #17382b;
    color: var(--c-music);
  }
  .failed .thumb {
    border-color: var(--danger);
  }
  .badge {
    position: absolute;
    left: 5px;
    bottom: 5px;
    display: inline-flex;
    align-items: center;
    height: 16px;
    padding: 0 5px;
    border-radius: 3px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
  }
  .badge.r {
    left: auto;
    right: 5px;
    bottom: auto;
    top: 5px;
  }
  .badge.warn {
    background: rgba(245, 185, 66, 0.92);
    color: #1b1300;
  }
  .actions {
    position: absolute;
    right: 4px;
    bottom: 4px;
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .media:hover .actions,
  .media:focus-within .actions,
  .failed .actions {
    opacity: 1;
  }
  .actions button {
    background: rgba(16, 18, 22, 0.85);
  }
  .actions .add {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .name {
    font-size: 11.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: 10.5px;
    color: var(--tx-3);
  }
  .error {
    color: var(--danger);
  }
</style>
