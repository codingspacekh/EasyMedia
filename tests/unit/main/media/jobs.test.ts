import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  computePeaks,
  frameArgs,
  proxyArgs,
  tempPathFor,
  thumbnailArgs,
  waveformArgs,
} from '../../../../src/main/media/jobs.ts';

describe('job commands', () => {
  it('a proxy is 360 px tall, keeps the shape, and is quick to decode and seek', () => {
    const args = proxyArgs('/in/a.mov');
    expect(args.slice(0, 2)).toEqual(['-i', '/in/a.mov']);
    expect(args).toEqual(
      expect.arrayContaining(['-vf', 'scale=-2:360', '-c:v', 'libx264', '-preset', 'veryfast']),
    );
    expect(args.join(' ')).toContain('-g 30');
  });

  it('thumbnails are one strip: count frames spread over the clip, tiled side by side', () => {
    const args = thumbnailArgs('/in/a.mp4', 10, { count: 5, height: 64 });
    expect(args).toContain('fps=0.5,scale=-2:64,tile=5x1');
    expect(args).toEqual(expect.arrayContaining(['-frames:v', '1']));
  });

  it('waveforms decode the sound to mono raw samples at a low rate', () => {
    expect(waveformArgs('/in/a.mp3')).toEqual([
      '-i',
      '/in/a.mp3',
      '-vn',
      '-ac',
      '1',
      '-ar',
      '8000',
      '-f',
      'f32le',
    ]);
  });

  it('a frame is taken at the exact time, as one image', () => {
    const args = frameArgs('/in/a.mp4', 16.66);
    expect(args.slice(0, 4)).toEqual(['-ss', '16.66', '-i', '/in/a.mp4']);
    expect(args).toEqual(expect.arrayContaining(['-frames:v', '1', '-update', '1']));
  });

  it('temporary output keeps the extension, so ffmpeg still knows the format', () => {
    expect(tempPathFor(join('/out', 'proxy.mp4'), 'j7')).toBe(join('/out', 'proxy.partial-j7.mp4'));
  });
});

describe('computePeaks', () => {
  it('takes the loudest sample in each slice', () => {
    const samples = Float32Array.from([0.1, -0.5, 0.2, 0.3, -0.9, 0.4]);
    expect(computePeaks(samples, 3).map((p) => Number(p.toFixed(2)))).toEqual([0.5, 0.3, 0.9]);
  });

  it('never returns values outside 0–1', () => {
    expect(computePeaks(Float32Array.from([1.7, -2]), 2)).toEqual([1, 1]);
  });

  it('returns silence for an empty or very short sound', () => {
    expect(computePeaks(new Float32Array(0), 4)).toEqual([0, 0, 0, 0]);
    expect(computePeaks(Float32Array.from([0.5]), 2)).toHaveLength(2);
  });
});
