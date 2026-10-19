// M12: an installed EasyMedia checks itself (CI starts each packaged app with EASYMEDIA_SELF_CHECK):
// its FFmpeg runs, its pages and every bundled font are there.
import { describe, expect, it } from 'vitest';
import { selfCheck, type SelfCheckDeps } from '../../../src/main/self-check.ts';
import { FONTS } from '../../../src/core/text/fonts.ts';

const FONT_FILES = FONTS.map((f) => `${f.name.replace(/ /g, '')}-abc123.ttf`);

function deps(change: Partial<SelfCheckDeps> = {}): SelfCheckDeps {
  return {
    binaries: { ffmpeg: '/r/ffmpeg', ffprobe: '/r/ffprobe' },
    pagesDir: '/app/dist',
    run: async (bin) => `${bin.endsWith('ffprobe') ? 'ffprobe' : 'ffmpeg'} version 9.0.2 Copyright`,
    exists: async () => true,
    list: async () => FONT_FILES,
    ...change,
  };
}

describe('self-check of an installed app', () => {
  it('passes when FFmpeg and ffprobe run and the pages and fonts are there', async () => {
    const result = await selfCheck(deps());
    expect(result.ok).toBe(true);
    expect(result.checks.map((c) => c.name)).toEqual(['ffmpeg', 'ffprobe', 'pages', 'fonts']);
    expect(result.checks[0]!.detail).toBe('ffmpeg version 9.0.2');
  });

  it('fails, saying why, when FFmpeg cannot run', async () => {
    const result = await selfCheck(
      deps({
        run: async () => {
          throw new Error('spawn /r/ffmpeg ENOENT');
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.checks[0]).toEqual({
      name: 'ffmpeg',
      ok: false,
      detail: 'spawn /r/ffmpeg ENOENT',
    });
  });

  it('fails when a bundled font is missing from the pages', async () => {
    const result = await selfCheck(deps({ list: async () => FONT_FILES.slice(1) }));
    expect(result.checks.find((c) => c.name === 'fonts')).toMatchObject({
      ok: false,
      detail: expect.stringContaining('Inter'),
    });
  });
});
