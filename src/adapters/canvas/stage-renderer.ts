// StageRenderer (AN15) on an OffscreenCanvas: the stage drawn by core/animation/draw.ts — the
// same drawing as the preview — and saved as a PNG. Pictures are fetched through media://.
import { drawStage, fontOf, type StageCanvas } from '../../core/animation/draw.ts';
import type { AnimObject, AnimationDoc } from '../../core/animation/types.ts';
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
    getContext(kind: '2d'): StageCanvas | null;
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

const textFonts = (objects: readonly AnimObject[]): string[] =>
  objects.flatMap((o) =>
    o.kind === 'text' ? [fontOf(o)] : o.kind === 'group' ? textFonts(o.children) : [],
  );

export function createCanvasStageRenderer({
  makeCanvas = (w, h) =>
    new OffscreenCanvas(w, h) as unknown as ReturnType<
      NonNullable<StageRendererDeps['makeCanvas']>
    >,
  loadImage = defaultLoadImage,
  loadFonts = defaultLoadFonts,
}: StageRendererDeps = {}): StageRenderer {
  // An export draws every frame of one animation: its pictures are loaded once, not per frame.
  let loaded: { pictures: AnimationDoc['pictures']; images: Map<string, unknown> } | null = null;
  async function imagesOf(doc: AnimationDoc): Promise<Map<string, unknown>> {
    if (loaded?.pictures === doc.pictures) return loaded.images;
    const images = new Map<string, unknown>();
    await Promise.all(
      doc.pictures.map(async (p) => {
        const image = await loadImage(p.path);
        if (image) images.set(p.id, image);
      }),
    );
    loaded = { pictures: doc.pictures, images };
    return images;
  }

  return {
    async renderPng(doc: AnimationDoc, frame = 0): Promise<Uint8Array> {
      const canvas = makeCanvas(doc.stage.width, doc.stage.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas is available to draw the stage.');
      const images = await imagesOf(doc);
      await loadFonts([...new Set(textFonts(doc.layers.flatMap((l) => l.objects)))]);
      drawStage(ctx, doc, { image: (id) => images.get(id) ?? null, frame });
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Uint8Array(await blob.arrayBuffer());
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
