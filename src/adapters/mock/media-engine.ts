// In-memory MediaEngine for UI and app tests (P1). It behaves like the real engine — checked by
// the shared contract tests — but finishes instantly and needs no FFmpeg or real files.
import { FILE_NOT_FOUND, JobCancelledError, MediaError } from '../../core/model/errors.ts';
import type { JobEvent, JobHandle, MediaEngine, ProbeInfo } from '../../core/ports.ts';
import { fromProjectPath, numberedPath } from '../../core/project/paths.ts';
import { resizeCropFilter } from '../../core/image/crop.ts';
import { compileProject } from '../../core/render/compile.ts';
import { defaultExport, estimateSize, type ExportSettings } from '../../core/render/formats.ts';
import {
  AUDIO_FORMATS,
  estimateAudioSize,
  validateAudioExport,
  type AudioExportSettings,
} from '../../core/render/audio-formats.ts';

const PROXY_HEIGHT = 360;
const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));
const even = (n: number) => 2 * Math.round(n / 2);

export function createMockMediaEngine(initialFiles: Record<string, ProbeInfo> = {}) {
  const files = new Map(Object.entries(initialFiles));
  const listeners = new Set<(event: JobEvent) => void>();
  let nextId = 1;
  const emit = (event: JobEvent) => listeners.forEach((listener) => listener(event));

  const find = (path: string): ProbeInfo => {
    const info = files.get(path);
    if (!info) throw new MediaError(FILE_NOT_FOUND);
    return info;
  };
  /** Width of a picture `height` px tall with the same shape as the source. */
  const scaledWidth = (info: ProbeInfo, height: number) =>
    even(((info.video?.width ?? 16) * height) / (info.video?.height ?? 9));

  /** Runs a fake job with the real queue's events; `produce` checks inputs and describes the output. */
  function job(label: string, output: string, produce: () => ProbeInfo): JobHandle {
    const id = `mock-job-${nextId++}`;
    let cancelled = false;
    const base = { jobId: id, label };
    emit({ type: 'queued', ...base });
    const done = (async () => {
      await nextTick();
      if (cancelled) {
        emit({ type: 'cancelled', ...base });
        throw new JobCancelledError();
      }
      emit({ type: 'started', ...base });
      let result: ProbeInfo;
      try {
        result = produce();
      } catch (error) {
        emit({ type: 'error', ...base, message: (error as Error).message });
        throw error;
      }
      for (const ratio of [0.5, 1]) emit({ type: 'progress', ...base, ratio });
      files.set(output, result);
      emit({ type: 'done', ...base });
    })();
    done.catch(() => {});
    return { id, done, cancel: () => (cancelled = true) };
  }

  const engine: MediaEngine & { addFile(path: string, info: ProbeInfo): void } = {
    addFile: (path, info) => void files.set(path, info),

    probe: async (path) => structuredClone(find(path)),

    makeProxy: (input, output) =>
      job('Preparing preview', output, () => {
        const src = find(input);
        return {
          ...src,
          container: 'mp4',
          video: {
            codec: 'h264',
            width: scaledWidth(src, PROXY_HEIGHT),
            height: PROXY_HEIGHT,
            fps: src.video?.fps ?? 30,
          },
        };
      }),

    makeThumbnails: (input, output, { count, height }) =>
      job('Thumbnails', output, () => ({
        kind: 'image',
        container: 'jpg',
        sizeBytes: 20_000,
        video: { codec: 'mjpeg', width: count * scaledWidth(find(input), height), height },
      })),

    async waveformPeaks(input, buckets) {
      find(input);
      return Array.from({ length: buckets }, (_, i) => 0.5 + 0.4 * Math.sin(i / 3));
    },

    async extractFrame(input, _time, output) {
      const src = find(input);
      const ext = output.split('.').pop() ?? 'png';
      files.set(output, {
        kind: 'image',
        container: ext,
        sizeBytes: 500_000,
        video: {
          codec: ext === 'jpg' ? 'mjpeg' : ext,
          width: src.video?.width ?? 0,
          height: src.video?.height ?? 0,
        },
      });
    },

    async resizeCropImage(input, plan) {
      resizeCropFilter(plan);
      const src = find(input);
      let n = 1;
      while (files.has(numberedPath(input, n))) n++;
      const path = numberedPath(input, n);
      const ext = path.split('.').pop() ?? 'jpg';
      files.set(path, {
        kind: 'image',
        container: ext,
        sizeBytes: Math.round(src.sizeBytes / 2),
        video: {
          codec: ext === 'jpg' ? 'mjpeg' : ext,
          width: plan.crop.width,
          height: plan.crop.height,
        },
      });
      return path;
    },

    async renderFrame(project, time, wanted, { projectDir, textImages }) {
      compileProject(project, {
        mediaPath: (asset) => fromProjectPath(projectDir, asset.path),
        frameAt: time,
        ...(textImages ? { textImages } : {}),
      });
      for (const asset of project.media) find(fromProjectPath(projectDir, asset.path));
      let output = wanted;
      for (let n = 2; files.has(output); n++) output = numberedPath(wanted, n);
      const ext = output.split('.').pop()?.toLowerCase() ?? 'png';
      const { width, height } = project.settings;
      files.set(output, {
        kind: 'image',
        container: ext,
        sizeBytes: width * height,
        video: { codec: ext === 'jpg' ? 'mjpeg' : ext, width, height },
      });
      return output;
    },

    renderVideo(project, output, { projectDir, textImages, format }) {
      let plan: ReturnType<typeof compileProject>;
      try {
        plan = compileProject(project, {
          mediaPath: (asset) => fromProjectPath(projectDir, asset.path),
          ...(textImages ? { textImages } : {}),
          ...(format ? { format } : {}),
        });
      } catch (error) {
        const done = Promise.reject(error as Error);
        done.catch(() => {});
        return { id: 'not-started', done, cancel: () => {} };
      }
      const f = format ?? defaultExport(project.settings);
      const [videoCodec, audioCodec] = codecsOf(f);
      return job('Export', output, () => {
        for (const asset of project.media) find(fromProjectPath(projectDir, asset.path));
        return {
          kind: 'video',
          container: f.container,
          duration: plan.duration,
          sizeBytes: Math.round(estimateSize(f, plan.duration, plan.hasAudio).bytes),
          video: { codec: videoCodec, width: f.width, height: f.height, fps: f.fps },
          ...(plan.hasAudio
            ? { audio: { codec: audioCodec, sampleRate: 48000, channels: 2 } }
            : {}),
        };
      });
    },

    async decodeAudio(path, sampleRate) {
      const info = find(path);
      if (!info.audio) throw new MediaError('This file has no sound to edit.');
      const rate = sampleRate ?? info.audio.sampleRate;
      const length = Math.round((info.duration ?? 0) * rate);
      // A quiet tone, different on each side: enough to see and edit.
      const channels = Array.from({ length: Math.min(2, info.audio.channels) }, (_, ch) => {
        const c = new Float32Array(length);
        const step = (2 * Math.PI * (220 + 110 * ch)) / rate;
        for (let i = 0; i < length; i++) c[i] = 0.5 * Math.sin(i * step);
        return c;
      });
      return {
        sampleRate: rate,
        channels,
        ...(info.audio.bitDepth ? { bits: info.audio.bitDepth } : {}),
      };
    },

    encodeAudio(audio, output, settings) {
      try {
        validateAudioExport(settings);
      } catch (error) {
        const done = Promise.reject(error as Error);
        done.catch(() => {});
        return { id: 'not-started', done, cancel: () => {} };
      }
      const duration = audio.channels[0]!.length / audio.sampleRate;
      return job('Export audio', output, () => ({
        kind: 'audio',
        container: AUDIO_FORMATS[settings.format].extension,
        duration,
        sizeBytes: Math.round(estimateAudioSize(settings, duration).bytes),
        audio: {
          codec: audioCodecOf(settings),
          sampleRate: settings.sampleRate,
          channels: settings.channels,
          ...(settings.format === 'wav' || settings.format === 'flac'
            ? { bitDepth: settings.bitDepth }
            : {}),
        },
      }));
    },

    onJobEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return engine;
}

/** The audio codec ffprobe reports for each audio export (A17). */
function audioCodecOf(e: AudioExportSettings): string {
  if (e.format === 'wav') return { 16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_f32le' }[e.bitDepth];
  return { mp3: 'mp3', m4a: 'aac', aac: 'aac', flac: 'flac' }[e.format];
}

/** The codec names ffprobe reports for each format (V16). */
function codecsOf(f: ExportSettings): [string, string] {
  if (f.compression === 'lossless') return [f.container === 'mov' ? 'png' : 'ffv1', 'pcm_s16le'];
  return {
    mp4: ['h264', 'aac'],
    mov: ['h264', 'aac'],
    avi: ['mpeg4', 'mp3'],
    wmv: ['wmv2', 'wmav2'],
    mpg: ['mpeg2video', 'ac3'],
  }[f.container] as [string, string];
}
