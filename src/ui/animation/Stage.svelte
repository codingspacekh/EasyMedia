<script lang="ts">
  // The stage (AN1–AN3, AN6): the animation drawn by core/animation/draw.ts, with rulers, grid,
  // guides, selection handles and the drawing tools. Every drag shows its result live and is
  // applied as one undo step when the pointer is let go.
  import type { App } from '../../app/app.ts';
  import { drawStage, type StageCanvas } from '../../core/animation/draw.ts';
  import {
    createEllipse,
    createLine,
    createPath,
    createPolygon,
    createRect,
    createStar,
  } from '../../core/animation/factory.ts';
  import {
    angleOf,
    boundsOf,
    centreOf,
    hitTest,
    moved,
    resizeFrom,
    rotated,
    snapAngle,
    toStage,
    type Bounds,
    type Handle,
    type Point,
  } from '../../core/animation/geometry.ts';
  import { drawOrder, findObject, updateObject } from '../../core/animation/layers.ts';
  import { snapBox } from '../../core/animation/snap.ts';
  import type { AnimObject, AnimationDoc, Id } from '../../core/animation/types.ts';
  import { toMediaUrl } from '../../core/media-url.ts';
  import { animUi, SNAP_PX } from './animation-ui.svelte.ts';
  import { textBox } from './measure.ts';

  let { app }: { app: App } = $props();
  const anim = $derived(app.animation);
  const store = $derived(app.animation.store);
  const doc = $derived($store.history.present);
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

  type Drag =
    | { kind: 'move'; start: Point; ids: Id[]; union: Bounds; dx: number; dy: number }
    | { kind: 'marquee'; start: Point; now: Point }
    | {
        kind: 'draw';
        tool: 'rect' | 'ellipse' | 'star' | 'polygon' | 'line';
        start: Point;
        now: Point;
        square: boolean;
      }
    | { kind: 'brush'; points: Point[] }
    | { kind: 'resize'; id: Id; handle: Handle; now: Point; lock: boolean }
    | { kind: 'rotate'; id: Id; centre: Point; degrees: number }
    | { kind: 'guide'; axis: 'x' | 'y'; index: number | null; value: number };
  let drag: Drag | null = $state(null);
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

  /** The temporary shape of a draw drag, in stage coordinates. */
  function drawn(d: Extract<Drag, { kind: 'draw' }>): AnimObject {
    let { x: x2, y: y2 } = d.now;
    if (d.tool === 'line') return { ...createLine(d.start, d.now), id: 'temp' };
    let w = x2 - d.start.x;
    let h = y2 - d.start.y;
    if (d.square) {
      const s = Math.max(Math.abs(w), Math.abs(h));
      w = Math.sign(w || 1) * s;
      h = Math.sign(h || 1) * s;
      x2 = d.start.x + w;
      y2 = d.start.y + h;
    }
    const box = {
      x: Math.min(d.start.x, x2),
      y: Math.min(d.start.y, y2),
      width: Math.abs(w),
      height: Math.abs(h),
    };
    const make = {
      rect: createRect,
      ellipse: createEllipse,
      star: createStar,
      polygon: createPolygon,
    };
    return { ...make[d.tool](box), id: 'temp' };
  }

  /** The document as it looks during the drag. */
  const shown = $derived.by((): AnimationDoc => {
    const d = drag;
    if (!d) return doc;
    const withTemp = (o: AnimObject) => ({
      ...doc,
      layers: doc.layers.map((l) =>
        l.id === $store.layerId ? { ...l, objects: [...l.objects, o] } : l,
      ),
    });
    switch (d.kind) {
      case 'move':
        return d.ids.reduce((acc, id) => {
          try {
            return updateObject(acc, id, (o) => moved(o, d.dx, d.dy));
          } catch {
            return acc;
          }
        }, doc);
      case 'draw':
        return withTemp(drawn(d));
      case 'brush':
        return d.points.length >= 2
          ? withTemp({ ...createPath(d.points, false), id: 'temp' })
          : doc;
      case 'resize':
        try {
          return updateObject(doc, d.id, (o) =>
            resizeFrom(o, d.handle, d.now, { lockRatio: d.lock }),
          );
        } catch {
          return doc;
        }
      case 'rotate':
        try {
          return updateObject(doc, d.id, (o) => rotated(o, d.degrees));
        } catch {
          return doc;
        }
      default:
        return doc;
    }
  });

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

  $effect(() => {
    void loaded;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = globalThis.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(stage.width * zoom * dpr));
    canvas.height = Math.max(1, Math.round(stage.height * zoom * dpr));
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, 0, 0);
    drawStage(ctx as unknown as StageCanvas, shown, {
      image,
      ...(view.grid.show && !view.grid.over ? { afterBackground: drawGrid } : {}),
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
  const round = (n: number) => Math.round(n * 100) / 100;

  /** The front-most object under the point that can be picked (its layer shown and unlocked). */
  function pick(p: Point): AnimObject | null {
    const order = drawOrder(doc);
    for (let i = order.length - 1; i >= 0; i--) {
      const { layer, object } = order[i]!;
      if (!layer.locked && hitTest(object, p)) return object;
    }
    return null;
  }

  function union(objects: readonly AnimObject[]): Bounds {
    const bs = objects.map(boundsOf);
    const x = Math.min(...bs.map((b) => b.x));
    const y = Math.min(...bs.map((b) => b.y));
    return {
      x,
      y,
      width: Math.max(...bs.map((b) => b.x + b.width)) - x,
      height: Math.max(...bs.map((b) => b.y + b.height)) - y,
    };
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
      const hit = pick(raw);
      if (!hit) {
        drag = { kind: 'marquee', start: raw, now: raw };
        track(
          (m) => {
            if (drag?.kind === 'marquee') drag = { ...drag, now: at(m) };
          },
          (u) => {
            const end = at(u);
            const box = {
              x: Math.min(raw.x, end.x),
              y: Math.min(raw.y, end.y),
              width: Math.abs(end.x - raw.x),
              height: Math.abs(end.y - raw.y),
            };
            if (box.width < 3 && box.height < 3) {
              anim.select([]);
              return;
            }
            const inside = drawOrder(doc)
              .filter(({ layer, object }) => {
                if (layer.locked) return false;
                const b = boundsOf(object);
                return (
                  b.x < box.x + box.width &&
                  b.x + b.width > box.x &&
                  b.y < box.y + box.height &&
                  b.y + b.height > box.y
                );
              })
              .map(({ object }) => object.id);
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
      const u = union(objects);
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
          const simple = simplify(drag.points, 2 / zoom);
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
        const o = drawn(drag);
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

  /** Fewer points for a brush stroke: drop those closer than `min` to the last kept one. */
  function simplify(points: Point[], min: number): Point[] {
    const out: Point[] = [];
    for (const p of points) {
      const last = out.at(-1);
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= min)
        out.push({ x: round(p.x), y: round(p.y) });
    }
    return out;
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

  function startRotate(e: PointerEvent): void {
    e.stopPropagation();
    if (!single) return;
    const id = single.id;
    const centre = centreOf(single);
    drag = { kind: 'rotate', id, centre, degrees: single.rotation };
    track(
      (m) => {
        if (drag?.kind !== 'rotate') return;
        const deg = angleOf(centre, at(m));
        drag = { ...drag, degrees: m.shiftKey ? snapAngle(deg, 15) : Math.round(deg) };
      },
      () => {
        if (drag?.kind === 'rotate') anim.rotateSelected(id, drag.degrees);
      },
    );
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
    const hit = pick(at(e));
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

  // ---- rulers ----
  const step = $derived([5, 10, 20, 50, 100, 200, 500, 1000].find((s) => s * zoom >= 48) ?? 1000);
  const ticks = (length: number) =>
    Array.from({ length: Math.floor(length / step) + 1 }, (_, i) => i * step);
  const minor = $derived(step / 5);
  const CURSORS: Record<string, string> = {
    select: 'default',
    text: 'text',
    picture: 'copy',
    pen: 'crosshair',
    brush: 'crosshair',
  };

  /** The selection box of an object, on the stage. */
  const corners = (o: AnimObject) =>
    [
      { x: 0, y: 0 },
      { x: o.width, y: 0 },
      { x: o.width, y: o.height },
      { x: 0, y: o.height },
    ].map((c) => toStage(o, c));
  const handlePoints = (o: AnimObject): [Handle, Point][] => [
    ['nw', toStage(o, { x: 0, y: 0 })],
    ['n', toStage(o, { x: o.width / 2, y: 0 })],
    ['ne', toStage(o, { x: o.width, y: 0 })],
    ['e', toStage(o, { x: o.width, y: o.height / 2 })],
    ['se', toStage(o, { x: o.width, y: o.height })],
    ['s', toStage(o, { x: o.width / 2, y: o.height })],
    ['sw', toStage(o, { x: 0, y: o.height })],
    ['w', toStage(o, { x: 0, y: o.height / 2 })],
  ];
  const shownSingle = $derived(single ? (findObject(shown, single.id)?.object ?? single) : null);
  const hs = $derived(HANDLE / zoom);
</script>

<svelte:window {onkeydown} />

<div class="stage-area" bind:clientWidth={areaW} bind:clientHeight={areaH}>
  <div
    class="sheet"
    style:width="{rulerSize + stage.width * zoom + 2 * MARGIN}px"
    style:height="{rulerSize + stage.height * zoom + 2 * MARGIN}px"
  >
    {#if view.rulers}
      <div class="corner" style:width="{RULER}px" style:height="{RULER}px"></div>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg
        class="ruler top"
        style:left="{RULER}px"
        width={stage.width * zoom + 2 * MARGIN}
        height={RULER}
        aria-label="Horizontal ruler"
        onpointerdown={(e) => startGuide(e, 'y', null)}
      >
        {#each ticks(stage.width) as t (t)}
          <line x1={MARGIN + t * zoom} y1={RULER - 8} x2={MARGIN + t * zoom} y2={RULER} />
          <text x={MARGIN + t * zoom + 2} y={9}>{t}</text>
          {#if minor * zoom >= 5}
            {#each [1, 2, 3, 4] as m (m)}
              <line
                x1={MARGIN + (t + m * minor) * zoom}
                y1={RULER - 4}
                x2={MARGIN + (t + m * minor) * zoom}
                y2={RULER}
              />
            {/each}
          {/if}
        {/each}
        {#if animUi.pointer}
          <line
            class="mark"
            x1={MARGIN + animUi.pointer.x * zoom}
            y1={0}
            x2={MARGIN + animUi.pointer.x * zoom}
            y2={RULER}
          />
        {/if}
      </svg>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <svg
        class="ruler left"
        style:top="{RULER}px"
        width={RULER}
        height={stage.height * zoom + 2 * MARGIN}
        aria-label="Vertical ruler"
        onpointerdown={(e) => startGuide(e, 'x', null)}
      >
        {#each ticks(stage.height) as t (t)}
          <line x1={RULER - 8} y1={MARGIN + t * zoom} x2={RULER} y2={MARGIN + t * zoom} />
          <text x={-(MARGIN + t * zoom) - 2} y={9} transform="rotate(-90)" text-anchor="end"
            >{t}</text
          >
          {#if minor * zoom >= 5}
            {#each [1, 2, 3, 4] as m (m)}
              <line
                x1={RULER - 4}
                y1={MARGIN + (t + m * minor) * zoom}
                x2={RULER}
                y2={MARGIN + (t + m * minor) * zoom}
              />
            {/each}
          {/if}
        {/each}
        {#if animUi.pointer}
          <line
            class="mark"
            x1={0}
            y1={MARGIN + animUi.pointer.y * zoom}
            x2={RULER}
            y2={MARGIN + animUi.pointer.y * zoom}
          />
        {/if}
      </svg>
    {/if}
    <div
      class="paper"
      bind:this={paper}
      style:left="{rulerSize + MARGIN}px"
      style:top="{rulerSize + MARGIN}px"
      style:width="{stage.width * zoom}px"
      style:height="{stage.height * zoom}px"
    >
      <canvas bind:this={canvas} style:width="100%" style:height="100%"></canvas>
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
        {#each doc.guides.x as gx, i (i)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <line
            class="guide"
            x1={drag?.kind === 'guide' && drag.axis === 'x' && drag.index === i ? drag.value : gx}
            y1={0}
            x2={drag?.kind === 'guide' && drag.axis === 'x' && drag.index === i ? drag.value : gx}
            y2={stage.height}
            vector-effect="non-scaling-stroke"
            onpointerdown={(e) => startGuide(e, 'x', i)}
          />
        {/each}
        {#each doc.guides.y as gy, i (i)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <line
            class="guide"
            x1={0}
            y1={drag?.kind === 'guide' && drag.axis === 'y' && drag.index === i ? drag.value : gy}
            x2={stage.width}
            y2={drag?.kind === 'guide' && drag.axis === 'y' && drag.index === i ? drag.value : gy}
            vector-effect="non-scaling-stroke"
            onpointerdown={(e) => startGuide(e, 'y', i)}
          />
        {/each}
        {#if drag?.kind === 'guide' && drag.index === null}
          {#if drag.axis === 'x'}
            <line
              class="guide new"
              x1={drag.value}
              y1={0}
              x2={drag.value}
              y2={stage.height}
              vector-effect="non-scaling-stroke"
            />
          {:else}
            <line
              class="guide new"
              x1={0}
              y1={drag.value}
              x2={stage.width}
              y2={drag.value}
              vector-effect="non-scaling-stroke"
            />
          {/if}
        {/if}
        {#if drag?.kind !== 'draw' && drag?.kind !== 'brush'}
          {#each selected as o (o.id)}
            {@const live = findObject(shown, o.id)?.object ?? o}
            <polygon
              class="sel"
              points={corners(live)
                .map((c) => `${c.x},${c.y}`)
                .join(' ')}
              vector-effect="non-scaling-stroke"
            />
          {/each}
        {/if}
        {#if shownSingle && $store.tool === 'select' && drag?.kind !== 'move'}
          {@const top = toStage(shownSingle, { x: shownSingle.width / 2, y: 0 })}
          {@const knob = toStage(shownSingle, { x: shownSingle.width / 2, y: -22 / zoom })}
          <line
            class="sel"
            x1={top.x}
            y1={top.y}
            x2={knob.x}
            y2={knob.y}
            vector-effect="non-scaling-stroke"
          />
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle
            class="handle rotate"
            cx={knob.x}
            cy={knob.y}
            r={hs / 2}
            vector-effect="non-scaling-stroke"
            aria-label="Rotate"
            onpointerdown={startRotate}
          />
          {#each handlePoints(shownSingle) as [handle, p] (handle)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <rect
              class="handle"
              x={p.x - hs / 2}
              y={p.y - hs / 2}
              width={hs}
              height={hs}
              vector-effect="non-scaling-stroke"
              style:cursor="{handle}-resize"
              aria-label="Resize {handle}"
              onpointerdown={(e) => startResize(e, handle)}
            />
          {/each}
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
  .corner {
    position: absolute;
    left: 0;
    top: 0;
    background: var(--bg-1);
    border-right: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    z-index: 2;
  }
  .ruler {
    position: absolute;
    background: var(--bg-1);
    z-index: 1;
    cursor: crosshair;
    user-select: none;
  }
  .ruler.top {
    top: 0;
    border-bottom: 1px solid var(--line);
  }
  .ruler.left {
    left: 0;
    border-right: 1px solid var(--line);
  }
  .ruler line {
    stroke: var(--tx-3);
    stroke-width: 1;
  }
  .ruler line.mark {
    stroke: var(--accent);
  }
  .ruler text {
    fill: var(--tx-3);
    font-size: 9px;
    font-family: var(--mono);
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
  .guide {
    stroke: #28c2d1;
    stroke-width: 1;
    cursor: move;
  }
  .guide.new {
    stroke-dasharray: 4 3;
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
  .handle.rotate {
    cursor: grab;
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
