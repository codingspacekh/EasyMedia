// MediaEngine implemented with the bundled ffprobe/ffmpeg (ARCHITECTURE §8).
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, open, readdir, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Seconds } from '../../core/model/time.ts';
import { deinterleave, interleave } from '../../core/audio/pcm.ts';
import { MediaError } from '../../core/model/errors.ts';
import type { JobHandle, MediaEngine, ProbeInfo } from '../../core/ports.ts';
import { audioCodecArgs, validateAudioExport } from '../../core/render/audio-formats.ts';
import {
  fromProjectPath,
  madePicturePath,
  numberedPath,
  withExtension,
} from '../../core/project/paths.ts';
import { colourKeyFilter } from '../../core/image/colour-key.ts';
import { combineFilter } from '../../core/image/combine.ts';
import { resizeCropFilter } from '../../core/image/crop.ts';
import { compileProject } from '../../core/render/compile.ts';
import type { BinaryPaths } from '../ffmpeg/paths.ts';
import { explainFfmpegError } from '../ffmpeg/errors.ts';
import { createJobQueue, type RunProcess } from '../jobs/queue.ts';
import {
  animationArgs,
  computePeaks,
  decodeArgs,
  frameArgs,
  proxyArgs,
  rawInputArgs,
  thumbnailArgs,
  waveformArgs,
} from './jobs.ts';
import { parseProbe, type FfprobeJson } from './probe.ts';
import { svgSize } from '../../core/animation/svg.ts';
import { gifLoops } from '../../core/image/gif.ts';

/** The first `count` bytes of a file (fewer if it is shorter). */
async function firstBytes(path: string, count: number): Promise<Uint8Array> {
  const file = await open(path, 'r');
  try {
    const buffer = new Uint8Array(count);
    const { bytesRead } = await file.read(buffer, 0, count, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

const execFileAsync = promisify(execFile);
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

export function createNodeMediaEngine(
  binaries: BinaryPaths,
  {
    concurrency = 1,
    run,
    videoEncoder = 'libx264',
  }: { concurrency?: number; run?: RunProcess; videoEncoder?: string } = {},
): MediaEngine & { cancelAll(): void } {
  const queue = createJobQueue({ ffmpeg: binaries.ffmpeg, concurrency, ...(run ? { run } : {}) });

  /** File checks still running: quitting stops them too (they are not queue jobs). */
  const checks = new Set<{ kill(): boolean }>();

  async function probe(path: string): Promise<ProbeInfo> {
    let stdout: string;
    const running = execFileAsync(
      binaries.ffprobe,
      ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
      { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
    );
    checks.add(running.child);
    try {
      ({ stdout } = await running);
    } catch (e) {
      throw explainFfmpegError((e as { stderr?: string }).stderr || String(e));
    } finally {
      checks.delete(running.child);
    }
    const info = parseProbe(JSON.parse(stdout) as FfprobeJson);
    // AN5: FFmpeg recognises an SVG but cannot draw it, so it knows no size: the file gives it.
    if (info.container === 'svg' && info.video)
      info.video = { ...info.video, ...svgSize(await readFile(path, 'utf8')) };
    // AN17: whether a GIF loops is in its first bytes (ffprobe does not say).
    if (info.container === 'gif') {
      const loops = gifLoops(await firstBytes(path, 64 * 1024));
      if (loops !== null) info.loop = loops;
    }
    return info;
  }

  async function decodeAudioToFile(input: string, sampleRate?: number) {
    const info = await probe(input);
    if (!info.audio) throw new MediaError(NO_SOUND);
    const count = Math.min(2, info.audio.channels);
    const rate = sampleRate ?? info.audio.sampleRate;
    const raw = join(tmpdir(), `oneeditor-decode-${randomUUID()}.f32`);
    await queue.run({
      label: 'Opening sound',
      args: decodeArgs(input, count, rate),
      output: raw,
      ...(info.duration ? { duration: info.duration } : {}),
    }).done;
    return {
      sampleRate: rate,
      count,
      raw,
      ...(info.audio.bitDepth ? { bits: info.audio.bitDepth } : {}),
    };
  }

  return {
    probe,

    makeProxy: (input, output, duration) =>
      queue.run({ label: 'Preparing preview', args: proxyArgs(input), output, duration }),

    makeThumbnails: (input, output, { count, height, duration }) =>
      queue.run({
        label: 'Thumbnails',
        args: thumbnailArgs(input, duration, { count, height }),
        output,
        duration,
      }),

    async waveformPeaks(input: string, buckets: number): Promise<number[]> {
      const raw = join(tmpdir(), `oneeditor-wave-${randomUUID()}.f32`);
      try {
        await queue.run({ label: 'Waveform', args: waveformArgs(input), output: raw }).done;
        const bytes = await readFile(raw);
        // Copy into an aligned buffer: Float32Array needs a 4-byte aligned offset.
        const samples = new Float32Array(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        );
        return computePeaks(samples, buckets);
      } finally {
        await rm(raw, { force: true });
      }
    },

    async extractFrame(input: string, time: Seconds, output: string): Promise<void> {
      await queue.run({ label: 'Snapshot', args: frameArgs(input, time), output }).done;
    },

    async resizeCropImage(input, plan, name) {
      const filter = resizeCropFilter(plan);
      let n = 0;
      while (await exists(madePicturePath(input, name, n))) n++;
      const path = madePicturePath(input, name, n);
      await queue.run({
        label: 'Resize & crop',
        args: ['-i', input, '-vf', filter, '-frames:v', '1', '-update', '1', '-q:v', '2'],
        output: path,
      }).done;
      return path;
    },

    async combineImages(base, top, plan, name) {
      const filter = combineFilter(plan);
      let n = 0;
      while (await exists(madePicturePath(base, name, n))) n++;
      const path = madePicturePath(base, name, n);
      await queue.run({
        label: 'Place a picture',
        args: ['-i', base, '-i', top, '-filter_complex', filter, '-frames:v', '1', '-update', '1'],
        output: path,
      }).done;
      return path;
    },

    async colourKeyImage(input, key, name) {
      const filter = colourKeyFilter(key);
      // A see-through picture is always a PNG (a JPG cannot be see-through).
      const png = withExtension(input, '.png');
      let n = 0;
      while (await exists(madePicturePath(png, name, n))) n++;
      const path = madePicturePath(png, name, n);
      await queue.run({
        label: 'Make a colour see-through',
        args: ['-i', input, '-vf', filter, '-frames:v', '1', '-update', '1'],
        output: path,
      }).done;
      return path;
    },

    async renderFrame(project, time, wanted, { projectDir, textImages }) {
      const plan = compileProject(project, {
        mediaPath: (asset) => fromProjectPath(projectDir, asset.path),
        frameAt: time,
        ...(textImages ? { textImages } : {}),
      });
      await mkdir(dirname(wanted), { recursive: true });
      let output = wanted;
      for (let n = 2; await exists(output); n++) output = numberedPath(wanted, n);
      const jpeg = /\.jpe?g$/i.test(output) ? ['-q:v', '2'] : [];
      await queue.run({ label: 'Snapshot', args: [...plan.args, ...jpeg], output }).done;
      return output;
    },

    renderVideo(project, output, { projectDir, format, textImages }) {
      const compile = (encoder: string) =>
        compileProject(project, {
          mediaPath: (asset) => fromProjectPath(projectDir, asset.path),
          videoEncoder: encoder,
          ...(format ? { format } : {}),
          ...(textImages ? { textImages } : {}),
        });
      let plan;
      try {
        plan = compile(videoEncoder);
      } catch (error) {
        return failedJob(error as Error);
      }
      // A hardware encoder cannot make every picture size (VideoToolbox refuses 426 × 240):
      // if it fails, the export is made again with the software encoder.
      const fallback = videoEncoder === 'libx264' ? {} : { fallbackArgs: compile('libx264').args };
      return queue.run({
        label: 'Export',
        args: plan.args,
        ...fallback,
        output,
        duration: plan.duration,
      });
    },

    decodeAudioToFile,

    async decodeAudio(input, sampleRate) {
      const decoded = await decodeAudioToFile(input, sampleRate);
      try {
        const bytes = await readFile(decoded.raw);
        // Copy into an aligned buffer: Float32Array needs a 4-byte aligned offset.
        const samples = new Float32Array(
          bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        );
        return {
          sampleRate: decoded.sampleRate,
          channels: deinterleave(samples, decoded.count),
          ...(decoded.bits ? { bits: decoded.bits } : {}),
        };
      } finally {
        await rm(decoded.raw, { force: true });
      }
    },

    releaseDecoded: (raw) => rm(raw, { force: true }),

    encodeAudio(audio, output, settings) {
      try {
        validateAudioExport(settings);
      } catch (error) {
        return failedJob(error as Error);
      }
      const raw = join(tmpdir(), `oneeditor-export-${randomUUID()}.f32`);
      const data = interleave(audio.channels);
      return queue.run({
        label: 'Export audio',
        args: [
          ...rawInputArgs(raw, audio.sampleRate, audio.channels.length),
          ...audioCodecArgs(settings),
        ],
        output,
        duration: (audio.channels[0]?.length ?? 0) / audio.sampleRate,
        prepare: async () => {
          // Audio mode's saved tracks go into a folder next to the project, made on first save.
          await mkdir(dirname(output), { recursive: true });
          await writeFile(raw, new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
        },
        cleanUp: () => rm(raw, { force: true }),
      });
    },

    encodeFrames(folder, output, options) {
      return queue.run({
        label: 'Export animation',
        args: animationArgs(folder, options),
        output,
        duration: options.frames / options.fps,
        prepare: async () => {
          if (!(await exists(folder)))
            throw new MediaError('The animation frames could not be found. Export again.');
          // AN28: a sound that has gone is named, rather than FFmpeg's own words.
          for (const sound of options.format === 'gif' ? [] : (options.sounds ?? []))
            if (!(await exists(sound.path)))
              throw new MediaError(
                `The sound ${basename(sound.path)} could not be found. Put it back beside the animation file, or delete it from the timeline.`,
              );
        },
        cleanUp: () => removeFrames(folder),
      });
    },

    onJobEvent: (listener) => queue.onEvent(listener),

    /** Stops every FFmpeg job, e.g. when the app quits, so nothing keeps running afterwards. */
    cancelAll: () => {
      queue.cancelAll();
      for (const check of checks) check.kill();
    },
  };
}

const NO_SOUND = 'This file has no sound to edit.';

/** Removes an export's frames and then their folder; nothing else is ever deleted. */
async function removeFrames(folder: string): Promise<void> {
  const names = await readdir(folder).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((n) => /^frame-\d{5}\.png$/.test(n))
      .map((n) => rm(join(folder, n), { force: true })),
  );
  await rmdir(folder).catch(() => {});
}

/** A job that could not start (e.g. the project cannot be exported): `done` rejects at once. */
function failedJob(error: Error): JobHandle {
  const done = Promise.reject(error);
  done.catch(() => {});
  return { id: 'not-started', done, cancel: () => {} };
}
