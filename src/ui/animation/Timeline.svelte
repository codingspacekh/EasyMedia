<script lang="ts">
  // The timeline (M14, AN8, AN9): under the stage. Frames across the top, numbered every 5 with
  // the seconds under them; one row per layer, its objects under it, and the selected (or opened)
  // object's animated properties under that, with keyframe dots, tween bars (a dash for a hold)
  // and the repeat mark. The playhead is dragged on the ruler or typed; a dot is clicked to edit
  // its easing, hold and repeat, dragged to move it, Alt-dragged to copy it. AN28: under the
  // layers, the Sounds row (Add sound…, Add a sound effect…) and one row per sound: a bar from its
  // start for as long as it is heard, with its name, dragged to move it and clicked for its bar
  // (volume, fades, trim, Mute, Delete).
  import type { App } from '../../app/app.ts';
  import { timeLabel } from '../../core/animation/time.ts';
  import type { Id, TweenProperty } from '../../core/animation/types.ts';
  import Icon from '../Icon.svelte';
  import KeyframeBar from './KeyframeBar.svelte';
  import SoundBar from './SoundBar.svelte';
  import { endFrame } from '../../core/animation/sound.ts';
  import { ui } from '../ui-state.svelte.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import TimelineBar from './TimelineBar.svelte';
  import {
    frameLabels as labelsAt,
    labelStep,
    PROPERTY_LABEL as LABEL,
    secondLabels as secondsIn,
    timelineRows,
  } from './timeline-rows.ts';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const doc = $derived($store.history.present);
  const stage = $derived(doc.stage);
  const frame = $derived($store.frame);

  /** A frame's width in px (the frame zoom). */
  let px = $state(8);
  /** Room before frame 0, so its number and dots are not cut off. */
  const PAD = 12;
  const xOf = (f: number) => PAD + f * px;
  const span = $derived(2 * PAD + stage.length * px);
  const frameLabels = $derived(labelsAt(stage.length, labelStep(px)));
  const secondLabels = $derived(secondsIn(stage.length, stage.fps));

  let error: string | null = $state(null);

  // ---- rows ----
  let closedLayers: Record<Id, boolean> = $state({});
  let openObjects: Record<Id, boolean> = $state({});
  const rows = $derived(
    timelineRows(doc, frame, { closedLayers, openObjects, selection: $store.selection }),
  );

  // ---- the playhead ----
  let ruler: HTMLDivElement | undefined = $state();
  const frameAt = (clientX: number): number => {
    const left = ruler?.getBoundingClientRect().left ?? 0;
    return Math.round((clientX - left - PAD) / px);
  };

  function onRulerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    anim.pause();
    anim.setFrame(frameAt(e.clientX));
    const move = (ev: PointerEvent) => anim.setFrame(frameAt(ev.clientX));
    const up = (ev: PointerEvent) => {
      anim.setFrame(frameAt(ev.clientX));
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function onRulerKey(e: KeyboardEvent): void {
    const by: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowUp: 5, ArrowDown: -5 };
    if (e.key in by) {
      e.preventDefault();
      anim.step(e.shiftKey ? by[e.key]! * 10 : by[e.key]!);
    } else if (e.key === 'Home') {
      e.preventDefault();
      anim.setFrame(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      anim.setFrame(stage.length);
    }
  }

  // ---- keyframes ----
  let picked: { id: Id; property: TweenProperty; frame: number } | null = $state(null);
  let dragging: { id: Id; property: TweenProperty; frame: number; to: number } | null =
    $state(null);
  let moved = false;

  const pickedTrack = $derived.by(() => {
    if (!picked) return null;
    const p = picked;
    const object = doc.layers.flatMap((l) => l.objects).find((o) => o.id === p.id);
    const track = object?.tracks?.find((t) => t.property === p.property);
    const key = track?.keyframes.find((k) => k.frame === p.frame);
    return track && key && object ? { object, track, key } : null;
  });

  function onKeyDown(e: PointerEvent, id: Id, property: TweenProperty, at: number): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    picked = { id, property, frame: at };
    pickedSound = null;
    const startX = e.clientX;
    const copy = e.altKey;
    dragging = { id, property, frame: at, to: at };
    const move = (ev: PointerEvent) => {
      if (dragging)
        dragging = { ...dragging, to: Math.max(0, at + Math.round((ev.clientX - startX) / px)) };
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const to = Math.max(0, at + Math.round((ev.clientX - startX) / px));
      dragging = null;
      if (to === at) return;
      // The click that follows a drag must not pick the old frame again.
      moved = true;
      setTimeout(() => (moved = false), 0);
      if (copy || ev.altKey) anim.copyKeyframe(id, property, at, to);
      else {
        anim.moveKeyframe(id, property, at, to);
        picked = { id, property, frame: to };
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  // ---- AN28: sounds ----
  const sounds = $derived(doc.sounds ?? []);
  let pickedSound: Id | null = $state(null);
  const pickedSoundOf = $derived(sounds.find((x) => x.id === pickedSound) ?? null);
  /** The sound being dragged and the frame it would start at. */
  let soundDrag: { id: Id; to: number } | null = $state(null);

  function onSoundDown(e: PointerEvent, id: Id, start: number): void {
    if (e.button !== 0) return;
    e.stopPropagation();
    pickedSound = id;
    picked = null;
    const startX = e.clientX;
    const at = (ev: PointerEvent) => Math.max(0, start + Math.round((ev.clientX - startX) / px));
    soundDrag = { id, to: start };
    const move = (ev: PointerEvent) => (soundDrag = { id, to: at(ev) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      soundDrag = null;
      const to = at(ev);
      if (to !== start) anim.moveSound(id, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  /** Where a sound's bar starts: where it is dragged to, or its start. */
  const soundStart = (id: Id, start: number): number =>
    soundDrag && soundDrag.id === id ? soundDrag.to : start;

  const shownFrame = (id: Id, property: TweenProperty, at: number): number =>
    dragging && dragging.id === id && dragging.property === property && dragging.frame === at
      ? dragging.to
      : at;
</script>

<section class="timeline" aria-label="Timeline">
  <TimelineBar {app} bind:px bind:error />

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if pickedTrack}
    <KeyframeBar {app} bind:picked track={pickedTrack.track} key={pickedTrack.key} />
  {:else if pickedSoundOf}
    <SoundBar {app} bind:error sound={pickedSoundOf} />
  {/if}

  <div class="grid">
    <div class="corner"></div>
    <div
      class="ruler"
      bind:this={ruler}
      style:width="{span}px"
      role="slider"
      tabindex="0"
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={stage.length}
      aria-valuenow={frame}
      aria-valuetext={timeLabel(frame, stage.fps)}
      onpointerdown={onRulerDown}
      onkeydown={onRulerKey}
    >
      {#each frameLabels as n (n)}
        <span class="tick" style:left="{xOf(n)}px">{n}</span>
      {/each}
      {#each secondLabels as s (s)}
        <span class="sec" style:left="{xOf(s * stage.fps)}px">{s} s</span>
      {/each}
      <span class="head" style:left="{xOf(frame)}px" aria-hidden="true"></span>
    </div>

    {#each rows as row (row.kind === 'property' ? `${row.id}:${row.track.property}` : row.kind === 'motion' ? `${row.id}:path${row.n}` : `${row.kind}:${row.id}`)}
      <div class="label {row.kind}">
        {#if row.kind === 'layer'}
          <button
            class="ghost sm icon-only twist"
            class:open={row.open}
            aria-label="{row.open ? 'Hide' : 'Show'} the objects in {row.name}"
            onclick={() => (closedLayers = { ...closedLayers, [row.id]: row.open })}
            ><Icon name="chevron" size={12} /></button
          >
          <span class="name" title={row.name}>{row.name}</span>
        {:else if row.kind === 'object'}
          {#if row.animated}
            <button
              class="ghost sm icon-only twist"
              class:open={row.open}
              aria-label="{row.open ? 'Hide' : 'Show'} the animated properties of {row.name}"
              onclick={() => (openObjects = { ...openObjects, [row.id]: !row.open })}
              ><Icon name="chevron" size={12} /></button
            >
          {:else}
            <span class="twist-space"></span>
          {/if}
          <button
            class="ghost sm name"
            class:selected={$store.selection.includes(row.id)}
            title="Select {row.name}"
            onclick={() => anim.select([row.id])}>{row.name}</button
          >
        {:else if row.kind === 'motion'}
          <span class="name prop">Path {row.n}{row.motion.orient ? ' (oriented)' : ''}</span>
        {:else}
          <span class="name prop"
            >{LABEL[row.track.property]}{row.track.repeat !== undefined ? ' ↻' : ''}</span
          >
        {/if}
      </div>
      <div class="lane {row.kind}" style:width="{span}px">
        {#if row.kind === 'property'}
          {@const keys = row.track.keyframes}
          {#each keys.slice(0, -1) as k, i (k.frame)}
            <span
              class="tween"
              class:hold={k.hold}
              style:left="{xOf(k.frame)}px"
              style:width="{(keys[i + 1]!.frame - k.frame) * px}px"
              aria-hidden="true"
            ></span>
          {/each}
          {#if row.track.repeat !== undefined && keys.length >= 2}
            <span
              class="repeat"
              style:left="{xOf(keys.at(-1)!.frame)}px"
              style:width="{Math.max(0, stage.length - keys.at(-1)!.frame) * px}px"
              title="Repeats {row.track.repeat === 'end'
                ? 'until the end'
                : `${row.track.repeat} more time(s)`}"
            ></span>
          {/if}
          {#each keys as k (k.frame)}
            <button
              class="key"
              class:picked={picked?.id === row.id &&
                picked.property === row.track.property &&
                picked.frame === k.frame}
              class:held={k.hold}
              style:left="{xOf(shownFrame(row.id, row.track.property, k.frame))}px"
              aria-label="{LABEL[row.track.property]} keyframe at frame {k.frame}"
              title="{LABEL[row.track.property]} = {typeof k.value === 'object'
                ? 'a shape'
                : k.value} at frame {k.frame}. Drag to move; Alt-drag to copy."
              onpointerdown={(e) => onKeyDown(e, row.id, row.track.property, k.frame)}
              onclick={() => {
                if (!moved) picked = { id: row.id, property: row.track.property, frame: k.frame };
              }}
            ></button>
          {/each}
        {:else if row.kind === 'motion'}
          <span
            class="path-bar"
            style:left="{xOf(row.motion.from)}px"
            style:width="{(row.motion.to - row.motion.from) * px}px"
            aria-label="Path from frame {row.motion.from} to {row.motion.to}"
            title="Follows {row.motion.source ?? 'a path'} from frame {row.motion.from} to {row
              .motion.to}"
          ></span>
        {:else}
          {#if row.kind === 'layer' && row.drawings}
            {#each row.drawings as f, i (f)}
              <span
                class="drawing"
                style:left="{xOf(f)}px"
                style:width="{((row.drawings[i + 1] ?? stage.length) - f) * px}px"
                title="Drawing from frame {f}"
                aria-label="Keyframe of a drawing at frame {f}"
              ></span>
            {/each}
          {/if}
          {#each row.frames as f (f)}
            <span class="dot" style:left="{xOf(f)}px" aria-hidden="true"></span>
          {/each}
        {/if}
      </div>
    {/each}

    <div class="label sounds-head">
      <span class="name">Sounds</span>
      <button
        class="ghost sm icon-only"
        aria-label="Add sound…"
        title={withWhy(
          'Add sound…: a sound file (MP3, WAV, M4A, AAC, OGG or FLAC) at the playhead',
          'animSound',
        )}
        onclick={() => void anim.addSound()}><Icon name="music" size={14} /></button
      >
      <button
        class="ghost sm icon-only"
        aria-label="Add a sound effect…"
        title={withWhy('Add a sound effect…: a built-in sound at the playhead', 'animSound')}
        onclick={() => (ui.soundEffects = true)}><Icon name="sfx" size={14} /></button
      >
    </div>
    <div class="lane sounds-head" style:width="{span}px">
      {#if sounds.length === 0}
        <span class="empty">No sounds yet: add one at the playhead (an alarm, a door, music…)</span>
      {/if}
    </div>
    {#each sounds as sound (sound.id)}
      {@const start = soundStart(sound.id, sound.start)}
      <div class="label sound">
        <button
          class="ghost sm name"
          class:selected={pickedSound === sound.id}
          title="{sound.name}: its volume, fades and trim"
          onclick={() => {
            pickedSound = sound.id;
            picked = null;
          }}
          ><Icon name={sound.muted ? 'mute' : sound.effect ? 'sfx' : 'music'} size={12} />
          {sound.name}</button
        >
      </div>
      <div class="lane sound" style:width="{span}px">
        <button
          class="sound-bar"
          class:muted={sound.muted}
          class:picked={pickedSound === sound.id}
          style:left="{xOf(start)}px"
          style:width="{Math.max(4, (endFrame(sound, stage.fps) - sound.start) * px)}px"
          aria-label="{sound.name} from frame {start}"
          title="{sound.name} from frame {start} ({timeLabel(
            start,
            stage.fps,
          )}). Drag to move; click for its volume, fades and trim."
          onpointerdown={(e) => onSoundDown(e, sound.id, sound.start)}
          onclick={() => {
            pickedSound = sound.id;
            picked = null;
          }}>{sound.name}</button
        >
      </div>
    {/each}
    <span class="line" style:left="calc(var(--label-w) + {xOf(frame)}px)" aria-hidden="true"></span>
  </div>
</section>

<style>
  .timeline {
    --label-w: 150px;
    display: flex;
    flex-direction: column;
    /* The rows keep their height; a bar that wraps on a small window (or the keyframe bar)
       makes the timeline taller rather than hiding rows: the stage fits what is left. */
    flex: none;
    border-top: 1px solid var(--line);
    background: var(--bg-1);
    font-size: 12px;
  }
  /* The chevron icon points down: turned for closed rows. */
  .error {
    margin: 0;
    padding: 2px 8px;
    color: var(--danger);
  }
  .grid {
    position: relative;
    flex: none;
    /* N16: the rows' height is the panel slot's (the bar above may wrap on a small window). */
    height: var(--panel-size, 152px);
    overflow: auto;
    display: grid;
    grid-template-columns: var(--label-w) max-content;
    /* The ruler's own row is taller than the others, so it never covers the first layer. */
    grid-template-rows: 30px;
    grid-auto-rows: 22px;
    align-content: start;
    /* A row scrolled into view (a click, the keyboard) stops below the sticky ruler and beside
       the sticky names, not under them: on a small window the rows scroll. */
    scroll-padding-top: 30px;
    scroll-padding-left: var(--label-w);
  }
  .corner,
  .label {
    position: sticky;
    left: 0;
    z-index: 2;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
  }
  .corner {
    top: 0;
    z-index: 3;
  }
  .ruler {
    position: sticky;
    top: 0;
    z-index: 1;
    height: 30px;
    grid-row: span 1;
    background: var(--bg-2);
    border-bottom: 1px solid var(--line);
    cursor: ew-resize;
    touch-action: none;
  }
  .ruler:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .tick,
  .sec {
    position: absolute;
    transform: translateX(-50%);
    color: var(--tx-2);
    font-family: var(--mono);
    font-size: 10px;
    pointer-events: none;
    white-space: nowrap;
  }
  .tick {
    top: 1px;
  }
  .sec {
    top: 15px;
    color: var(--tx-3);
  }
  .head {
    position: absolute;
    bottom: 0;
    width: 9px;
    height: 9px;
    margin-left: -4px;
    background: var(--accent);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }
  .label {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 4px;
    overflow: hidden;
    border-bottom: 1px solid var(--line);
  }
  .label.object {
    padding-left: 14px;
  }
  .label.property,
  .label.motion {
    padding-left: 36px;
    color: var(--tx-2);
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .label.layer .name {
    font-weight: 600;
  }
  .selected {
    color: var(--accent);
  }
  .twist :global(svg) {
    transform: rotate(-90deg);
    transition: transform 0.1s;
  }
  .twist.open :global(svg) {
    transform: none;
  }
  .twist-space {
    width: 22px;
    flex: none;
  }
  .lane {
    position: relative;
    border-bottom: 1px solid var(--line);
  }
  .lane.layer {
    background: var(--bg-2);
  }
  /* AN14: a drawing held from its keyframe (a filled circle, as Animate's) to the next one. */
  .drawing {
    position: absolute;
    top: 3px;
    bottom: 3px;
    border-left: 1px solid var(--tx-2);
    background: var(--bg-3, var(--line));
  }
  .drawing::before {
    content: '';
    position: absolute;
    left: -4px;
    top: 50%;
    width: 7px;
    height: 7px;
    margin-top: -3.5px;
    border-radius: 50%;
    background: var(--tx-1);
  }
  .dot,
  .key {
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    margin: -4.5px 0 0 -4.5px;
    transform: rotate(45deg);
    background: var(--tx-3);
  }
  .key {
    padding: 0;
    border: 1px solid var(--bg-0);
    border-radius: 1px;
    background: var(--accent);
    cursor: grab;
    z-index: 1;
  }
  .key.held {
    background: var(--warn);
  }
  .key.picked {
    outline: 2px solid var(--tx-1);
  }
  .tween {
    position: absolute;
    top: 50%;
    height: 4px;
    margin-top: -2px;
    background: var(--accent-soft);
  }
  .tween.hold {
    height: 0;
    margin-top: 0;
    border-top: 2px dashed var(--tx-3);
    background: none;
  }
  .path-bar {
    position: absolute;
    top: 50%;
    height: 6px;
    margin-top: -3px;
    border-radius: 3px;
    background: var(--accent);
    opacity: 0.55;
  }
  .repeat {
    position: absolute;
    top: 50%;
    height: 0;
    border-top: 2px dotted var(--accent);
  }
  /* AN28: the sounds, under the layers. */
  .label.sounds-head .name {
    flex: 1;
    font-weight: 600;
  }
  .lane.sounds-head {
    background: var(--bg-2);
  }
  .empty {
    position: sticky;
    left: 8px;
    line-height: 21px;
    color: var(--tx-3);
    white-space: nowrap;
  }
  .label.sound {
    padding-left: 14px;
  }
  .sound-bar {
    position: absolute;
    top: 3px;
    bottom: 3px;
    padding: 0 4px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--accent-soft);
    color: var(--tx-1);
    font-size: 11px;
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: grab;
    z-index: 1;
  }
  .sound-bar.muted {
    opacity: 0.45;
    border-style: dashed;
  }
  .sound-bar.picked {
    outline: 2px solid var(--tx-1);
  }
  .line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--accent);
    pointer-events: none;
    z-index: 1;
  }
</style>
