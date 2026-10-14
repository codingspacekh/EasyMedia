// Draws titles, captions, subtitles and credits on any 2D canvas (ARCHITECTURE §7.3). The preview
// and the export both use this, so the words land on the same pixels in both.
import type { TextStyle } from '../model/types.ts';
import { layoutText, type Measure } from './layout.ts';

/** The parts of CanvasRenderingContext2D the drawing needs (a fake one is used in tests). */
export interface TextCanvas {
  font: string;
  fillStyle: string | object;
  strokeStyle: string | object;
  lineWidth: number;
  lineJoin: string;
  textBaseline: string;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  measureText(text: string): { width: number };
  fillRect(x: number, y: number, width: number, height: number): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
}

/**
 * 'frame': an image the size of the video frame, with the words in their place.
 * 'block': only the words' rows (full width), for credits that scroll up the frame.
 */
export type TextImageMode = 'frame' | 'block';

export interface Size {
  width: number;
  height: number;
}

const BOX_COLOUR = 'rgba(0, 0, 0, 0.6)';
const SHADOW_COLOUR = 'rgba(0, 0, 0, 0.8)';
const OUTLINE_COLOUR = '#000000';
/** As a fraction of the font size in pixels. */
const BOX_PADDING = 0.25;
const BLOCK_PADDING = 0.5;
const OUTLINE_WIDTH = 0.1;
const SHADOW_OFFSET = 0.05;
const SHADOW_BLUR = 0.1;

const pixelSize = (style: TextStyle, frame: Size) => (style.size * frame.height) / 1080;

export function textImageSize(
  text: string,
  style: TextStyle,
  frame: Size,
  mode: TextImageMode,
  measure: Measure,
): Size {
  if (mode === 'frame') return { width: frame.width, height: frame.height };
  const layout = layoutText(text, style, frame, measure);
  const pad = BLOCK_PADDING * pixelSize(style, frame);
  return { width: frame.width, height: Math.ceil(layout.box.height + 2 * pad) };
}

/** Draws the text onto a transparent canvas of `textImageSize`; returns that size. */
export function drawText(
  ctx: TextCanvas,
  text: string,
  style: TextStyle,
  frame: Size,
  mode: TextImageMode,
): Size {
  const measure: Measure = (t, font) => {
    ctx.font = font;
    return ctx.measureText(t).width;
  };
  const size = textImageSize(text, style, frame, mode, measure);
  const layout = layoutText(text, style, frame, measure);
  const px = pixelSize(style, frame);
  const dy = mode === 'block' ? BLOCK_PADDING * px - layout.box.y : 0;
  const { box } = layout;

  ctx.font = layout.font;
  ctx.textBaseline = 'top';
  if (style.box) {
    const pad = BOX_PADDING * px;
    ctx.fillStyle = BOX_COLOUR;
    ctx.fillRect(box.x - pad, box.y + dy - pad, box.width + 2 * pad, box.height + 2 * pad);
  }
  layout.lines.forEach((line, i) => {
    const x = layout.lineX[i] as number;
    const y = box.y + dy + i * layout.lineHeight;
    if (style.outline) {
      ctx.strokeStyle = OUTLINE_COLOUR;
      ctx.lineWidth = OUTLINE_WIDTH * px;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, y);
    }
    if (style.shadow) {
      ctx.shadowColor = SHADOW_COLOUR;
      ctx.shadowOffsetX = SHADOW_OFFSET * px;
      ctx.shadowOffsetY = SHADOW_OFFSET * px;
      ctx.shadowBlur = SHADOW_BLUR * px;
    }
    ctx.fillStyle = style.colour;
    ctx.fillText(line, x, y);
    ctx.shadowColor = 'transparent';
  });
  return size;
}
