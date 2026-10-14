// Turns ffprobe's JSON (-show_format -show_streams) into ProbeInfo.
import { MediaError } from '../../core/model/errors.ts';
import type { ProbeInfo } from '../../core/ports.ts';

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  sample_rate?: string;
  channels?: number;
  bits_per_sample?: number;
  bits_per_raw_sample?: string;
  bit_rate?: string;
  disposition?: { attached_pic?: number };
}

export interface FfprobeJson {
  format: {
    format_name: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
    tags?: { major_brand?: string };
  };
  streams: FfprobeStream[];
}

const CONTAINERS: Record<string, string> = {
  avi: 'avi',
  mpeg: 'mpg',
  'matroska,webm': 'mkv',
  mp3: 'mp3',
  wav: 'wav',
  flac: 'flac',
  ogg: 'ogg',
  aac: 'aac',
};
const IMAGE_CODECS: Record<string, string> = {
  mjpeg: 'jpg',
  png: 'png',
  bmp: 'bmp',
  tiff: 'tiff',
  webp: 'webp',
};

export function parseProbe(json: FfprobeJson): ProbeInfo {
  const { format } = json;
  const isImage = format.format_name === 'image2' || format.format_name.endsWith('_pipe');
  // Album art in music files is a "video" stream marked as an attached picture: ignore it.
  const v = json.streams.find((s) => s.codec_type === 'video' && !s.disposition?.attached_pic);
  const a = json.streams.find((s) => s.codec_type === 'audio');
  if (!v && !a) throw new MediaError('This file has no picture or sound that EasyMedia can use.');

  const kind = isImage ? 'image' : v ? 'video' : 'audio';
  const info: ProbeInfo = {
    kind,
    container: containerName(format, kind, v?.codec_name),
    sizeBytes: Number(format.size ?? 0),
  };
  const duration = Number(format.duration);
  if (kind !== 'image' && Number.isFinite(duration)) info.duration = duration;
  const bitRate = Number(format.bit_rate);
  if (Number.isFinite(bitRate)) info.bitRate = bitRate;

  if (v) {
    info.video = { codec: v.codec_name ?? 'unknown', width: v.width ?? 0, height: v.height ?? 0 };
    const fps = frameRate(v.r_frame_rate);
    if (kind === 'video' && fps) info.video.fps = fps;
  }
  if (a) {
    info.audio = {
      codec: a.codec_name ?? 'unknown',
      sampleRate: Number(a.sample_rate ?? 0),
      channels: a.channels ?? 0,
    };
    const depth = a.bits_per_sample || Number(a.bits_per_raw_sample ?? 0);
    if (depth > 0) info.audio.bitDepth = depth;
    const audioRate = Number(a.bit_rate);
    if (Number.isFinite(audioRate)) info.audio.bitRate = audioRate;
  }
  return info;
}

function containerName(
  format: FfprobeJson['format'],
  kind: ProbeInfo['kind'],
  videoCodec?: string,
): string {
  const name = format.format_name;
  if (kind === 'image') return IMAGE_CODECS[videoCodec ?? ''] ?? name.replace(/_pipe$/, '');
  if (name.startsWith('mov,mp4')) {
    const brand = format.tags?.major_brand?.trim();
    return brand === 'qt' ? 'mov' : brand === 'M4A' ? 'm4a' : 'mp4';
  }
  if (name === 'asf') return kind === 'audio' ? 'wma' : 'wmv';
  return CONTAINERS[name] ?? name;
}

/** "30/1" → 30, "30000/1001" → 29.97. */
function frameRate(rate?: string): number | undefined {
  const [num, den] = (rate ?? '').split('/').map(Number);
  if (!num || !den) return undefined;
  return Math.round((num / den) * 100) / 100;
}
