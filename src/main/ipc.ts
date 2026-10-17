// Main-process side of the IPC contract (P2, ARCHITECTURE §8). Every request is answered with
// data: a value, or a WireError the page turns back into the right error type.
import { JobCancelledError } from '../core/model/errors.ts';
import type { AppPaths, Dialogs, JobHandle, MediaEngine, ProjectFiles } from '../core/ports.ts';
import { toWire } from '../core/wire.ts';
import { resizeCropFilter } from '../core/image/crop.ts';
import type { Channel, Channels, Events } from '../preload/api.ts';
import { CHANNELS } from '../preload/api.ts';
import type { AllowList } from './protocol/allowlist.ts';

export interface MainServices {
  ipc: { handle(channel: string, handler: (event: unknown, ...args: unknown[]) => unknown): void };
  send<E extends keyof Events>(event: E, payload: Events[E]): void;
  engine: MediaEngine;
  allow: AllowList;
  paths: AppPaths;
  dialogs: Dialogs;
  files: ProjectFiles;
  /** X4: asks the system for the microphone (macOS); true where the system does not ask. */
  microphoneAccess: () => Promise<boolean>;
  /** P7: the page's answer when the window is closing. */
  closeAnswer: (close: boolean) => void;
}

type Handlers = {
  [C in Channel]: (...args: Channels[C]['args']) => Promise<Channels[C]['result']>;
};

export function registerIpc(s: MainServices): void {
  const jobs = new Map<string, JobHandle>();
  /** Temporary files of decoded sound the page has not read yet. */
  const decoded = new Set<string>();
  const keyOf = new Map<string, string>();

  // Progress comes from engine events; the outcome from the job's promise.
  s.engine.onJobEvent((e) => {
    const key = keyOf.get(e.jobId);
    if (key && (e.type === 'started' || e.type === 'progress'))
      s.send('job:event', { ...e, jobId: key });
  });

  function track(key: string, label: string, handle: JobHandle, onDone?: () => void): null {
    jobs.set(key, handle);
    keyOf.set(handle.id, key);
    handle.done
      .then(
        () => {
          onDone?.();
          s.send('job:event', { type: 'done', jobId: key, label });
        },
        (error: unknown) =>
          s.send(
            'job:event',
            error instanceof JobCancelledError
              ? { type: 'cancelled', jobId: key, label }
              : { type: 'failed', jobId: key, label, error: toWire(error) },
          ),
      )
      .finally(() => {
        jobs.delete(key);
        keyOf.delete(handle.id);
      });
    return null;
  }

  const handlers: Handlers = {
    'media:probe': async (path) => {
      const info = await s.engine.probe(path);
      s.allow.add(path);
      return info;
    },
    'media:proxy': async (key, input, output, duration) =>
      track(key, 'Preparing preview', s.engine.makeProxy(input, output, duration), () =>
        s.allow.add(output),
      ),
    'media:thumbnails': async (key, input, output, options) =>
      track(key, 'Thumbnails', s.engine.makeThumbnails(input, output, options), () =>
        s.allow.add(output),
      ),
    'media:waveform': (input, buckets) => s.engine.waveformPeaks(input, buckets),
    'media:frame': async (input, time, output) => {
      await s.engine.extractFrame(input, time, output);
      s.allow.add(output);
      return null;
    },
    'media:resizeCrop': async (input, plan) => {
      resizeCropFilter(plan); // explains a bad crop before anything else
      if (!s.allow.has(input)) throw new Error('Only pictures opened in EasyMedia can be cropped.');
      const path = await s.engine.resizeCropImage(input, plan);
      s.allow.add(path);
      return path;
    },
    'media:snapshot': async (project, time, output, options) => {
      const path = await s.engine.renderFrame(project, time, output, options);
      s.allow.add(path);
      return path;
    },
    'media:render': async (key, project, output, options) =>
      track(key, 'Export', s.engine.renderVideo(project, output, options)),
    // A1: the samples are left in a file the page reads once through media://, then releases.
    'media:decodeAudio': async (path, sampleRate) => {
      const file = await s.engine.decodeAudioToFile(path, sampleRate);
      decoded.add(file.raw);
      s.allow.add(file.raw);
      return file;
    },
    'media:release': async (raw) => {
      if (!decoded.delete(raw)) return null;
      s.allow.remove(raw);
      await s.engine.releaseDecoded(raw);
      return null;
    },
    'media:encodeAudio': async (key, audio, output, settings) =>
      track(key, 'Export audio', s.engine.encodeAudio(audio, output, settings), () =>
        s.allow.add(output),
      ),
    'job:cancel': async (key) => {
      jobs.get(key)?.cancel();
      return null;
    },
    'app:paths': async () => s.paths,
    'dialog:openMedia': () => s.dialogs.openMedia(),
    'dialog:openProject': () => s.dialogs.openProject(),
    'dialog:saveProject': (name) => s.dialogs.saveProject(name),
    'dialog:exportVideo': (name, container) => s.dialogs.exportVideo(name, container),
    'dialog:exportAudio': (name, format) => s.dialogs.exportAudio(name, format),
    'dialog:confirm': (message) => s.dialogs.confirm(message),
    'dialog:unsavedChanges': () => s.dialogs.unsavedChanges(),
    'app:closeAnswer': async (close) => {
      s.closeAnswer(close === true);
      return null;
    },
    'dialog:chooseFolder': (title) => s.dialogs.chooseFolder(title),
    'project:read': (path) => s.files.read(path),
    'project:write': async (path, text) => {
      await s.files.write(path, text);
      return null;
    },
    'media:microphoneAccess': () => s.microphoneAccess(),
    'project:remove': async (path) => {
      await s.files.remove(path);
      return null;
    },
    'project:copy': async (from, to) => {
      if (!s.allow.has(from)) throw new Error('Only files opened in EasyMedia can be copied.');
      await s.files.copy(from, to);
      return null;
    },
    'project:saveImage': async (name, png) => {
      if (!/^[\w-]{1,100}$/.test(name)) throw new Error('A text picture needs a plain name.');
      const path = await s.files.saveImage(name, png);
      s.allow.add(path);
      return path;
    },
  };

  for (const channel of CHANNELS) {
    const handler = handlers[channel] as (...args: unknown[]) => Promise<unknown>;
    s.ipc.handle(channel, async (_event, ...args) => {
      try {
        return { ok: true, value: await handler(...args) };
      } catch (error) {
        return { ok: false, error: toWire(error) };
      }
    });
  }
}
