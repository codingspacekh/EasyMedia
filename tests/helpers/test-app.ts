// An App wired to the mock engine and in-memory dialogs / files, for UI tests.
import { fakeDialogs } from './fake-dialogs.ts';
import { vi } from 'vitest';
import { createApp } from '../../src/app/app.ts';
import { createMockMediaEngine } from '../../src/adapters/mock/media-engine.ts';
import { createMockRecorder } from '../../src/adapters/mock/recorder.ts';
import type { AudioOutput } from '../../src/app/audio.ts';
import type {
  PageAssets,
  ProbeInfo,
  ProjectFiles,
  StageRenderer,
  UpdatesPort,
} from '../../src/core/ports.ts';

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
  /** Where preferences.json is (N16, X7); none by default. M17a: the updates port, if any. */
  { preferences, updates }: { preferences?: string; updates?: UpdatesPort } = {},
) {
  const engine = createMockMediaEngine(media);
  const dialogs = fakeDialogs();
  const disk = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  /** Files copied (P2), [from, to]. */
  const copies: [string, string][] = [];
  const recorder = createMockRecorder();
  /** X8: sound effects saved in the app's folder. */
  const saveSound = vi.fn<ProjectFiles['saveSound']>(async (name) => `/cache/sounds/${name}.wav`);
  const stageRenderer = {
    renderPng: vi.fn<StageRenderer['renderPng']>(async () => new Uint8Array([137, 80, 78, 71])),
    textTops: vi.fn<StageRenderer['textTops']>(async (fonts) =>
      Object.fromEntries(fonts.map((f) => [f.replace(/ [\d.]+px /, ' '), 0.9])),
    ),
    /** AN26: half the font size a letter. */
    textWidths: vi.fn<StageRenderer['textWidths']>(
      async () => (font, text) =>
        [...text].length * Number(/([\d.]+)px/.exec(font)?.[1] ?? 10) * 0.5,
    ),
    pixels: vi.fn<StageRenderer['pixels']>(async () => ({
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([255, 255, 255, 255]),
    })),
  };
  /** AN15: the web page's player and files, as data: URLs named after the file. */
  const pageAssets = {
    playerScript: vi.fn<PageAssets['playerScript']>(async () => '/* player */'),
    pictureDataUrl: vi.fn<PageAssets['pictureDataUrl']>(
      async (path) => `data:image/jpeg;base64,${btoa(path)}`,
    ),
    fontDataUrl: vi.fn<PageAssets['fontDataUrl']>(
      async (file) => `data:font/ttf;base64,${btoa(file)}`,
    ),
    soundDataUrl: vi.fn<PageAssets['soundDataUrl']>(
      async (path) => `data:audio/mpeg;base64,${btoa(path)}`,
    ),
    openTest: vi.fn<PageAssets['openTest']>(async () => {}),
  };
  /** AN28: the speakers Animation mode plays its sounds on: what was played, and stops. */
  const animationAudio = {
    played: [] as { sampleRate: number; channels: readonly Float32Array[] }[],
    stops: 0,
    play: vi.fn<AudioOutput['play']>((audio) => void animationAudio.played.push(audio)),
    stop: vi.fn<AudioOutput['stop']>(() => void animationAudio.stops++),
    elapsed: () => 0,
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
      copy: async (from, to) => void copies.push([from, to]),
      saveImage: async (name) => `/cache/text/${name}.png`,
      saveSound,
      writeBytes: async (p, b) => void bytes.set(p, b),
    },
    stageRenderer,
    pageAssets,
    animationAudioOutput: animationAudio,
    text: {
      draw: async (_text, _style, frame) => ({ png: new Uint8Array(1), ...frame }),
    },
    paths: {
      proxies: '/cache',
      recovery: '/cache/recovery.mve',
      snapshots: '/cache/snapshots',
      learn: '/cache/learn',
      ...(preferences ? { preferences } : {}),
    },
    audioRecorder: recorder,
    ...(updates ? { updates } : {}),
  });
  const importFiles = async (...paths: string[]) => {
    dialogs.openMedia.mockResolvedValueOnce(paths);
    await app.importMedia();
  };
  return {
    app,
    engine,
    dialogs,
    importFiles,
    recorder,
    disk,
    bytes,
    copies,
    saveSound,
    stageRenderer,
    pageAssets,
    animationAudio,
  };
}
