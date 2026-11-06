// FFmpeg arguments for each background job (inputs and options only; the job queue adds
// the progress flags and the output path).
import { basename, dirname, extname, join } from 'node:path';
import { FRAME_PATTERN } from '../../core/animation/export.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { EncodeFramesOptions } from '../../core/ports.ts';

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

/** Seconds and volumes in FFmpeg's arguments: no long tails of digits. */
const num = (n: number): string => String(Number(n.toFixed(4)));

/** AN28: every sound in an animation's video is read at one rate and layout, then mixed. */
const SOUND_RATE = 48000;
const SOUND_FORMAT = `aformat=sample_rates=${SOUND_RATE}:channel_layouts=stereo`;

/** AN15: the codecs of each video, as Video mode makes them (V16): MP4 and MOV H.264 + AAC, AVI MPEG-4 Part 2 + MP3. */
function videoCodecs(format: 'mp4' | 'avi' | 'mov', fps: number, sound: boolean): string[] {
  const rate = ['-pix_fmt', 'yuv420p', '-r', String(fps)];
  if (format === 'avi')
    return [
      ...['-c:v', 'mpeg4', '-vtag', 'xvid', '-q:v', '3', ...rate],
      ...(sound ? ['-c:a', 'libmp3lame', '-b:a', '192k'] : []),
    ];
  return [
    ...['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', ...rate],
    ...(sound ? ['-c:a', 'aac', '-b:a', '160k'] : []),
    ...['-movflags', '+faststart'],
  ];
}

/**
 * AN15: an animation's PNG frames as an MP4, MOV (H.264, yuv420p) or AVI (MPEG-4 Part 2), an odd
 * side padded to even, or an animated GIF, made in two passes in one run: palettegen finds the
 * best 256 colours, paletteuse draws every frame with them. The GIF loops for ever (-loop 0) or,
 * AN8, plays once and stops on its last frame (-loop -1: no looping block in the file).
 *
 * AN28: a video's sounds: each file is read from its trim start for the seconds heard, set to its
 * volume and faded as in the app, cut where the export starts after it did, moved to its time
 * (exact to the sample) and mixed without lowering the others; the mix is padded with silence
 * or cut to the video's length.
 */
export function animationArgs(
  folder: string,
  { format, fps, frames, once, sounds = [] }: EncodeFramesOptions,
): string[] {
  const input = ['-framerate', String(fps), '-i', join(folder, FRAME_PATTERN)];
  if (format === 'gif')
    return [
      ...input,
      '-vf',
      'split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
      '-loop',
      once ? '-1' : '0',
    ];
  const pad = 'pad=ceil(iw/2)*2:ceil(ih/2)*2';
  if (sounds.length === 0) return [...input, '-vf', pad, ...videoCodecs(format, fps, false)];
  const reads = sounds.flatMap((s) => ['-ss', num(s.offset), '-t', num(s.heard), '-i', s.path]);
  const shaped = sounds.map((s, i) => {
    const volume = s.volume === 1 ? '' : `,volume=${num(s.volume)}`;
    const fadeIn = s.fadeIn > 0 ? `,afade=t=in:st=0:d=${num(s.fadeIn)}` : '';
    const fadeOut =
      s.fadeOut > 0 ? `,afade=t=out:st=${num(s.heard - s.fadeOut)}:d=${num(s.fadeOut)}` : '';
    const delay = Math.round(s.at * SOUND_RATE);
    return `[${i + 1}:a]asetpts=PTS-STARTPTS,${SOUND_FORMAT}${volume}${fadeIn}${fadeOut},atrim=start=${num(s.cut)}:duration=${num(s.duration)},asetpts=PTS-STARTPTS,adelay=${delay}S:all=1[s${i}]`;
  });
  const labels = sounds.map((_, i) => `[s${i}]`).join('');
  const mixed =
    sounds.length > 1 ? `amix=inputs=${sounds.length}:duration=longest:normalize=0,` : '';
  const graph = [
    `[0:v]${pad}[v]`,
    ...shaped,
    `${labels}${mixed}apad,atrim=duration=${num(frames / fps)}[a]`,
  ].join(';');
  return [
    ...input,
    ...reads,
    ...['-filter_complex', graph, '-map', '[v]', '-map', '[a]'],
    ...videoCodecs(format, fps, true),
  ];
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
