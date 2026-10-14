import { createElectronMediaEngine } from '../../../src/adapters/electron/media-engine.ts';
import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import { mediaEngineContract } from '../../contract/media-engine.contract.ts';
import { inProcessBridge } from '../../helpers/ipc-bridge.ts';

// The page's engine talks to the main process over IPC. Behind it here: the mock engine.
// Passing the same contract proves the IPC layer keeps results, progress, cancel and errors intact.
mediaEngineContract('Electron adapter over IPC', () => {
  const backend = createMockMediaEngine({
    '/media/clip.mp4': {
      kind: 'video',
      container: 'mp4',
      duration: 10,
      sizeBytes: 7_000_000,
      video: { codec: 'h264', width: 1920, height: 1080, fps: 30 },
      audio: { codec: 'aac', sampleRate: 44100, channels: 2 },
    },
    '/media/photo.jpg': {
      kind: 'image',
      container: 'jpg',
      sizeBytes: 900_000,
      video: { codec: 'mjpeg', width: 3764, height: 3092 },
    },
    '/media/music.mp3': {
      kind: 'audio',
      container: 'mp3',
      duration: 45,
      sizeBytes: 1_000_000,
      audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
    },
  });
  return {
    engine: createElectronMediaEngine(inProcessBridge(backend).api),
    video: '/media/clip.mp4',
    image: '/media/photo.jpg',
    audio: '/media/music.mp3',
    missing: '/media/missing.mp4',
    out: (name) => `/out/${name}`,
  };
});
