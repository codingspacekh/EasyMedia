// AN22: the frame at the playhead as an SVG picture (O/N/25 Apple: "Save the image as an .svg
// file"). The stage is drawn by the same drawStage as the preview and every export, through a
// canvas that writes SVG elements instead of pixels, so the picture matches the stage: each shape
// a path (its fill and outline on one element), gradients, text as text, pictures inside as data,
// masks as clip paths. Pure: no DOM.
import { drawStage, type CanvasGradientLike, type StageCanvas } from './draw.ts';
import type { AnimationDoc, Id } from './types.ts';

type Matrix = [number, number, number, number, number, number];

const TAU = 2 * Math.PI;

/** Up to 3 decimals, no "-0", no trailing zeros. */
function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

const escape = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

class Gradient implements CanvasGradientLike {
  readonly stops: string[] = [];
  readonly id: string;
  private readonly open: string;
  private readonly close: string;
  constructor(id: string, open: string, close: string) {
    this.id = id;
    this.open = open;
    this.close = close;
  }
  addColorStop(offset: number, colour: string): void {
    this.stops.push(`<stop offset="${n(offset)}" stop-color="${escape(colour)}"/>`);
  }
  toString(): string {
    return `${this.open}${this.stops.join('')}${this.close}`;
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

  fill(): void {
    this.flush();
    this.pending = { d: this.d, attrs: ` fill="${this.paint(this.fillStyle)}"${this.opacity()}` };
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

  private transform(): string {
    return ` transform="matrix(${this.m.map(n).join(' ')})"`;
  }

  private text(text: string, x: number, y: number, paint: string): void {
    this.flush();
    const font = /^(italic )?(\d+) ([\d.]+)px "(.*)"$/.exec(this.font);
    const [, italic, weight, size, family] = font ?? [];
    const anchor = { left: 'start', start: 'start', center: 'middle', right: 'end', end: 'end' };
    const baseline =
      this.textBaseline === 'top'
        ? 'text-before-edge'
        : this.textBaseline === 'middle'
          ? 'central'
          : 'alphabetic';
    const fontAttrs = font
      ? ` font-family="${escape(family!)}" font-size="${size}" font-weight="${weight}"${italic ? ' font-style="italic"' : ''}`
      : '';
    this.body.push(
      `<text x="${n(x)}" y="${n(y)}"${fontAttrs} text-anchor="${anchor[this.textAlign as keyof typeof anchor] ?? 'start'}" dominant-baseline="${baseline}" xml:space="preserve"${paint}${this.opacity()}${this.transform()}>${escape(text)}</text>`,
    );
  }

  fillText(text: string, x: number, y: number): void {
    this.text(text, x, y, ` fill="${this.paint(this.fillStyle)}"`);
  }

  strokeText(text: string, x: number, y: number): void {
    this.text(text, x, y, ` fill="none"${this.strokeAttrs()}`);
  }

  drawImage(image: unknown, x: number, y: number, w: number, h: number): void {
    this.flush();
    const { href } = image as Href;
    this.body.push(
      `<image href="${escape(href)}" x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none"${this.opacity()}${this.transform()}/>`,
    );
  }

  // ---- gradients, in stage coordinates where they are made ----

  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradientLike {
    const a = this.point(x0, y0);
    const b = this.point(x1, y1);
    const id = `g${this.gradients.length + 1}`;
    const g = new Gradient(
      id,
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}">`,
      '</linearGradient>',
    );
    this.gradients.push(g);
    return g;
  }

  createRadialGradient(
    _x0: number,
    _y0: number,
    _r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): CanvasGradientLike {
    const c = this.point(x1, y1);
    const id = `g${this.gradients.length + 1}`;
    const g = new Gradient(
      id,
      `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(c.x)}" cy="${n(c.y)}" r="${n(r1)}">`,
      '</radialGradient>',
    );
    this.gradients.push(g);
    return g;
  }

  /** The finished SVG document. */
  finish(width: number, height: number): string {
    this.flush();
    for (; this.groups > 0; this.groups--) this.body.push('</g>');
    const defs = [...this.gradients.map(String), ...this.clips];
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
 * (one the app could not read is drawn as the stage draws a missing picture: a dashed box).
 */
export function stageSvg(
  doc: AnimationDoc,
  frame = 0,
  pictures: Readonly<Record<Id, string>> = {},
): string {
  const canvas = new SvgCanvas();
  drawStage(canvas, doc, {
    frame,
    image: (id) => (pictures[id] ? ({ href: pictures[id] } satisfies Href) : null),
  });
  return canvas.finish(doc.stage.width, doc.stage.height);
}
