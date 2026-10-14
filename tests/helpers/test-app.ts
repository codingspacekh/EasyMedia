// An App wired to the mock engine and in-memory dialogs / files, for UI tests.
import { vi } from 'vitest';
import { createApp } from '../../src/app/app.ts';
import { createMockMediaEngine } from '../../src/adapters/mock/media-engine.ts';
import type { Dialogs, ProbeInfo } from '../../src/core/ports.ts';

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
    confirm: vi.fn<Dialogs['confirm']>(async () => true),
  };
  const disk = new Map<string, string>();
  const app = createApp({
    engine,
    dialogs,
    files: {
      read: async (p) => disk.get(p) ?? Promise.reject(new Error('ENOENT')),
      write: async (p, t) => void disk.set(p, t),
      remove: async (p) => void disk.delete(p),
    },
    paths: { proxies: '/cache', recovery: '/cache/recovery.mve' },
  });
  const importFiles = async (...paths: string[]) => {
    dialogs.openMedia.mockResolvedValueOnce(paths);
    await app.importMedia();
  };
  return { app, engine, dialogs, importFiles };
}
