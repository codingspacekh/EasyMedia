// StageRenderer (AN15) on an OffscreenCanvas: the stage drawn by core/animation/draw.ts — the
// same drawing as the preview — and saved as a PNG. Pictures are fetched through media://.
import { drawStage, fontsUsed, type StageCanvas } from '../../core/animation/draw.ts';
import { fontKey } from '../../core/animation/svg-export.ts';
import { withLayers } from './layers.ts';
import type { AnimationDoc } from '../../core/animation/types.ts';
import type { Pixels } from '../../core/animation/trace.ts';
import { toMediaUrl } from '../../core/media-url.ts';
import { MediaError } from '../../core/model/errors.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { StageRenderer } from '../../core/ports.ts';

export interface StageRendererDeps {
  /** A canvas of the stage's size (an OffscreenCanvas in the app). */
  makeCanvas?: (
    width: number,
    height: number,
  ) => {
    getContext(kind: '2d', options?: { willReadFrequently?: boolean }): StageCanvas | null;
    convertToBlob(options: { type: string }): Promise<Blob>;
  };
  /** A picture file as something drawImage accepts; null when it cannot be loaded. */
  loadImage?: (path: string) => Promise<unknown | null>;
  /** Makes sure the bundled fonts the text uses are loaded first. */
  loadFonts?: (fonts: string[]) => Promise<void>;
}

export interface PictureLoaders {
  fetch: (url: string) => Promise<{ ok: boolean; blob(): Promise<Blob> }>;
  createImageBitmap: (blob: Blob) => Promise<unknown>;
  /** An <img> of the file's bytes, decoded. */
  loadElement: (blob: Blob) => Promise<unknown>;
}

const browserLoaders = (): PictureLoaders => ({
  fetch: (url) => fetch(url),
  createImageBitmap: (blob) => createImageBitmap(blob),
  async loadElement(blob) {
    // From a data: URL (the page's own): an <img> from media:// would count as another site's
    // picture and the canvas could then not be saved; blob: URLs are not allowed by the page.
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await blob.text())}`;
    await img.decode();
    return img;
  },
});

/**
 * AN5: a picture file as something drawImage accepts; null when it cannot be loaded. A bitmap
 * cannot be made from an SVG, so an SVG is drawn from an <img> (it keeps its size from the file).
 */
export async function loadPicture(
  path: string,
  loaders: PictureLoaders = browserLoaders(),
): Promise<unknown | null> {
  try {
    const response = await loaders.fetch(toMediaUrl(path));
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.type === 'image/svg+xml') return await loaders.loadElement(blob);
    return await loaders.createImageBitmap(blob);
  } catch {
    return null;
  }
}

const defaultLoadImage = (path: string): Promise<unknown | null> => loadPicture(path);

const defaultLoadFonts = async (fonts: string[]): Promise<void> => {
  const set = (globalThis as { document?: { fonts?: FontFaceSet } }).document?.fonts;
  if (!set) return;
  await Promise.all(fonts.map((f) => set.load(f).catch(() => [])));
};

export function createCanvasStageRenderer({
  makeCanvas = (w, h) =>
    new OffscreenCanvas(w, h) as unknown as ReturnType<
      NonNullable<StageRendererDeps['makeCanvas']>
    >,
  loadImage = defaultLoadImage,
  loadFonts = defaultLoadFonts,
}: StageRendererDeps = {}): StageRenderer {
  // An export draws every frame of one animation: its pictures are loaded once, not per frame,
  // even for the frames drawn at once (N2), which share the one loading.
  let loaded: { pictures: AnimationDoc['pictures']; images: Promise<Map<string, unknown>> } | null =
    null;
  function imagesOf(doc: AnimationDoc): Promise<Map<string, unknown>> {
    if (loaded?.pictures === doc.pictures) return loaded.images;
    const images = (async () => {
      const found = new Map<string, unknown>();
      await Promise.all(
        doc.pictures.map(async (p) => {
          const image = await loadImage(p.path);
          if (image) found.set(p.id, image);
        }),
      );
      return found;
    })();
    loaded = { pictures: doc.pictures, images };
    return images;
  }

  return {
    async renderPng(
      doc: AnimationDoc,
      frame = 0,
      size?: { width: number; height: number },
    ): Promise<Uint8Array> {
      // AN15: another size: the vectors drawn scaled onto a canvas of that size, so they stay sharp.
      const canvas = makeCanvas(size?.width ?? doc.stage.width, size?.height ?? doc.stage.height);
      // N4: drawn in ordinary memory: on the graphics card, Chromium keeps every frame's shapes in
      // its caches (over 250 MB for a 10 s export of 100 moving objects). The PNG is read back anyway.
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No canvas is available to draw the stage.');
      const images = await imagesOf(doc);
      await loadFonts(fontsUsed(doc.layers.flatMap((l) => l.objects)));
      const stage = withLayers(ctx);
      if (size) stage.scale(size.width / doc.stage.width, size.height / doc.stage.height);
      drawStage(stage, doc, { image: (id) => images.get(id) ?? null, frame });
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Uint8Array(await blob.arrayBuffer());
    },

    async textTops(fonts: string[]): Promise<Record<string, number>> {
      await loadFonts(fonts);
      const ctx = makeCanvas(8, 8).getContext('2d') as
        | (Omit<StageCanvas, 'measureText'> & {
            measureText(t: string): { actualBoundingBoxAscent: number };
          })
        | null;
      if (!ctx) throw new Error('No canvas is available to measure the text.');
      const tops: Record<string, number> = {};
      for (const font of fonts) {
        const key = fontKey(font);
        if (key in tops) continue;
        // The same letters measured from the alphabetic baseline and from the top the stage
        // draws from: the difference is how far the baseline sits below that top.
        ctx.font = font.replace(/ [\d.]+px /, ' 100px ');
        ctx.textBaseline = 'alphabetic';
        const fromBaseline = ctx.measureText('Hg').actualBoundingBoxAscent;
        ctx.textBaseline = 'top';
        const fromTop = ctx.measureText('Hg').actualBoundingBoxAscent;
        tops[key] = Math.round(fromBaseline - fromTop) / 100;
      }
      return tops;
    },

    async textWidths(fonts: string[]): Promise<(font: string, text: string) => number> {
      await loadFonts(fonts);
      const ctx = makeCanvas(8, 8).getContext('2d') as
        (StageCanvas & { measureText(t: string): { width: number } }) | null;
      if (!ctx) throw new Error('No canvas is available to measure the text.');
      return (font, text) => {
        ctx.font = font;
        return ctx.measureText(text).width;
      };
    },

    async pixels(path: string, maxSide: number): Promise<Pixels> {
      const image = (await loadImage(path)) as { width: number; height: number } | null;
      if (!image || !(image.width > 0) || !(image.height > 0))
        throw new MediaError(`${fileNameOf(path)} could not be read as a picture.`);
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const ctx = makeCanvas(width, height).getContext('2d') as
        | (StageCanvas & { getImageData(x: number, y: number, w: number, h: number): ImageData })
        | null;
      if (!ctx) throw new Error('No canvas is available to read the picture.');
      ctx.drawImage(image, 0, 0, width, height);
      return { width, height, data: ctx.getImageData(0, 0, width, height).data };
    },
  };
}
