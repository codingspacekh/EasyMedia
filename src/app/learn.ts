// Learn mode's use cases (M11, screens 21–22): inspect any file (T1), compare compression
// settings on real files (T3) and check an export against a teacher's task (T6). Learn mode
// never changes the project; its comparison files go into the app's own folder.
import { createProject, assetFromProbe, createVideoClip } from '../core/model/factory.ts';
import { EditError, MediaError } from '../core/model/errors.ts';
import type { Seconds } from '../core/model/time.ts';
import type { Project, ProjectSettings } from '../core/model/types.ts';
import type { AppPaths, Dialogs, MediaEngine, ProbeInfo, ProjectFiles } from '../core/ports.ts';
import { fileNameOf } from '../core/project/relocate.ts';
import { AUDIO_FORMATS, type AudioExportSettings } from '../core/render/audio-formats.ts';
import { CONTAINERS, type ExportSettings } from '../core/render/formats.ts';
import {
  checkFile,
  parseTaskSpec,
  serializeTaskSpec,
  type CheckRow,
  type TaskSpec,
} from '../core/teaching/task-check.ts';
import { createStore, type Store } from './store.ts';

export interface ComparisonItem {
  label: string;
  path: string;
  /** The real size of the file made. */
  bytes: number;
  /** How much smaller than the first (lossless) file: 0–1. */
  saving: number;
  lossless: boolean;
  /** One exact frame, for a video players cannot show (the lossless AVI). */
  still?: string;
}

export interface Comparison {
  kind: 'audio' | 'video';
  /** How much of the file was compared. */
  seconds: Seconds;
  items: ComparisonItem[];
}

export interface LearnState {
  inspected: { path: string; name: string; info: ProbeInfo } | null;
  comparison: Comparison | null;
  /** What Learn mode is doing, e.g. "Making file 2 of 5…". */
  busy: string | null;
  task: {
    spec: TaskSpec;
    checked: { name: string; rows: CheckRow[]; pass: boolean } | null;
  };
  message: { kind: 'error' | 'info'; text: string } | null;
}

export interface LearnDeps {
  engine: MediaEngine;
  dialogs: Dialogs;
  files: ProjectFiles;
  paths: AppPaths;
}

/** T3: how much of a file the comparison exports (README: 5–10 s). */
export const AUDIO_SECONDS = 10;
export const VIDEO_SECONDS = 5;
const UNEXPECTED = 'Something went wrong. Please try again.';
const FIRST = 'Inspect a file first (Choose a file, or drop one on the inspector).';
const DEFAULT_TASK: TaskSpec = {
  name: 'My task',
  container: 'mp4',
  width: 1920,
  height: 1080,
  duration: 30,
  tolerance: 0.5,
};

const even = (n: number) => 2 * Math.round(n / 2);

/** The source's picture, made no bigger than 1920 × 1080 so the comparison stays quick. */
function comparisonSettings(info: ProbeInfo): ProjectSettings {
  const v = info.video!;
  const scale = Math.min(1, 1920 / v.width, 1080 / v.height);
  const width = Math.max(128, even(v.width * scale));
  const height = Math.max(128, even(v.height * scale));
  const ratio = width / height;
  const fps = ([24, 25, 30] as const).reduce((best, f) =>
    Math.abs(f - (v.fps ?? 30)) < Math.abs(best - (v.fps ?? 30)) ? f : best,
  );
  return {
    aspect:
      Math.abs(ratio - 16 / 9) < 0.01 ? '16:9' : Math.abs(ratio - 4 / 3) < 0.01 ? '4:3' : 'custom',
    width,
    height,
    fps,
    background: '#000000',
    fit: 'letterbox',
  };
}

export function createLearnApp({ engine, dialogs, files, paths }: LearnDeps) {
  const store: Store<LearnState> = createStore<LearnState>({
    inspected: null,
    comparison: null,
    busy: null,
    task: { spec: DEFAULT_TASK, checked: null },
    message: null,
  });
  const patch = (change: Partial<LearnState>) => store.update((s) => ({ ...s, ...change }));
  const showError = (error: unknown) =>
    patch({
      message: {
        kind: 'error',
        text:
          error instanceof MediaError || error instanceof EditError ? error.message : UNEXPECTED,
      },
    });
  const out = (n: number, extension: string) => `${paths.learn}/compare-${n}.${extension}`;

  /** Makes the files one after the other, then reads their real sizes. */
  async function makeAll(
    kind: Comparison['kind'],
    seconds: Seconds,
    jobs: {
      label: string;
      extension: string;
      lossless: boolean;
      /** Makes the file; may give back a still picture of it (see ComparisonItem.still). */
      make: (o: string) => Promise<string | void>;
    }[],
  ): Promise<void> {
    patch({ comparison: null, message: null });
    try {
      const made: Omit<ComparisonItem, 'saving'>[] = [];
      for (const [i, job] of jobs.entries()) {
        patch({ busy: `Making file ${i + 1} of ${jobs.length}…` });
        const path = out(i + 1, job.extension);
        const still = await job.make(path);
        const { sizeBytes } = await engine.probe(path);
        made.push({
          label: job.label,
          path,
          bytes: sizeBytes,
          lossless: job.lossless,
          ...(still ? { still } : {}),
        });
      }
      const first = made[0]!.bytes;
      patch({
        comparison: {
          kind,
          seconds,
          items: made.map((m) => ({ ...m, saving: first > 0 ? 1 - m.bytes / first : 0 })),
        },
      });
    } catch (error) {
      showError(error);
    } finally {
      patch({ busy: null });
    }
  }

  /** The inspected file, or a message saying what is missing. */
  function source(): { path: string; info: ProbeInfo } | null {
    const inspected = store.get().inspected;
    if (!inspected) patch({ message: { kind: 'error', text: FIRST } });
    return inspected;
  }

  return {
    store,

    /** T1: what is inside a file — the one dropped, or one chosen in the dialog. */
    async inspect(path?: string): Promise<void> {
      const chosen = path ?? (await dialogs.openMedia())[0];
      if (!chosen) return;
      patch({ busy: 'Reading the file…', message: null });
      try {
        const info = await engine.probe(chosen);
        patch({ inspected: { path: chosen, name: fileNameOf(chosen), info }, comparison: null });
      } catch (error) {
        showError(error);
      } finally {
        patch({ busy: null });
      }
    },

    /** T3: the first 10 s of the sound as WAV, FLAC and MP3 at three bit rates. */
    async compareAudio(): Promise<void> {
      const file = source();
      if (!file || store.get().busy) return;
      const a = file.info.audio;
      if (!a) {
        patch({ message: { kind: 'error', text: 'This file has no sound to compare.' } });
        return;
      }
      const seconds = Math.min(AUDIO_SECONDS, file.info.duration ?? AUDIO_SECONDS);
      let sound: { sampleRate: number; channels: Float32Array[] } | null = null;
      const samples = async () => {
        if (!sound) {
          const decoded = await engine.decodeAudio(file.path);
          const length = Math.round(seconds * decoded.sampleRate);
          sound = {
            sampleRate: decoded.sampleRate,
            channels: decoded.channels.map((c) => c.subarray(0, length)),
          };
        }
        return sound;
      };
      const rate = Math.min(a.sampleRate, 96000);
      const base: AudioExportSettings = {
        format: 'wav',
        sampleRate: rate,
        channels: a.channels >= 2 ? 2 : 1,
        bitRate: 128,
        mode: 'cbr',
        bitDepth: 16,
        tags: {},
      };
      const mp3 = (bitRate: number): AudioExportSettings => ({
        ...base,
        format: 'mp3',
        sampleRate: rate > 48000 ? 44100 : rate,
        bitRate,
      });
      const settings: [string, AudioExportSettings][] = [
        ['WAV · lossless', base],
        ['FLAC · lossless', { ...base, format: 'flac' }],
        ['MP3 192 kbps', mp3(192)],
        ['MP3 128 kbps', mp3(128)],
        ['MP3 64 kbps', mp3(64)],
      ];
      await makeAll(
        'audio',
        seconds,
        settings.map(([label, s]) => ({
          label,
          extension: AUDIO_FORMATS[s.format].extension,
          lossless: AUDIO_FORMATS[s.format].lossless,
          make: async (output) => {
            const audio = await samples();
            const job = engine.encodeAudio(
              { ...audio, channels: audio.channels.slice(0, s.channels) },
              output,
              s,
            );
            await job.done;
          },
        })),
      );
    },

    /** T3: the first 5 s of the video lossless, as a high-quality MP4 and as smaller MP4s. */
    async compareVideo(): Promise<void> {
      const file = source();
      if (!file || store.get().busy) return;
      if (file.info.kind !== 'video') {
        patch({ message: { kind: 'error', text: 'This file is not a video.' } });
        return;
      }
      const settings = comparisonSettings(file.info);
      const asset = assetFromProbe(file.path, file.info);
      const clip = createVideoClip(asset);
      const seconds = Math.min(VIDEO_SECONDS, clip.out);
      const project: Project = {
        ...createProject({ name: 'Compare' }),
        settings,
        media: [asset],
        timeline: { main: [{ ...clip, out: seconds }], text: [], audio: [[], []] },
      };
      const base: ExportSettings = {
        container: 'mp4',
        compression: 'lossy',
        width: settings.width,
        height: settings.height,
        fps: settings.fps,
        quality: 'high',
      };
      const narrow = (width: number) => ({
        width,
        height: even((width * settings.height) / settings.width),
      });
      const formats: [string, ExportSettings][] = [
        ['Lossless', { ...base, container: 'avi', compression: 'lossless' }],
        ['MP4 high', base],
        ['MP4', { ...base, ...narrow(640), quality: 'medium' }],
        ['MP4', { ...base, ...narrow(426), quality: 'low' }],
      ];
      await makeAll(
        'video',
        seconds,
        formats.map(([label, f]) => ({
          label: `${label} · ${f.width} × ${f.height}`,
          extension: CONTAINERS[f.container].extension,
          lossless: f.compression === 'lossless',
          make: async (output) => {
            await engine.renderVideo(project, output, { projectDir: '/', format: f }).done;
            if (f.compression !== 'lossless') return;
            // Video players cannot show the lossless AVI: one exact frame of it, as a PNG.
            const still = output.replace(/\.[^.]+$/, '.png');
            await engine.extractFrame(output, Math.min(1, seconds / 2), still);
            return still;
          },
        })),
      );
    },

    /** T6: the teacher changes what the export must be; an earlier check no longer counts. */
    setTask(spec: TaskSpec): void {
      patch({ task: { spec, checked: null } });
    },

    async saveTask(): Promise<void> {
      const { spec } = store.get().task;
      const path = await dialogs.saveTaskCheck(spec.name);
      if (!path) return;
      try {
        await files.write(path, serializeTaskSpec(spec));
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(path)}` } });
      } catch (error) {
        showError(error);
      }
    },

    async openTask(): Promise<void> {
      const path = await dialogs.openTaskCheck();
      if (!path) return;
      try {
        const spec = parseTaskSpec(await files.read(path));
        patch({ task: { spec, checked: null }, message: null });
      } catch (error) {
        showError(error);
      }
    },

    /** T6: checks an exported file against the task, row by row. */
    async checkExport(path?: string): Promise<void> {
      const chosen = path ?? (await dialogs.openMedia())[0];
      if (!chosen) return;
      try {
        const info = await engine.probe(chosen);
        const { spec } = store.get().task;
        patch({
          task: { spec, checked: { name: fileNameOf(chosen), ...checkFile(spec, info) } },
          message: null,
        });
      } catch (error) {
        showError(error);
      }
    },
  };
}

export type LearnApp = ReturnType<typeof createLearnApp>;
