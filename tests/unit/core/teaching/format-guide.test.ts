import { describe, expect, it } from 'vitest';
import { audioFormatNotes } from '../../../../src/core/render/audio-formats.ts';
import { formatNotes } from '../../../../src/core/render/formats.ts';
import {
  PICTURE_SIZES,
  formatGuide,
  videoSizeExamples,
} from '../../../../src/core/teaching/format-guide.ts';

const row = (format: string) => formatGuide().find((r) => r.format === format)!;

describe('T7 format guide (screen 22)', () => {
  it('lists every export format: video first, then audio', () => {
    expect(formatGuide().map((r) => [r.kind, r.format])).toEqual([
      ['video', 'MP4'],
      ['video', 'MOV'],
      ['video', 'AVI'],
      ['video', 'WMV'],
      ['video', 'MPG'],
      ['audio', 'MP3'],
      ['audio', 'M4A'],
      ['audio', 'AAC'],
      ['audio', 'WAV'],
      ['audio', 'FLAC'],
    ]);
  });

  it('says how each format compresses', () => {
    expect(row('MP4').compression).toBe('Lossy (H.264)');
    expect(row('MOV').compression).toBe('Lossy or lossless');
    expect(row('AVI').compression).toBe('Lossy or lossless');
    expect(row('MPG').compression).toBe('Lossy (MPEG-2)');
    expect(row('MP3').compression).toBe('Lossy');
    expect(row('WAV').compression).toBe('None (uncompressed)');
    expect(row('FLAC').compression).toBe('Lossless');
  });

  it('uses the same advantages and disadvantages as the export dialogs', () => {
    expect(row('MP4').pros).toEqual(formatNotes('mp4', 'lossy').pros);
    expect(row('MP4').cons).toEqual(formatNotes('mp4', 'lossy').cons);
    expect(row('MOV').pros).toEqual(expect.arrayContaining(formatNotes('mov', 'lossy').pros));
    expect(row('MOV').pros.join(' ')).toMatch(/lossless/i);
    expect(row('MP3').pros).toEqual(audioFormatNotes('mp3').pros);
    expect(row('FLAC').cons).toEqual(audioFormatNotes('flac').cons);
  });

  it('says what each format is best for', () => {
    for (const r of formatGuide()) expect(r.bestFor.length, r.format).toBeGreaterThan(3);
    expect(row('MPG').bestFor).toMatch(/DVD/);
  });

  it('Book B 11.1.19: pixels per frame for SD, HD and 4K', () => {
    expect(PICTURE_SIZES.map((p) => [p.name, p.width * p.height])).toEqual([
      ['SD', 345_600],
      ['HD', 2_073_600],
      ['4K', 8_294_400],
    ]);
  });

  it('the same video at four settings: lossless is biggest, a small picture is smallest', () => {
    const examples = videoSizeExamples({ width: 1920, height: 1080, fps: 30 }, 40.7);
    expect(examples.map((e) => [e.label, e.width, e.height])).toEqual([
      ['Lossless', 1920, 1080],
      ['MP4 high', 1920, 1080],
      ['MP4', 640, 360],
      ['MP4', 426, 240],
    ]);
    const sizes = examples.map((e) => e.bytes);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(examples[0]!.upTo).toBe(true);
    expect(sizes[0]! / sizes[1]!).toBeGreaterThan(10);
  });

  it('a 4:3 video keeps its shape in the smaller examples', () => {
    const examples = videoSizeExamples({ width: 960, height: 720, fps: 25 }, 10);
    expect(examples.slice(2).map((e) => [e.width, e.height])).toEqual([
      [640, 480],
      [426, 320],
    ]);
  });
});
