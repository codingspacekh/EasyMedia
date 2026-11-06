// AN26: text along a curve (9626/04 M/J/17 the HUNGRY logo, O/N/17 Rock ICT, M/J/18 "TTS is
// 10!", March 2021): the words bent along a circular arc, each letter placed on it and turned to
// follow it, as Word's and Canva's arch. The straight words are bent as a whole: a letter's place
// across becomes a turn round the circle's centre and its place down a distance from that centre,
// so each line has an arc of its own round the same centre (the lower line inside when it arches
// up) and stays aligned as it was. Pure: the widths come from a function (a canvas in the app),
// so the stage, every export, the web page and the SVG place the letters alike.
import { LINE_HEIGHT } from './factory.ts';
import { MAX_CURVE } from './rules.ts';
import type { TextObject } from './types.ts';

export { MAX_CURVE };

/** How wide some words are in the text's font, in px. */
export type WidthOf = (text: string) => number;

/**
 * One letter on the arc: the middle of its line-high cell (`x`, `y` from the top left of the
 * bent words' bounds) and its turn in degrees, clockwise.
 */
export interface PlacedLetter {
  char: string;
  x: number;
  y: number;
  angle: number;
  width: number;
}

/** The letters and the size of the box round them. */
export interface CurvedText {
  letters: PlacedLetter[];
  width: number;
  height: number;
}

/** The curve as drawn: −100 to 100 (0 when absent or not a number). */
export const curveOf = (t: Pick<TextObject, 'curve'>): number =>
  Number.isFinite(t.curve) ? Math.max(-MAX_CURVE, Math.min(MAX_CURVE, t.curve!)) : 0;

/**
 * The letters of `t` along its curve. 100 bends the widest line, through the middle of its
 * letters, into a whole circle (50 a half circle, a rainbow); with more lines the middle of the
 * block is bent so, and the circle is never smaller than the block is high, so no line is turned
 * inside out.
 */
export function curvedText(
  t: Pick<TextObject, 'text' | 'size' | 'align' | 'curve'>,
  widthOf: WidthOf,
): CurvedText {
  const lineHeight = t.size * LINE_HEIGHT;
  const lines = t.text.split('\n');
  const widths = lines.map((line) => (line === '' ? 0 : widthOf(line)));
  const widest = Math.max(0, ...widths);
  const height = lines.length * lineHeight;
  // The straight words, across from the middle of the widest line and down from the top.
  const cells = lines.flatMap((line, row) => {
    const start =
      t.align === 'left'
        ? -widest / 2
        : t.align === 'centre'
          ? -widths[row]! / 2
          : widest / 2 - widths[row]!;
    const chars = [...line];
    return chars.map((char, i) => {
      const before = i === 0 ? 0 : widthOf(chars.slice(0, i).join(''));
      const width = widthOf(char);
      return { char, u: start + before + width / 2, v: (row + 0.5) * lineHeight, width };
    });
  });
  const curve = curveOf(t);
  // The bend: 1 / radius, more than 0 arching up (the centre below the words).
  const sweep = (Math.abs(curve) / MAX_CURVE) * 2 * Math.PI;
  const bend =
    curve === 0 || widest === 0
      ? 0
      : Math.sign(curve) * Math.min(sweep / widest, height > 0 ? 2 / height : Infinity);
  const middle = height / 2;
  const placed = cells.map((c) => {
    if (bend === 0) return { ...c, x: c.u, y: c.v, turn: 0 };
    const radius = 1 / bend + (middle - c.v);
    const turn = bend * c.u;
    return {
      ...c,
      x: radius * Math.sin(turn),
      y: middle + 1 / bend - radius * Math.cos(turn),
      turn,
    };
  });
  // The bounds of every letter's cell, turned with it.
  let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of placed) {
    const cos = Math.cos(p.turn);
    const sin = Math.sin(p.turn);
    for (const [dx, dy] of [
      [-p.width / 2, -lineHeight / 2],
      [p.width / 2, -lineHeight / 2],
      [p.width / 2, lineHeight / 2],
      [-p.width / 2, lineHeight / 2],
    ] as const) {
      const x = p.x + dx * cos - dy * sin;
      const y = p.y + dx * sin + dy * cos;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (placed.length === 0) [left, top, right, bottom] = [-widest / 2, 0, widest / 2, height];
  return {
    letters: placed.map((p) => ({
      char: p.char,
      x: p.x - left,
      y: p.y - top,
      angle: (p.turn * 180) / Math.PI,
      width: p.width,
    })),
    width: right - left,
    height: bottom - top,
  };
}
