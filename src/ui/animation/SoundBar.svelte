<script lang="ts">
  // AN28: the bar for the sound picked on the timeline: where it starts (a frame or a time), its
  // volume, its fades, its trim (where in the file it starts and how long it plays), Mute and
  // Delete. Each change is one undo step; a value that cannot be used is explained under the bar.
  import type { App } from '../../app/app.ts';
  import type { SoundChange } from '../../app/animation/sounds.ts';
  import { heardSeconds, MAX_VOLUME } from '../../core/animation/sound.ts';
  import { timeLabel } from '../../core/animation/time.ts';
  import type { AnimSound } from '../../core/animation/types.ts';
  import Icon from '../Icon.svelte';
  import Why from '../Why.svelte';

  let {
    app,
    sound,
    error = $bindable(),
  }: {
    app: App;
    /** The sound picked on the timeline (the bar goes when it is deleted). */
    sound: AnimSound;
    error: string | null;
  } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const fps = $derived($store.history.present.stage.fps);

  const round = (n: number) => Math.round(n * 100) / 100;

  /**
   * A number typed in a field: empty (or 0 for a trim or fade) takes the trim or fade off; the
   * volume's empty is 100 %. A refused value goes back to what the sound has (`shown`).
   */
  function change(key: keyof SoundChange, event: Event, shown: string): void {
    const input = event.currentTarget as HTMLInputElement;
    const text = input.value.trim();
    const typed = text === '' ? (key === 'volume' ? 100 : undefined) : Number(text);
    error =
      typed !== undefined && !Number.isFinite(typed)
        ? 'Type a number.'
        : anim.setSound(sound.id, {
            [key]: typed === 0 && key !== 'volume' ? undefined : typed,
          });
    if (error) input.value = shown;
  }

  function setStart(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    error = anim.setSoundStart(sound.id, input.value);
    if (error) input.value = String(sound.start);
  }
</script>

<div class="sound-bar" aria-label="Sound">
  <span class="sound-name" title={sound.name}
    ><Icon name={sound.effect ? 'sfx' : 'music'} size={14} /> {sound.name}</span
  >
  <label
    >Starts at
    <input
      class="num"
      aria-label="Starts at frame"
      title="The frame it starts at: type a frame (24) or a time (1 s, 0:01.00). Or drag its bar"
      value={String(sound.start)}
      onchange={setStart}
    />
    <span class="unit">{timeLabel(sound.start, fps)}</span></label
  >
  <label
    >Volume
    <input
      class="num"
      type="number"
      min="0"
      max={MAX_VOLUME}
      step="5"
      aria-label="Volume"
      title="100 % is the file as it is; 0 % is silent; up to 200 % (twice as loud)"
      value={sound.volume}
      onchange={(e) => change('volume', e, String(sound.volume))}
    /> %</label
  >
  <label
    >Fade in
    <input
      class="num"
      type="number"
      min="0"
      step="0.1"
      aria-label="Fade in"
      title="Seconds it takes to come up from silence (0: none)"
      value={sound.fadeIn ?? 0}
      onchange={(e) => change('fadeIn', e, String(sound.fadeIn ?? 0))}
    /> s</label
  >
  <label
    >Fade out
    <input
      class="num"
      type="number"
      min="0"
      step="0.1"
      aria-label="Fade out"
      title="Seconds it takes to go down to silence at its end (0: none)"
      value={sound.fadeOut ?? 0}
      onchange={(e) => change('fadeOut', e, String(sound.fadeOut ?? 0))}
    /> s</label
  >
  <label
    >From
    <input
      class="num"
      type="number"
      min="0"
      step="0.1"
      aria-label="Start in the file"
      title="Trim: the seconds of the file skipped at its start (0: from its start)"
      value={round(sound.offset ?? 0)}
      onchange={(e) => change('offset', e, String(round(sound.offset ?? 0)))}
    /> s</label
  >
  <label
    >Plays for
    <input
      class="num"
      type="number"
      min="0.01"
      step="0.1"
      aria-label="Length heard"
      title="Trim: how many seconds of it are heard (empty: to the end of the file)"
      placeholder={String(round(sound.duration - (sound.offset ?? 0)))}
      value={sound.length === undefined ? '' : round(sound.length)}
      onchange={(e) =>
        change('length', e, sound.length === undefined ? '' : String(round(sound.length)))}
    />
    s
    <span class="unit">of {round(sound.duration)} s</span></label
  >
  <label title="Not heard while it plays or in an export (it stays on the timeline)"
    ><input
      type="checkbox"
      aria-label="Mute"
      checked={sound.muted === true}
      onchange={(e) =>
        (error = anim.setSound(sound.id, {
          muted: (e.currentTarget as HTMLInputElement).checked || undefined,
        }))}
    /> Mute</label
  >
  <span class="unit" aria-label="Heard for">{round(heardSeconds(sound))} s heard</span>
  <button
    class="sm"
    aria-label="Delete sound"
    title="Delete this sound from the animation"
    onclick={() => anim.removeSound(sound.id)}><Icon name="delete" size={14} /></button
  >
  <Why tool="animSound" />
</div>

<style>
  .sound-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
    background: var(--bg-2);
  }
  .sound-bar label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--tx-2);
  }
  .sound-name {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .num {
    width: 60px;
    height: 26px;
    font-size: 12px;
    padding: 0 6px;
  }
  .unit {
    color: var(--tx-3);
    font-family: var(--mono);
    font-size: 11px;
  }
</style>
