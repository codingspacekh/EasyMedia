// StageRenderer (AN15) on an OffscreenCanvas: the stage drawn by core/animation/draw.ts — the
// same drawing as the preview — and saved as a PNG. Pictures are fetched through media://.
import { drawStage, fontOf, type StageCanvas } from '../../core/animation/draw.ts';
import type { AnimObject, AnimationDoc } from '../../core/animation/types.ts';
import { toMediaUrl } from '../../core/media-url.ts';
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

const defaultLoadImage = async (path: string): Promise<unknown | null> => {
  try {
    const response = await fetch(toMediaUrl(path));
    if (!response.ok) return null;
    return await createImageBitmap(await response.blob());
  } catch {
    return null;
  }
};

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
  };
}
