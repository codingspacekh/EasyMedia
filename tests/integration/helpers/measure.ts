import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { bundledFfmpeg, run } from './ffmpeg.ts';

const execBuffer = promisify(execFile);

/** Exact stream lengths and size of a rendered file. */
export async function measure(file: string) {
  const { stdout } = await run(bundledFfmpeg().ffprobe, [
    ...[
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height,duration',
      '-of',
      'json',
      file,
    ],
  ]);
  const streams = (
    JSON.parse(stdout) as {
      streams: { codec_type: string; width?: number; height?: number; duration?: string }[];
    }
  ).streams;
  const v = streams.find((s) => s.codec_type === 'video');
  const a = streams.find((s) => s.codec_type === 'audio');
  return {
    width: v?.width,
    height: v?.height,
    videoDuration: Number(v?.duration),
    audioDuration: a ? Number(a.duration) : undefined,
  };
}

/** Frame at `time` shrunk to 16 × 9 RGB pixels, for checking colours and black bars. */
export async function tinyFrame(file: string, time: number) {
  const { stdout } = await execBuffer(
    bundledFfmpeg().ffmpeg,
    [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      'scale=16:9:flags=area',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      'pipe:1',
    ],
    { encoding: 'buffer' },
  );
  const at = (x: number, y: number) =>
    [...stdout.subarray((y * 16 + x) * 3, (y * 16 + x) * 3 + 3)] as [number, number, number];
  const columnBrightness = (x: number) => {
    let sum = 0;
    for (let y = 0; y < 9; y++) sum += at(x, y).reduce((a, b) => a + b, 0) / 3;
    return sum / 9;
  };
  return { at, columnBrightness };
}

/** Average brightness (0–255) of the frame at `time`. */
export async function brightness(file: string, time: number): Promise<number> {
  const { stdout } = await execBuffer(
    bundledFfmpeg().ffmpeg,
    [
      '-v',
      'error',
      '-ss',
      String(time),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      'scale=16:9:flags=area',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'gray',
      'pipe:1',
    ],
    { encoding: 'buffer' },
  );
  return stdout.reduce((sum, v) => sum + v, 0) / stdout.length;
}

/** Full-size frame at `time` as one brightness byte per pixel, plus helpers to read it. */
export async function grayFrame(file: string, time: number) {
  const { width, height } = await measure(file);
  const { stdout } = await execBuffer(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1'],
      ...['-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
    ],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  const w = width!;
  const h = height!;
  const at = (x: number, y: number) => stdout[y * w + x]!;
  return {
    width: w,
    height: h,
    at,
    /** Smallest box holding every pixel brighter than `threshold`, or null. */
    brightBox(threshold = 128) {
      let [x0, y0, x1, y1] = [w, h, -1, -1];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (at(x, y) > threshold) {
            x0 = Math.min(x0, x);
            y0 = Math.min(y0, y);
            x1 = Math.max(x1, x);
            y1 = Math.max(y1, y);
          }
      return x1 < 0 ? null : { x0, y0, x1, y1 };
    },
    /** How many pixels in the box differ from `other` by more than `by`. */
    changedIn(other: { at(x: number, y: number): number }, box: number[], by = 40) {
      const [bx0, by0, bx1, by1] = box as [number, number, number, number];
      let n = 0;
      for (let y = by0; y < by1; y++)
        for (let x = bx0; x < bx1; x++) if (Math.abs(at(x, y) - other.at(x, y)) > by) n++;
      return n;
    },
  };
}

/** How many full-size pixels of the frame at `time` match `test(r, g, b)`. */
export async function countPixels(
  file: string,
  time: number,
  test: (r: number, g: number, b: number) => boolean,
): Promise<number> {
  const { stdout } = await execBuffer(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1'],
      ...['-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    ],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  let n = 0;
  for (let i = 0; i + 2 < stdout.length; i += 3)
    if (test(stdout[i]!, stdout[i + 1]!, stdout[i + 2]!)) n++;
  return n;
}
