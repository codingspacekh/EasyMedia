// AN4: a text object's box is the size of its words on screen, measured with the bundled font
// (the drawing uses the same font string). Without a canvas (tests) the rough estimate stays.
import { fontOf, LINE_HEIGHT } from '../../core/animation/draw.ts';
import { roughTextWidth } from '../../core/animation/factory.ts';
import type { TextObject } from '../../core/animation/types.ts';

export interface Measurer {
  font: string;
  measureText(text: string): { width: number };
}

let shared: Measurer | null | undefined;

function sharedMeasurer(): Measurer | null {
  if (shared !== undefined) return shared;
  shared =
    typeof document === 'undefined'
      ? null
      : (document.createElement('canvas').getContext('2d') as Measurer | null);
  return shared;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The box that fits the words: the widest line, and a line height of 1.2 per line. */
export function textBox(
  t: TextObject,
  ctx: Measurer | null = sharedMeasurer(),
): { width: number; height: number } {
  const lines = t.text.split('\n');
  const height = round(Math.max(1, lines.length) * t.size * LINE_HEIGHT);
  if (!ctx) return { width: round(roughTextWidth(t.text, t.size)), height };
  ctx.font = fontOf(t);
  const width = Math.max(1, ...lines.map((line) => ctx.measureText(line).width));
  return { width: round(width), height };
}
