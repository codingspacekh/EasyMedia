// Text layout maths (V4–V6). Pure: measuring text is passed in, so the same layout is used by
// the canvas that draws titles, captions and credits for both the preview and the export.
import type { TextStyle } from '../model/types.ts';

export const LINE_HEIGHT = 1.2;
/** Text stays inside this margin from every edge (the "safe area"). */
export const SAFE_MARGIN = 0.05;
/** Font sizes are given for a 1080-pixel-tall frame and scaled to the project. */
const REFERENCE_HEIGHT = 1080;

export type Measure = (text: string, font: string) => number;

export interface TextLayout {
  font: string;
  lines: string[];
  lineHeight: number;
  box: { x: number; y: number; width: number; height: number };
  /** Left edge of each line, after alignment. */
  lineX: number[];
}

export function cssFont(style: TextStyle, frameHeight: number): string {
  const size = Number(((style.size * frameHeight) / REFERENCE_HEIGHT).toFixed(2));
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${size}px "${style.font}"`;
}

export function layoutText(
  text: string,
  style: TextStyle,
  frame: { width: number; height: number },
  measure: Measure,
): TextLayout {
  const font = cssFont(style, frame.height);
  const size = (style.size * frame.height) / REFERENCE_HEIGHT;
  const maxWidth = frame.width * (1 - 2 * SAFE_MARGIN);
  const lines = text.split('\n').flatMap((paragraph) => wrap(paragraph, maxWidth, font, measure));
  const widths = lines.map((line) => measure(line, font));
  const width = Math.max(0, ...widths);
  const lineHeight = size * LINE_HEIGHT;
  const height = lines.length * lineHeight;

  const mx = frame.width * SAFE_MARGIN;
  const my = frame.height * SAFE_MARGIN;
  const [vertical, horizontal] = splitPosition(style.position);
  const x =
    horizontal === 'left'
      ? mx
      : horizontal === 'right'
        ? frame.width - mx - width
        : (frame.width - width) / 2;
  const y =
    vertical === 'top'
      ? my
      : vertical === 'bottom'
        ? frame.height - my - height
        : (frame.height - height) / 2;

  const lineX = widths.map((w) =>
    style.align === 'left' ? x : style.align === 'right' ? x + width - w : x + (width - w) / 2,
  );
  return { font, lines, lineHeight, box: { x, y, width, height }, lineX };
}

/** Top of the scrolling credits block at time t: from just below the frame to just above it. */
export function creditsY(
  t: number,
  duration: number,
  frameHeight: number,
  blockHeight: number,
): number {
  return frameHeight - (t / duration) * (frameHeight + blockHeight);
}

/** WCAG contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
}

/** 4.5 : 1 or more is easy to read (WCAG AA for normal text). */
export function readability(text: string, background: string): { ratio: number; easy: boolean } {
  const ratio = contrastRatio(text, background);
  return { ratio: Math.round(ratio * 100) / 100, easy: ratio >= 4.5 };
}

function wrap(paragraph: string, maxWidth: number, font: string, measure: Measure): string[] {
  if (paragraph === '') return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of paragraph.split(' ')) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (line !== '' && measure(candidate, font) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

function splitPosition(
  position: TextStyle['position'],
): ['top' | 'middle' | 'bottom', 'left' | 'centre' | 'right'] {
  const vertical = position.startsWith('top')
    ? 'top'
    : position.startsWith('bottom')
      ? 'bottom'
      : 'middle';
  const horizontal = position.endsWith('left')
    ? 'left'
    : position.endsWith('right')
      ? 'right'
      : 'centre';
  return [vertical, horizontal];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
