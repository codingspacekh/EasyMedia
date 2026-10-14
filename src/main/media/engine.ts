// MediaEngine implemented with the bundled ffprobe/ffmpeg (ARCHITECTURE §8).
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { Seconds } from '../../core/model/time.ts';
import type { JobHandle, MediaEngine, ProbeInfo } from '../../core/ports.ts';
import { fromProjectPath, numberedPath } from '../../core/project/paths.ts';
import { resizeCropFilter } from '../../core/image/crop.ts';
import { compileProject } from '../../core/render/compile.ts';
import type { BinaryPaths } from '../ffmpeg/paths.ts';
import { explainFfmpegError } from '../ffmpeg/errors.ts';
import { createJobQueue, type RunProcess } from '../jobs/queue.ts';
import { computePeaks, frameArgs, proxyArgs, thumbnailArgs, waveformArgs } from './jobs.ts';
import { parseProbe, type FfprobeJson } from './probe.ts';

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

  async function probe(path: string): Promise<ProbeInfo> {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(
        binaries.ffprobe,
        ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path],
        { maxBuffer: 16 * 1024 * 1024, windowsHide: true },
      ));
    } catch (e) {
      throw explainFfmpegError((e as { stderr?: string }).stderr || String(e));
    }
    return parseProbe(JSON.parse(stdout) as FfprobeJson);
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
      const raw = join(tmpdir(), `easymedia-wave-${randomUUID()}.f32`);
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

    async resizeCropImage(input, plan) {
      const filter = resizeCropFilter(plan);
      let n = 1;
      while (await exists(numberedPath(input, n))) n++;
      const path = numberedPath(input, n);
      await queue.run({
        label: 'Resize & crop',
        args: ['-i', input, '-vf', filter, '-frames:v', '1', '-update', '1', '-q:v', '2'],
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

    renderVideo(project, output, { projectDir, quality, textImages }) {
      let plan;
      try {
        plan = compileProject(project, {
          mediaPath: (asset) => fromProjectPath(projectDir, asset.path),
          videoEncoder,
          ...(quality ? { quality } : {}),
          ...(textImages ? { textImages } : {}),
        });
      } catch (error) {
        return failedJob(error as Error);
      }
      return queue.run({ label: 'Export', args: plan.args, output, duration: plan.duration });
    },

    onJobEvent: (listener) => queue.onEvent(listener),

    /** Stops every FFmpeg job, e.g. when the app quits, so nothing keeps running afterwards. */
    cancelAll: () => queue.cancelAll(),
  };
}

/** A job that could not start (e.g. the project cannot be exported): `done` rejects at once. */
function failedJob(error: Error): JobHandle {
  const done = Promise.reject(error);
  done.catch(() => {});
  return { id: 'not-started', done, cancel: () => {} };
}
