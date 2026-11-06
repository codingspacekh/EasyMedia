// AN22: the frame at the playhead as an SVG picture (O/N/25 Apple: "Save the image as an .svg
// file"). The stage is drawn by the same drawStage as the preview and every export, through a
// canvas that writes SVG elements instead of pixels, so the picture matches the stage: each shape
// a path (its fill and outline on one element), gradients, text as text, pictures inside as data,
// masks as clip paths. Pure: no DOM.
import { drawStage, type CanvasGradientLike, type StageCanvas } from './draw.ts';
import type { AnimationDoc, Id } from './types.ts';
import { fontFaceRule, genericFamily, type FontFile } from '../text/fonts.ts';

type Matrix = [number, number, number, number, number, number];

const TAU = 2 * Math.PI;

/** Up to 3 decimals, no "-0", no trailing zeros. */
function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/** A canvas font without its size: '700 48px "Inter"' → '700 "Inter"' (AN22 text tops). */
export const fontKey = (font: string): string => font.replace(/ [\d.]+px /, ' ');

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** a × b: b's step first, then a's (as an SVG transform list "a b"). */
function times(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** The step back of a matrix; null when there is none (squashed flat). */
function inverse([a, b, c, d, e, f]: Matrix): Matrix | null {
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const sameMatrix = (a: Matrix, b: Matrix) => a.every((v, i) => Math.abs(v - b[i]!) < 1e-9);

class Gradient implements CanvasGradientLike {
  readonly stops: string[] = [];
  readonly id: string;
  private readonly tag: string;
  private readonly attrs: string;
  /** From the gradient's own coordinates to the stage (AN25: a skewed box); null: the same. */
  private readonly base: Matrix | null;
  /** AN6: the transform of the text it fills, whose own space it is read in. */
  private element: Matrix | null = null;
  constructor(id: string, tag: string, attrs: string, base: Matrix | null) {
    this.id = id;
    this.tag = tag;
    this.attrs = attrs;
    this.base = base;
  }
  addColorStop(offset: number, colour: string): void {
    this.stops.push(`<stop offset="${n(offset)}" stop-color="${escape(colour)}"/>`);
  }
  /**
   * AN6: the gradient for an element placed by the transform `m` (text): an SVG reads its
   * gradient in the element's own space, so it takes the way back from the stage first. Used
   * by an element with another transform, it is copied under `id`.
   */
  forElement(m: Matrix, id: () => string): Gradient {
    if (this.element === null) {
      this.element = m;
      return this;
    }
    if (sameMatrix(this.element, m)) return this;
    const copy = new Gradient(id(), this.tag, this.attrs, this.base);
    copy.stops.push(...this.stops);
    copy.element = m;
    return copy;
  }
  toString(): string {
    const back = this.element ? inverse(this.element) : null;
    const m = back ? times(back, this.base ?? IDENTITY) : this.base;
    const transform = m ? ` gradientTransform="matrix(${m.map(n).join(' ')})"` : '';
    return `<${this.tag} id="${this.id}" gradientUnits="userSpaceOnUse"${transform}${this.attrs}>${this.stops.join('')}</${this.tag}>`;
  }
}

/** The drawing's picture: what options.image gives drawStage for a picture with data. */
interface Href {
  href: string;
}

/** A StageCanvas that records what is drawn as SVG. */
class SvgCanvas implements StageCanvas {
  globalAlpha = 1;
  fillStyle: string | object = '#000000';
  strokeStyle: string | object = '#000000';
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  font = '10px sans-serif';
  textAlign = 'start';
  textBaseline = 'alphabetic';

  private readonly textTops: Readonly<Record<string, number>>;
  /** AN26: how wide words are in a font, as the stage measures them (curved text). */
  measureText?: (text: string) => { width: number };
  constructor(
    textTops: Readonly<Record<string, number>> = {},
    measure?: (font: string, text: string) => number,
  ) {
    this.textTops = textTops;
    if (measure) this.measureText = (text) => ({ width: measure(this.font, text) });
  }

  private m: Matrix = [1, 0, 0, 1, 0, 0];
  private dash: number[] = [];
  private path: string[] = [];
  private at: { x: number; y: number } | null = null;
  private stack: { state: Partial<SvgCanvas>; m: Matrix; dash: number[]; groups: number }[] = [];
  private groups = 0;
  private readonly gradients: Gradient[] = [];
  private readonly clips: string[] = [];
  private readonly body: string[] = [];
  /** A filled path waiting for its outline, so both go on one element. */
  private pending: { d: string; attrs: string } | null = null;

  // ---- state ----

  save(): void {
    this.flush();
    const { globalAlpha, fillStyle, strokeStyle, lineWidth, lineCap, lineJoin } = this;
    const { font, textAlign, textBaseline } = this;
    this.stack.push({
      state: {
        globalAlpha,
        fillStyle,
        strokeStyle,
        lineWidth,
        lineCap,
        lineJoin,
        font,
        textAlign,
        textBaseline,
      },
      m: [...this.m],
      dash: [...this.dash],
      groups: this.groups,
    });
    this.groups = 0;
  }

  restore(): void {
    this.flush();
    for (; this.groups > 0; this.groups--) this.body.push('</g>');
    const top = this.stack.pop();
    if (!top) return;
    Object.assign(this, top.state);
    this.m = top.m;
    this.dash = top.dash;
    this.groups = top.groups;
  }

  translate(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m;
    this.m = [a, b, c, d, e + a * x + c * y, f + b * x + d * y];
  }

  scale(x: number, y: number): void {
    const [a, b, c, d, e, f] = this.m;
    this.m = [a * x, b * x, c * y, d * y, e, f];
  }

  /** AN25: a skew (or any matrix), after what is set already, as a canvas does. */
  transform(a2: number, b2: number, c2: number, d2: number, e2: number, f2: number): void {
    const [a, b, c, d, e, f] = this.m;
    this.m = [
      a * a2 + c * b2,
      b * a2 + d * b2,
      a * c2 + c * d2,
      b * c2 + d * d2,
      a * e2 + c * f2 + e,
      b * e2 + d * f2 + f,
    ];
  }

  /** Only turned (and moved): a circle stays a circle and an arc is an SVG arc. */
  private isTurnOnly(): boolean {
    const [a, b, c, d] = this.m;
    return Math.abs(a - d) < 1e-9 && Math.abs(b + c) < 1e-9;
  }

  /** Turned, mirrored or moved, not skewed: a gradient made on the stage looks the same. */
  private isUnskewed(): boolean {
    const [a, b, c, d] = this.m;
    return Math.abs(a * c + b * d) < 1e-9 && Math.abs(a * a + b * b - (c * c + d * d)) < 1e-9;
  }

  rotate(r: number): void {
    const [a, b, c, d, e, f] = this.m;
    const cos = Math.cos(r);
    const sin = Math.sin(r);
    this.m = [a * cos + c * sin, b * cos + d * sin, c * cos - a * sin, d * cos - b * sin, e, f];
  }

  setLineDash(segments: number[]): void {
    this.dash = [...segments];
  }

  private point(x: number, y: number): { x: number; y: number } {
    const [a, b, c, d, e, f] = this.m;
    return { x: a * x + c * y + e, y: b * x + d * y + f };
  }

  // ---- paths (kept in stage coordinates, as a canvas does) ----

  beginPath(): void {
    this.flush();
    this.path = [];
    this.at = null;
  }

  closePath(): void {
    this.path.push('Z');
  }

  moveTo(x: number, y: number): void {
    this.at = this.point(x, y);
    this.path.push(`M${n(this.at.x)} ${n(this.at.y)}`);
  }

  lineTo(x: number, y: number): void {
    this.at = this.point(x, y);
    this.path.push(`L${n(this.at.x)} ${n(this.at.y)}`);
  }

  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void {
    const p = [this.point(c1x, c1y), this.point(c2x, c2y), this.point(x, y)];
    this.path.push(`C${p.map((q) => `${n(q.x)} ${n(q.y)}`).join(' ')}`);
    this.at = p[2]!;
  }

  arc(x: number, y: number, r: number, start: number, end: number): void {
    this.ellipse(x, y, r, r, 0, start, end);
  }

  ellipse(x: number, y: number, rx: number, ry: number, rot: number, start: number, end: number) {
    const local = (t: number) => ({
      x: x + rx * Math.cos(t) * Math.cos(rot) - ry * Math.sin(t) * Math.sin(rot),
      y: y + rx * Math.cos(t) * Math.sin(rot) + ry * Math.sin(t) * Math.cos(rot),
    });
    const begin = local(start);
    const first = this.point(begin.x, begin.y);
    this.path.push(`${this.at ? 'L' : 'M'}${n(first.x)} ${n(first.y)}`);
    const sweep = Math.min(end - start, TAU);
    if (!this.isTurnOnly()) return this.curvedArc(local, start, sweep, rx, ry, rot);
    // A whole turn is two halves: one SVG arc cannot end where it starts.
    const pieces = Math.abs(sweep) >= TAU - 1e-9 ? 2 : 1;
    const turn = (Math.atan2(this.m[1], this.m[0]) + rot) * (180 / Math.PI);
    for (let i = 1; i <= pieces; i++) {
      const piece = sweep / pieces;
      const p = local(start + piece * i);
      const q = this.point(p.x, p.y);
      const large = Math.abs(piece) >= Math.PI - 1e-9 ? 1 : 0;
      this.path.push(
        `A${n(rx)} ${n(ry)} ${n(turn)} ${large} ${piece > 0 ? 1 : 0} ${n(q.x)} ${n(q.y)}`,
      );
      this.at = q;
    }
  }

  /**
   * An arc drawn skewed (AN25) or mirrored (AN23), which an SVG arc cannot be: Bézier curves, a
   * quarter turn or less each, through the arc's own points (exact enough to see no difference).
   */
  private curvedArc(
    local: (t: number) => { x: number; y: number },
    start: number,
    sweep: number,
    rx: number,
    ry: number,
    rot: number,
  ): void {
    const pieces = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2) - 1e-9));
    const piece = sweep / pieces;
    const handle = (4 / 3) * Math.tan(piece / 4);
    // The arc's direction at t, in the box (before the matrix).
    const along = (t: number) => ({
      x: -rx * Math.sin(t) * Math.cos(rot) - ry * Math.cos(t) * Math.sin(rot),
      y: -rx * Math.sin(t) * Math.sin(rot) + ry * Math.cos(t) * Math.cos(rot),
    });
    for (let i = 0; i < pieces; i++) {
      const t0 = start + piece * i;
      const t1 = t0 + piece;
      const [p0, p1, d0, d1] = [local(t0), local(t1), along(t0), along(t1)];
      this.bezierCurveTo(
        p0.x + handle * d0.x,
        p0.y + handle * d0.y,
        p1.x - handle * d1.x,
        p1.y - handle * d1.y,
        p1.x,
        p1.y,
      );
    }
  }

  private get d(): string {
    return this.path.join('');
  }

  private paint(style: string | object): string {
    return style instanceof Gradient ? `url(#${style.id})` : escape(String(style));
  }

  private opacity(): string {
    return this.globalAlpha === 1 ? '' : ` opacity="${n(this.globalAlpha)}"`;
  }

  private strokeAttrs(): string {
    const dash = this.dash.length ? ` stroke-dasharray="${this.dash.map(n).join(' ')}"` : '';
    return (
      ` stroke="${this.paint(this.strokeStyle)}" stroke-width="${n(this.lineWidth)}"` +
      ` stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${dash}`
    );
  }

  private flush(): void {
    if (!this.pending) return;
    this.body.push(`<path d="${this.pending.d}"${this.pending.attrs}/>`);
    this.pending = null;
  }

  fill(rule?: 'nonzero' | 'evenodd'): void {
    this.flush();
    const evenodd = rule === 'evenodd' ? ' fill-rule="evenodd"' : '';
    this.pending = {
      d: this.d,
      attrs: ` fill="${this.paint(this.fillStyle)}"${evenodd}${this.opacity()}`,
    };
  }

  stroke(): void {
    if (this.pending?.d === this.d) this.pending.attrs += this.strokeAttrs();
    else {
      this.flush();
      this.pending = { d: this.d, attrs: ` fill="none"${this.opacity()}${this.strokeAttrs()}` };
    }
    this.flush();
  }

  clip(): void {
    this.flush();
    const id = `c${this.clips.length + 1}`;
    this.clips.push(`<clipPath id="${id}"><path d="${this.d}"/></clipPath>`);
    this.body.push(`<g clip-path="url(#${id})">`);
    this.groups++;
  }

  /** A see-through group: its parts in one <g> with the opacity, so overlaps are no darker. */
  withLayer(alpha: number, draw: (layer: StageCanvas) => void): void {
    this.flush();
    this.body.push(`<g opacity="${n(alpha)}">`);
    this.save();
    this.globalAlpha = 1;
    draw(this);
    this.restore();
    this.body.push('</g>');
  }

  // ---- rectangles, text and pictures ----

  private isPlain(): boolean {
    const [a, b, c, d] = this.m;
    return a === 1 && b === 0 && c === 0 && d === 1;
  }

  private rectPath(x: number, y: number, w: number, h: number): void {
    this.beginPath();
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.flush();
    if (!this.isPlain()) {
      this.rectPath(x, y, w, h);
      return this.fill();
    }
    const p = this.point(x, y);
    this.body.push(
      `<rect x="${n(p.x)}" y="${n(p.y)}" width="${n(w)}" height="${n(h)}" fill="${this.paint(this.fillStyle)}"${this.opacity()}/>`,
    );
  }

  /** A new SVG starts empty: there is nothing to clear. */
  clearRect(): void {}

  strokeRect(x: number, y: number, w: number, h: number): void {
    this.rectPath(x, y, w, h);
    this.stroke();
  }

  private matrixAttr(): string {
    return ` transform="matrix(${this.m.map(n).join(' ')})"`;
  }

  private text(text: string, x: number, y: number, paint: string): void {
    this.flush();
    const font = /^(italic )?(\d+) ([\d.]+)px "(.*)"$/.exec(this.font);
    const [, italic, weight, size, family] = font ?? [];
    const anchor = { left: 'start', start: 'start', center: 'middle', right: 'end', end: 'end' };
    // Text drawn from the top of the em square (as the stage draws it) goes on the baseline the
    // app measured for the font: "text-before-edge" follows the font's own ascender instead,
    // which puts a tall-lettered font (Pacifico) far lower than the stage shows it.
    const top = font && this.textBaseline === 'top' ? this.textTops[fontKey(this.font)] : undefined;
    if (top !== undefined) y += top * Number(size);
    const baseline =
      top !== undefined
        ? 'alphabetic'
        : this.textBaseline === 'top'
          ? 'text-before-edge'
          : this.textBaseline === 'middle'
            ? 'central'
            : 'alphabetic';
    const fontAttrs = font
      ? ` font-family="'${escape(family!)}', ${genericFamily(family!)}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}`
      : '';
    this.body.push(
      `<text x="${n(x)}" y="${n(y)}"${fontAttrs} text-anchor="${anchor[this.textAlign as keyof typeof anchor] ?? 'start'}" dominant-baseline="${baseline}" xml:space="preserve"${paint}${this.opacity()}${this.matrixAttr()}>${escape(text)}</text>`,
    );
  }

  fillText(text: string, x: number, y: number): void {
    // AN6: a gradient is read in the text's own space, where its transform puts it.
    const style =
      this.fillStyle instanceof Gradient
        ? this.fillStyle.forElement([...this.m], () => this.newGradientId())
        : this.fillStyle;
    if (style instanceof Gradient && !this.gradients.includes(style)) this.gradients.push(style);
    this.text(text, x, y, ` fill="${this.paint(style)}"`);
  }

  strokeText(text: string, x: number, y: number): void {
    this.text(text, x, y, ` fill="none"${this.strokeAttrs()}`);
  }

  drawImage(image: unknown, x: number, y: number, w: number, h: number): void {
    this.flush();
    const { href } = image as Href;
    this.body.push(
      `<image href="${escape(href)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"${this.opacity()}${this.matrixAttr()}/>`,
    );
  }

  // ---- gradients, in stage coordinates where they are made ----

  private newGradientId(): string {
    return `g${this.gradients.length + 1}`;
  }

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike {
    // AN25: a skewed gradient is made in the box and leans with it (a gradientTransform).
    const skewed = !this.isUnskewed();
    const a = skewed ? { x: x0, y: y0 } : this.point(x0, y0);
    const b = skewed ? { x: x1, y: y1 } : this.point(x1, y1);
    const g = new Gradient(
      this.newGradientId(),
      'linearGradient',
      ` x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}"`,
      skewed ? [...this.m] : null,
    );
    this.gradients.push(g);
    return g;
  }

  createRadialGradient(
    x0: number,
    y0: number,
    _r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradientLike {
    const skewed = !this.isUnskewed();
    const c = skewed ? { x: x1, y: y1 } : this.point(x1, y1);
    // AN6: it starts from its centre (fx, fy), unless a canvas was asked otherwise.
    const f = skewed ? { x: x0, y: y0 } : this.point(x0, y0);
    const focus =
      Math.abs(f.x - c.x) > 1e-9 || Math.abs(f.y - c.y) > 1e-9
        ? ` fx="${n(f.x)}" fy="${n(f.y)}"`
        : '';
    const g = new Gradient(
      this.newGradientId(),
      'radialGradient',
      ` cx="${n(c.x)}" cy="${n(c.y)}"${focus} r="${n(r1)}"`,
      skewed ? [...this.m] : null,
    );
    this.gradients.push(g);
    return g;
  }

  /** The finished SVG document. */
  finish(width: number, height: number, styles: readonly string[] = []): string {
    this.flush();
    for (; this.groups > 0; this.groups--) this.body.push('</g>');
    const style = styles.length ? [`<style>${styles.join('\n')}</style>`] : [];
    const defs = [...style, ...this.gradients.map(String), ...this.clips];
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n` +
      (defs.length ? `<defs>${defs.join('')}</defs>\n` : '') +
      this.body.join('\n') +
      '\n</svg>\n'
    );
  }
}

/**
 * AN22: the stage at `frame` as an SVG document. `pictures` gives each picture used as a data URL
 * (one the app could not read is drawn as the stage draws a missing picture: a dashed box);
 * `fonts` the bundled fonts its text uses, put inside so it looks the same on any computer
 * (9626/04 M/J/18 TTS10 in a script font, M/J/21 GlobalLogo in a sans-serif); `textTops` where
 * each font's baseline sits below the top the stage draws text from (StageRenderer.textTops);
 * `measure` how wide words are in a font, as the stage measures them (StageRenderer.textWidths),
 * so curved text (AN26) has its letters where the stage puts them.
 */
export function stageSvg(
  doc: AnimationDoc,
  frame = 0,
  pictures: Readonly<Record<Id, string>> = {},
  fonts: readonly { face: FontFile; url: string }[] = [],
  textTops: Readonly<Record<string, number>> = {},
  measure?: (font: string, text: string) => number,
): string {
  const canvas = new SvgCanvas(textTops, measure);
  drawStage(canvas, doc, {
    frame,
    image: (id) => (pictures[id] ? ({ href: pictures[id] } satisfies Href) : null),
  });
  return canvas.finish(
    doc.stage.width,
    doc.stage.height,
    fonts.map((f) => fontFaceRule(f.face, f.url)),
  );
}
