// AN1–AN7, AN13: draws the stage onto any 2D canvas. The preview, the PNG export, the video
// and GIF exports (M14) and the HTML player (M16) all use this one function, so what the
// student sees is what is exported (ARCHITECTURE §7.3, as the text drawing).
import { curvedText, curveOf, type PlacedLetter } from './curve.ts';
import { roughTextWidth } from './factory.ts';
import { flattenPath, localOutline, outlineOf, pivotInBox, skewOf } from './geometry.ts';
import { colourStops, radialCentre } from './gradient.ts';
import { TRANSPARENT } from './rules.ts';
import { stateAt } from './state.ts';
import type {
  AnimObject,
  AnimationDoc,
  ButtonObject,
  Layer,
  Paint,
  PathObject,
  Stroke,
  TextObject,
} from './types.ts';

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
  /** AN23: a flip is a scale of −1. */
  scale(x: number, y: number): void;
  /** AN25: a skew (and taking it off again for an outline). */
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
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
  /** AN24: 'evenodd' for a shape with holes. */
  fill(rule?: 'nonzero' | 'evenodd'): void;
  stroke(): void;
  clip(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  /** AN26: how wide words are in the current font (a canvas without it: roughly). */
  measureText?(text: string): { width: number };
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
  /**
   * Draws `draw` into a layer of its own, then puts the layer down at `alpha`: a see-through
   * group is faded as one picture, so where its parts overlap it is no darker. A canvas without
   * it fades each part instead.
   */
  withLayer?(alpha: number, draw: (layer: StageCanvas) => void): void;
}

export interface CanvasGradientLike {
  addColorStop(offset: number, colour: string): void;
}

export interface DrawOptions {
  /** The loaded image for a picture (an HTMLImageElement in the app); null while loading. */
  image?: (pictureId: string) => unknown | null;
  /** Drawn after the background and before the objects (the grid behind them, AN2). */
  afterBackground?: (ctx: StageCanvas) => void;
  /** AN9: the frame to draw (every object with its tweened values); frame 0 when absent. */
  frame?: number;
  /**
   * AN12: the stage while editing — a mask works only while its layer is locked (the padlock, as
   * in the coursebook); unlocked, its shapes are shown so they can be moved. Exports leave this
   * out, so masks always work there.
   */
  editing?: boolean;
  /**
   * AN14: onion skin while editing — the objects to draw faintly behind a layer's own (the
   * drawings just before and after the one shown, see frames.ts), to draw the next one in step.
   */
  onionSkin?: (layerId: string) => readonly AnimObject[];
}

/** AN14: how strongly the onion skin's neighbouring drawings are drawn. */
export const ONION_OPACITY = 0.3;

export const LINE_HEIGHT = 1.2;
const TAU = 2 * Math.PI;
const PLACEHOLDER = '#9aa4b2';

/** The CSS font of a text object: `italic 700 64px "Inter"`. */
export function fontOf(t: TextObject): string {
  return `${t.italic ? 'italic ' : ''}${t.bold ? 700 : 400} ${t.size}px "${t.font}"`;
}

/** AN18: a button's label is drawn in the bundled Inter, semi-bold. */
export const BUTTON_FONT = 'Inter';
export const buttonFontOf = (b: ButtonObject): string => `600 ${b.size}px "${BUTTON_FONT}"`;
/** A button's corners: rounded a little, as a browser's own buttons. */
const BUTTON_RADIUS = 3;

/** The CSS fonts the objects' text and button labels need loaded before drawing, each once. */
export function fontsUsed(objects: readonly AnimObject[]): string[] {
  const walk = (list: readonly AnimObject[]): string[] =>
    list.flatMap((o) =>
      o.kind === 'text'
        ? [fontOf(o)]
        : o.kind === 'button'
          ? [buttonFontOf(o)]
          : o.kind === 'group'
            ? walk(o.children)
            : [],
    );
  return [...new Set(walk(objects))];
}

/** Where a letter is drawn from (AN26): a place in the box centred on (0, 0), and a turn. */
type Spot = { x: number; y: number; angle: number };

/**
 * The paint as a canvas style, inside a box centred on (0, 0). Given a letter's spot (AN26), the
 * gradient is made where the letter is drawn from, so it still runs across the whole words.
 */
function styleOf(
  ctx: StageCanvas,
  paint: Paint,
  w: number,
  h: number,
  spot?: Spot,
): string | object | null {
  const at = (x: number, y: number) => {
    if (!spot) return { x, y };
    const a = (-spot.angle * Math.PI) / 180;
    const [dx, dy] = [x - spot.x, y - spot.y];
    return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
  };
  let g: CanvasGradientLike;
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
      const [p, q] = [at(-dx * half, -dy * half), at(dx * half, dy * half)];
      g = ctx.createLinearGradient(p.x, p.y, q.x, q.y);
      break;
    }
    case 'radial': {
      // AN6: from its centre (the middle of the box unless moved), as far as half the box.
      const centre = radialCentre(paint);
      const c = at(((centre.x - 50) / 100) * w, ((centre.y - 50) / 100) * h);
      g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, Math.max(w, h) / 2);
      break;
    }
  }
  for (const stop of colourStops(paint)) g.addColorStop(stop.offset, stop.colour);
  return g;
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

/** A rectangle with rounded corners, centred on (0, 0). */
function roundedRect(ctx: StageCanvas, w: number, h: number, radius: number): void {
  const ox = -w / 2;
  const oy = -h / 2;
  const r = Math.min(radius, w / 2, h / 2);
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
  if ((o.kind === 'rect' && o.radius > 0) || o.kind === 'button') {
    roundedRect(ctx, o.width, o.height, o.kind === 'rect' ? o.radius : BUTTON_RADIUS);
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
    traceHoles(ctx, o);
    return;
  }
  const points = o.kind === 'path' ? flattenPath(o.points, false) : localOutline(o);
  points.forEach((p, i) =>
    i === 0 ? ctx.moveTo(ox + p.x, oy + p.y) : ctx.lineTo(ox + p.x, oy + p.y),
  );
  if (o.kind !== 'path' || o.closed) ctx.closePath();
  if (o.kind === 'path') traceHoles(ctx, o);
}

/** AN24: each hole as its own closed outline in the same path (filled even-odd). */
function traceHoles(ctx: StageCanvas, o: PathObject): void {
  const ox = -o.width / 2;
  const oy = -o.height / 2;
  for (const hole of o.holes ?? []) {
    flattenPath(hole, true).forEach((p, i) =>
      i === 0 ? ctx.moveTo(ox + p.x, oy + p.y) : ctx.lineTo(ox + p.x, oy + p.y),
    );
    ctx.closePath();
  }
}

/**
 * AN26: curved text, letter by letter: each from the middle of its line-high cell on the arc,
 * turned to follow it; the bent words in the middle of the box (their bounds are the box).
 */
function drawCurvedText(ctx: StageCanvas, t: TextObject): void {
  ctx.font = fontOf(t);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const widthOf = (s: string) =>
    ctx.measureText ? ctx.measureText(s).width : roughTextWidth(s, t.size);
  const bent = curvedText(t, widthOf);
  const half = (t.size * LINE_HEIGHT) / 2;
  const letter = (l: PlacedLetter) => {
    const spot = { x: l.x - bent.width / 2, y: l.y - bent.height / 2, angle: l.angle };
    ctx.save();
    ctx.translate(spot.x, spot.y);
    if (spot.angle !== 0) ctx.rotate((spot.angle * Math.PI) / 180);
    if (t.stroke && t.stroke.width > 0) {
      applyStroke(ctx, t.stroke);
      ctx.strokeText(l.char, 0, -half);
    }
    const fill = styleOf(ctx, t.fill, t.width, t.height, spot);
    if (fill !== null) {
      ctx.fillStyle = fill;
      ctx.fillText(l.char, 0, -half);
    }
    ctx.restore();
  };
  for (const l of bent.letters) if (l.char.trim() !== '') letter(l);
}

function drawText(ctx: StageCanvas, t: TextObject): void {
  if (curveOf(t) !== 0) return drawCurvedText(ctx, t);
  const fill = styleOf(ctx, t.fill, t.width, t.height);
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
  // AN27: turned, mirrored and skewed about the point it turns about (its centre unless chosen).
  const pivot = pivotInBox(o);
  ctx.save();
  ctx.translate(o.x + pivot.x, o.y + pivot.y);
  if (o.rotation !== 0) ctx.rotate((o.rotation * Math.PI) / 180);
  if (o.flipX || o.flipY) ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
  // AN25: skewed in its own box, as geometry's toStage: x' = x − tan(skewX)·y, y' = y + tan(skewY)·x.
  const k = skewOf(o);
  const skewed = k.x !== 0 || k.y !== 0;
  if (skewed) ctx.transform(1, k.y, -k.x, 1, 0, 0);
  // The rest is drawn about the box's centre: placed from the pivot, in the turned box.
  const fromPivot = { x: o.width / 2 - pivot.x, y: o.height / 2 - pivot.y };
  if (fromPivot.x !== 0 || fromPivot.y !== 0) ctx.translate(fromPivot.x, fromPivot.y);
  const shown = alpha * (o.opacity / 100);
  if (shown !== 1) ctx.globalAlpha = shown;
  const ox = -o.width / 2;
  const oy = -o.height / 2;
  switch (o.kind) {
    case 'group':
      // The children are placed in the group's box: move its top-left corner to the origin.
      ctx.translate(ox, oy);
      if (shown < 1 && o.children.length > 1 && ctx.withLayer)
        ctx.withLayer(shown, (layer) => {
          for (const child of o.children) drawObject(layer, child, options);
        });
      else for (const child of o.children) drawObject(ctx, child, options, shown);
      break;
    case 'text':
      drawText(ctx, o);
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
        if (o.kind === 'path' && o.holes?.length) ctx.fill('evenodd');
        else ctx.fill();
      }
      if (o.stroke && o.stroke.width > 0) {
        // AN25: the outline follows the skewed shape but its lines stay as wide as set (as in
        // the SVG): the skew is taken off while it is drawn, then put back for a button's label.
        const det = 1 + k.x * k.y;
        const unskew = skewed && Math.abs(det) > 1e-9;
        if (unskew) ctx.transform(1 / det, -k.y / det, k.x / det, 1 / det, 0, 0);
        applyStroke(ctx, o.stroke);
        ctx.stroke();
        if (unskew) ctx.transform(1, k.y, -k.x, 1, 0, 0);
      }
      if (o.kind === 'button') {
        // AN18: the label in the middle of the box.
        ctx.font = buttonFontOf(o);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = o.colour;
        ctx.fillText(o.label, 0, 0);
      }
    }
  }
  ctx.restore();
}

/** Draws the whole stage at its own size: background, then every visible layer in order. */
export function drawStage(ctx: StageCanvas, doc: AnimationDoc, options: DrawOptions = {}): void {
  // AN21: a transparent stage is cleared (a canvas used again keeps no earlier frame).
  if (doc.stage.background === TRANSPARENT) ctx.clearRect(0, 0, doc.stage.width, doc.stage.height);
  else {
    ctx.fillStyle = doc.stage.background;
    ctx.fillRect(0, 0, doc.stage.width, doc.stage.height);
  }
  options.afterBackground?.(ctx);
  // Frame 0 is a frame like any other (an object on a path is at its start, not where drawn).
  const shown = options.frame === undefined ? doc : stateAt(doc, options.frame);
  const layers = shown.layers;
  const masking = (l: Layer): boolean =>
    l.mask === true && l.visible && (!options.editing || l.locked);
  const skin = (layer: Layer): void => {
    for (const object of options.onionSkin?.(layer.id) ?? [])
      drawObject(ctx, object, options, ONION_OPACITY);
  };
  layers.forEach((layer, i) => {
    if (!layer.visible || masking(layer)) return;
    const mask = layers[i + 1];
    if (!mask || !masking(mask)) {
      skin(layer);
      for (const object of layer.objects) drawObject(ctx, object, options);
      return;
    }
    // AN12: only what lies under the mask's shapes is seen of this layer.
    ctx.save();
    ctx.beginPath();
    for (const o of mask.objects)
      for (const outline of outlineOf(o)) {
        outline.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
      }
    ctx.clip();
    for (const object of layer.objects) drawObject(ctx, object, options);
    ctx.restore();
  });
}
