// Audio export (A16, A17): file formats, sample rates, bit depth, bit rate, tags, estimated file
// size, and the pros and cons of each format (T7). Pure data and arithmetic; the main process
// turns the choice into an FFmpeg command (src/main/media/engine.ts).
import { EditError } from '../model/errors.ts';
import type { Seconds } from '../model/time.ts';

export type AudioFormat = 'mp3' | 'm4a' | 'aac' | 'wav' | 'flac';
export type BitDepth = 16 | 24 | 32;
export type BitRateMode = 'cbr' | 'vbr';

/** A17: details of the originators and the track (Book B 11.2.9: "title, year and so on"). */
export interface AudioTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  comment?: string;
}

export interface AudioExportSettings {
  format: AudioFormat;
  /** Hz, one of SAMPLE_RATES. */
  sampleRate: number;
  /** 1 = mono ("Force export to mono"), 2 = stereo. */
  channels: 1 | 2;
  /** kbps, for MP3, M4A and AAC. */
  bitRate: number;
  /** Constant or variable bit rate (variable: MP3 only). */
  mode: BitRateMode;
  /** Sample resolution of WAV and FLAC. */
  bitDepth: BitDepth;
  tags: AudioTags;
}

export const AUDIO_FORMATS: Record<
  AudioFormat,
  { label: string; extension: string; lossless: boolean; tags: boolean; description: string }
> = {
  mp3: {
    label: 'MP3',
    extension: 'mp3',
    lossless: false,
    tags: true,
    description: 'MPEG-1 Audio Layer III',
  },
  m4a: {
    label: 'M4A (MP4a)',
    extension: 'm4a',
    lossless: false,
    tags: true,
    description: 'AAC sound in an MP4 file',
  },
  aac: {
    label: 'AAC',
    extension: 'aac',
    lossless: false,
    tags: false,
    description: 'AAC sound stream (ADTS)',
  },
  wav: {
    label: 'WAV',
    extension: 'wav',
    lossless: true,
    tags: true,
    description: 'Uncompressed PCM',
  },
  flac: {
    label: 'FLAC',
    extension: 'flac',
    lossless: true,
    tags: true,
    description: 'Free Lossless Audio Codec',
  },
};

/** A16: the sample rates on offer, with where each is used (screen 20). */
export const SAMPLE_RATES: { rate: number; hint: string }[] = [
  { rate: 8000, hint: 'Internet phone (VoIP)' },
  { rate: 11025, hint: 'Old telephone quality' },
  { rate: 22050, hint: 'AM radio, old MP3' },
  { rate: 32000, hint: 'Speech, FM radio' },
  { rate: 44100, hint: 'Music CD · default' },
  { rate: 48000, hint: 'DVD and video' },
  { rate: 96000, hint: 'Blu-ray, studio' },
];

const LOSSY_BIT_RATES = [32, 64, 96, 128, 192, 320];
/** LAME's quality levels for a variable bit rate, and the average kbps they give for music. */
const VBR: Record<number, { q: number; kbps: number }> = {
  320: { q: 0, kbps: 245 },
  192: { q: 2, kbps: 190 },
  128: { q: 5, kbps: 130 },
  64: { q: 8, kbps: 85 },
  32: { q: 9, kbps: 65 },
};
const WAV_HEADER = 44;

/** "44 100 Hz" — numbers grouped with a space, as in the coursebooks. */
export const hz = (rate: number): string =>
  `${String(rate).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} Hz`;

export function sampleRatesFor(format: AudioFormat): number[] {
  const all = SAMPLE_RATES.map((r) => r.rate);
  return format === 'mp3' ? all.filter((r) => r <= 48000) : all;
}

export function bitDepthsFor(format: AudioFormat): BitDepth[] {
  if (format === 'wav') return [16, 24, 32];
  return format === 'flac' ? [16, 24] : [];
}

/** MP3 allows lower bit rates only at lower sample rates (MPEG-2 and 2.5). */
export function bitRatesFor(format: AudioFormat, sampleRate: number): number[] {
  if (AUDIO_FORMATS[format].lossless) return [];
  if (format !== 'mp3') return LOSSY_BIT_RATES;
  const most = sampleRate < 16000 ? 64 : sampleRate < 32000 ? 160 : 320;
  return LOSSY_BIT_RATES.filter((k) => k <= most);
}

export function defaultAudioExport({
  rate,
  channels,
}: {
  rate: number;
  channels: number;
}): AudioExportSettings {
  const rates = sampleRatesFor('mp3');
  return {
    format: 'mp3',
    sampleRate: rates.includes(rate) ? rate : rate > 48000 ? 48000 : 44100,
    channels: channels >= 2 ? 2 : 1,
    bitRate: 128,
    mode: 'cbr',
    bitDepth: 16,
    tags: {},
  };
}

export function validateAudioExport(e: AudioExportSettings): void {
  const info = AUDIO_FORMATS[e.format];
  if (!info) throw new EditError('Choose a file format.');
  if (!SAMPLE_RATES.some((r) => r.rate === e.sampleRate))
    throw new EditError('Choose one of the sample rates in the list.');
  if (!sampleRatesFor(e.format).includes(e.sampleRate))
    throw new EditError(`${info.label} cannot use ${hz(e.sampleRate)}: choose 48 000 Hz or less.`);
  if (e.channels !== 1 && e.channels !== 2) throw new EditError('Choose mono or stereo.');
  if (info.lossless) {
    if (e.mode === 'vbr') throw new EditError(`${info.label} has no bit rate to choose.`);
    if (!bitDepthsFor(e.format).includes(e.bitDepth))
      throw new EditError(
        `${info.label} can be ${bitDepthsFor(e.format)
          .join(' or ')
          .replace(/ or (?=.* or )/, ', ')}-bit.`,
      );
    return;
  }
  if (e.mode === 'vbr' && e.format !== 'mp3')
    throw new EditError('A variable bit rate is only available for MP3.');
  const rates = bitRatesFor(e.format, e.sampleRate);
  if (e.bitRate > rates.at(-1)!)
    throw new EditError(
      `At ${hz(e.sampleRate)} an ${info.label} can be at most ${rates.at(-1)} kbps.`,
    );
  if (!rates.includes(e.bitRate))
    throw new EditError(
      `Choose one of the bit rates in the list: ${rates.slice(0, -1).join(', ')} or ${rates.at(-1)} kbps.`,
    );
}

/** FFmpeg options for the output (no input, no output path). */
export function audioCodecArgs(e: AudioExportSettings): string[] {
  const common = ['-ar', String(e.sampleRate), '-ac', String(e.channels)];
  const tags = AUDIO_FORMATS[e.format].tags
    ? Object.entries({
        title: e.tags.title,
        artist: e.tags.artist,
        album: e.tags.album,
        date: e.tags.year,
        comment: e.tags.comment,
      }).flatMap(([key, value]) => (value?.trim() ? ['-metadata', `${key}=${value.trim()}`] : []))
    : [];
  const kbps = ['-b:a', `${e.bitRate}k`];
  switch (e.format) {
    case 'mp3':
      return [
        ...[
          '-c:a',
          'libmp3lame',
          ...(e.mode === 'vbr' ? ['-q:a', String(VBR[e.bitRate]!.q)] : kbps),
        ],
        ...common,
        ...tags,
        ...['-id3v2_version', '3', '-f', 'mp3'],
      ];
    case 'm4a':
      return ['-c:a', 'aac', ...kbps, ...common, ...tags, '-movflags', '+faststart', '-f', 'ipod'];
    case 'aac':
      return ['-c:a', 'aac', ...kbps, ...common, '-f', 'adts'];
    case 'wav': {
      const codec = { 16: 'pcm_s16le', 24: 'pcm_s24le', 32: 'pcm_f32le' }[e.bitDepth];
      return ['-c:a', codec, ...common, ...tags, '-f', 'wav'];
    }
    case 'flac': {
      const depth =
        e.bitDepth === 24
          ? ['-sample_fmt', 's32', '-bits_per_raw_sample', '24']
          : ['-sample_fmt', 's16'];
      return ['-c:a', 'flac', ...depth, ...common, ...tags, '-f', 'flac'];
    }
  }
}

/** Size of the same sound as an uncompressed WAV (T2: rate × bits × channels × seconds ÷ 8). */
export function wavBytes(
  sampleRate: number,
  bits: number,
  channels: number,
  duration: Seconds,
): number {
  return (sampleRate * bits * channels * duration) / 8 + WAV_HEADER;
}

/**
 * A16: the expected size of the file. `upTo`: lossless compression depends on the sound, so only
 * the most it can be is known. `about`: a variable bit rate depends on the sound too.
 */
export function estimateAudioSize(
  e: AudioExportSettings,
  duration: Seconds,
): { bytes: number; upTo: boolean; about: boolean } {
  if (e.format === 'wav' || e.format === 'flac')
    return {
      bytes: wavBytes(e.sampleRate, e.bitDepth, e.channels, duration),
      upTo: e.format === 'flac',
      about: false,
    };
  const vbr = e.mode === 'vbr';
  const kbps = vbr ? VBR[e.bitRate]!.kbps : e.bitRate;
  return { bytes: (kbps * 1000 * duration) / 8, upTo: false, about: vbr };
}

// ---- T7 advantages and disadvantages ----

export interface AudioFormatNotes {
  title: string;
  pros: string[];
  cons: string[];
}

export function audioFormatNotes(format: AudioFormat): AudioFormatNotes {
  switch (format) {
    case 'mp3':
      return {
        title: 'MP3 · lossy compression',
        pros: ['Plays on almost every device', 'Small files: quick to stream, download or email'],
        cons: [
          'Lossy: removed detail cannot be recovered',
          'AAC / M4A sound better at the same bit rate',
        ],
      };
    case 'm4a':
      return {
        title: 'M4A · AAC sound in an MP4 file (lossy)',
        pros: [
          'Better sound than MP3 at the same bit rate',
          'Holds tags; plays on phones, Apple devices and most players',
        ],
        cons: [
          'Lossy: removed detail cannot be recovered',
          'Some older MP3 players and car stereos cannot play it',
        ],
      };
    case 'aac':
      return {
        title: 'AAC · sound stream (lossy)',
        pros: ['Same good sound as M4A at a small size', 'Used for streaming and digital radio'],
        cons: [
          'Cannot hold tags (title, artist): choose M4A to keep them',
          'Lossy, and fewer players open .aac files than .mp3',
        ],
      };
    case 'wav':
      return {
        title: 'WAV · uncompressed (lossless)',
        pros: ['Lossless: every sample is kept exactly', 'Opens in almost every editor and player'],
        cons: ['Very large: about 10 MB a minute at CD quality', 'Slow to upload, stream or email'],
      };
    case 'flac':
      return {
        title: 'FLAC · lossless compression',
        pros: [
          'Lossless: the original sound can be reinstated exactly (e.g. live music, orchestras)',
          'Often about half the size of a WAV',
        ],
        cons: ['Much bigger than MP3 or AAC', 'Some devices and web browsers cannot play it'],
      };
  }
}
