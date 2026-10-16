// MediaEngine for the page: every call goes to the main process through window.mve (P1, P2).
import { JobCancelledError } from '../../core/model/errors.ts';
import type { JobEvent, JobHandle, MediaEngine } from '../../core/ports.ts';
import { fromWire } from '../../core/wire.ts';
import { deinterleave } from '../../core/audio/pcm.ts';
import { toMediaUrl } from '../../core/media-url.ts';
import type { MveApi, Reply } from '../../preload/api.ts';

export async function unwrap<T>(reply: Promise<Reply<T>>): Promise<T> {
  const r = await reply;
  if (!r.ok) throw fromWire(r.error);
  return r.value;
}

/** Reads a file the main process allowed, through media:// (no copy through the main process). */
const fetchBytes = async (path: string): Promise<ArrayBuffer> =>
  (await fetch(toMediaUrl(path))).arrayBuffer();

export function createElectronMediaEngine(
  api: MveApi,
  {
    readFile = fetchBytes,
  }: { readFile?: (path: string) => Promise<ArrayBuffer | Uint8Array> } = {},
): MediaEngine {
  const listeners = new Set<(event: JobEvent) => void>();
  const pending = new Map<string, { resolve: () => void; reject: (e: Error) => void }>();
  let nextKey = 1;

  const settle = (
    key: string,
    outcome: (p: { resolve: () => void; reject: (e: Error) => void }) => void,
  ) => {
    const p = pending.get(key);
    pending.delete(key);
    if (p) outcome(p);
  };

  api.on('job:event', (e) => {
    if (e.type === 'failed') {
      const error = fromWire(e.error);
      listeners.forEach((l) =>
        l({ type: 'error', jobId: e.jobId, label: e.label, message: error.message }),
      );
      settle(e.jobId, (p) => p.reject(error));
      return;
    }
    listeners.forEach((l) => l(e));
    if (e.type === 'done') settle(e.jobId, (p) => p.resolve());
    if (e.type === 'cancelled') settle(e.jobId, (p) => p.reject(new JobCancelledError()));
  });

  function startJob(start: (key: string) => Promise<Reply<null>>): JobHandle {
    const key = `page-job-${nextKey++}`;
    const done = new Promise<void>((resolve, reject) => pending.set(key, { resolve, reject }));
    done.catch(() => {});
    unwrap(start(key)).catch((error: Error) => settle(key, (p) => p.reject(error)));
    return { id: key, done, cancel: () => void api.invoke('job:cancel', key) };
  }

  return {
    probe: (path) => unwrap(api.invoke('media:probe', path)),
    makeProxy: (input, output, duration) =>
      startJob((k) => api.invoke('media:proxy', k, input, output, duration)),
    makeThumbnails: (input, output, options) =>
      startJob((k) => api.invoke('media:thumbnails', k, input, output, options)),
    waveformPeaks: (input, buckets) => unwrap(api.invoke('media:waveform', input, buckets)),
    extractFrame: async (input, time, output) => {
      await unwrap(api.invoke('media:frame', input, time, output));
    },
    resizeCropImage: (input, plan) => unwrap(api.invoke('media:resizeCrop', input, plan)),
    renderFrame: (project, time, output, options) =>
      unwrap(api.invoke('media:snapshot', project, time, output, options)),
    renderVideo: (project, output, options) =>
      startJob((k) => api.invoke('media:render', k, project, output, options)),
    async decodeAudio(path, sampleRate) {
      const { raw, count, ...rest } = await unwrap(
        api.invoke('media:decodeAudio', path, sampleRate),
      );
      try {
        const bytes = await readFile(raw);
        const samples =
          bytes instanceof Uint8Array
            ? new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
            : new Float32Array(bytes);
        return { ...rest, channels: deinterleave(samples, count) };
      } finally {
        void api.invoke('media:release', raw);
      }
    },
    decodeAudioToFile: (path, sampleRate) =>
      unwrap(api.invoke('media:decodeAudio', path, sampleRate)),
    releaseDecoded: async (raw) => void (await unwrap(api.invoke('media:release', raw))),
    encodeAudio: (audio, output, settings) =>
      startJob((k) => api.invoke('media:encodeAudio', k, audio, output, settings)),
    onJobEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
