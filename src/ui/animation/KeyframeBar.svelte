<script lang="ts">
  // AN9: the bar for the keyframe picked on the timeline: its easing, hold, the property's
  // repeat, Reverse, and Delete.
  import type { App } from '../../app/app.ts';
  import { EASINGS } from '../../core/animation/tween.ts';
  import type { Id, Keyframe, Track, TweenProperty } from '../../core/animation/types.ts';
  import Icon from '../Icon.svelte';
  import { PROPERTY_LABEL } from './timeline-rows.ts';

  let {
    app,
    picked = $bindable(),
    track,
    key,
  }: {
    app: App;
    /** The keyframe picked (Delete clears it). */
    picked: { id: Id; property: TweenProperty; frame: number } | null;
    /** Its property's track and the keyframe itself. */
    track: Track;
    key: Keyframe;
  } = $props();
  const anim = $derived(app.animation);

  function setRepeat(event: Event): void {
    if (!picked) return;
    const value = (event.currentTarget as HTMLSelectElement).value;
    anim.setRepeat(
      picked.id,
      picked.property,
      value === '' ? undefined : value === 'end' ? 'end' : Number(value),
    );
  }
</script>

{#if picked}
  <div class="key-bar" aria-label="Keyframe">
    <span class="key-name">{PROPERTY_LABEL[picked.property]} · frame {picked.frame}</span>
    <label
      >Easing
      <select
        aria-label="Easing"
        value={key.easing}
        title="How the change runs to the next keyframe"
        onchange={(e) =>
          picked &&
          anim.setEasing(
            picked.id,
            picked.property,
            picked.frame,
            (e.currentTarget as HTMLSelectElement).value as never,
          )}
      >
        {#each EASINGS as e (e.id)}
          <option value={e.id} title={e.hint}>{e.label}</option>
        {/each}
      </select></label
    >
    <label title="Keep this value until the next keyframe (no tween), for frame-by-frame work"
      ><input
        type="checkbox"
        aria-label="Hold"
        checked={key.hold}
        onchange={(e) =>
          picked &&
          anim.setHold(
            picked.id,
            picked.property,
            picked.frame,
            (e.currentTarget as HTMLInputElement).checked,
          )}
      /> Hold</label
    >
    <label
      >Repeat
      <select
        aria-label="Repeat"
        value={track.repeat === undefined ? '' : String(track.repeat)}
        title="Play this property's keyframes again after the last one"
        onchange={setRepeat}
      >
        <option value="">No repeat</option>
        <option value="end">Until the end</option>
        {#each [1, 2, 3, 4, 5] as n (n)}
          <option value={String(n)}>{n} more time{n === 1 ? '' : 's'}</option>
        {/each}
      </select></label
    >
    <button
      class="sm"
      title="Copy the keyframes mirrored after the last one, so the motion runs back"
      onclick={() => picked && anim.reverse(picked.id, picked.property)}>Reverse</button
    >
    <button
      class="sm"
      aria-label="Delete keyframe"
      title="Delete this keyframe"
      onclick={() => {
        if (!picked) return;
        anim.removeKeyframe(picked.id, picked.property, picked.frame);
        picked = null;
      }}><Icon name="delete" size={14} /></button
    >
  </div>
{/if}

<style>
  .key-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
    background: var(--bg-2);
  }
  .key-bar label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--tx-2);
  }
  .key-name {
    font-weight: 600;
    margin-right: 6px;
  }
  select {
    height: 26px;
    font-size: 12px;
    padding: 0 6px;
  }
</style>
