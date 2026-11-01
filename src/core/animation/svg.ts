// AN5: the size of an SVG picture, as a browser gives it to an <img>. FFmpeg cannot read SVG, so
// its size comes from the file itself; the canvas draws it (M16 plan, build order 1).
import { EditError } from '../model/errors.ts';

/** px per unit at the CSS 96 dpi. */
const UNITS: Record<string, number> = {
  '': 1,
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72,
  pc: 16,
};

const round = (n: number) => Math.round(n * 100) / 100;

function attribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i').exec(tag);
  return match?.[2]?.trim();
}

/** A length in px, or undefined for "100%", "auto" or anything unreadable. */
function length(value: string | undefined): number | undefined {
  const match = /^([\d.]+(?:e[+-]?\d+)?)\s*([a-z]*)$/i.exec(value ?? '');
  if (!match) return undefined;
  const unit = UNITS[match[2]!.toLowerCase()];
  const n = Number(match[1]) * (unit ?? NaN);
  return Number.isFinite(n) && n > 0 ? round(n) : undefined;
}

export function svgSize(text: string): { width: number; height: number } {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) throw new EditError('This file is not an SVG picture.');
  let width = length(attribute(tag, 'width'));
  let height = length(attribute(tag, 'height'));
  const box = (attribute(tag, 'viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [bw, bh] = [box[2] ?? NaN, box[3] ?? NaN];
  if (bw > 0 && bh > 0) {
    if (width === undefined && height === undefined) [width, height] = [bw, bh];
    else if (width === undefined) width = round((height! * bw) / bh);
    else if (height === undefined) height = round((width * bh) / bw);
  }
  return { width: width ?? 300, height: height ?? 150 };
}
