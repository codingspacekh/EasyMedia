<script lang="ts">
  // Layers (AN7): the top layer is in front. Each layer can be hidden, locked, renamed, moved,
  // coloured and put in a folder; new objects go on the selected layer.
  import type { App } from '../../app/app.ts';
  import type { Layer } from '../../core/animation/types.ts';
  import Icon from '../Icon.svelte';
  import Why from '../Why.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const doc = $derived($store.history.present);
  /** Top first, grouped by folder (a folder's layers under its header). */
  const rows = $derived.by(() => {
    const top = [...doc.layers].reverse();
    const loose = top.filter((l) => !l.folderId || !doc.folders.some((f) => f.id === l.folderId));
    const out: (
      { kind: 'folder'; id: string; name: string; open: boolean } | { kind: 'layer'; layer: Layer }
    )[] = [];
    for (const folder of doc.folders) {
      out.push({ kind: 'folder', id: folder.id, name: folder.name, open: folder.open });
      if (folder.open)
        for (const layer of top.filter((l) => l.folderId === folder.id))
          out.push({ kind: 'layer', layer });
    }
    for (const layer of loose) out.push({ kind: 'layer', layer });
    return out;
  });
  const selectedIndex = $derived(doc.layers.findIndex((l) => l.id === $store.layerId));
  let renaming: string | null = $state(null);
  let renameError: string | null = $state(null);

  function commitRename(id: string, event: Event): void {
    const name = (event.currentTarget as HTMLInputElement).value;
    renameError = anim.renameLayer(id, name);
    if (!renameError) renaming = null;
  }
  const count = (l: Layer) => `${l.objects.length} object${l.objects.length === 1 ? '' : 's'}`;
</script>

<aside class="layers" aria-label="Layers">
  <div class="panel-h">Layers</div>
  <div class="actions">
    <button class="sm" title="New layer above the selected one" onclick={() => anim.addLayer()}>
      <Icon name="plus" size={14} /> Layer
    </button>
    <button class="sm" title="New folder for layers" onclick={() => anim.addFolder()}>
      <Icon name="folder" size={14} /> Folder
    </button>
    <span class="spacer"></span>
    <button
      class="sm icon-only"
      aria-label="Move layer up"
      title="Move the layer up (in front)"
      disabled={selectedIndex < 0 || selectedIndex >= doc.layers.length - 1}
      onclick={() => anim.moveLayer($store.layerId, selectedIndex + 1)}
      ><Icon name="up" size={14} /></button
    >
    <button
      class="sm icon-only"
      aria-label="Move layer down"
      title="Move the layer down (behind)"
      disabled={selectedIndex <= 0}
      onclick={() => anim.moveLayer($store.layerId, selectedIndex - 1)}
      ><Icon name="down" size={14} /></button
    >
    <button
      class="sm icon-only"
      aria-label="Delete layer"
      title="Delete the selected layer and its objects"
      disabled={doc.layers.length <= 1}
      onclick={() => anim.removeLayer($store.layerId)}><Icon name="delete" size={14} /></button
    >
  </div>
  <ul class="list" role="listbox" aria-label="Layer list">
    {#each rows as row (row.kind === 'folder' ? `f${row.id}` : row.layer.id)}
      {#if row.kind === 'folder'}
        <li class="folder">
          <button
            class="ghost sm icon-only"
            aria-label="{row.open ? 'Close' : 'Open'} folder {row.name}"
            onclick={() => anim.setFolderOpen(row.id, !row.open)}
          >
            <Icon name="chevron" size={12} />
          </button>
          <Icon name="folder" size={14} />
          <span class="name">{row.name}</span>
          <button
            class="ghost sm icon-only"
            aria-label="Delete folder {row.name}"
            title="Delete the folder (its layers stay)"
            onclick={() => anim.removeFolder(row.id)}
          >
            <Icon name="delete" size={12} />
          </button>
        </li>
      {:else}
        {@const layer = row.layer}
        <li
          class="layer"
          class:cur={layer.id === $store.layerId}
          class:infolder={layer.folderId !== undefined}
          role="option"
          aria-selected={layer.id === $store.layerId}
          aria-label={layer.name}
          tabindex="0"
          onclick={() => anim.selectLayer(layer.id)}
          onkeydown={(e) => e.key === 'Enter' && anim.selectLayer(layer.id)}
          ondblclick={() => (renaming = layer.id)}
        >
          <span class="tag" style:background={layer.colour ?? 'var(--accent)'}></span>
          <button
            class="ghost sm icon-only"
            aria-label="{layer.visible ? 'Hide' : 'Show'} {layer.name}"
            aria-pressed={!layer.visible}
            title={layer.visible ? 'Hide the layer' : 'Show the layer'}
            onclick={(e) => {
              e.stopPropagation();
              anim.toggleLayer(layer.id, 'visible');
            }}><Icon name={layer.visible ? 'eye' : 'eyeOff'} size={14} /></button
          >
          <button
            class="ghost sm icon-only"
            aria-label="{layer.locked ? 'Unlock' : 'Lock'} {layer.name}"
            aria-pressed={layer.locked}
            title={layer.locked ? 'Unlock the layer' : 'Lock the layer (the padlock)'}
            onclick={(e) => {
              e.stopPropagation();
              anim.toggleLayer(layer.id, 'locked');
            }}><Icon name={layer.locked ? 'lock' : 'unlock'} size={14} /></button
          >
          {#if renaming === layer.id}
            <input
              class="rename"
              aria-label="Layer name"
              value={layer.name}
              aria-invalid={renameError !== null}
              onchange={(e) => commitRename(layer.id, e)}
              onblur={(e) => commitRename(layer.id, e)}
              onkeydown={(e) => e.key === 'Escape' && (renaming = null)}
              onclick={(e) => e.stopPropagation()}
            />
          {:else}
            <span class="name" title="Double-click to rename">{layer.name}</span>
            {#if !(doc.folders.length && layer.id === $store.layerId)}
              <span class="count">{count(layer)}</span>
            {/if}
          {/if}
          {#if doc.folders.length && layer.id === $store.layerId}
            <select
              class="folder-pick"
              aria-label="Folder of {layer.name}"
              value={layer.folderId ?? ''}
              onclick={(e) => e.stopPropagation()}
              onchange={(e) =>
                anim.moveLayerToFolder(
                  layer.id,
                  (e.currentTarget as HTMLSelectElement).value || null,
                )}
            >
              <option value="">No folder</option>
              {#each doc.folders as f (f.id)}<option value={f.id}>{f.name}</option>{/each}
            </select>
          {/if}
        </li>
      {/if}
    {/each}
  </ul>
  {#if renameError}<p class="error" role="alert">{renameError}</p>{/if}
  <div class="why"><Why tool="animLayers" /></div>
</aside>

<style>
  .layers {
    width: 230px;
    flex: none;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
  }
  .actions {
    display: flex;
    gap: 4px;
    padding: 6px 8px;
    border-bottom: 1px solid var(--line);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow: auto;
    flex: 1;
  }
  .layer,
  .folder {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px 8px 3px 6px;
    font-size: 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
  }
  .layer.infolder {
    padding-left: 18px;
  }
  .layer.cur {
    background: var(--bg-3);
    border-left-color: var(--accent);
  }
  .folder {
    color: var(--tx-2);
    cursor: default;
  }
  .tag {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex: none;
    margin-right: 2px;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding-left: 4px;
  }
  .count {
    color: var(--tx-3);
    font-size: 10.5px;
    white-space: nowrap;
  }
  .rename {
    flex: 1;
    min-width: 0;
    font: inherit;
    background: var(--bg-2);
    color: var(--tx-1);
    border: 1px solid var(--accent);
    border-radius: 3px;
    padding: 1px 4px;
  }
  .folder-pick {
    font-size: 10.5px;
    max-width: 90px;
    background: var(--bg-2);
    color: var(--tx-2);
    border: 1px solid var(--line);
    border-radius: 3px;
  }
  .error {
    margin: 0;
    padding: 4px 10px;
    color: var(--danger);
    font-size: 11.5px;
  }
  .why {
    padding: 6px 10px 8px;
    border-top: 1px solid var(--line);
  }
</style>
