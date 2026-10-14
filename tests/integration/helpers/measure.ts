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
