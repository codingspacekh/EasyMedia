// AN1–AN7, AN13: draws the stage onto any 2D canvas. The preview, the PNG export, the video
// and GIF exports (M14) and the HTML player (M16) all use this one function, so what the
// student sees is what is exported (ARCHITECTURE §7.3, as the text drawing).
import { centreOf, flattenPath, localOutline } from './geometry.ts';
import { drawOrder } from './layers.ts';
import type { AnimObject, AnimationDoc, Paint, Stroke, TextObject } from './types.ts';

/** The parts of CanvasRenderingContext2D the drawing needs (a recording fake is used in tests). */
export interface StageCanvas {
  globalAlpha: number;
  fillStyle: string | object;
  strokeStyle: string | object;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(radians: number): void;
  setLineDash(segments: number[]): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  ellipse(
    x: number,
    y: number,
    rx: number,
    ry: number,
    rot: number,
    start: number,
    end: number,
  ): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  drawImage(image: unknown, x: number, y: number, w: number, h: number): void;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike;
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradientLike;
}

export interface CanvasGradientLike {
  addColorStop(offset: number, colour: string): void;
}

export interface DrawOptions {
  /** The loaded image for a picture (an HTMLImageElement in the app); null while loading. */
  image?: (pictureId: string) => unknown | null;
  /** Drawn after the background and before the objects (the grid behind them, AN2). */
  afterBackground?: (ctx: StageCanvas) => void;
}

export const LINE_HEIGHT = 1.2;
const TAU = 2 * Math.PI;
const PLACEHOLDER = '#9aa4b2';

/** The CSS font of a text object: `italic 700 64px "Inter"`. */
export function fontOf(t: TextObject): string {
  return `${t.italic ? 'italic ' : ''}${t.bold ? 700 : 400} ${t.size}px "${t.font}"`;
}

/** The paint as a canvas style, inside a box centred on (0, 0). */
function styleOf(ctx: StageCanvas, paint: Paint, w: number, h: number): string | object | null {
  switch (paint.kind) {
    case 'none':
      return null;
    case 'solid':
      return paint.colour;
    case 'linear': {
      const a = (paint.angle * Math.PI) / 180;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
      const g = ctx.createLinearGradient(-dx * half, -dy * half, dx * half, dy * half);
      g.addColorStop(0, paint.from);
      g.addColorStop(1, paint.to);
      return g;
    }
    case 'radial': {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w, h) / 2);
      g.addColorStop(0, paint.from);
      g.addColorStop(1, paint.to);
      return g;
    }
  }
}

function applyStroke(ctx: StageCanvas, stroke: Stroke): void {
  ctx.strokeStyle = stroke.colour;
  ctx.lineWidth = stroke.width;
  ctx.lineJoin = 'round';
  const w = Math.max(1, stroke.width);
  if (stroke.dash === 'dashed') {
    ctx.lineCap = 'butt';
    ctx.setLineDash([3 * w, 2 * w]);
  } else if (stroke.dash === 'dotted') {
    ctx.lineCap = 'round';
    ctx.setLineDash([0.01, 2 * w]);
  } else {
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
  }
}

/** Traces the object's outline as a path, in its own box moved so its centre is (0, 0). */
function tracePath(ctx: StageCanvas, o: AnimObject): void {
  const ox = -o.width / 2;
  const oy = -o.height / 2;
  ctx.beginPath();
  if (o.kind === 'ellipse') {
    ctx.ellipse(0, 0, o.width / 2, o.height / 2, 0, 0, TAU);
    return;
  }
  if (o.kind === 'rect' && o.radius > 0) {
    const r = Math.min(o.radius, o.width / 2, o.height / 2);
    const { width: w, height: h } = o;
    ctx.moveTo(ox + r, oy);
    ctx.lineTo(ox + w - r, oy);
    ctx.arc(ox + w - r, oy + r, r, -Math.PI / 2, 0);
    ctx.lineTo(ox + w, oy + h - r);
    ctx.arc(ox + w - r, oy + h - r, r, 0, Math.PI / 2);
    ctx.lineTo(ox + r, oy + h);
    ctx.arc(ox + r, oy + h - r, r, Math.PI / 2, Math.PI);
    ctx.lineTo(ox, oy + r);
    ctx.arc(ox + r, oy + r, r, Math.PI, 1.5 * Math.PI);
    ctx.closePath();
    return;
  }
  if (o.kind === 'path' && o.points.some((p) => p.in || p.out)) {
    const pts = o.points;
    const n = o.closed ? pts.length : pts.length - 1;
    ctx.moveTo(ox + pts[0]!.x, oy + pts[0]!.y);
    for (let i = 0; i < n; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      const c1 = a.out ?? a;
      const c2 = b.in ?? b;
      ctx.bezierCurveTo(ox + c1.x, oy + c1.y, ox + c2.x, oy + c2.y, ox + b.x, oy + b.y);
    }
    if (o.closed) ctx.closePath();
    return;
  }
  const points = o.kind === 'path' ? flattenPath(o.points, false) : localOutline(o);
  points.forEach((p, i) =>
    i === 0 ? ctx.moveTo(ox + p.x, oy + p.y) : ctx.lineTo(ox + p.x, oy + p.y),
  );
  if (o.kind !== 'path' || o.closed) ctx.closePath();
}

function drawText(ctx: StageCanvas, t: TextObject, fill: string | object | null): void {
  ctx.font = fontOf(t);
  ctx.textAlign = t.align === 'centre' ? 'center' : t.align;
  ctx.textBaseline = 'top';
  const x = t.align === 'left' ? 0 : t.align === 'centre' ? t.width / 2 : t.width;
  const ox = -t.width / 2;
  const oy = -t.height / 2;
  t.text.split('\n').forEach((line, i) => {
    const y = i * t.size * LINE_HEIGHT;
    if (t.stroke && t.stroke.width > 0) {
      applyStroke(ctx, t.stroke);
      ctx.strokeText(line, ox + x, oy + y);
    }
    if (fill !== null) {
      ctx.fillStyle = fill;
      ctx.fillText(line, ox + x, oy + y);
    }
  });
}

/** Draws one object; `alpha` is the opacity of the groups it is in (0–1). */
export function drawObject(
  ctx: StageCanvas,
  o: AnimObject,
  options: DrawOptions = {},
  alpha = 1,
): void {
  const c = centreOf(o);
  ctx.save();
  ctx.translate(c.x, c.y);
  if (o.rotation !== 0) ctx.rotate((o.rotation * Math.PI) / 180);
  const shown = alpha * (o.opacity / 100);
  if (shown !== 1) ctx.globalAlpha = shown;
  const ox = -o.width / 2;
  const oy = -o.height / 2;
  switch (o.kind) {
    case 'group':
      // The children are placed in the group's box: move its top-left corner to the origin.
      ctx.translate(ox, oy);
      for (const child of o.children) drawObject(ctx, child, options, shown);
      break;
    case 'text':
      drawText(ctx, o, styleOf(ctx, o.fill, o.width, o.height));
      break;
    case 'picture': {
      const image = options.image?.(o.pictureId) ?? null;
      if (image) ctx.drawImage(image, ox, oy, o.width, o.height);
      else {
        ctx.strokeStyle = PLACEHOLDER;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(ox, oy, o.width, o.height);
      }
      break;
    }
    default: {
      tracePath(ctx, o);
      const fill = styleOf(ctx, o.fill, o.width, o.height);
      if (fill !== null && (o.kind !== 'path' || o.closed)) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (o.stroke && o.stroke.width > 0) {
        applyStroke(ctx, o.stroke);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

/** Draws the whole stage at its own size: background, then every visible layer in order. */
export function drawStage(ctx: StageCanvas, doc: AnimationDoc, options: DrawOptions = {}): void {
  ctx.fillStyle = doc.stage.background;
  ctx.fillRect(0, 0, doc.stage.width, doc.stage.height);
  options.afterBackground?.(ctx);
  for (const { object } of drawOrder(doc)) drawObject(ctx, object, options);
}
