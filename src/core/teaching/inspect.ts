// T1: the media inspector (screen 21) — what is inside a file, in the coursebooks' words:
// the container, the codec of each stream (lossy, lossless or not compressed), and the
// numbers that decide the quality and the size, each with a short explanation.
import type { ProbeInfo } from '../ports.ts';
import { group } from './file-size.ts';

export type Compression = 'lossy' | 'lossless' | 'uncompressed';

export interface InspectRow {
  label: string;
  value: string;
  /** For a codec: how it compresses its stream. */
  compression?: Compression;
  explain: string;
}

export const FILE_VS_CONTAINER =
  'File vs container. MP4 is a container: a box that holds the video stream, the audio stream and information about them. A codec (for example H.264 and AAC) is the method used to compress and decompress each stream. A player needs the right codec to play what is inside the box.';

const VIDEO_CODECS: Record<string, { name: string; compression: Compression }> = {
  h264: { name: 'H.264', compression: 'lossy' },
  hevc: { name: 'H.265 (HEVC)', compression: 'lossy' },
  mpeg4: { name: 'MPEG-4 Part 2', compression: 'lossy' },
  mpeg2video: { name: 'MPEG-2', compression: 'lossy' },
  mpeg1video: { name: 'MPEG-1', compression: 'lossy' },
  wmv1: { name: 'Windows Media Video 7', compression: 'lossy' },
  wmv2: { name: 'Windows Media Video 8', compression: 'lossy' },
  wmv3: { name: 'Windows Media Video 9', compression: 'lossy' },
  vc1: { name: 'VC-1', compression: 'lossy' },
  vp8: { name: 'VP8', compression: 'lossy' },
  vp9: { name: 'VP9', compression: 'lossy' },
  av1: { name: 'AV1', compression: 'lossy' },
  prores: { name: 'Apple ProRes', compression: 'lossy' },
  mjpeg: { name: 'JPEG', compression: 'lossy' },
  webp: { name: 'WebP', compression: 'lossy' },
  png: { name: 'PNG', compression: 'lossless' },
  ffv1: { name: 'FFV1', compression: 'lossless' },
  utvideo: { name: 'Ut Video', compression: 'lossless' },
  huffyuv: { name: 'HuffYUV', compression: 'lossless' },
  tiff: { name: 'TIFF', compression: 'lossless' },
  gif: { name: 'GIF', compression: 'lossless' },
  rawvideo: { name: 'Raw video', compression: 'uncompressed' },
  bmp: { name: 'BMP', compression: 'uncompressed' },
};

const AUDIO_CODECS: Record<string, { name: string; compression: Compression }> = {
  aac: { name: 'AAC', compression: 'lossy' },
  mp3: { name: 'MP3', compression: 'lossy' },
  mp2: { name: 'MP2', compression: 'lossy' },
  ac3: { name: 'Dolby Digital (AC-3)', compression: 'lossy' },
  wmav1: { name: 'Windows Media Audio', compression: 'lossy' },
  wmav2: { name: 'Windows Media Audio', compression: 'lossy' },
  opus: { name: 'Opus', compression: 'lossy' },
  vorbis: { name: 'Vorbis', compression: 'lossy' },
  flac: { name: 'FLAC', compression: 'lossless' },
  alac: { name: 'Apple Lossless', compression: 'lossless' },
};

/** The codec's everyday name and how it compresses; an unknown codec keeps its own name. */
export function codecInfo(
  kind: 'video' | 'audio',
  codec: string,
): { name: string; compression?: Compression } {
  if (kind === 'audio' && codec.startsWith('pcm_'))
    return { name: 'PCM', compression: 'uncompressed' };
  return (kind === 'video' ? VIDEO_CODECS : AUDIO_CODECS)[codec] ?? { name: codec };
}

const COMMON_RATIOS = [
  [16, 9],
  [4, 3],
  [3, 2],
  [5, 4],
  [16, 10],
  [21, 9],
  [1, 1],
] as const;

/** "16:9" — whole numbers, or the common ratio it is within 1 % of (1366 × 768 is 16:9). */
export function aspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  const [w, h] = [width / d, height / d];
  if (w <= 21 && h <= 21) return `${w}:${h}`;
  const ratio = width / height;
  for (const [a, b] of COMMON_RATIOS) {
    if (Math.abs(ratio / (a / b) - 1) < 0.01) return `${a}:${b}`;
    if (Math.abs(ratio / (b / a) - 1) < 0.01) return `${b}:${a}`;
  }
  return `${ratio.toFixed(2)}:1`;
}

const size = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(1)} GB`
    : bytes >= 1e6
      ? `${(bytes / 1e6).toFixed(1)} MB`
      : `${Math.round(bytes / 1e3)} KB`;

const bitRate = (bps: number) =>
  bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mbit/s` : `${Math.round(bps / 1e3)} kbit/s`;

function codecRow(kind: 'video' | 'audio', codec: string): InspectRow {
  const { name, compression } = codecInfo(kind, codec);
  const stream = kind === 'video' ? 'picture' : 'sound';
  const what = `The codec (coder / decoder) compresses the ${stream} to store it and decompresses it to play it.`;
  const how = {
    lossy: `${name} is lossy: it throws away detail that is hard to ${kind === 'video' ? 'see' : 'hear'}, so the file is much smaller, but that detail is lost for good.`,
    lossless: `${name} is lossless: the file is smaller than the raw ${stream}, yet every ${kind === 'video' ? 'pixel' : 'sample'} can be rebuilt exactly.`,
    uncompressed: `${name} is not compressed at all: every value is stored exactly, so the file is very large.`,
  };
  return {
    label: kind === 'video' ? 'Video codec' : 'Audio codec',
    value: name,
    ...(compression ? { compression } : {}),
    explain: `${what} ${compression ? how[compression] : `EasyMedia does not know whether ${name} is lossy or lossless.`}`,
  };
}

export function inspect(info: ProbeInfo): InspectRow[] {
  const rows: InspectRow[] = [];
  const container = info.container.toUpperCase();
  rows.push({
    label: 'Container',
    value: container,
    explain:
      info.kind === 'image'
        ? `${container} is the picture's file format: it holds the pixels (compressed or not) and information about them, such as the size.`
        : `${container} is a container: a box that holds the ${info.video ? 'picture and sound streams' : 'sound stream'} and information about them, such as their length. The codec inside decides whether the data is lossy or lossless.`,
  });
  const v = info.video;
  if (v && info.kind === 'video') rows.push(codecRow('video', v.codec));
  if (v) {
    const ratio = aspectRatio(v.width, v.height);
    rows.push({
      label: 'Resolution',
      value:
        v.displayAspect && v.displayAspect !== ratio
          ? `${v.width} × ${v.height}, shown as ${v.displayAspect}`
          : `${v.width} × ${v.height} (${ratio})`,
      explain: `The number of pixels across × down in each ${info.kind === 'image' ? 'picture' : 'frame'}: more pixels give a sharper picture but a bigger file. The aspect ratio is the width of the frame compared with its height; 16:9 is used by almost all screens today.`,
    });
  }
  if (v?.fps)
    rows.push({
      label: 'Frame rate',
      value: `${v.fps} fps`,
      explain:
        'How many pictures (frames) are shown each second. More frames make movement smoother but need more data: 30 fps needs twice the data of 15 fps.',
    });
  if (v?.bitRate)
    rows.push({
      label: 'Video bit rate',
      value: bitRate(v.bitRate),
      explain:
        'How much data each second of the picture uses after compression. A higher bit rate keeps more detail but makes the file bigger.',
    });
  const a = info.audio;
  if (a) {
    rows.push(codecRow('audio', a.codec));
    if (a.bitRate)
      rows.push({
        label: 'Audio bit rate',
        value: bitRate(a.bitRate),
        explain:
          'How much data each second of the sound uses after compression. 128 kbit/s is common for MP3; a lower bit rate makes a smaller file that sounds worse.',
      });
    rows.push({
      label: 'Sample rate',
      value: `${group(a.sampleRate)} Hz`,
      explain:
        'How many times each second the sound was measured (sampled). 44 100 Hz is CD quality; a higher sample rate is more accurate but makes the file bigger.',
    });
    if (a.bitDepth)
      rows.push({
        label: 'Bit depth',
        value: `${a.bitDepth}-bit`,
        explain: `The sample resolution: the number of bits used for each sample. ${a.bitDepth} bits give ${group(2 ** a.bitDepth)} levels; more bits record the sound more accurately but make the file bigger.`,
      });
    rows.push({
      label: 'Channels',
      value: a.channels === 1 ? '1 (mono)' : a.channels === 2 ? '2 (stereo)' : `${a.channels}`,
      explain:
        'Stereo has two channels (left and right) that can play different sounds; mono has one, played the same through every speaker. Mono needs half the data.',
    });
  }
  if (info.duration !== undefined)
    rows.push({
      label: 'Duration',
      value: `${info.duration.toFixed(2)} s`,
      explain: 'How long the file plays for. The longer it is, the more storage it needs.',
    });
  rows.push({
    label: 'File size',
    value: size(info.sizeBytes),
    explain:
      'How much storage the file takes. It depends on the resolution, frame rate, sample rate, length and how much the codecs compress (1 MB = 1 000 000 bytes).',
  });
  return rows;
}
