import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';

const { version } = JSON.parse(
  readFileSync(new URL('../../../scripts/ffmpeg-manifest.json', import.meta.url), 'utf8'),
);

describe('X5 bundled FFmpeg runs on this platform', () => {
  it('ffmpeg reports the pinned version', async () => {
    const { stdout } = await run(bundledFfmpeg().ffmpeg, ['-hide_banner', '-version']);
    expect(stdout).toContain(`ffmpeg version ${version}`);
  });

  it('ffprobe reports the pinned version', async () => {
    const { stdout } = await run(bundledFfmpeg().ffprobe, ['-hide_banner', '-version']);
    expect(stdout).toContain(`ffprobe version ${version}`);
  });

  it.each(['libx264', 'aac', 'libmp3lame', 'wmv2', 'mpeg4', 'ffv1', 'prores_ks', 'mpeg2video'])(
    'includes the %s encoder needed for exports',
    async (encoder) => {
      const { stdout } = await run(bundledFfmpeg().ffmpeg, ['-hide_banner', '-encoders']);
      expect(stdout).toMatch(new RegExp(`\\s${encoder}\\s`));
    },
  );
});
