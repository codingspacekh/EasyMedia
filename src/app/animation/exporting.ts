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
import { TRANSPARENT } from '../../core/animation/rules.ts';
import { stageSvg } from '../../core/animation/svg-export.ts';
import { newId } from '../../core/model/factory.ts';
import type { JobHandle } from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';
import type { AnimationExporting } from './state.ts';

/** N2: how many frames are drawn at once (the PNGs are made on other threads meanwhile). */
export const FRAMES_AT_ONCE = 4;

/**
 * N2: runs `draw` for frames 0 … count − 1, FRAMES_AT_ONCE at a time, telling `progress` how many
 * are done. After a failure (or Cancel) no new frame starts; it waits for the frames already
 * started, so nothing is still being written when it rejects with the first error.
 */
export async function drawFrames(
  count: number,
  draw: (frame: number) => Promise<void>,
  progress: (done: number) => void,
): Promise<void> {
  let next = 0;
  let done = 0;
  let failure: { error: unknown } | null = null;
  const worker = async () => {
    while (!failure && next < count) {
      const frame = next++;
      try {
        await draw(frame);
        done++;
        if (!failure) progress(done);
      } catch (error) {
        failure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(FRAMES_AT_ONCE, count) }, worker));
  if (failure) throw (failure as { error: unknown }).error;
}

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

  /** AN22: the frame at the playhead as an SVG, its pictures inside (one not read is left out). */
  async function exportSvg(doc: AnimationDoc, frame: number, output: string) {
    patch({ busy: 'Exporting…' });
    try {
      const read = await Promise.all(
        picturesUsed(doc).map(async (p) => ({
          picture: p,
          url: await pageAssets.pictureDataUrl(p.path).catch(() => null),
        })),
      );
      const pictures: Record<Id, string> = {};
      for (const { picture, url } of read) if (url) pictures[picture.id] = url;
      await files.write(output, stageSvg(doc, frame, pictures));
      const missing = read.filter((r) => !r.url).map((r) => fileNameOf(r.picture.path));
      patch({
        message: {
          kind: 'info',
          text: missing.length
            ? `Saved ${fileNameOf(output)} without ${missing.join(', ')}: could not be read.`
            : `Saved ${fileNameOf(output)}.`,
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
    const drawn = present();
    // AN21: an MP4 cannot be transparent: a stage with no background is drawn on white.
    const onWhite = format === 'mp4' && drawn.stage.background === TRANSPARENT;
    const doc = onWhite ? { ...drawn, stage: { ...drawn.stage, background: '#ffffff' } } : drawn;
    const { frame } = store.get();
    const output = chosen ?? (await dialogs.exportAnimation(ctx.fileBase(), format));
    if (!output) return null;
    if (format === 'html') return exportWebPage(doc, output);
    if (format === 'svg') return exportSvg(doc, frame, output);
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
      await drawFrames(
        count,
        async (i) => {
          stopIfCancelled();
          const png = await renderer.renderPng(doc, i);
          stopIfCancelled();
          const file = folder ? `${folder}${frameFile(i)}` : sequenceName(output, i);
          await files.writeBytes(file, png);
          written.push(file);
        },
        (done) => show('drawing', done / count),
      );
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
        const white = onWhite ? ' An MP4 cannot be transparent, so its background is white.' : '';
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.${note}${white}` } });
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
        frames: format === 'png' || format === 'svg' ? 1 : count,
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
