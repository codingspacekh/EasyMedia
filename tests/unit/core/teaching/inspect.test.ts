import { describe, expect, it } from 'vitest';
import type { ProbeInfo } from '../../../../src/core/ports.ts';
import {
  FILE_VS_CONTAINER,
  aspectRatio,
  codecInfo,
  inspect,
} from '../../../../src/core/teaching/inspect.ts';

// Screen 21: Task_11e.mp4
const mp4: ProbeInfo = {
  kind: 'video',
  container: 'mp4',
  duration: 40.7,
  sizeBytes: 25_300_000,
  bitRate: 4_973_000,
  video: { codec: 'h264', width: 1920, height: 1080, fps: 30, bitRate: 4_800_000 },
  audio: { codec: 'aac', sampleRate: 44100, channels: 2, bitRate: 128_000 },
};
const wav: ProbeInfo = {
  kind: 'audio',
  container: 'wav',
  duration: 120,
  sizeBytes: 10_584_044,
  audio: { codec: 'pcm_s16le', sampleRate: 44100, channels: 1, bitDepth: 16 },
};
const value = (info: ProbeInfo, label: string) => inspect(info).find((r) => r.label === label);

describe('T1 media inspector', () => {
  it('shows what is inside an MP4, as screen 21', () => {
    expect(inspect(mp4).map((r) => [r.label, r.value])).toEqual([
      ['Container', 'MP4'],
      ['Video codec', 'H.264'],
      ['Resolution', '1920 × 1080 (16:9)'],
      ['Frame rate', '30 fps'],
      ['Video bit rate', '4.8 Mbit/s'],
      ['Audio codec', 'AAC'],
      ['Audio bit rate', '128 kbit/s'],
      ['Sample rate', '44 100 Hz'],
      ['Channels', '2 (stereo)'],
      ['Duration', '40.70 s'],
      ['File size', '25.3 MB'],
    ]);
  });

  it('explains every row', () => {
    for (const info of [mp4, wav])
      for (const row of inspect(info)) expect(row.explain.length, row.label).toBeGreaterThan(40);
  });

  it('a WAV shows its bit depth and no picture rows; mono is one channel', () => {
    const rows = inspect(wav);
    expect(rows.map((r) => r.label)).toEqual([
      'Container',
      'Audio codec',
      'Sample rate',
      'Bit depth',
      'Channels',
      'Duration',
      'File size',
    ]);
    expect(value(wav, 'Bit depth')!.value).toBe('16-bit');
    expect(value(wav, 'Channels')!.value).toBe('1 (mono)');
    expect(value(wav, 'Audio codec')!.value).toBe('PCM');
  });

  it('marks codecs lossy, lossless or uncompressed', () => {
    expect(value(mp4, 'Video codec')!.compression).toBe('lossy');
    expect(value(mp4, 'Audio codec')!.compression).toBe('lossy');
    expect(value(wav, 'Audio codec')!.compression).toBe('uncompressed');
    expect(value(mp4, 'Container')!.compression).toBeUndefined();
    for (const [kind, codec] of [
      ['video', 'h264'],
      ['video', 'mpeg2video'],
      ['video', 'wmv2'],
      ['audio', 'aac'],
      ['audio', 'mp3'],
    ] as const)
      expect(codecInfo(kind, codec).compression, codec).toBe('lossy');
    for (const [kind, codec] of [
      ['video', 'png'],
      ['video', 'ffv1'],
      ['audio', 'flac'],
      ['audio', 'alac'],
    ] as const)
      expect(codecInfo(kind, codec).compression, codec).toBe('lossless');
    expect(codecInfo('audio', 'pcm_f32le').compression).toBe('uncompressed');
    expect(codecInfo('video', 'rawvideo').compression).toBe('uncompressed');
  });

  it('a codec it does not know keeps its own name and says so', () => {
    const odd = codecInfo('video', 'cinepak');
    expect(odd).toEqual({ name: 'cinepak' });
    expect(
      value({ ...mp4, video: { ...mp4.video!, codec: 'cinepak' } }, 'Video codec')!.explain,
    ).toMatch(/does not know/);
  });

  it('names the aspect ratio, also for screens that are only nearly 16:9', () => {
    expect(aspectRatio(1920, 1080)).toBe('16:9');
    expect(aspectRatio(640, 480)).toBe('4:3');
    expect(aspectRatio(1366, 768)).toBe('16:9');
    expect(aspectRatio(1080, 1920)).toBe('9:16');
    expect(aspectRatio(1000, 1000)).toBe('1:1');
    expect(aspectRatio(1000, 300)).toBe('10:3');
  });

  it('a DVD stored at 720 × 576 but shown as 16:9 says both', () => {
    const dvd: ProbeInfo = {
      ...mp4,
      container: 'mpg',
      video: { codec: 'mpeg2video', width: 720, height: 576, fps: 25, displayAspect: '16:9' },
    };
    expect(value(dvd, 'Resolution')!.value).toBe('720 × 576, shown as 16:9');
  });

  it('a still image has a size but no duration or frame rate', () => {
    const png: ProbeInfo = {
      kind: 'image',
      container: 'png',
      sizeBytes: 812_000,
      video: { codec: 'png', width: 800, height: 600 },
    };
    expect(inspect(png).map((r) => r.label)).toEqual(['Container', 'Resolution', 'File size']);
    expect(value(png, 'File size')!.value).toBe('812 KB');
  });

  it('"File vs container" uses the coursebook words', () => {
    expect(FILE_VS_CONTAINER).toMatch(/container/);
    expect(FILE_VS_CONTAINER).toMatch(/codec/);
  });
});
