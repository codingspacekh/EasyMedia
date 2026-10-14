import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { FIXTURES, ffmpegArgs, selectFixtures } from '../../../scripts/lib/fixtures.ts';

describe('test fixture definitions (MILESTONES §3.2)', () => {
  it('provides every fixture the milestones rely on', () => {
    expect(FIXTURES.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        'clip_1080p30_10s.mp4',
        'clip_4x3_640x480.mov',
        'clip_4x3_640x480.avi',
        'clip_4x3_640x480.wmv',
        'photo_3764x3092.jpg',
        'music_stereo_45s.mp3',
        'tone_dc_offset.wav',
        'voice_noisy.wav',
        'music_with_cover.mp3',
        'spike_1080p30_60s.mp4',
      ]),
    );
  });

  it('has unique names', () => {
    const names = FIXTURES.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('describes what each file must contain, so it can be verified', () => {
    for (const f of FIXTURES) {
      expect(f.expect.video ?? f.expect.audio, f.name).toBeDefined();
    }
  });

  it('keeps the heavy spike clip out of the default "test" group', () => {
    const names = selectFixtures(FIXTURES, 'test').map((f) => f.name);
    expect(names).not.toContain('spike_1080p30_60s.mp4');
    expect(names).toContain('clip_1080p30_10s.mp4');
    expect(selectFixtures(FIXTURES, 'spike').map((f) => f.name)).toEqual(['spike_1080p30_60s.mp4']);
  });

  it('builds quiet, overwriting ffmpeg arguments ending with the output file', () => {
    const spec = FIXTURES.find((f) => f.name === 'photo_3764x3092.jpg')!;
    const args = ffmpegArgs(spec, '/tmp/out');
    expect(args.slice(0, 4)).toEqual(['-hide_banner', '-loglevel', 'error', '-y']);
    expect(args).toContain('-frames:v');
    expect(args.at(-1)).toBe(join('/tmp/out', 'photo_3764x3092.jpg'));
  });
});
