// Exporting an animation (AN15, N12): MP4 and GIF made by FFmpeg from frames drawn by the
// preview's own drawing, a PNG sequence, one PNG, and the HTML web page — and Test (AN18), the
// web page in a window of its own.
import { JobCancelledError } from '../../core/model/errors.ts';
import {
  estimateAnimationSize,
  evenSize,
  exportedFrames,
  frameFile,
  sequenceName,
  type AnimationFormat,
} from '../../core/animation/export.ts';
import { fontsNeeded, picturesUsed, webPage } from '../../core/animation/html.ts';
import type { AnimationDoc, Id } from '../../core/animation/types.ts';
import { newId } from '../../core/model/factory.ts';
import type { JobHandle } from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';
import type { AnimationExporting } from './state.ts';

export function exportActions(ctx: AnimationContext) {
  const { store, patch, present, showError, pause, services } = ctx;
  const { dialogs, files, paths, engine, renderer, pageAssets } = services;
  let cancelExporting: (() => void) | null = null;

  /** A new folder of its own for one export's frames, in the app's frames folder. */
  function framesFolder(): string {
    const base = paths.animationFrames ?? `${paths.proxies}/animation-frames`;
    const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/';
    return `${base}${sep}export-${newId()}${sep}`;
  }

  /**
   * AN15: the web page: the animation with its player, pictures and fonts inside. A picture that
   * cannot be read is left out (the player shows the rest) and its file named in `missing`.
   */
  async function makePage(doc: AnimationDoc): Promise<{ html: string; missing: string[] }> {
    const [player, fonts, read] = await Promise.all([
      pageAssets.playerScript(),
      Promise.all(
        fontsNeeded(doc).map(async (face) => ({
          face,
          url: await pageAssets.fontDataUrl(face.file),
        })),
      ),
      Promise.all(
        picturesUsed(doc).map(async (p) => ({
          picture: p,
          url: await pageAssets.pictureDataUrl(p.path).catch(() => null),
        })),
      ),
    ]);
    const pictures: Record<Id, string> = {};
    for (const { picture, url } of read) if (url) pictures[picture.id] = url;
    return {
      html: webPage(doc, { player, pictures, fonts }),
      missing: read.filter((r) => !r.url).map((r) => fileNameOf(r.picture.path)),
    };
  }

  async function exportWebPage(doc: AnimationDoc, output: string): Promise<string | null> {
    patch({ busy: 'Exporting…' });
    try {
      const { html, missing } = await makePage(doc);
      await files.write(output, html);
      const saved = fileNameOf(output);
      patch({
        message: {
          kind: 'info',
          text: missing.length
            ? `Saved ${saved} without ${missing.join(', ')}: ${
                missing.length === 1 ? 'that picture' : 'those pictures'
              } could not be read.`
            : `Saved ${saved}. Open it in any web browser: it plays without the internet.`,
        },
      });
      return output;
    } catch (error) {
      showError(error);
      return null;
    } finally {
      patch({ busy: null });
    }
  }

  /**
   * AN15: every frame drawn by the same drawing as the preview, then made into the chosen file:
   * MP4 or GIF by FFmpeg from frames in the app's folder (removed afterwards), a PNG sequence
   * beside the chosen name, or the frame at the playhead as one PNG. `chosen` skips the save box
   * (Send to Video mode). Returns the file made, or null (closed, cancelled or failed).
   */
  async function exportAnimation(format: AnimationFormat, chosen?: string): Promise<string | null> {
    if (store.get().exporting || store.get().busy) return null;
    pause();
    const doc = present();
    const { frame } = store.get();
    const output = chosen ?? (await dialogs.exportAnimation(ctx.fileBase(), format));
    if (!output) return null;
    if (format === 'html') return exportWebPage(doc, output);
    if (format === 'png') {
      patch({ busy: 'Exporting…' });
      try {
        await files.writeBytes(output, await renderer.renderPng(doc, frame));
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.` } });
        return output;
      } catch (error) {
        showError(error);
        return null;
      } finally {
        patch({ busy: null });
      }
    }

    let cancelled = false;
    let job: JobHandle | null = null;
    cancelExporting = () => {
      cancelled = true;
      job?.cancel();
    };
    const show = (phase: AnimationExporting['phase'], progress: number) =>
      patch({ exporting: { format, phase, progress, output } });
    const stopIfCancelled = () => {
      if (cancelled) throw new JobCancelledError();
    };
    const { count } = exportedFrames(doc);
    const folder = format === 'png-sequence' ? null : framesFolder();
    const written: string[] = [];
    let made: string | null = null;
    try {
      show('drawing', 0);
      for (let i = 0; i < count; i++) {
        stopIfCancelled();
        const png = await renderer.renderPng(doc, i);
        stopIfCancelled();
        const file = folder ? `${folder}${frameFile(i)}` : sequenceName(output, i);
        await files.writeBytes(file, png);
        written.push(file);
        show('drawing', (i + 1) / count);
      }
      if (folder && format !== 'png-sequence') {
        show('encoding', 0);
        stopIfCancelled();
        const { width, height, fps } = doc.stage;
        const started = engine.encodeFrames(folder.slice(0, -1), output, {
          format,
          fps,
          frames: count,
          width,
          height,
        });
        job = started;
        const stop = engine.onJobEvent((e) => {
          if (e.jobId === started.id && e.type === 'progress') show('encoding', e.ratio);
        });
        try {
          await started.done;
        } finally {
          stop();
        }
        written.length = 0; // FFmpeg's job removes the frames
        const even = evenSize(width, height);
        const note =
          format === 'mp4' && even.padded
            ? ` MP4 needs even sizes, so it is ${even.width} × ${even.height} (one pixel added).`
            : '';
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.${note}` } });
        made = output;
      } else {
        written.length = 0;
        const first = fileNameOf(sequenceName(output, 0));
        const last = fileNameOf(sequenceName(output, count - 1));
        patch({
          message: {
            kind: 'info',
            text: count === 1 ? `Saved ${first}.` : `Saved ${count} pictures, ${first} to ${last}.`,
          },
        });
        made = output;
      }
    } catch (error) {
      if (error instanceof JobCancelledError)
        patch({ message: { kind: 'info', text: 'Export cancelled.' } });
      else showError(error);
    } finally {
      await Promise.all(written.map((f) => files.remove(f).catch(() => {})));
      cancelExporting = null;
      patch({ exporting: null });
    }
    return made;
  }

  return {
    /** AN15: the frame at the playhead as a PNG (M13's Export). */
    exportPng: async (): Promise<void> => void (await exportAnimation('png')),

    exportAnimation,

    /** N12: stops an export while it draws the frames or while FFmpeg makes the file. */
    cancelExport(): void {
      cancelExporting?.();
    },

    /** T7: what the export dialog shows before exporting. */
    exportSummary(format: AnimationFormat) {
      const doc = present();
      const { count, seconds } = exportedFrames(doc);
      const { width, height } = doc.stage;
      return {
        frames: format === 'png' ? 1 : count,
        seconds,
        bytes: estimateAnimationSize(doc, format),
        size: format === 'mp4' ? evenSize(width, height) : { width, height, padded: false },
      };
    },

    /**
     * AN18: Test — the animation as its web page in a window of its own, where it plays and its
     * buttons work, as the exported file will in a browser.
     */
    async testAnimation(): Promise<void> {
      if (store.get().busy) return;
      pause();
      const doc = present();
      patch({ busy: 'Opening the test…' });
      try {
        const { html, missing } = await makePage(doc);
        await pageAssets.openTest(html, ctx.fileBase(), doc.stage.width, doc.stage.height);
        if (missing.length)
          patch({
            message: {
              kind: 'info',
              text: `Testing without ${missing.join(', ')}: ${
                missing.length === 1 ? 'that picture' : 'those pictures'
              } could not be read.`,
            },
          });
      } catch (error) {
        showError(error);
      } finally {
        patch({ busy: null });
      }
    },
  };
}
