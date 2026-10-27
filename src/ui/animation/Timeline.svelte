<script lang="ts">
  // The timeline (M14, AN8, AN9): under the stage. Frames across the top, numbered every 5 with
  // the seconds under them; one row per layer, its objects under it, and the selected (or opened)
  // object's animated properties under that, with keyframe dots, tween bars (a dash for a hold)
  // and the repeat mark. The playhead is dragged on the ruler or typed; a dot is clicked to edit
  // its easing, hold and repeat, dragged to move it, Alt-dragged to copy it.
  import type { App } from '../../app/app.ts';
  import { parseFrame, timeLabel } from '../../core/animation/time.ts';
  import { EASINGS, TWEEN_PROPERTIES } from '../../core/animation/tween.ts';
  import type { AnimObject, Id, Track, TweenProperty } from '../../core/animation/types.ts';
  import Icon from '../Icon.svelte';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const doc = $derived($store.history.present);
  const stage = $derived(doc.stage);
  const frame = $derived($store.frame);

  /** A frame's width in px (the frame zoom). */
  let px = $state(8);
  const span = $derived((stage.length + 1) * px);
  /** Frame numbers every 5, or every 10, 20… when the frames are narrow. */
  const labelStep = $derived(
    5 * Math.max(1, 2 ** Math.ceil(Math.log2(Math.max(1, 28 / (5 * px))))),
  );
  const frameLabels = $derived(
    Array.from({ length: Math.floor(stage.length / labelStep) + 1 }, (_, i) => i * labelStep),
  );
  const secondLabels = $derived(
    Array.from({ length: Math.floor(stage.length / stage.fps) }, (_, i) => i + 1),
  );

  let error: string | null = $state(null);

  // ---- rows ----
  let closedLayers: Record<Id, boolean> = $state({});
  let openObjects: Record<Id, boolean> = $state({});
  const LABEL: Record<TweenProperty, string> = Object.fromEntries(
    TWEEN_PROPERTIES.map((p) => [p.id, p.label]),
  ) as Record<TweenProperty, string>;
  const ORDER = TWEEN_PROPERTIES.map((p) => p.id);

  const framesOf = (objects: readonly AnimObject[]): number[] => [
    ...new Set(
      objects.flatMap((o) => (o.tracks ?? []).flatMap((t) => t.keyframes.map((k) => k.frame))),
    ),
  ];

  type Row =
    | { kind: 'layer'; id: Id; name: string; frames: number[]; open: boolean }
    | { kind: 'object'; id: Id; name: string; frames: number[]; open: boolean; animated: boolean }
    | { kind: 'property'; id: Id; track: Track };

  const rows = $derived.by((): Row[] => {
    const out: Row[] = [];
    for (const layer of [...doc.layers].reverse()) {
      const open = !closedLayers[layer.id];
      out.push({
        kind: 'layer',
        id: layer.id,
        name: layer.name,
        frames: framesOf(layer.objects),
        open,
      });
      if (!open) continue;
      for (const o of [...layer.objects].reverse()) {
        const tracks = (o.tracks ?? []).filter((t) => t.keyframes.length > 0);
        const shown = openObjects[o.id] ?? $store.selection.includes(o.id);
        out.push({
          kind: 'object',
          id: o.id,
          name: o.name,
          frames: framesOf([o]),
          open: shown,
          animated: tracks.length > 0,
        });
        if (shown)
          for (const track of [...tracks].sort(
            (a, b) => ORDER.indexOf(a.property) - ORDER.indexOf(b.property),
          ))
            out.push({ kind: 'property', id: o.id, track });
      }
    }
    return out;
  });

  // ---- the playhead ----
  let ruler: HTMLDivElement | undefined = $state();
  const frameAt = (clientX: number): number => {
    const left = ruler?.getBoundingClientRect().left ?? 0;
    return Math.round((clientX - left) / px);
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

  const shownFrame = (id: Id, property: TweenProperty, at: number): number =>
    dragging && dragging.id === id && dragging.property === property && dragging.frame === at
      ? dragging.to
      : at;

  function insertKeyframes(): void {
    for (const id of $store.selection) anim.insertKeyframe(id, 'all');
  }

  function setRepeat(event: Event): void {
    if (!pickedTrack || !picked) return;
    const value = (event.currentTarget as HTMLSelectElement).value;
    anim.setRepeat(
      picked.id,
      picked.property,
      value === '' ? undefined : value === 'end' ? 'end' : Number(value),
    );
  }
</script>

<section class="timeline" aria-label="Timeline">
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
      ><span class="flip"><Icon name="chevron" size={14} /></span></button
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
      onclick={() => anim.step(1)}><Icon name="chevron" size={14} /></button
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
    <button
      class="sm"
      aria-label="Insert keyframe"
      title="Fix every property of the selected objects at the playhead"
      disabled={$store.selection.length === 0}
      onclick={insertKeyframes}><Icon name="plus" size={14} /> Keyframe</button
    >
    <label class="zoom" title="Frame zoom">
      <span class="sr-only">Frame zoom</span>
      <input type="range" min="2" max="24" step="1" aria-label="Frame zoom" bind:value={px} />
    </label>
  </div>

  {#if error}
    <p class="error" role="alert">{error}</p>
  {/if}

  {#if pickedTrack && picked}
    <div class="key-bar" aria-label="Keyframe">
      <span class="key-name">{LABEL[picked.property]} · frame {picked.frame}</span>
      <label
        >Easing
        <select
          aria-label="Easing"
          value={pickedTrack.key.easing}
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
          checked={pickedTrack.key.hold}
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
          value={pickedTrack.track.repeat === undefined ? '' : String(pickedTrack.track.repeat)}
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
        <span class="tick" style:left="{n * px}px">{n}</span>
      {/each}
      {#each secondLabels as s (s)}
        <span class="sec" style:left="{s * stage.fps * px}px">{s} s</span>
      {/each}
      <span class="head" style:left="{frame * px}px" aria-hidden="true"></span>
    </div>

    {#each rows as row (row.kind === 'property' ? `${row.id}:${row.track.property}` : `${row.kind}:${row.id}`)}
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
              style:left="{k.frame * px}px"
              style:width="{(keys[i + 1]!.frame - k.frame) * px}px"
              aria-hidden="true"
            ></span>
          {/each}
          {#if row.track.repeat !== undefined && keys.length >= 2}
            <span
              class="repeat"
              style:left="{keys.at(-1)!.frame * px}px"
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
              style:left="{shownFrame(row.id, row.track.property, k.frame) * px}px"
              aria-label="{LABEL[row.track.property]} keyframe at frame {k.frame}"
              title="{LABEL[
                row.track.property
              ]} = {k.value} at frame {k.frame}. Drag to move; Alt-drag to copy."
              onpointerdown={(e) => onKeyDown(e, row.id, row.track.property, k.frame)}
              onclick={() => {
                if (!moved) picked = { id: row.id, property: row.track.property, frame: k.frame };
              }}
            ></button>
          {/each}
        {:else}
          {#each row.frames as f (f)}
            <span class="dot" style:left="{f * px}px" aria-hidden="true"></span>
          {/each}
        {/if}
      </div>
    {/each}
    <span class="line" style:left="calc(var(--label-w) + {frame * px}px)" aria-hidden="true"></span>
  </div>
</section>

<style>
  .timeline {
    --label-w: 150px;
    display: flex;
    flex-direction: column;
    height: 190px;
    min-height: 120px;
    border-top: 1px solid var(--line);
    background: var(--bg-1);
    font-size: 12px;
  }
  .bar,
  .key-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-bottom: 1px solid var(--line);
    flex-wrap: wrap;
  }
  .key-bar {
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
  .flip {
    display: inline-flex;
    transform: scaleX(-1);
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
  .error {
    margin: 0;
    padding: 2px 8px;
    color: var(--danger);
  }
  .grid {
    position: relative;
    flex: 1;
    overflow: auto;
    display: grid;
    grid-template-columns: var(--label-w) max-content;
    grid-auto-rows: 22px;
    align-content: start;
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
  .label.property {
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
    transition: transform 0.1s;
  }
  .twist.open :global(svg) {
    transform: rotate(90deg);
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
  .repeat {
    position: absolute;
    top: 50%;
    height: 0;
    border-top: 2px dotted var(--accent);
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
