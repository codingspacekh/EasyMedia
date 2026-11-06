<script lang="ts">
  // The stage (AN1–AN3, AN6): the animation drawn by core/animation/draw.ts, with rulers, grid,
  // guides, selection handles and the drawing tools. Every drag shows its result live and is
  // applied as one undo step when the pointer is let go.
  import type { App } from '../../app/app.ts';
  import { drawStage, type StageCanvas } from '../../core/animation/draw.ts';
  import { withLayers } from '../../adapters/canvas/layers.ts';
  import { onionSkin } from '../../core/animation/frames.ts';
  import { TRANSPARENT } from '../../core/animation/rules.ts';
  import {
    angleOf,
    pivotOf,
    pivotOnStage,
    snapAngle,
    type Handle,
    type Point,
  } from '../../core/animation/geometry.ts';
  import { findObject } from '../../core/animation/layers.ts';
  import {
    cornerPoint,
    insertPoint,
    moveAnchor,
    moveHandle,
    pullHandles,
    removePoint,
  } from '../../core/animation/pen.ts';
  import { snapBox } from '../../core/animation/snap.ts';
  import { stateAt } from '../../core/animation/state.ts';
  import type { PathObject } from '../../core/animation/types.ts';
  import { toMediaUrl } from '../../core/media-url.ts';
  import { animUi, SNAP_PX } from './animation-ui.svelte.ts';
  import { textBox } from './measure.ts';
  import PathPoints from './PathPoints.svelte';
  import SelectionHandles from './SelectionHandles.svelte';
  import StageGuides from './StageGuides.svelte';
  import StageRulers from './StageRulers.svelte';
  import {
    drawnShape,
    marqueeBox,
    objectCorners,
    objectsInBox,
    pickObject,
    boxPivotNear,
    pivotFrom,
    previewDoc,
    roundStage as round,
    simplifyStroke,
    sizeCanvas,
    unionBounds,
    type StageDrag,
  } from './stage-geometry.ts';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  // M14: what the student sees and edits is the animation at the playhead.
  const doc = $derived(stateAt($store.history.present, $store.frame));
  const stage = $derived(doc.stage);
  const view = $derived(doc.view);

  const RULER = 20;
  const MARGIN = 24;
  const HANDLE = 8;
  let areaW = $state(0);
  let areaH = $state(0);
  const fitZoom = $derived(
    areaW > 0 && areaH > 0
      ? Math.min(
          (areaW - RULER - 2 * MARGIN) / stage.width,
          (areaH - RULER - 2 * MARGIN) / stage.height,
        )
      : 1,
  );
  const zoom = $derived($store.zoom === 'fit' ? Math.max(0.05, Math.min(fitZoom, 4)) : $store.zoom);
  const rulerSize = $derived(view.rulers ? RULER : 0);
  /**
   * N16: the space around the stage on each axis — at least MARGIN, more to keep the stage in the
   * middle of its area whatever the panels' sizes and the zoom (as Video mode's preview).
   */
  const padX = $derived(Math.max(MARGIN, Math.floor((areaW - rulerSize - stage.width * zoom) / 2)));
  const padY = $derived(
    Math.max(MARGIN, Math.floor((areaH - rulerSize - stage.height * zoom) / 2)),
  );

  let drag: StageDrag | null = $state(null);
  /** The pen's points so far (AN3). */
  let pen: Point[] = $state([]);
  let penNow: Point | null = $state(null);
  let paper: HTMLDivElement | undefined = $state();
  let canvas: HTMLCanvasElement | undefined = $state();

  const selected = $derived(
    $store.selection.flatMap((id) => {
      const found = findObject(doc, id);
      return found ? [found.object] : [];
    }),
  );
  const single = $derived(selected.length === 1 ? selected[0]! : null);

  /** The document as it looks during the drag. */
  const shown = $derived(previewDoc(doc, drag, $store.layerId));

  // ---- pictures (AN5): loaded once each; the stage is drawn again when one arrives ----
  // A plain cache, not state: the stage is drawn again through `loaded` when a picture arrives.
  const images: Record<string, HTMLImageElement> = {};
  let loaded = $state(0);
  function image(pictureId: string): HTMLImageElement | null {
    const picture = doc.pictures.find((p) => p.id === pictureId);
    if (!picture) return null;
    const known = images[picture.path];
    if (known) return known.complete && known.naturalWidth > 0 ? known : null;
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    img.onload = () => loaded++;
    img.src = toMediaUrl(picture.path);
    images[picture.path] = img;
    return null;
  }

  function drawGrid(ctx: StageCanvas): void {
    const size = Math.max(2, view.grid.size);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.14)';
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([]);
    ctx.beginPath();
    for (let x = 0; x <= stage.width; x += size) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, stage.height);
    }
    for (let y = 0; y <= stage.height; y += size) {
      ctx.moveTo(0, y);
      ctx.lineTo(stage.width, y);
    }
    ctx.stroke();
  }

  function skinOf(layerId: string) {
    const layer = $store.history.present.layers.find((l) => l.id === layerId);
    if (!layer) return [];
    const { before, after } = onionSkin(layer, $store.frame);
    return [...before, ...after];
  }

  $effect(() => {
    void loaded;
    // N4: drawn in ordinary memory: on the graphics card, Chromium keeps the shapes of every
    // frame played in its caches (over 300 MB for 100 moving objects), for no faster a stage.
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx) return;
    const dpr = globalThis.devicePixelRatio || 1;
    // N1: the same canvas from frame to frame, cleared and its settings reset as a resize would.
    if (!sizeCanvas(canvas, stage, zoom, dpr)) ctx.reset();
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);
    drawStage(withLayers(ctx) as unknown as StageCanvas, shown, {
      image,
      // AN12: a mask works on the stage while its layer is locked, as in the coursebook.
      editing: true,
      ...(view.grid.show && !view.grid.over ? { afterBackground: drawGrid } : {}),
      // AN14: the drawings before and after, faintly, on frame-by-frame layers.
      ...($store.onionSkin ? { onionSkin: skinOf } : {}),
    });
  });

  // ---- coordinates ----
  function at(e: { clientX: number; clientY: number }): Point {
    const r = paper?.getBoundingClientRect() ?? { left: 0, top: 0 };
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }
  const threshold = () => SNAP_PX / zoom;
  /** A single point snapped to the grid, guides and objects (as a 0 × 0 box). */
  function snapPoint(p: Point, off: boolean): Point {
    const r = snapBox(
      doc,
      { x: p.x, y: p.y, width: 0, height: 0 },
      {
        threshold: threshold(),
        exclude: $store.selection,
        off,
      },
    );
    animUi.snapped = r.to;
    return { x: p.x + r.dx, y: p.y + r.dy };
  }
  // ---- the drag ----
  function track(move: (e: PointerEvent) => void, up: (e: PointerEvent) => void): void {
    const onMove = (e: PointerEvent) => move(e);
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      up(e);
      drag = null;
      animUi.snapped = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  function onpointerdown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const tool = $store.tool;
    const raw = at(e);
    if (tool === 'select') {
      const hit = pickObject(doc, raw);
      if (!hit) {
        drag = { kind: 'marquee', start: raw, now: raw };
        track(
          (m) => {
            if (drag?.kind === 'marquee') drag = { ...drag, now: at(m) };
          },
          (u) => {
            const box = marqueeBox(raw, at(u));
            if (box.width < 3 && box.height < 3) {
              anim.select([]);
              return;
            }
            const inside = objectsInBox(doc, box);
            anim.select(inside);
          },
        );
        return;
      }
      let ids = $store.selection;
      if (e.shiftKey) {
        ids = ids.includes(hit.id) ? ids.filter((id) => id !== hit.id) : [...ids, hit.id];
        anim.select(ids);
        return;
      }
      if (!ids.includes(hit.id)) {
        ids = [hit.id];
        anim.select(ids);
      }
      const objects = ids.flatMap((id) => {
        const f = findObject(doc, id);
        return f ? [f.object] : [];
      });
      const u = unionBounds(objects);
      drag = { kind: 'move', start: raw, ids, union: u, dx: 0, dy: 0 };
      track(
        (m) => {
          if (drag?.kind !== 'move') return;
          const p = at(m);
          let dx = p.x - raw.x;
          let dy = p.y - raw.y;
          if (m.shiftKey) {
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
          }
          const r = snapBox(
            doc,
            { ...u, x: u.x + dx, y: u.y + dy },
            { threshold: threshold(), exclude: ids, off: m.altKey },
          );
          animUi.snapped = r.to;
          drag = { ...drag, dx: round(dx + r.dx), dy: round(dy + r.dy) };
        },
        () => {
          if (drag?.kind === 'move' && (drag.dx !== 0 || drag.dy !== 0))
            anim.moveSelection(drag.dx, drag.dy);
        },
      );
      return;
    }
    if (tool === 'text') {
      const p = snapPoint(raw, e.altKey);
      anim.addText({ x: round(p.x), y: round(p.y) }, 'Text', (t) => textBox(t));
      animUi.focusText++;
      return;
    }
    if (tool === 'picture') {
      const p = snapPoint(raw, e.altKey);
      void anim.addPicture({ x: round(p.x), y: round(p.y) });
      return;
    }
    if (tool === 'button') {
      const p = snapPoint(raw, e.altKey);
      anim.addButton({ x: round(p.x), y: round(p.y) });
      return;
    }
    if (tool === 'pen') {
      const p = snapPoint(raw, e.altKey);
      const first = pen[0];
      if (first && pen.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) <= 6 / zoom) {
        finishPen(true);
        return;
      }
      pen = [...pen, { x: round(p.x), y: round(p.y) }];
      return;
    }
    if (tool === 'brush') {
      drag = { kind: 'brush', points: [raw] };
      track(
        (m) => {
          if (drag?.kind === 'brush') drag = { ...drag, points: [...drag.points, at(m)] };
        },
        () => {
          if (drag?.kind !== 'brush') return;
          const simple = simplifyStroke(drag.points, 2 / zoom);
          if (simple.length >= 2) anim.addPath(simple, false);
        },
      );
      return;
    }
    // Shapes and lines are dragged out (AN3).
    const start = snapPoint(raw, e.altKey);
    drag = { kind: 'draw', tool, start, now: start, square: e.shiftKey };
    track(
      (m) => {
        if (drag?.kind === 'draw')
          drag = { ...drag, now: snapPoint(at(m), m.altKey), square: m.shiftKey };
      },
      () => {
        if (drag?.kind !== 'draw') return;
        const o = drawnShape(drag);
        if (o.width < 2 && o.height < 2) return;
        const box = {
          x: round(o.x),
          y: round(o.y),
          width: round(o.width),
          height: round(o.height),
        };
        if (drag.tool === 'line')
          anim.addLine(
            { x: round(drag.start.x), y: round(drag.start.y) },
            { x: round(drag.now.x), y: round(drag.now.y) },
          );
        else anim.addShape(drag.tool, box);
      },
    );
  }

  function finishPen(closed: boolean): void {
    const points = pen;
    pen = [];
    penNow = null;
    if (points.length >= 2) anim.addPath(points, closed && points.length >= 3);
  }

  function startResize(e: PointerEvent, handle: Handle): void {
    e.stopPropagation();
    if (!single) return;
    const id = single.id;
    drag = { kind: 'resize', id, handle, now: at(e), lock: e.shiftKey };
    track(
      (m) => {
        if (drag?.kind === 'resize')
          drag = { ...drag, now: snapPoint(at(m), m.altKey), lock: m.shiftKey };
      },
      () => {
        if (drag?.kind === 'resize') anim.resizeSelected(id, handle, drag.now, drag.lock);
      },
    );
  }

  // ---- AN3: a pen path's points and curves ----

  /** The selected object, when it is a pen path that can be edited (not a morph's in-between). */
  const editablePath = $derived.by((): PathObject | null => {
    if (!single || $store.tool !== 'select') return null;
    const own = findObject($store.history.present, single.id)?.object;
    return own?.kind === 'path' && single.kind === 'path' ? single : null;
  });

  function startAnchor(e: PointerEvent, index: number): void {
    e.stopPropagation();
    if (!editablePath) return;
    const id = editablePath.id;
    const pull = e.altKey;
    drag = { kind: 'anchor', id, index, now: at(e), pull, moved: false };
    track(
      (m) => {
        if (drag?.kind === 'anchor')
          drag = { ...drag, now: pull ? at(m) : snapPoint(at(m), m.altKey), moved: true };
      },
      () => {
        if (drag?.kind !== 'anchor') return;
        const { now, moved } = drag;
        if (!moved && pull) anim.editPath(id, 'Corner point', (p) => cornerPoint(p, index));
        else if (moved && pull) anim.editPath(id, 'Curve point', (p) => pullHandles(p, index, now));
        else if (moved) anim.editPath(id, 'Move point', (p) => moveAnchor(p, index, now));
      },
    );
  }

  function startCurve(e: PointerEvent, index: number, which: 'in' | 'out'): void {
    e.stopPropagation();
    if (!editablePath) return;
    const id = editablePath.id;
    drag = { kind: 'curve', id, index, which, now: at(e), alone: e.altKey };
    track(
      (m) => {
        if (drag?.kind === 'curve') drag = { ...drag, now: at(m), alone: m.altKey };
      },
      () => {
        if (drag?.kind !== 'curve') return;
        const { now, alone } = drag;
        anim.editPath(id, 'Move curve handle', (p) => moveHandle(p, index, which, now, !alone));
      },
    );
  }

  function removeAnchor(e: MouseEvent, index: number): void {
    e.stopPropagation();
    if (editablePath) anim.editPath(editablePath.id, 'Remove point', (p) => removePoint(p, index));
  }

  function startRotate(e: PointerEvent): void {
    e.stopPropagation();
    if (!single) return;
    const id = single.id;
    // AN27: it turns about its point (the centre unless another is chosen), by as much as the
    // pointer goes round that point.
    const centre = pivotOnStage(single);
    const from = single.rotation - angleOf(centre, at(e));
    drag = { kind: 'rotate', id, centre, degrees: single.rotation };
    track(
      (m) => {
        if (drag?.kind !== 'rotate') return;
        const deg = from + angleOf(centre, at(m));
        drag = { ...drag, degrees: m.shiftKey ? snapAngle(deg, 15) : Math.round(deg) };
      },
      () => {
        if (drag?.kind === 'rotate') anim.rotateSelected(id, drag.degrees);
      },
    );
  }

  /**
   * AN27: the point the object turns about, dragged: it snaps to the box's centre, corners and
   * edge middles, and to the grid, guides and other objects when snapping is on (Alt: not at all).
   */
  function startPivot(e: PointerEvent): void {
    e.stopPropagation();
    if (!single) return;
    const object = single;
    const id = object.id;
    const start = pivotOf(object);
    drag = { kind: 'pivot', id, pivot: start };
    track(
      (m) => {
        if (drag?.kind !== 'pivot') return;
        const p = at(m);
        const pivot =
          (m.altKey ? null : boxPivotNear(object, p, threshold())) ??
          pivotFrom(object, snapPoint(p, m.altKey));
        drag = { ...drag, pivot };
      },
      () => {
        if (drag?.kind !== 'pivot') return;
        const { pivot } = drag;
        if (pivot.x !== start.x || pivot.y !== start.y) anim.setPivot(pivot, [id]);
      },
    );
  }

  /**
   * AN27: a double-click on the point puts it back in the centre of the box. Already there, the
   * double-click is the stage's own (text's words are edited).
   */
  function centrePivot(e: MouseEvent): void {
    if (!single?.pivot) return;
    e.stopPropagation();
    anim.setPivot(null, [single.id]);
  }

  /** AN2: a guide dragged out of a ruler, or an existing one moved (off the stage removes it). */
  function startGuide(e: PointerEvent, axis: 'x' | 'y', index: number | null): void {
    e.stopPropagation();
    e.preventDefault();
    const value = axis === 'x' ? at(e).x : at(e).y;
    drag = { kind: 'guide', axis, index, value };
    track(
      (m) => {
        if (drag?.kind === 'guide') {
          const p = at(m);
          drag = { ...drag, value: Math.round(axis === 'x' ? p.x : p.y) };
        }
      },
      () => {
        if (drag?.kind !== 'guide') return;
        const limit = axis === 'x' ? stage.width : stage.height;
        const inside = drag.value >= 0 && drag.value <= limit;
        if (index === null) {
          if (inside) anim.addGuide(axis, drag.value);
        } else if (inside) anim.moveGuide(axis, index, drag.value);
        else anim.removeGuide(axis, index);
      },
    );
  }

  function onpointermove(e: PointerEvent): void {
    const p = at(e);
    animUi.pointer = { x: Math.round(p.x), y: Math.round(p.y) };
    if ($store.tool === 'pen' && pen.length) penNow = snapPoint(p, e.altKey);
  }

  function ondblclick(e: MouseEvent): void {
    if ($store.tool === 'pen') {
      finishPen(false);
      return;
    }
    const hit = pickObject(doc, at(e));
    // AN3: a double-click on the selected pen path adds a point there.
    if (editablePath && hit?.id === editablePath.id) {
      const p = at(e);
      anim.editPath(editablePath.id, 'Add point', (path) => insertPoint(path, p));
      return;
    }
    if (hit?.kind === 'text') {
      anim.select([hit.id]);
      animUi.focusText++;
    }
  }

  function onkeydown(e: KeyboardEvent): void {
    if ($store.tool !== 'pen' || pen.length === 0) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      finishPen(false);
    } else if (e.key === 'Escape') {
      pen = [];
      penNow = null;
    }
  }

  const CURSORS: Record<string, string> = {
    select: 'default',
    text: 'text',
    picture: 'copy',
    pen: 'crosshair',
    brush: 'crosshair',
  };

  const shownSingle = $derived(single ? (findObject(shown, single.id)?.object ?? single) : null);
  const hs = $derived(HANDLE / zoom);
</script>

<svelte:window {onkeydown} />

<div class="stage-area" bind:clientWidth={areaW} bind:clientHeight={areaH}>
  <div
    class="sheet"
    style:width="{rulerSize + stage.width * zoom + 2 * padX}px"
    style:height="{rulerSize + stage.height * zoom + 2 * padY}px"
  >
    {#if view.rulers}
      <StageRulers
        {stage}
        {zoom}
        {padX}
        {padY}
        size={RULER}
        onguide={(e, axis) => startGuide(e, axis, null)}
      />
    {/if}
    <div
      class="paper"
      bind:this={paper}
      style:left="{rulerSize + padX}px"
      style:top="{rulerSize + padY}px"
      style:width="{stage.width * zoom}px"
      style:height="{stage.height * zoom}px"
    >
      <canvas
        bind:this={canvas}
        class:transparent={stage.background === TRANSPARENT}
        style:width="100%"
        style:height="100%"
      ></canvas>
      <svg
        class="overlay"
        role="application"
        aria-label="Stage"
        viewBox="0 0 {stage.width} {stage.height}"
        width={stage.width * zoom}
        height={stage.height * zoom}
        style:cursor={CURSORS[$store.tool] ?? 'crosshair'}
        {onpointerdown}
        {onpointermove}
        onpointerleave={() => (animUi.pointer = null)}
        {ondblclick}
      >
        {#if view.grid.show && view.grid.over}
          <defs>
            <pattern
              id="grid"
              width={view.grid.size}
              height={view.grid.size}
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M {view.grid.size} 0 L 0 0 0 {view.grid.size}"
                class="grid"
                vector-effect="non-scaling-stroke"
              />
            </pattern>
          </defs>
          <rect width={stage.width} height={stage.height} fill="url(#grid)" />
        {/if}
        <StageGuides
          guides={doc.guides}
          {stage}
          dragging={drag?.kind === 'guide' ? drag : null}
          onguide={startGuide}
        />
        {#if drag?.kind !== 'draw' && drag?.kind !== 'brush'}
          {#each selected as o (o.id)}
            {@const live = findObject(shown, o.id)?.object ?? o}
            <polygon
              class="sel"
              points={objectCorners(live)
                .map((c) => `${c.x},${c.y}`)
                .join(' ')}
              vector-effect="non-scaling-stroke"
            />
          {/each}
        {/if}
        <!-- A pen path shows its points instead of the box's handles (its size and turn are in Properties). -->
        {#if shownSingle && $store.tool === 'select' && drag?.kind !== 'move' && !editablePath}
          <SelectionHandles
            object={shownSingle}
            {zoom}
            size={hs}
            onrotate={startRotate}
            onresize={startResize}
            onpivot={startPivot}
            oncentre={centrePivot}
          />
        {/if}
        {#if editablePath && drag?.kind !== 'move'}
          <PathPoints
            path={(findObject(shown, editablePath.id)?.object ?? editablePath) as PathObject}
            size={hs}
            onanchor={startAnchor}
            oncurve={startCurve}
            onremove={removeAnchor}
          />
        {/if}
        {#if drag?.kind === 'marquee'}
          <rect
            class="marquee"
            x={Math.min(drag.start.x, drag.now.x)}
            y={Math.min(drag.start.y, drag.now.y)}
            width={Math.abs(drag.now.x - drag.start.x)}
            height={Math.abs(drag.now.y - drag.start.y)}
            vector-effect="non-scaling-stroke"
          />
        {/if}
        {#if pen.length}
          <polyline
            class="pen"
            points={[...pen, ...(penNow ? [penNow] : [])].map((p) => `${p.x},${p.y}`).join(' ')}
            vector-effect="non-scaling-stroke"
          />
          {#each pen as p, i (i)}
            <circle
              class="handle"
              cx={p.x}
              cy={p.y}
              r={hs / 2}
              vector-effect="non-scaling-stroke"
            />
          {/each}
        {/if}
      </svg>
    </div>
  </div>
</div>

<style>
  .stage-area {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    background: var(--bg-0);
    position: relative;
  }
  .sheet {
    position: relative;
    min-width: 100%;
    min-height: 100%;
  }
  .paper {
    position: absolute;
    box-shadow:
      0 0 0 1px var(--line-strong),
      0 8px 30px rgba(0, 0, 0, 0.5);
  }
  canvas {
    display: block;
  }
  /* AN21: a stage with no background shows a checkerboard, as image editors do. */
  canvas.transparent {
    background: repeating-conic-gradient(#d9d9d9 0% 25%, #ffffff 0% 50%) 0 0 / 16px 16px;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: block;
    touch-action: none;
  }
  .grid {
    fill: none;
    stroke: rgba(0, 0, 0, 0.14);
    stroke-width: 1;
  }
  .sel {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1;
  }
  .handle {
    fill: #fff;
    stroke: var(--accent);
    stroke-width: 1;
  }
  .marquee {
    fill: rgba(79, 140, 255, 0.12);
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 4 3;
  }
  .pen {
    fill: none;
    stroke: var(--accent);
    stroke-width: 1;
  }
</style>
