// In-memory MediaEngine for UI and app tests (P1). It behaves like the real engine — checked by
// the shared contract tests — but finishes instantly and needs no FFmpeg or real files.
import { FILE_NOT_FOUND, JobCancelledError, MediaError } from '../../core/model/errors.ts';
import type { JobEvent, JobHandle, MediaEngine, ProbeInfo } from '../../core/ports.ts';

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

  /** Runs a fake job: events like the real queue, then `produce` writes the output file. */
  function job(
    label: string,
    input: string,
    output: string,
    produce: (source: ProbeInfo) => ProbeInfo,
  ): JobHandle {
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
      let source: ProbeInfo;
      try {
        source = find(input);
      } catch (error) {
        emit({ type: 'error', ...base, message: (error as Error).message });
        throw error;
      }
      for (const ratio of [0.5, 1]) emit({ type: 'progress', ...base, ratio });
      files.set(output, produce(source));
      emit({ type: 'done', ...base });
    })();
    done.catch(() => {});
    return { id, done, cancel: () => (cancelled = true) };
  }

  const engine: MediaEngine & { addFile(path: string, info: ProbeInfo): void } = {
    addFile: (path, info) => void files.set(path, info),

    probe: async (path) => structuredClone(find(path)),

    makeProxy: (input, output) =>
      job('Preparing preview', input, output, (src) => ({
        ...src,
        container: 'mp4',
        video: {
          codec: 'h264',
          width: scaledWidth(src, PROXY_HEIGHT),
          height: PROXY_HEIGHT,
          fps: src.video?.fps ?? 30,
        },
      })),

    makeThumbnails: (input, output, { count, height }) =>
      job('Thumbnails', input, output, (src) => ({
        kind: 'image',
        container: 'jpg',
        sizeBytes: 20_000,
        video: { codec: 'mjpeg', width: count * scaledWidth(src, height), height },
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

    onJobEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return engine;
}
