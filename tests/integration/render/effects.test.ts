// Every registry effect and transition is a valid filter for the bundled FFmpeg (P6).
import { describe, expect, it } from 'vitest';
import { defaultParams, EFFECTS, TRANSITIONS } from '../../../src/core/effects/registry.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';

const ffmpeg = (args: string[]) => run(bundledFfmpeg().ffmpeg, ['-v', 'error', ...args]);
const SOURCE = 'testsrc2=s=320x180:r=30:d=1';

describe('registry filters run in the bundled FFmpeg', () => {
  it.each(EFFECTS.map((e) => [e.id, e] as const))('%s', async (_, e) => {
    const params = Object.fromEntries(
      Object.entries(e.params).map(([k, p]) => [k, p.default === 0 ? p.max / 2 : p.default]),
    );
    const filter = e.render({ ...defaultParams(e), ...params });
    expect(filter).not.toBe('');
    await ffmpeg([
      '-f',
      'lavfi',
      '-i',
      SOURCE,
      '-vf',
      `${filter},format=yuv420p`,
      '-f',
      'null',
      '-',
    ]);
  });
});

describe('registry transitions run in the bundled FFmpeg', () => {
  it.each(TRANSITIONS.map((t) => [t.id, t] as const))('%s', async (_, t) => {
    await ffmpeg([
      ...['-f', 'lavfi', '-i', SOURCE, '-f', 'lavfi', '-i', 'color=c=red:s=320x180:r=30:d=1'],
      ...[
        '-filter_complex',
        `[0:v][1:v]xfade=transition=${t.xfade}:duration=0.5:offset=0.4,format=yuv420p`,
      ],
      ...['-f', 'null', '-'],
    ]);
  });
});
