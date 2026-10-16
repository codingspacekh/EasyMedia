// FFmpeg arguments for each background job (inputs and options only; the job queue adds
// the progress flags and the output path).
import { basename, dirname, extname, join } from 'node:path';
import type { Seconds } from '../../core/model/time.ts';

export const PROXY_HEIGHT = 360;
export const WAVEFORM_SAMPLE_RATE = 8000;

/** Small, fast-to-decode copy for smooth preview on slow laptops (ARCHITECTURE §10.2). */
export function proxyArgs(input: string): string[] {
  return [
    ...['-i', input, '-vf', `scale=-2:${PROXY_HEIGHT}`],
    ...['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-g', '30', '-pix_fmt', 'yuv420p'],
    ...['-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart'],
  ];
}

/** One image strip with `count` thumbnails spread evenly over the clip. */
export function thumbnailArgs(
  input: string,
  duration: Seconds,
  { count, height }: { count: number; height: number },
): string[] {
  const fps = Number((count / duration).toFixed(4));
  return [
    '-i',
    input,
    '-vf',
    `fps=${fps},scale=-2:${height},tile=${count}x1`,
    '-frames:v',
    '1',
    '-q:v',
    '4',
  ];
}

/** Mono 32-bit float samples at a low rate: plenty for drawing a waveform. */
export function waveformArgs(input: string): string[] {
  return ['-i', input, '-vn', '-ac', '1', '-ar', String(WAVEFORM_SAMPLE_RATE), '-f', 'f32le'];
}

/** A1: the sound as 32-bit float samples side by side, mono or stereo, at `rate`. */
export function decodeArgs(input: string, channels: number, rate: number): string[] {
  return [
    '-i',
    input,
    '-vn',
    '-map',
    '0:a:0',
    '-ac',
    String(channels),
    '-ar',
    String(rate),
    '-f',
    'f32le',
  ];
}

/** Reads raw samples written by FFmpeg (f32le, side by side). */
export function rawInputArgs(path: string, rate: number, channels: number): string[] {
  return ['-f', 'f32le', '-ar', String(rate), '-ac', String(channels), '-i', path];
}

/** One frame at `time`; the image format follows the output file's extension (V10). */
export function frameArgs(input: string, time: Seconds): string[] {
  return ['-ss', String(time), '-i', input, '-frames:v', '1', '-update', '1', '-q:v', '2'];
}

/** Jobs write here first and are renamed on success, so a failed job never leaves a broken file. */
export function tempPathFor(output: string, jobId: string): string {
  const ext = extname(output);
  return join(dirname(output), `${basename(output, ext)}.partial-${jobId}${ext}`);
}

/** Loudest sample (0–1) in each of `buckets` equal slices. */
export function computePeaks(samples: Float32Array, buckets: number): number[] {
  const peaks = new Array<number>(buckets).fill(0);
  if (samples.length === 0) return peaks;
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor((b * samples.length) / buckets);
    const end = Math.max(start + 1, Math.floor(((b + 1) * samples.length) / buckets));
    let peak = 0;
    for (let i = start; i < end && i < samples.length; i++)
      peak = Math.max(peak, Math.abs(samples[i]!));
    peaks[b] = Math.min(1, peak);
  }
  return peaks;
}
