// Main-process side of the IPC contract (P2, ARCHITECTURE §8). Every request is answered with
// data: a value, or a WireError the page turns back into the right error type.
import { isAbsolute, join, relative } from 'node:path';
import { EditError, JobCancelledError } from '../core/model/errors.ts';
import type { AppPaths, Dialogs, JobHandle, MediaEngine, ProjectFiles } from '../core/ports.ts';
import { toWire } from '../core/wire.ts';
import { isPlaybackSample, type PlaybackSample } from '../core/animation/paint-meter.ts';
import { combineFilter } from '../core/image/combine.ts';
import type { Updates } from './updates.ts';
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
  /** AN15: the files an HTML web animation carries: the player's script and the built fonts. */
  pageFiles: PageFiles;
  /** M17a U1–U5: updates (electron-updater in the installed app). */
  updates: Updates;
  /** N1: the performance report, when ONEEDITOR_PERF_REPORT asks for one. */
  perf?: { playback(sample: PlaybackSample): void };
}

export interface PageFiles {
  /** out/player.js */
  player: string;
  /** The built pages' assets folder (dist/assets), where the bundled fonts are. */
  assets: string;
  read(path: string): Promise<Uint8Array>;
  /** AN18: Test — shows the page in a window of its own, the stage's size. */
  show(html: string, title: string, width: number, height: number): Promise<void>;
}

/** AN5: the picture types Animation mode opens, by extension. */
const PICTURE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
};

const dataUrl = (type: string, bytes: Uint8Array) =>
  `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

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
      if (!s.allow.has(input)) throw new Error('Only pictures opened in OneEditor can be cropped.');
      const path = await s.engine.resizeCropImage(input, plan);
      s.allow.add(path);
      return path;
    },
    'media:combine': async (base, top, plan) => {
      combineFilter(plan); // explains a bad place before anything else
      if (!s.allow.has(base) || !s.allow.has(top))
        throw new Error('Only pictures opened in OneEditor can be combined.');
      const path = await s.engine.combineImages(base, top, plan);
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
    // AN15: only frames the page drew into the app's own frames folder are made into a file.
    'media:encodeFrames': async (key, folder, output, options) => {
      const base = s.paths.animationFrames;
      const inside = base ? relative(base, folder) : '';
      if (!base || inside === '' || inside.startsWith('..') || isAbsolute(inside))
        throw new Error('Only frames drawn by OneEditor can be exported.');
      return track(key, 'Export animation', s.engine.encodeFrames(folder, output, options), () =>
        s.allow.add(output),
      );
    },
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
    'dialog:openTaskCheck': () => s.dialogs.openTaskCheck(),
    'dialog:saveTaskCheck': (name) => s.dialogs.saveTaskCheck(name),
    'dialog:openAnimation': () => s.dialogs.openAnimation(),
    'dialog:openPicture': () => s.dialogs.openPicture(),
    'dialog:openFrames': () => s.dialogs.openFrames(),
    'dialog:openExport': () => s.dialogs.openExport(),
    'dialog:saveAnimation': (name) => s.dialogs.saveAnimation(name),
    'dialog:exportAnimation': (name, format) => s.dialogs.exportAnimation(name, format),
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
      if (!s.allow.has(from)) throw new Error('Only files opened in OneEditor can be copied.');
      await s.files.copy(from, to);
      return null;
    },
    'project:writeBytes': async (path, bytes) => {
      await s.files.writeBytes(path, bytes);
      return null;
    },
    'page:player': async () => new TextDecoder().decode(await s.pageFiles.read(s.pageFiles.player)),
    'page:picture': async (path) => {
      if (!s.allow.has(path)) throw new EditError('Only pictures opened in OneEditor can be used.');
      const type = PICTURE_TYPES[/\.(\w+)$/.exec(path)?.[1]?.toLowerCase() ?? ''];
      if (!type)
        throw new EditError('Only a picture (PNG, JPG, GIF, BMP or SVG) can go in a web page.');
      return dataUrl(type, await s.pageFiles.read(path));
    },
    'page:font': async (name) => {
      // Only a font file of the app's own pages: a plain name, nothing outside the folder.
      if (!/^[\w-]+(\.[\w-]+)*\.ttf$/.test(name))
        throw new EditError('That is not a bundled font.');
      return dataUrl('font/ttf', await s.pageFiles.read(join(s.pageFiles.assets, name)));
    },
    'updates:get': async () => s.updates.get(),
    'updates:check': () => s.updates.check(),
    'updates:download': () => s.updates.download(),
    'updates:install': async () => s.updates.install(),
    'updates:auto': async (on) => s.updates.setAuto(on === true),
    'updates:seen': async () => s.updates.seen(),
    'updates:showDmg': async () => s.updates.showDmg(),
    'updates:openDmg': () => s.updates.openDmg(),
    'perf:enabled': async () => s.perf !== undefined,
    'perf:playback': async (sample) => {
      if (!isPlaybackSample(sample)) throw new Error('Not a measurement of the stage.');
      s.perf?.playback(sample);
      return null;
    },
    'page:test': async (html, title, width, height) => {
      if (typeof html !== 'string' || !(width > 0) || !(height > 0))
        throw new EditError('There is nothing to test.');
      await s.pageFiles.show(html, String(title), width, height);
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
