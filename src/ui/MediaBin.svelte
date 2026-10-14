<script lang="ts">
  import type { App, AssetStatus } from '../app/app.ts';
  import { formatTime } from '../core/model/time.ts';
  import { fileNameOf } from '../core/project/relocate.ts';

  let { app }: { app: App } = $props();
  const store = $derived(app.store);

  function statusText(status: AssetStatus | undefined): string {
    if (!status) return 'Checking…';
    if (status.state === 'preparing')
      return `Preparing preview ${Math.round(status.progress * 100)} %`;
    if (status.state === 'failed') return status.message ?? 'Cannot be used';
    return 'Ready';
  }
</script>

<aside class="bin">
  <div class="panel-h">Media</div>
  {#if $store.history.present.media.length === 0}
    <p class="empty">No media yet — click Import to add videos, pictures or sound.</p>
  {/if}
  <ul>
    {#each $store.history.present.media as asset (asset.id)}
      {@const name = fileNameOf(asset.path)}
      {@const status = $store.assets[asset.id]}
      <li class="media">
        <div class="name">{name}</div>
        <div class="meta">
          {asset.kind}{asset.duration !== undefined ? ` · ${formatTime(asset.duration)}` : ''}
        </div>
        <div class="status" class:failed={status?.state === 'failed'}>{statusText(status)}</div>
        <button
          aria-label={`Add ${name} to the timeline`}
          onclick={() => app.addToTimeline(asset.id)}
        >
          Add
        </button>
      </li>
    {/each}
  </ul>
</aside>

<style>
  .bin {
    width: 260px;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
    overflow: auto;
  }
  .empty {
    padding: 12px;
    color: var(--tx-3);
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 8px;
  }
  .media {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 2px 8px;
    padding: 8px;
    border-radius: 6px;
    background: var(--bg-2);
    margin-bottom: 6px;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta,
  .status {
    grid-column: 1;
    font-size: 11.5px;
    color: var(--tx-3);
  }
  .status.failed {
    color: var(--danger);
  }
  button {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
  }
</style>
