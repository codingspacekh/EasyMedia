import { createMockMediaEngine } from '../../../src/adapters/mock/media-engine.ts';
import { mediaEngineContract } from '../../contract/media-engine.contract.ts';

mediaEngineContract('mock', () => {
  const engine = createMockMediaEngine({
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
    engine,
    video: '/media/clip.mp4',
    image: '/media/photo.jpg',
    audio: '/media/music.mp3',
    missing: '/media/missing.mp4',
    out: (name) => `/out/${name}`,
  };
});
