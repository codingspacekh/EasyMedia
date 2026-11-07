// Exporting an animation (AN15, N12): MP4, AVI, MOV and GIF made by FFmpeg from frames drawn by
// the preview's own drawing, a PNG sequence, one PNG, and the HTML web page — all of it or a
// range of frames, at the stage's size or another width; the videos and the web page with the
// animation's sounds (AN28) — and Test (AN18), the web page in a window of its own.
import { JobCancelledError } from '../../core/model/errors.ts';
import {
  carriesSound,
  estimateAnimationSize,
  exportedFrames,
  exportSize,
  frameFile,
  hasRange,
  isVideoFormat,
  sequenceName,
  type AnimationExportOptions,
  type AnimationFormat,
} from '../../core/animation/export.ts';
import { soundPieces, soundsHeard } from '../../core/animation/sound.ts';
import { fontsUsed } from '../../core/animation/draw.ts';
import { fontsNeeded, picturesUsed, webPage, type WebPageView } from '../../core/animation/html.ts';
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

/**
 * AN22, G11: the stage at `frame` as an SVG document, with its pictures and fonts inside (a
 * picture that cannot be read is left out and named in `missing`). `shown`: the width and height
 * written on it ("10cm"; absent: the stage in px).
 */
export async function svgDocument(
  ctx: AnimationContext,
  doc: AnimationDoc,
  frame: number,
  shown?: { width: string; height: string },
): Promise<{ svg: string; missing: string[] }> {
  const { renderer, pageAssets } = ctx.services;
  const lettering = fontsUsed(doc.layers.flatMap((l) => l.objects));
  const [read, fonts, tops, widths] = await Promise.all([
    Promise.all(
      picturesUsed(doc).map(async (p) => ({
        picture: p,
        url: await pageAssets.pictureDataUrl(p.path).catch(() => null),
      })),
    ),
    // The fonts go inside, as in the web page: an SVG shows its words in the right font on any
    // computer.
    Promise.all(
      fontsNeeded(doc).map(async (face) => ({
        face,
        url: await pageAssets.fontDataUrl(face.file),
      })),
    ),
    // Where each font's baseline sits, measured as the stage draws it.
    renderer.textTops(lettering),
    // AN26: how wide letters are, for curved text.
    renderer.textWidths(lettering),
  ]);
  const pictures: Record<Id, string> = {};
  for (const { picture, url } of read) if (url) pictures[picture.id] = url;
  return {
    svg: stageSvg(doc, frame, pictures, fonts, tops, widths, shown),
    missing: read.filter((r) => !r.url).map((r) => fileNameOf(r.picture.path)),
  };
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
   * AN15: the web page: the animation with its player, pictures, fonts and (AN28) sounds inside,
   * of a part or at another size (`view`). A picture or sound that cannot be read is left out (the
   * player plays the rest) and its file named in `missing`.
   */
  async function makePage(
    doc: AnimationDoc,
    view: WebPageView = {},
  ): Promise<{ html: string; missing: string[]; what: string }> {
    const [player, fonts, read, heard] = await Promise.all([
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
      Promise.all(
        soundsHeard(doc).map(async (s) => ({
          sound: s,
          url: await pageAssets.soundDataUrl(s.path).catch(() => null),
        })),
      ),
    ]);
    const pictures: Record<Id, string> = {};
    for (const { picture, url } of read) if (url) pictures[picture.id] = url;
    const sounds: Record<Id, string> = {};
    for (const { sound, url } of heard) if (url) sounds[sound.id] = url;
    const lost = read.filter((r) => !r.url).map((r) => fileNameOf(r.picture.path));
    const silent = heard.filter((r) => !r.url).map((r) => fileNameOf(r.sound.path));
    const missing = [...lost, ...silent];
    const kind = !silent.length ? 'picture' : !lost.length ? 'sound' : 'file';
    return {
      html: webPage(doc, { player, pictures, fonts, sounds }, view),
      missing,
      what: missing.length === 1 ? `that ${kind}` : `those ${kind}s`,
    };
  }

  /** AN22: the frame at the playhead as an SVG, its pictures inside (one not read is left out). */
  async function exportSvg(doc: AnimationDoc, frame: number, output: string) {
    patch({ busy: 'Exporting…' });
    try {
      const { svg, missing } = await svgDocument(ctx, doc, frame);
      await files.write(output, svg);
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

  async function exportWebPage(
    doc: AnimationDoc,
    output: string,
    view: WebPageView,
  ): Promise<string | null> {
    patch({ busy: 'Exporting…' });
    try {
      const { html, missing, what } = await makePage(doc, view);
      await files.write(output, html);
      const saved = fileNameOf(output);
      patch({
        message: {
          kind: 'info',
          text: missing.length
            ? `Saved ${saved} without ${missing.join(', ')}: ${what} could not be read.`
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

  /** AN28: what an export says when its format cannot carry the animation's sounds. */
  const noSound = (format: AnimationFormat, doc: AnimationDoc): string =>
    carriesSound(format) || soundsHeard(doc).length === 0
      ? ''
      : ` ${format === 'gif' ? 'A GIF' : 'A picture'} has no sound, so the animation’s sound is left out.`;

  /**
   * AN15: every frame drawn by the same drawing as the preview, then made into the chosen file:
   * MP4, AVI, MOV or GIF by FFmpeg from frames in the app's folder (removed afterwards; AN28 a
   * video with the sounds), a PNG sequence beside the chosen name, or the frame at the playhead as
   * one PNG. `options`: another width (the height in proportion) and a range of frames. `chosen`
   * skips the save box (Send to Video mode). Returns the file made, or null (closed, cancelled or
   * failed).
   */
  async function exportAnimation(
    format: AnimationFormat,
    chosen?: string,
    options: AnimationExportOptions = {},
  ): Promise<string | null> {
    if (store.get().exporting || store.get().busy) return null;
    pause();
    const drawn = present();
    // The size and the frames are checked before the save box.
    let size: ReturnType<typeof exportSize>;
    let range: ReturnType<typeof exportedFrames>;
    try {
      size = exportSize(drawn.stage, format, options.width);
      range = exportedFrames(drawn, hasRange(format) ? options : {});
    } catch (error) {
      showError(error);
      return null;
    }
    const scaled =
      options.width !== undefined && options.width !== drawn.stage.width
        ? { width: size.width, height: size.height }
        : undefined;
    // AN21: a video cannot be transparent: a stage with no background is drawn on white.
    const onWhite = isVideoFormat(format) && drawn.stage.background === TRANSPARENT;
    const doc = onWhite ? { ...drawn, stage: { ...drawn.stage, background: '#ffffff' } } : drawn;
    const { frame } = store.get();
    const output = chosen ?? (await dialogs.exportAnimation(ctx.fileBase(), format));
    if (!output) return null;
    const whole = range.first === 0 && range.last === doc.stage.length - 1;
    if (format === 'html')
      return exportWebPage(doc, output, {
        ...(scaled ? { size: scaled } : {}),
        ...(whole ? {} : { range: { first: range.first, last: range.last } }),
      });
    if (format === 'svg') return exportSvg(doc, frame, output);
    const sized = scaled ? ` (${scaled.width} × ${scaled.height})` : '';
    if (format === 'png') {
      patch({ busy: 'Exporting…' });
      try {
        const png = await (scaled
          ? renderer.renderPng(doc, frame, scaled)
          : renderer.renderPng(doc, frame));
        await files.writeBytes(output, png);
        patch({
          message: {
            kind: 'info',
            text: `Saved ${fileNameOf(output)}${sized}.${noSound(format, doc)}`,
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
    const { count, first, last } = range;
    const folder = format === 'png-sequence' ? null : framesFolder();
    const written: string[] = [];
    let made: string | null = null;
    try {
      show('drawing', 0);
      await drawFrames(
        count,
        async (i) => {
          stopIfCancelled();
          const png = await (scaled
            ? renderer.renderPng(doc, first + i, scaled)
            : renderer.renderPng(doc, first + i));
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
        const { fps, playOnce } = doc.stage;
        const { width, height } = scaled ?? doc.stage;
        const sounds = isVideoFormat(format) ? soundPieces(doc, first, last) : [];
        const started = engine.encodeFrames(folder.slice(0, -1), output, {
          format: format as 'mp4' | 'avi' | 'mov' | 'gif',
          fps,
          frames: count,
          width,
          height,
          // AN8: a GIF set to play once stops on its last frame (a video always stops at its end).
          ...(format === 'gif' && playOnce ? { once: true } : {}),
          // AN28: the sounds heard in the frames exported, each at its time.
          ...(sounds.length ? { sounds } : {}),
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
        const name = format === 'gif' ? 'GIF' : format.toUpperCase();
        const note = size.padded
          ? ` ${name} needs even sizes, so it is ${size.width} × ${size.height} (one pixel added).`
          : '';
        const white = onWhite
          ? ` ${name === 'GIF' ? 'A GIF' : `An ${name}`} cannot be transparent, so its background is white.`
          : '';
        patch({
          message: {
            kind: 'info',
            text: `Saved ${fileNameOf(output)}${sized}.${note}${white}${noSound(format, doc)}`,
          },
        });
        made = output;
      } else {
        written.length = 0;
        const firstFile = fileNameOf(sequenceName(output, 0));
        const lastFile = fileNameOf(sequenceName(output, count - 1));
        patch({
          message: {
            kind: 'info',
            text:
              (count === 1
                ? `Saved ${firstFile}${sized}.`
                : `Saved ${count} pictures${sized}, ${firstFile} to ${lastFile}.`) +
              noSound(format, doc),
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

    /**
     * T7: what the export dialog shows before exporting: the frames, seconds, estimated size and
     * the file's size, and how many sounds the animation has (AN28); `error` when the width or
     * frames typed cannot be used.
     */
    exportSummary(format: AnimationFormat, options: AnimationExportOptions = {}) {
      const doc = present();
      const sounds = soundsHeard(doc).length;
      const picture = format === 'png' || format === 'svg';
      try {
        const { count, seconds } = exportedFrames(doc, hasRange(format) ? options : {});
        return {
          frames: picture ? 1 : count,
          seconds,
          bytes: estimateAnimationSize(
            doc,
            format,
            hasRange(format) ? options : { ...options, from: undefined, to: undefined },
          ),
          size:
            format === 'svg'
              ? { width: doc.stage.width, height: doc.stage.height, padded: false }
              : exportSize(doc.stage, format, options.width),
          sounds,
          error: null as string | null,
        };
      } catch (error) {
        const { width, height } = doc.stage;
        return {
          frames: 0,
          seconds: 0,
          bytes: 0,
          size: { width, height, padded: false },
          sounds,
          error: error instanceof Error ? error.message : String(error),
        };
      }
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
