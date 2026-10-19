// TextRenderer on the page's canvas (ARCHITECTURE §7.3): the bundled fonts are loaded first,
// so the export uses exactly the letters the preview shows.
import type { TextRenderer } from '../../core/ports.ts';
import { cssFont, layoutText } from '../../core/text/layout.ts';
import { drawText, textImageSize, type TextCanvas } from '../../core/text/draw.ts';

export interface CanvasParts {
  /** Resolves once the font (a CSS font string) can be drawn. */
  loadFont(font: string): Promise<void>;
  makeCanvas(width: number, height: number): { ctx: TextCanvas; toPng(): Promise<Uint8Array> };
}

export function createCanvasTextRenderer(parts: CanvasParts = browserCanvas()): TextRenderer {
  let scratch: TextCanvas | undefined;
  const measure = (text: string, font: string) => {
    scratch ??= parts.makeCanvas(1, 1).ctx;
    scratch.font = font;
    return scratch.measureText(text).width;
  };
  return {
    async draw(text, style, frame, mode) {
      await parts.loadFont(cssFont(style, frame.height));
      const { width, height } =
        mode === 'frame' ? frame : textImageSize(text, style, frame, mode, measure);
      const canvas = parts.makeCanvas(width, height);
      drawText(canvas.ctx, text, style, frame, mode);
      const png = await canvas.toPng();
      if (mode !== 'frame') return { png, width, height };
      const { box } = layoutText(text, style, frame, (t, font) => {
        canvas.ctx.font = font;
        return canvas.ctx.measureText(t).width;
      });
      return {
        png,
        width,
        height,
        anchor: { x: box.x + box.width / 2, y: box.y + box.height / 2 },
      };
    },
  };
}

export function browserCanvas(): CanvasParts {
  return {
    loadFont: async (font) => void (await document.fonts.load(font)),
    makeCanvas(width, height) {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
      return {
        ctx,
        toPng: async () =>
          new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer()),
      };
    },
  };
}
