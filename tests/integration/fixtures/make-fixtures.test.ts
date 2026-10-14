import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';

interface ProbeStream {
  codec_type: string;
  codec_name: string;
  width?: number;
  height?: number;
  channels?: number;
  sample_rate?: string;
}

async function probe(file: string) {
  const { stdout } = await run(bundledFfmpeg().ffprobe, [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    file,
  ]);
  const json = JSON.parse(stdout) as { streams: ProbeStream[]; format: { duration?: string } };
  return {
    video: json.streams.find((s) => s.codec_type === 'video'),
    audio: json.streams.find((s) => s.codec_type === 'audio'),
    duration: Number(json.format.duration ?? NaN),
  };
}

describe('make-fixtures generates media that matches each spec', () => {
  let dir: string;
  const specs = selectFixtures(FIXTURES, 'test');

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'mve-fixtures-'));
    await generateFixtures(bundledFfmpeg().ffmpeg, dir, specs);
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it.each(specs.map((s) => [s.name, s] as const))('%s', async (name, spec) => {
    const info = await probe(join(dir, name));
    const { video, audio, durationS } = spec.expect;
    if (video) {
      expect(info.video).toMatchObject({
        codec_name: video.codec,
        width: video.width,
        height: video.height,
      });
    } else {
      expect(info.video).toBeUndefined();
    }
    if (audio) {
      expect(info.audio).toMatchObject({
        codec_name: audio.codec,
        channels: audio.channels,
        sample_rate: String(audio.sampleRate),
      });
    } else {
      expect(info.audio).toBeUndefined();
    }
    if (durationS !== undefined) expect(Math.abs(info.duration - durationS)).toBeLessThan(0.1);
  });
});
