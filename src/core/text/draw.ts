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
  createLinearGradient(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ): { addColorStop(offset: number, colour: string): void };
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
const GLOW_BLUR = 0.4;
/** 3D: this many layers, each this far (× the size) down and right. */
const DEPTH_LAYERS = 6;
const DEPTH_STEP = 1 / 60;
const DEPTH_COLOUR = '#333333';

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
    ctx.fillStyle = style.boxColour ?? BOX_COLOUR;
    ctx.fillRect(box.x - pad, box.y + dy - pad, box.width + 2 * pad, box.height + 2 * pad);
  }
  const step = Math.round(DEPTH_STEP * px * 2) / 2;
  layout.lines.forEach((line, i) => {
    const x = layout.lineX[i] as number;
    const y = box.y + dy + i * layout.lineHeight;
    if (style.depth) {
      // 3D: the farthest layer first, so nearer ones cover it.
      ctx.fillStyle = style.accent ?? DEPTH_COLOUR;
      for (let k = DEPTH_LAYERS; k >= 1; k--) ctx.fillText(line, x + k * step, y + k * step);
    }
    if (style.outline) {
      ctx.strokeStyle = style.outlineColour ?? OUTLINE_COLOUR;
      ctx.lineWidth = OUTLINE_WIDTH * px;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, x, y);
    }
    if (style.glow) {
      ctx.shadowColor = style.accent ?? style.colour;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = GLOW_BLUR * px;
    } else if (style.shadow) {
      ctx.shadowColor = SHADOW_COLOUR;
      ctx.shadowOffsetX = SHADOW_OFFSET * px;
      ctx.shadowOffsetY = SHADOW_OFFSET * px;
      ctx.shadowBlur = SHADOW_BLUR * px;
    }
    if (style.gradient) {
      const fill = ctx.createLinearGradient(0, y, 0, y + px);
      fill.addColorStop(0, style.colour);
      fill.addColorStop(1, style.accent ?? style.colour);
      ctx.fillStyle = fill;
    } else {
      ctx.fillStyle = style.colour;
    }
    ctx.fillText(line, x, y);
    // A glow is drawn twice: once is too faint to see on a bright picture.
    if (style.glow) ctx.fillText(line, x, y);
    ctx.shadowColor = 'transparent';
  });
  return size;
}
