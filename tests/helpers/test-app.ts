// An App wired to the mock engine and in-memory dialogs / files, for UI tests.
import { vi } from 'vitest';
import { createApp } from '../../src/app/app.ts';
import { createMockMediaEngine } from '../../src/adapters/mock/media-engine.ts';
import { createMockRecorder } from '../../src/adapters/mock/recorder.ts';
import type { Dialogs, ProbeInfo, StageRenderer } from '../../src/core/ports.ts';

export const VIDEO: ProbeInfo = {
  kind: 'video',
  container: 'mp4',
  duration: 10,
  sizeBytes: 7_000_000,
  video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
  audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
};
export const IMAGE: ProbeInfo = {
  kind: 'image',
  container: 'jpg',
  sizeBytes: 1,
  video: { codec: 'mjpeg', width: 100, height: 100 },
};

export function testApp(
  media: Record<string, ProbeInfo> = { '/m/clip.mp4': VIDEO, '/m/photo.jpg': IMAGE },
) {
  const engine = createMockMediaEngine(media);
  const dialogs = {
    openMedia: vi.fn<Dialogs['openMedia']>(async () => []),
    openProject: vi.fn<Dialogs['openProject']>(async () => null),
    saveProject: vi.fn<Dialogs['saveProject']>(async () => null),
    exportVideo: vi.fn<Dialogs['exportVideo']>(async () => null),
    exportAudio: vi.fn<Dialogs['exportAudio']>(async () => null),
    confirm: vi.fn<Dialogs['confirm']>(async () => true),
    chooseFolder: vi.fn<Dialogs['chooseFolder']>(async () => null),
    unsavedChanges: vi.fn<Dialogs['unsavedChanges']>(async () => 'cancel'),
    openTaskCheck: vi.fn<Dialogs['openTaskCheck']>(async () => null),
    saveTaskCheck: vi.fn<Dialogs['saveTaskCheck']>(async () => null),
    openAnimation: vi.fn<Dialogs['openAnimation']>(async () => null),
    saveAnimation: vi.fn<Dialogs['saveAnimation']>(async () => null),
    exportAnimation: vi.fn<Dialogs['exportAnimation']>(async () => null),
  };
  const disk = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  const recorder = createMockRecorder();
  const stageRenderer = {
    renderPng: vi.fn<StageRenderer['renderPng']>(async () => new Uint8Array([137, 80, 78, 71])),
  };
  const app = createApp({
    engine,
    dialogs,
    files: {
      read: async (p) => disk.get(p) ?? Promise.reject(new Error('ENOENT')),
      write: async (p, t) => void disk.set(p, t),
      remove: async (p) => {
        disk.delete(p);
        bytes.delete(p);
      },
      copy: async () => {},
      saveImage: async (name) => `/cache/text/${name}.png`,
      writeBytes: async (p, b) => void bytes.set(p, b),
    },
    stageRenderer,
    text: {
      draw: async (_text, _style, frame) => ({ png: new Uint8Array(1), ...frame }),
    },
    paths: {
      proxies: '/cache',
      recovery: '/cache/recovery.mve',
      snapshots: '/cache/snapshots',
      learn: '/cache/learn',
    },
    audioRecorder: recorder,
  });
  const importFiles = async (...paths: string[]) => {
    dialogs.openMedia.mockResolvedValueOnce(paths);
    await app.importMedia();
  };
  return { app, engine, dialogs, importFiles, recorder, disk, bytes, stageRenderer };
}
