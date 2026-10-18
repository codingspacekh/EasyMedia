// T7: the format guide of Learn mode (screen 22) — every export format side by side, with the
// same advantages and disadvantages as the export dialogs — and how the picture size, frame
// rate, length and compression decide a video's file size (Book B 11.1.19).
import type { Seconds } from '../model/time.ts';
import { audioFormatNotes, type AudioFormat } from '../render/audio-formats.ts';
import {
  CONTAINERS,
  estimateSize,
  formatNotes,
  type Container,
  type ExportFps,
  type ExportSettings,
} from '../render/formats.ts';

export interface GuideRow {
  kind: 'video' | 'audio';
  format: string;
  compression: string;
  pros: string[];
  cons: string[];
  bestFor: string;
}

const VIDEO: { container: Container; compression: string; bestFor: string }[] = [
  { container: 'mp4', compression: 'Lossy (H.264)', bestFor: 'The web, phones, sharing' },
  { container: 'mov', compression: 'Lossy or lossless', bestFor: 'Editing, Apple devices' },
  {
    container: 'avi',
    compression: 'Lossy or lossless',
    bestFor: 'Older Windows PCs, archive copies',
  },
  { container: 'wmv', compression: 'Lossy (Windows Media)', bestFor: 'Windows PCs, PowerPoint' },
  { container: 'mpg', compression: 'Lossy (MPEG-2)', bestFor: 'DVD players' },
];

const AUDIO: { format: AudioFormat; label: string; compression: string; bestFor: string }[] = [
  { format: 'mp3', label: 'MP3', compression: 'Lossy', bestFor: 'Music players, any device' },
  { format: 'm4a', label: 'M4A', compression: 'Lossy (AAC)', bestFor: 'Phones, Apple devices' },
  { format: 'aac', label: 'AAC', compression: 'Lossy', bestFor: 'Streaming, digital radio' },
  {
    format: 'wav',
    label: 'WAV',
    compression: 'None (uncompressed)',
    bestFor: 'Recording, editing',
  },
  { format: 'flac', label: 'FLAC', compression: 'Lossless', bestFor: 'Archiving, live music' },
];

export function formatGuide(): GuideRow[] {
  return [
    ...VIDEO.map(({ container, compression, bestFor }) => {
      const notes = formatNotes(container, 'lossy');
      const lossless = CONTAINERS[container].lossless;
      return {
        kind: 'video' as const,
        format: CONTAINERS[container].label,
        compression,
        pros: lossless
          ? [...notes.pros, 'Can also be lossless: every pixel kept exactly']
          : notes.pros,
        cons: lossless ? [...notes.cons, 'Lossless files are very large'] : notes.cons,
        bestFor,
      };
    }),
    ...AUDIO.map(({ format, label, compression, bestFor }) => {
      const { pros, cons } = audioFormatNotes(format);
      return { kind: 'audio' as const, format: label, compression, pros, cons, bestFor };
    }),
  ];
}

/** Book B 11.1.19: the more pixels in each frame, the more data to store and stream. */
export const PICTURE_SIZES = [
  { name: 'SD', width: 720, height: 480 },
  { name: 'HD', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
] as const;

export interface SizeExample {
  label: string;
  width: number;
  height: number;
  bytes: number;
  /** Lossless: only an upper limit is known. */
  upTo: boolean;
}

const even = (n: number) => 2 * Math.round(n / 2);

/**
 * Screen 22: the same video at full size lossless, as a high-quality MP4, and as MP4s 640 and
 * 426 pixels wide (the shape kept), with the export dialog's size estimates.
 */
export function videoSizeExamples(
  picture: { width: number; height: number; fps: ExportFps },
  duration: Seconds,
): SizeExample[] {
  const base: ExportSettings = {
    container: 'mp4',
    compression: 'lossy',
    quality: 'high',
    ...picture,
  };
  const narrow = (width: number) => ({
    width,
    height: even((width * picture.height) / picture.width),
  });
  const make = (label: string, e: ExportSettings): SizeExample => ({
    label,
    width: e.width,
    height: e.height,
    ...estimateSize(e, duration, true),
  });
  return [
    make('Lossless', { ...base, container: 'mov', compression: 'lossless' }),
    make('MP4 high', base),
    make('MP4', { ...base, ...narrow(640), quality: 'medium' }),
    make('MP4', { ...base, ...narrow(426), quality: 'low' }),
  ];
}
