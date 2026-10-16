// Export formats (V16), presets and estimated file size (V17), and the pros and cons of each
// format (T7). Pure data and arithmetic: the compiler turns the choice into FFmpeg arguments.
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';
import type { ProjectSettings } from '../model/types.ts';

export type Container = 'mp4' | 'mov' | 'avi' | 'wmv' | 'mpg';
export type Compression = 'lossy' | 'lossless';
export type Quality = 'best' | 'high' | 'medium' | 'low';
/** 29.97 is the NTSC (DVD) frame rate, 30000/1001. */
export type ExportFps = 24 | 25 | 29.97 | 30;

export interface ExportSettings {
  container: Container;
  compression: Compression;
  width: number;
  height: number;
  fps: ExportFps;
  /** Lossy only: how many bits each pixel gets (smaller file ↔ better picture). */
  quality: Quality;
}

export const CONTAINERS: Record<
  Container,
  { label: string; extension: string; lossless: boolean; codecs: Record<Compression, string> }
> = {
  mp4: {
    label: 'MP4',
    extension: 'mp4',
    lossless: false,
    codecs: { lossy: 'H.264 video · AAC sound', lossless: '' },
  },
  mov: {
    label: 'MOV',
    extension: 'mov',
    lossless: true,
    codecs: { lossy: 'H.264 video · AAC sound', lossless: 'PNG video · PCM sound' },
  },
  avi: {
    label: 'AVI',
    extension: 'avi',
    lossless: true,
    codecs: { lossy: 'MPEG-4 Part 2 video · MP3 sound', lossless: 'FFV1 video · PCM sound' },
  },
  wmv: {
    label: 'WMV',
    extension: 'wmv',
    lossless: false,
    codecs: { lossy: 'Windows Media Video 8 · WMA sound', lossless: '' },
  },
  mpg: {
    label: 'MPG',
    extension: 'mpg',
    lossless: false,
    codecs: { lossy: 'MPEG-2 video · AC-3 sound (DVD)', lossless: '' },
  },
};

export const EXPORT_FPS: ExportFps[] = [24, 25, 29.97, 30];

/** Bits per pixel for H.264; older codecs need more bits for the same picture. */
const BITS_PER_PIXEL: Record<Quality, number> = { best: 0.15, high: 0.1, medium: 0.06, low: 0.035 };
const CODEC_FACTOR: Record<Container, number> = { mp4: 1, mov: 1, avi: 2, wmv: 2, mpg: 4 };
const AUDIO_KBPS: Record<Quality, number> = { best: 256, high: 192, medium: 160, low: 128 };
/** 48 kHz × 16 bits × 2 channels. */
const PCM_KBPS = 1536;
/** Headers and indexes of the container. */
const OVERHEAD = 1.01;
/** A lossless file is rarely more than this part of the raw picture. */
const LOSSLESS_AT_MOST = 0.6;

export function defaultExport(s: ProjectSettings): ExportSettings {
  return {
    container: 'mp4',
    compression: 'lossy',
    width: s.width,
    height: s.height,
    fps: s.fps,
    quality: 'high',
  };
}

export function videoKbps(e: ExportSettings): number {
  return Math.round(
    (e.width * e.height * e.fps * BITS_PER_PIXEL[e.quality] * CODEC_FACTOR[e.container]) / 1000,
  );
}

export function audioKbps(e: ExportSettings): number {
  return e.compression === 'lossless' ? PCM_KBPS : AUDIO_KBPS[e.quality];
}

/** A DVD player's picture: at most 720 × 576, MPEG-2. */
export function isDvd(e: ExportSettings): boolean {
  return e.container === 'mpg' && e.width <= 720 && e.height <= 576;
}

/** FFmpeg video and audio codec options for the chosen format (no inputs, no output path). */
export function codecArgs(
  e: ExportSettings,
  { hasAudio, videoEncoder = 'libx264' }: { hasAudio: boolean; videoEncoder?: string },
): string[] {
  const kbps = videoKbps(e);
  const rate = (k: number) => `${Math.round(k)}k`;
  const audio = (codec: string) =>
    hasAudio ? ['-c:a', codec, '-b:a', rate(audioKbps(e))] : ['-an'];
  const pcm = hasAudio ? ['-c:a', 'pcm_s16le'] : ['-an'];
  if (e.compression === 'lossless') {
    return e.container === 'mov'
      ? ['-c:v', 'png', '-pix_fmt', 'rgb24', ...pcm]
      : ['-c:v', 'ffv1', '-pix_fmt', 'yuv420p', ...pcm];
  }
  switch (e.container) {
    case 'mp4':
    case 'mov': {
      const x264 = videoEncoder === 'libx264' ? ['-preset', 'veryfast'] : [];
      return [
        ...['-c:v', videoEncoder, ...x264, '-b:v', rate(kbps)],
        ...['-maxrate', rate(kbps * 1.5), '-bufsize', rate(kbps * 2), '-pix_fmt', 'yuv420p'],
        ...audio('aac'),
        ...['-movflags', '+faststart'],
      ];
    }
    case 'avi':
      return [
        ...['-c:v', 'mpeg4', '-vtag', 'xvid', '-b:v', rate(kbps), '-pix_fmt', 'yuv420p'],
        ...audio('libmp3lame'),
      ];
    case 'wmv':
      return [...['-c:v', 'wmv2', '-b:v', rate(kbps), '-pix_fmt', 'yuv420p'], ...audio('wmav2')];
    case 'mpg': {
      const limits = isDvd(e)
        ? ['-maxrate', '9000k', '-bufsize', '1835k']
        : ['-maxrate', rate(kbps * 1.5), '-bufsize', rate(kbps * 2)];
      return [
        ...['-c:v', 'mpeg2video', '-b:v', rate(kbps), ...limits],
        ...['-g', e.fps === 25 ? '15' : '18', '-pix_fmt', 'yuv420p'],
        ...audio('ac3'),
        ...['-f', 'dvd'],
      ];
    }
  }
}

/**
 * V17: the expected size of the file. Lossy files are made at a set bit rate, so the estimate is
 * close; a lossless file's size depends on the picture, so only an upper limit (`upTo`) is known.
 */
export function estimateSize(
  e: ExportSettings,
  duration: Seconds,
  hasAudio: boolean,
): { bytes: number; upTo: boolean } {
  const sound = hasAudio ? audioKbps(e) : 0;
  if (e.compression === 'lossy') {
    return { bytes: ((videoKbps(e) + sound) * 1000 * duration * OVERHEAD) / 8, upTo: false };
  }
  const bytesPerPixel = e.container === 'mov' ? 3 : 1.5; // RGB, or YUV 4:2:0
  const picture = e.width * e.height * bytesPerPixel * e.fps * duration * LOSSLESS_AT_MOST;
  return { bytes: picture + (sound * 1000 * duration) / 8, upTo: true };
}

export function validateExport(e: ExportSettings): void {
  if (!CONTAINERS[e.container]) throw new EditError('Choose a file format.');
  if (e.compression === 'lossless' && !CONTAINERS[e.container].lossless) {
    throw new EditError('Lossless is only available in MOV or AVI.');
  }
  for (const [name, n] of [
    ['width', e.width],
    ['height', e.height],
  ] as const) {
    if (!(Number.isInteger(n) && n >= 128 && n <= 3840)) {
      throw new EditError(`The ${name} must be between 128 and 3840 pixels.`);
    }
    if (n % 2 !== 0) throw new EditError(`The ${name} must be an even number of pixels.`);
  }
  if (!EXPORT_FPS.includes(e.fps)) throw new EditError('Choose 24, 25, 29.97 or 30 fps.');
  if (!(e.quality in BITS_PER_PIXEL)) throw new EditError('Choose a quality.');
}

/** FFmpeg's name for a frame rate. */
export function fpsValue(fps: ExportFps): string {
  return fps === 29.97 ? '30000/1001' : String(fps);
}

// ---- V17 presets ----

export type PresetId =
  'youtube' | 'mobile-medium' | 'mobile-small' | 'dvd-pal' | 'dvd-ntsc' | 'bluray' | 'custom';

export const PRESETS: { id: PresetId; label: string; hint: string }[] = [
  { id: 'youtube', label: 'Internet / YouTube', hint: 'MP4 · plays on the web' },
  { id: 'mobile-medium', label: 'Mobile phone (medium)', hint: 'MP4 · 960 wide' },
  { id: 'mobile-small', label: 'Mobile phone (small)', hint: 'MP4 · 640 wide' },
  { id: 'dvd-pal', label: 'DVD player (PAL)', hint: '720 × 576 · MPEG-2' },
  { id: 'dvd-ntsc', label: 'DVD player (NTSC)', hint: '720 × 480 · MPEG-2' },
  { id: 'bluray', label: 'Blu-ray / HD television', hint: 'Full HD · best quality' },
  { id: 'custom', label: 'Custom', hint: 'Choose every setting' },
];

const even = (n: number) => 2 * Math.round(n / 2);

/** The settings of a preset for this project: the picture keeps the project's shape. */
export function presetSettings(id: PresetId, s: ProjectSettings): ExportSettings {
  const base = defaultExport(s);
  const wide = (width: number) => ({ width, height: even((width * s.height) / s.width) });
  const tall = (height: number) => ({ width: even((height * s.width) / s.height), height });
  switch (id) {
    case 'youtube':
      return { ...base, ...(s.height > 1080 ? tall(1080) : {}) };
    case 'mobile-medium':
      return { ...base, ...wide(960), quality: 'medium' };
    case 'mobile-small':
      return { ...base, ...wide(640), quality: 'low' };
    case 'dvd-pal':
      return { ...base, container: 'mpg', width: 720, height: 576, fps: 25 };
    case 'dvd-ntsc':
      return { ...base, container: 'mpg', width: 720, height: 480, fps: 29.97 };
    case 'bluray':
      return { ...base, ...tall(1080), quality: 'best' };
    case 'custom':
      return base;
  }
}

// ---- T7 advantages and disadvantages ----

export interface FormatNotes {
  title: string;
  pros: string[];
  cons: string[];
}

const LOSSY_CONS = [
  'Lossy: some detail is lost for ever',
  'Exporting again and again loses more quality',
];
const LOSSLESS_NOTES = {
  pros: [
    'Lossless: every pixel is kept exactly',
    'Good for a master copy that will be edited again',
  ],
  cons: [
    'Very large file: slow to copy, upload or email',
    'Many phones and websites cannot play it',
  ],
};

export function formatNotes(container: Container, compression: Compression): FormatNotes {
  if (compression === 'lossless') {
    const codec = container === 'mov' ? 'PNG video (lossless)' : 'FFV1 video (lossless)';
    return { title: `${CONTAINERS[container].label} container · ${codec}`, ...LOSSLESS_NOTES };
  }
  switch (container) {
    case 'mp4':
      return {
        title: 'MP4 container · H.264 video (lossy)',
        pros: [
          'Plays on almost all devices and websites',
          'Small file: quick to upload, stream or share',
        ],
        cons: LOSSY_CONS,
      };
    case 'mov':
      return {
        title: 'MOV container · H.264 video (lossy)',
        pros: [
          'Plays well on Apple devices and in editing software',
          'Small file, same picture as MP4',
        ],
        cons: ['Some Windows and Android players need extra software', ...LOSSY_CONS.slice(0, 1)],
      };
    case 'avi':
      return {
        title: 'AVI container · MPEG-4 Part 2 video (lossy)',
        pros: ['Plays in older Windows software and many TVs', 'Simple, widely supported format'],
        cons: ['Bigger than MP4 for the same picture (an older codec)', ...LOSSY_CONS.slice(0, 1)],
      };
    case 'wmv':
      return {
        title: 'WMV container · Windows Media Video (lossy)',
        pros: ['Plays in Windows Media Player and PowerPoint', 'Reasonably small files'],
        cons: ['Not played by most Apple devices and many websites', ...LOSSY_CONS.slice(0, 1)],
      };
    case 'mpg':
      return {
        title: 'MPG container · MPEG-2 video (lossy)',
        pros: ['The format used on DVDs: plays in DVD players', 'Easy for slow computers to play'],
        cons: ['Much bigger than MP4 for the same picture', ...LOSSY_CONS.slice(0, 1)],
      };
  }
}
