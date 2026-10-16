import { describe, expect, it } from 'vitest';
import { createProject } from '../../../../src/core/model/factory.ts';
import {
  CONTAINERS,
  codecArgs,
  defaultExport,
  estimateSize,
  formatNotes,
  PRESETS,
  presetSettings,
  validateExport,
  videoKbps,
  type ExportSettings,
} from '../../../../src/core/render/formats.ts';

const hd = createProject({ name: 'p' }).settings; // 16:9, 1920 × 1080, 30 fps
const fourThree = { ...hd, aspect: '4:3' as const, width: 960, height: 720 };
const mp4: ExportSettings = defaultExport(hd);
const tail = (s: ExportSettings, audio = true) => codecArgs(s, { hasAudio: audio });

describe('V16 containers and codecs', () => {
  it('lossless is offered only where it is genuinely lossless and playable: MOV and AVI', () => {
    expect(Object.entries(CONTAINERS).map(([id, c]) => [id, c.lossless])).toEqual([
      ['mp4', false],
      ['mov', true],
      ['avi', true],
      ['wmv', false],
      ['mpg', false],
    ]);
  });

  it('the default export is the project as a high-quality MP4', () => {
    expect(mp4).toEqual({
      container: 'mp4',
      compression: 'lossy',
      width: 1920,
      height: 1080,
      fps: 30,
      quality: 'high',
    });
  });

  it('MP4 and MOV (lossy): H.264 at a set bit rate + AAC, ready for the web', () => {
    for (const container of ['mp4', 'mov'] as const) {
      expect(tail({ ...mp4, container })).toEqual([
        ...['-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '6221k'],
        ...['-maxrate', '9332k', '-bufsize', '12442k', '-pix_fmt', 'yuv420p'],
        ...['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
      ]);
    }
  });

  it('a hardware H.264 encoder is used for MP4 and MOV when given', () => {
    const args = codecArgs(mp4, { hasAudio: false, videoEncoder: 'h264_videotoolbox' });
    expect(args.slice(0, 4)).toEqual(['-c:v', 'h264_videotoolbox', '-b:v', '6221k']);
    expect(args).toContain('-an');
  });

  it('MOV lossless: PNG pictures + PCM sound', () => {
    expect(tail({ ...mp4, container: 'mov', compression: 'lossless' })).toEqual([
      ...['-c:v', 'png', '-pix_fmt', 'rgb24', '-c:a', 'pcm_s16le'],
    ]);
  });

  it('AVI: MPEG-4 Part 2 + MP3, or lossless FFV1 + PCM', () => {
    expect(tail({ ...mp4, container: 'avi' })).toEqual([
      ...['-c:v', 'mpeg4', '-vtag', 'xvid', '-b:v', '12442k', '-pix_fmt', 'yuv420p'],
      ...['-c:a', 'libmp3lame', '-b:a', '192k'],
    ]);
    expect(tail({ ...mp4, container: 'avi', compression: 'lossless' })).toEqual([
      ...['-c:v', 'ffv1', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s16le'],
    ]);
  });

  it('WMV: Windows Media Video 8 (WMV2) + WMA2', () => {
    expect(tail({ ...mp4, container: 'wmv' })).toEqual([
      ...['-c:v', 'wmv2', '-b:v', '12442k', '-pix_fmt', 'yuv420p'],
      ...['-c:a', 'wmav2', '-b:a', '192k'],
    ]);
  });

  it('MPG: MPEG-2 + AC-3 in a DVD program stream; DVD sizes stay under the DVD bit rate limit', () => {
    const dvd = presetSettings('dvd-pal', hd);
    expect(tail(dvd)).toEqual([
      ...['-c:v', 'mpeg2video', '-b:v', '4147k', '-maxrate', '9000k', '-bufsize', '1835k'],
      ...['-g', '15', '-pix_fmt', 'yuv420p'],
      ...['-c:a', 'ac3', '-b:a', '192k', '-f', 'dvd'],
    ]);
  });

  it('a file with no sound has no audio stream', () => {
    expect(tail({ ...mp4, container: 'wmv' }, false)).toContain('-an');
  });

  it('lossless is refused for containers that do not offer it; sizes must be even', () => {
    expect(() => validateExport({ ...mp4, compression: 'lossless' })).toThrow(/MOV or AVI/);
    expect(() => validateExport({ ...mp4, width: 1919 })).toThrow(/even/);
    expect(() => validateExport({ ...mp4, width: 100 })).toThrow(/between/);
    expect(() => validateExport(mp4)).not.toThrow();
  });
});

describe('V17 presets, bit rates and estimated file size', () => {
  it('bit rate follows the number of pixels per second, the quality and the codec', () => {
    expect(videoKbps(mp4)).toBe(6221); // 1920 × 1080 × 30 × 0.1 bits
    expect(videoKbps({ ...mp4, quality: 'medium' })).toBe(3732);
    expect(videoKbps({ ...mp4, width: 1280, height: 720 })).toBe(2765);
    expect(videoKbps({ ...mp4, container: 'avi' })).toBe(12442); // older codecs need more bits
  });

  it('estimate = (video + audio bit rate) × length, plus a little for the container', () => {
    const { bytes, upTo } = estimateSize(mp4, 10, true);
    expect(upTo).toBe(false);
    expect(bytes / 1000).toBeCloseTo(((6221 + 192) * 10 * 1.01) / 8, 0);
    expect(estimateSize(mp4, 10, false).bytes).toBeLessThan(bytes);
  });

  it('lossless sizes depend on the picture, so the estimate is an upper limit', () => {
    const { bytes, upTo } = estimateSize(
      { ...mp4, container: 'avi', compression: 'lossless' },
      10,
      true,
    );
    expect(upTo).toBe(true);
    expect(bytes).toBeGreaterThan(estimateSize(mp4, 10, true).bytes * 20);
  });

  it.each([
    ['youtube', hd, { container: 'mp4', width: 1920, height: 1080, fps: 30 }],
    ['mobile-medium', hd, { container: 'mp4', width: 960, height: 540, quality: 'medium' }],
    ['mobile-medium', fourThree, { width: 960, height: 720 }], // Book B 11f: Android 960 × 720
    ['mobile-small', hd, { container: 'mp4', width: 640, height: 360, quality: 'low' }],
    ['dvd-pal', hd, { container: 'mpg', width: 720, height: 576, fps: 25 }],
    ['dvd-ntsc', hd, { container: 'mpg', width: 720, height: 480, fps: 29.97 }],
    ['bluray', hd, { container: 'mp4', width: 1920, height: 1080, quality: 'best' }],
  ] as const)('%s for a %o project', (id, settings, expected) => {
    expect(presetSettings(id, settings)).toMatchObject(expected);
  });

  it('every preset has a label and a short description, and Custom is last', () => {
    expect(PRESETS.map((p) => p.id).at(-1)).toBe('custom');
    for (const p of PRESETS) expect(p.label && p.hint).toBeTruthy();
  });
});

describe('T7 advantages and disadvantages of the chosen format', () => {
  it.each(
    Object.entries(CONTAINERS).flatMap(([id, c]) =>
      (c.lossless ? (['lossy', 'lossless'] as const) : (['lossy'] as const)).map(
        (comp) => [id, comp] as const,
      ),
    ),
  )('%s %s has a title, pros and cons', (container, compression) => {
    const notes = formatNotes(container as ExportSettings['container'], compression);
    expect(notes.title).toMatch(new RegExp(container, 'i'));
    expect(notes.pros.length).toBeGreaterThanOrEqual(2);
    expect(notes.cons.length).toBeGreaterThanOrEqual(2);
  });

  it('MP4 says it plays almost everywhere and that lossy loses detail for ever', () => {
    const notes = formatNotes('mp4', 'lossy');
    expect(notes.pros.join(' ')).toMatch(/almost all devices/i);
    expect(notes.cons.join(' ')).toMatch(/lost for ever/i);
  });
});
