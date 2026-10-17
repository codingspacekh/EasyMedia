import { describe, expect, it } from 'vitest';
import {
  AUDIO_FORMATS,
  SAMPLE_RATES,
  audioCodecArgs,
  audioFormatNotes,
  bitDepthsFor,
  bitRatesFor,
  defaultAudioExport,
  estimateAudioSize,
  sampleRatesFor,
  validateAudioExport,
  type AudioExportSettings,
} from '../../../../src/core/render/audio-formats.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const mp3: AudioExportSettings = {
  format: 'mp3',
  sampleRate: 44100,
  channels: 2,
  bitRate: 128,
  mode: 'cbr',
  bitDepth: 16,
  tags: {},
};
const pair = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('A16 / A17 audio export formats', () => {
  it('offers MP3, M4A, AAC, WAV and FLAC', () => {
    expect(Object.keys(AUDIO_FORMATS)).toEqual(['mp3', 'm4a', 'aac', 'wav', 'flac']);
    expect(AUDIO_FORMATS.flac.lossless && AUDIO_FORMATS.wav.lossless).toBe(true);
    expect(AUDIO_FORMATS.mp3.lossless).toBe(false);
  });

  it('A16 has the syllabus sample rates, from 8 kHz to 96 kHz', () => {
    expect(SAMPLE_RATES.map((r) => r.rate)).toEqual([
      8000, 11025, 22050, 32000, 44100, 48000, 96000,
    ]);
    expect(SAMPLE_RATES.find((r) => r.rate === 44100)!.hint).toMatch(/CD/);
  });

  it('MP3 cannot be 96 kHz; WAV, FLAC and AAC can', () => {
    expect(sampleRatesFor('mp3')).not.toContain(96000);
    for (const f of ['wav', 'flac', 'aac', 'm4a'] as const)
      expect(sampleRatesFor(f)).toContain(96000);
  });

  it('bit depth 16 / 24 / 32-bit for WAV, 16 / 24 for FLAC, none for lossy formats', () => {
    expect(bitDepthsFor('wav')).toEqual([16, 24, 32]);
    expect(bitDepthsFor('flac')).toEqual([16, 24]);
    expect(bitDepthsFor('mp3')).toEqual([]);
  });

  it('MP3 bit rates are limited at low sample rates', () => {
    expect(bitRatesFor('mp3', 44100)).toEqual([32, 64, 96, 128, 192, 320]); // 96: Book B Task 11p
    expect(bitRatesFor('mp3', 22050)).toEqual([32, 64, 96, 128]);
    expect(bitRatesFor('mp3', 8000)).toEqual([32, 64]);
    expect(bitRatesFor('wav', 44100)).toEqual([]);
  });

  it('the default is MP3 at 128 kbps with the sound’s own rate and channels', () => {
    expect(defaultAudioExport({ rate: 44100, channels: 1 })).toMatchObject({
      format: 'mp3',
      bitRate: 128,
      mode: 'cbr',
      sampleRate: 44100,
      channels: 1,
    });
    expect(defaultAudioExport({ rate: 96000, channels: 2 }).sampleRate).toBe(48000);
  });

  describe('FFmpeg arguments', () => {
    it('MP3 constant bit rate, with the sample rate and channels', () => {
      const args = audioCodecArgs(mp3);
      expect(pair(args, '-c:a')).toBe('libmp3lame');
      expect(pair(args, '-b:a')).toBe('128k');
      expect(pair(args, '-ar')).toBe('44100');
      expect(pair(args, '-ac')).toBe('2');
    });

    it('MP3 variable bit rate uses a quality level instead', () => {
      const args = audioCodecArgs({ ...mp3, mode: 'vbr', bitRate: 192 });
      expect(args).not.toContain('-b:a');
      expect(pair(args, '-q:a')).toBe('2');
    });

    it('WAV 16, 24 and 32-bit', () => {
      const wav = { ...mp3, format: 'wav' as const };
      expect(pair(audioCodecArgs({ ...wav, bitDepth: 16 }), '-c:a')).toBe('pcm_s16le');
      expect(pair(audioCodecArgs({ ...wav, bitDepth: 24 }), '-c:a')).toBe('pcm_s24le');
      expect(pair(audioCodecArgs({ ...wav, bitDepth: 32 }), '-c:a')).toBe('pcm_f32le');
    });

    it('FLAC 16 and 24-bit', () => {
      const flac = { ...mp3, format: 'flac' as const };
      expect(pair(audioCodecArgs({ ...flac, bitDepth: 16 }), '-sample_fmt')).toBe('s16');
      const deep = audioCodecArgs({ ...flac, bitDepth: 24 });
      expect([pair(deep, '-sample_fmt'), pair(deep, '-bits_per_raw_sample')]).toEqual([
        's32',
        '24',
      ]);
    });

    it('M4A is AAC in an MP4 file; AAC is a raw ADTS stream', () => {
      const m4a = audioCodecArgs({ ...mp3, format: 'm4a' });
      expect([pair(m4a, '-c:a'), pair(m4a, '-f')]).toEqual(['aac', 'ipod']);
      const aac = audioCodecArgs({ ...mp3, format: 'aac' });
      expect([pair(aac, '-c:a'), pair(aac, '-f')]).toEqual(['aac', 'adts']);
    });

    it('A17 writes the tags that are filled in (each as one argument, any characters)', () => {
      const args = audioCodecArgs({
        ...mp3,
        tags: { title: 'Task 11j', artist: 'A & B "quoted"', year: '2026', album: '' },
      });
      expect(args).toEqual(expect.arrayContaining(['-metadata', 'title=Task 11j']));
      expect(args).toContain('artist=A & B "quoted"');
      expect(args).toContain('date=2026');
      expect(args.some((a) => a.startsWith('album='))).toBe(false);
    });

    it('an AAC stream cannot hold tags, so none are written', () => {
      expect(audioCodecArgs({ ...mp3, format: 'aac', tags: { title: 'x' } })).not.toContain(
        '-metadata',
      );
    });
  });

  describe('A16 estimated file size', () => {
    it('WAV: sample rate × bit depth × channels × length ÷ 8 (+ 44 byte header)', () => {
      const wav = estimateAudioSize({ ...mp3, format: 'wav' }, 45);
      expect(wav).toEqual({ bytes: (44100 * 16 * 2 * 45) / 8 + 44, upTo: false, about: false });
    });

    it('MP3 128 kbps for 45 s ≈ 0.72 MB', () => {
      expect(estimateAudioSize(mp3, 45).bytes).toBeCloseTo(720_000, -4);
    });

    it('FLAC: at most the size of the WAV (lossless compression depends on the sound)', () => {
      const flac = estimateAudioSize({ ...mp3, format: 'flac' }, 10);
      expect(flac.upTo).toBe(true);
      expect(flac.bytes).toBe(estimateAudioSize({ ...mp3, format: 'wav' }, 10).bytes);
    });

    it('a variable bit rate gives only an approximate size', () => {
      expect(estimateAudioSize({ ...mp3, mode: 'vbr' }, 10).about).toBe(true);
    });
  });

  describe('validation', () => {
    it('accepts the defaults', () => {
      expect(() => validateAudioExport(mp3)).not.toThrow();
    });

    it.each([
      [{ ...mp3, sampleRate: 96000 }, /96 000 Hz/],
      [{ ...mp3, sampleRate: 12345 }, /sample rate/i],
      [{ ...mp3, sampleRate: 8000, bitRate: 128 }, /at most 64 kbps/],
      [{ ...mp3, bitRate: 100 }, /one of the bit rates in the list: 32, 64, 96, 128, 192 or 320 kbps/],
      [{ ...mp3, format: 'flac' as const, bitDepth: 32 as const }, /16 or 24-bit/],
      [{ ...mp3, format: 'wav' as const, mode: 'vbr' as const }, /bit rate/i],
      [{ ...mp3, format: 'm4a' as const, mode: 'vbr' as const }, /variable bit rate.*MP3/i],
      [{ ...mp3, channels: 3 as never }, /mono or stereo/i],
    ])('refuses %o', (settings, message) => {
      expect(() => validateAudioExport(settings as AudioExportSettings)).toThrow(EditError);
      expect(() => validateAudioExport(settings as AudioExportSettings)).toThrow(message);
    });
  });

  describe('T7 pros and cons of each format', () => {
    it.each(Object.keys(AUDIO_FORMATS))('%s has a title, pros and cons', (format) => {
      const notes = audioFormatNotes(format as keyof typeof AUDIO_FORMATS);
      expect(notes.title.length).toBeGreaterThan(5);
      expect(notes.pros.length).toBeGreaterThanOrEqual(2);
      expect(notes.cons.length).toBeGreaterThanOrEqual(2);
    });

    it('MP3 is lossy and plays everywhere; AAC explains it has no tags', () => {
      expect(audioFormatNotes('mp3').pros.join(' ')).toMatch(/almost every device/i);
      expect(audioFormatNotes('mp3').cons.join(' ')).toMatch(/lossy/i);
      expect(audioFormatNotes('aac').cons.join(' ')).toMatch(/tags/i);
      expect(audioFormatNotes('flac').pros.join(' ')).toMatch(/lossless/i);
    });
  });
});
