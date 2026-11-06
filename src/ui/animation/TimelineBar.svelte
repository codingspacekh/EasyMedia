<script lang="ts">
  // The animation timeline's bar (AN8, AN14): stop, previous / next frame, play, loop (the whole
  // animation or typed frames), the time and Go to; on a frame-by-frame layer its keyframe
  // buttons and onion skin (else Frame-by-frame); Keyframe; and the frame zoom.
  import type { App } from '../../app/app.ts';
  import { parseFrame, timeLabel } from '../../core/animation/time.ts';
  import { withWhy } from '../../core/effects/help.ts';
  import Icon from '../Icon.svelte';
  import Why from '../Why.svelte';

  let {
    app,
    px = $bindable(),
    error = $bindable(),
  }: {
    app: App;
    /** A frame's width in px (the frame zoom). */
    px: number;
    /** Why the last action was refused (shown under the bar by the timeline). */
    error: string | null;
  } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const doc = $derived($store.history.present);
  const stage = $derived(doc.stage);
  const frame = $derived($store.frame);

  function goTo(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    error = anim.goTo(input.value);
    if (!error) input.value = '';
  }

  // ---- loop ----
  let fromBox: HTMLInputElement | undefined = $state();
  let toBox: HTMLInputElement | undefined = $state();
  function toggleLoop(): void {
    error = anim.setLoop({ on: !$store.loop.on });
  }
  /** Both boxes empty: the whole animation; both filled: that range (both ends shown). */
  function setRange(): void {
    const loopFrom = fromBox?.value ?? '';
    const loopTo = toBox?.value ?? '';
    const from = parseFrame(loopFrom, stage.fps);
    const to = parseFrame(loopTo, stage.fps);
    if (loopFrom.trim() === '' && loopTo.trim() === '') {
      error = anim.setLoop({ on: true });
      return;
    }
    if (from === null || to === null) {
      error = from === null && loopFrom.trim() !== '' ? 'Type the first frame of the loop.' : null;
      return;
    }
    error = anim.setLoop({ on: true, from, to });
  }

  // ---- frame-by-frame (AN14) ----
  const current = $derived(doc.layers.find((l) => l.id === $store.layerId));
  const onDrawingKey = $derived(current?.drawings?.includes(frame) ?? false);

  function insertKeyframes(): void {
    for (const id of $store.selection) anim.insertKeyframe(id, 'all');
  }
</script>

<div class="bar">
  <button
    class="sm icon-only"
    aria-label="Stop"
    title="Stop and go back to frame 0"
    onclick={() => anim.stop()}><Icon name="stop" size={14} /></button
  >
  <button
    class="sm icon-only"
    aria-label="Previous frame"
    title="Previous frame (,)"
    onclick={() => anim.step(-1)}
    ><span class="left"><Icon name="chevron" size={14} /></span></button
  >
  <button
    class="sm icon-only"
    aria-label={$store.playing ? 'Pause' : 'Play'}
    title="Play or pause (Space)"
    onclick={() => anim.togglePlay()}
    ><Icon name={$store.playing ? 'pause' : 'play'} size={14} /></button
  >
  <button
    class="sm icon-only"
    aria-label="Next frame"
    title="Next frame (.)"
    onclick={() => anim.step(1)}
    ><span class="right"><Icon name="chevron" size={14} /></span></button
  >
  <button
    class="sm icon-only"
    class:on={$store.loop.on}
    aria-label="Loop"
    aria-pressed={$store.loop.on}
    title="Loop: play again and again, the whole animation or the frames you type"
    onclick={toggleLoop}><Icon name="loop" size={14} /></button
  >
  {#if $store.loop.on}
    <input
      class="frame-box"
      aria-label="Loop from"
      placeholder="from"
      title="First frame of the loop (empty: the whole animation)"
      bind:this={fromBox}
      onchange={setRange}
    />
    <input
      class="frame-box"
      aria-label="Loop to"
      placeholder="to"
      title="Last frame of the loop"
      bind:this={toBox}
      onchange={setRange}
    />
  {/if}
  <span class="time mono">{timeLabel(frame, stage.fps)}</span>
  <input
    class="frame-box"
    aria-label="Go to frame"
    placeholder="Go to…"
    title="Type a frame (72), seconds (3 s) or a time (0:03.00) and press Enter"
    onchange={goTo}
  />
  <span class="spacer"></span>
  {#if current?.drawings}
    <span class="fbf" role="group" aria-label="Frame-by-frame">
      <button
        class="sm"
        aria-label="Insert blank keyframe"
        title={withWhy(
          `A blank keyframe at the playhead on ${current.name}: the next drawing starts empty (F7)`,
          'animFrameByFrame',
        )}
        onclick={() => (error = anim.insertDrawing('blank'))}>Blank keyframe</button
      >
      <button
        class="sm"
        aria-label="Duplicate frame"
        title={withWhy(
          `A keyframe at the playhead on ${current.name} holding a copy of the drawing, to change it a little (F6)`,
          'animFrameByFrame',
        )}
        onclick={() => (error = anim.insertDrawing('copy'))}>Duplicate frame</button
      >
      <button
        class="sm icon-only"
        aria-label="Remove keyframe"
        title="Remove the keyframe at the playhead and its drawing (Shift + F6)"
        disabled={!onDrawingKey}
        onclick={() => (error = anim.removeDrawing())}><Icon name="delete" size={14} /></button
      >
      <button
        class="sm"
        class:on={$store.onionSkin}
        aria-label="Onion skin"
        aria-pressed={$store.onionSkin}
        title="Onion skin: see the drawings before and after faintly, to keep the steps even"
        onclick={() => anim.setOnionSkin(!$store.onionSkin)}>Onion skin</button
      >
    </span>
  {:else}
    <button
      class="sm"
      aria-label="Make frame-by-frame"
      title={withWhy(
        `Make ${current?.name ?? 'the layer'} frame-by-frame: every keyframe holds its own drawing, as a flip book`,
        'animFrameByFrame',
      )}
      disabled={!current}
      onclick={() => (error = anim.makeFrameByFrame())}>Frame-by-frame</button
    >
  {/if}
  <button
    class="sm"
    aria-label="Insert keyframe"
    title="Fix every property of the selected objects at the playhead"
    disabled={$store.selection.length === 0}
    onclick={insertKeyframes}><Icon name="plus" size={14} /> Keyframe</button
  >
  <Why tool="animTimeline" />
  <label class="zoom" title="Frame zoom">
    <span class="sr-only">Frame zoom</span>
    <input type="range" min="2" max="24" step="1" aria-label="Frame zoom" bind:value={px} />
  </label>
</div>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .spacer {
    flex: 1;
  }
  .time {
    color: var(--tx-2);
    margin: 0 6px;
    white-space: nowrap;
  }
  .frame-box {
    width: 64px;
  }
  .on {
    background: var(--accent-soft);
    color: var(--accent);
  }
  /* The chevron icon points down: turned for previous / next. */
  .left,
  .right {
    display: inline-flex;
  }
  .left {
    transform: rotate(90deg);
  }
  .right {
    transform: rotate(-90deg);
  }
  input:not([type]) {
    height: 26px;
    font-size: 12px;
    padding: 0 6px;
  }
  .zoom input {
    width: 80px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .fbf {
    display: inline-flex;
    gap: 4px;
    margin-right: 6px;
  }
</style>
