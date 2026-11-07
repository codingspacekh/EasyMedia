// Graphics mode's own actions (M18): a new image of a chosen size, the image settings (canvas,
// resolution, units, background), cropping the canvas (G8), align and distribute (G5, in
// Animation mode too), exporting PNG, JPG and SVG at a size and of the chosen objects (G11), and
// what is sent to Animation mode (GL3).
import * as cmd from '../animation-commands.ts';
import { findObject, pictureIdsOf } from '../../core/animation/layers.ts';
import type { AnimObject, AnimationDoc, Picture } from '../../core/animation/types.ts';
import {
  alignMoves,
  distributeMoves,
  type AlignEdge,
  type AlignTo,
  type DistributeAxis,
  type DistributeBy,
} from '../../core/graphics/align.ts';
import {
  createGraphic,
  drawingBounds,
  graphicOf,
  type NewImage,
} from '../../core/graphics/document.ts';
import {
  exportPixels,
  FORMAT_INFO,
  imageOfObjects,
  imagesOfEach,
  jpegQuality,
  svgDimensions,
  type GraphicExportOptions,
} from '../../core/graphics/export.ts';
import { jpegWithDpi, pngWithDpi } from '../../core/image/dpi.ts';
import { stateAt } from '../../core/animation/state.ts';
import { EditError } from '../../core/model/errors.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';
import { svgDocument } from './exporting.ts';

const ALIGN_LABELS: Record<AlignEdge, string> = {
  left: 'Align left',
  centre: 'Align centres',
  right: 'Align right',
  top: 'Align top',
  middle: 'Align middles',
  bottom: 'Align bottom',
};

export function graphicActions(
  ctx: AnimationContext,
  startWith: (doc: AnimationDoc) => Promise<boolean>,
) {
  const { store, patch, present, showError, run, edit, liveSelection } = ctx;
  const { dialogs, files, renderer } = ctx.services;

  /** The selected objects as they are shown at the playhead, in the order chosen. */
  function chosenNow(): AnimObject[] {
    const { frame } = store.get();
    const shown = stateAt(present(), frame);
    return liveSelection().flatMap((id) => {
      const found = findObject(shown, id);
      return found ? [found.object] : [];
    });
  }

  /** One file's bytes (or text, for an SVG) for an image document. */
  async function fileOf(doc: AnimationDoc, options: GraphicExportOptions) {
    const { dpi } = graphicOf(doc);
    const size = exportPixels(doc.stage, dpi, options.size);
    const scaled =
      size.width !== doc.stage.width || size.height !== doc.stage.height
        ? { width: size.width, height: size.height }
        : undefined;
    if (options.format === 'svg') {
      const { svg, missing } = await svgDocument(ctx, doc, 0, svgDimensions(doc, options.size));
      return { text: svg, size, missing };
    }
    if (options.format === 'jpg') {
      const jpeg = await renderer.renderJpeg(doc, {
        quality: jpegQuality(options.quality),
        background: options.background ?? '#ffffff',
        ...(scaled ? { size: scaled } : {}),
      });
      return { bytes: jpegWithDpi(jpeg, size.dpi), size, missing: [] };
    }
    const png = await (scaled ? renderer.renderPng(doc, 0, scaled) : renderer.renderPng(doc, 0));
    return { bytes: pngWithDpi(png, size.dpi), size, missing: [] };
  }

  return {
    /** G1: a new image of the size, resolution and background chosen. False when it stayed. */
    async newImage(image: NewImage): Promise<string | null> {
      let doc: AnimationDoc;
      try {
        doc = createGraphic(image);
      } catch (error) {
        return error instanceof EditError ? error.message : String(error);
      }
      await startWith(doc);
      return null;
    },

    /** G1, G10: the canvas size, resolution, units or background; or why not. */
    setImage: (change: Parameters<typeof cmd.setImage>[0]): string | null =>
      edit(cmd.setImage(change)),

    /** G8: the canvas cropped to the selected objects, or to the whole drawing. */
    cropCanvas(to: 'selection' | 'drawing'): void {
      const ids = liveSelection();
      if (to === 'selection' && ids.length === 0) {
        patch({ message: { kind: 'error', text: 'Select what to crop the canvas to first.' } });
        return;
      }
      const shown = stateAt(present(), store.get().frame);
      const box = drawingBounds(shown, to === 'selection' ? new Set(ids) : undefined);
      if (!box) {
        patch({
          message: { kind: 'error', text: 'There is nothing drawn to crop the canvas to.' },
        });
        return;
      }
      run(cmd.cropCanvas(box, to === 'selection' ? 'Crop to selection' : 'Fit canvas to drawing'));
    },

    /** G5: lines the selection up (one object: with the canvas). */
    align(edge: AlignEdge, to: AlignTo): void {
      const objects = chosenNow();
      const target = objects.length === 1 ? 'canvas' : to;
      const moves = alignMoves(objects, edge, target, present().stage);
      if (moves.length) run(cmd.moveEach(moves, ALIGN_LABELS[edge], store.get().frame));
    },

    /** G5: spaces three or more selected objects evenly. */
    distribute(axis: DistributeAxis, by: DistributeBy): void {
      const objects = chosenNow();
      if (objects.length < 3) {
        patch({ message: { kind: 'error', text: 'Select three or more objects to distribute.' } });
        return;
      }
      const moves = distributeMoves(objects, axis, by);
      const label = axis === 'horizontal' ? 'Distribute across' : 'Distribute down';
      if (moves.length) run(cmd.moveEach(moves, label, store.get().frame));
    },

    /**
     * G11: exports the image (or the selected objects, or each one in a file of its own in a
     * folder chosen) as PNG, JPG or SVG, with its resolution in the file. Returns the files made.
     */
    async exportImage(options: GraphicExportOptions): Promise<string[] | null> {
      if (store.get().busy) return null;
      const doc = present();
      const what = options.what ?? 'image';
      const ids = liveSelection();
      const info = FORMAT_INFO[options.format];
      let parts: { name: string; doc: AnimationDoc }[];
      try {
        if (what !== 'image' && ids.length === 0)
          throw new EditError('Select the objects to export first, or export the whole image.');
        const single = ids.length === 1 ? findObject(doc, ids[0]!)?.object.name : undefined;
        parts =
          what === 'each'
            ? imagesOfEach(doc, ids)
            : [
                {
                  name: what === 'selection' && single ? single : ctx.fileBase(),
                  doc: what === 'selection' ? imageOfObjects(doc, ids) : doc,
                },
              ];
        // The sizes are checked before any save box.
        for (const p of parts) exportPixels(p.doc.stage, graphicOf(doc).dpi, options.size);
        if (options.format === 'jpg') jpegQuality(options.quality);
      } catch (error) {
        showError(error);
        return null;
      }
      let outputs: string[];
      if (what === 'each') {
        const dir = await dialogs.chooseFolder(
          `Choose the folder for the ${parts.length} ${info.extension.toUpperCase()} files`,
        );
        if (!dir) return null;
        const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
        const nameFor = ctx.services.fileName ?? ((n: string) => n);
        outputs = parts.map((p) => `${dir}${sep}${nameFor(p.name)}.${info.extension}`);
      } else {
        const output = await dialogs.exportGraphic(parts[0]!.name, options.format);
        if (!output) return null;
        outputs = [output];
      }
      patch({ busy: 'Exporting…' });
      try {
        const missing = new Set<string>();
        let made = parts[0]
          ? exportPixels(parts[0].doc.stage, graphicOf(doc).dpi, options.size)
          : null;
        for (const [i, p] of parts.entries()) {
          const file = await fileOf({ ...p.doc, graphic: graphicOf(doc) }, options);
          made = file.size;
          for (const m of file.missing) missing.add(m);
          if ('text' in file && file.text !== undefined) await files.write(outputs[i]!, file.text);
          else await files.writeBytes(outputs[i]!, file.bytes!);
        }
        const names = outputs.map((o) => fileNameOf(o));
        const sized =
          parts.length === 1 && made
            ? ` (${made.width} × ${made.height} px${options.format === 'svg' ? '' : `, ${made.dpi} dpi`})`
            : '';
        const lost = missing.size ? ` without ${[...missing].join(', ')}: could not be read` : '';
        patch({
          message: {
            kind: 'info',
            text: `Saved ${names.length > 3 ? `${names.length} files: ${names.slice(0, 3).join(', ')}…` : names.join(', ')}${sized}${lost}.`,
          },
        });
        return outputs;
      } catch (error) {
        showError(error);
        return null;
      } finally {
        patch({ busy: null });
      }
    },

    /**
     * GL3: objects sent from Graphics mode arrive here on a layer of their own, where they were
     * drawn, selected. Returns how many arrived.
     */
    receive(layerName: string, sent: { objects: AnimObject[]; pictures: Picture[] }): number {
      let ids: string[] = [];
      let layerId = '';
      const ok = run(
        cmd.receiveObjects(layerName, sent, (layer, made) => {
          layerId = layer;
          ids = made;
        }),
      );
      if (!ok) return 0;
      patch({ selection: ids, layerId, tool: 'select' });
      return ids.length;
    },

    /**
     * GL3: what goes to Animation mode: the selected objects, or everything on the visible layers,
     * with the pictures they show. Null when there is nothing.
     */
    toSend(): { objects: AnimObject[]; pictures: Picture[] } | null {
      const doc = present();
      const ids = liveSelection();
      const objects = ids.length
        ? ids.flatMap((id) => {
            const found = findObject(doc, id);
            return found ? [found.object] : [];
          })
        : doc.layers.filter((l) => l.visible && !l.mask).flatMap((l) => l.objects);
      if (objects.length === 0) return null;
      const used = new Set(pictureIdsOf(objects));
      return { objects, pictures: doc.pictures.filter((p) => used.has(p.id)) };
    },
  };
}
