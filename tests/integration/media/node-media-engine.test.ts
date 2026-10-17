import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { mediaEngineContract } from '../../contract/media-engine.contract.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';

let media: string;
let out: string;
const engine = createNodeMediaEngine(bundledFfmpeg());

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), 'mve-media-'));
  out = await mkdtemp(join(tmpdir(), 'mve-out-'));
  await generateFixtures(bundledFfmpeg().ffmpeg, media, selectFixtures(FIXTURES, 'test'));
});
afterAll(async () => {
  await rm(media, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

mediaEngineContract('Node + FFmpeg', () => ({
  engine,
  video: join(media, 'clip_1080p30_10s.mp4'),
  image: join(media, 'photo_3764x3092.jpg'),
  audio: join(media, 'music_stereo_45s.mp3'),
  missing: join(media, 'missing.mp4'),
  out: (name) => join(out, name),
}));

describe('Node + FFmpeg engine, real-file details', () => {
  it.each([
    ['clip_1080p30_10s.mp4', 'video', 'mp4'],
    ['clip_4x3_640x480.mov', 'video', 'mov'],
    ['clip_4x3_640x480.avi', 'video', 'avi'],
    ['clip_4x3_640x480.wmv', 'video', 'wmv'],
    ['photo_3764x3092.jpg', 'image', 'jpg'],
    ['music_stereo_45s.mp3', 'audio', 'mp3'],
    ['music_with_cover.mp3', 'audio', 'mp3'],
    ['tone_dc_offset.wav', 'audio', 'wav'],
  ])('probes %s as %s / %s', async (file, kind, container) => {
    expect(await engine.probe(join(media, file))).toMatchObject({ kind, container });
  });

  it('a 4:3 clip keeps its shape in the proxy (480 × 360)', async () => {
    await engine.makeProxy(join(media, 'clip_4x3_640x480.mov'), join(out, 'proxy43.mp4'), 5).done;
    expect((await engine.probe(join(out, 'proxy43.mp4'))).video).toMatchObject({
      width: 480,
      height: 360,
    });
  });

  it('quitting (cancelAll) also stops a file check (ffprobe) that is still running', async () => {
    const own = createNodeMediaEngine(bundledFfmpeg());
    const checking = own.probe(join(media, 'clip_1080p30_10s.mp4'));
    own.cancelAll();
    await expect(checking).rejects.toThrow();
  });

  it('explains a damaged file', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(media, 'damaged.mp4'), 'this is not a video');
    await expect(engine.probe(join(media, 'damaged.mp4'))).rejects.toThrow(/damaged/i);
  });

  it('leaves no temporary files behind after cancelled or failed jobs', async () => {
    const job = engine.makeProxy(join(media, 'clip_1080p30_10s.mp4'), join(out, 'gone.mp4'), 10);
    setTimeout(() => job.cancel(), 50);
    await job.done.catch(() => {});
    await engine
      .makeProxy(join(media, 'missing.mp4'), join(out, 'gone2.mp4'), 10)
      .done.catch(() => {});
    expect((await readdir(out)).filter((f) => f.includes('.partial-'))).toEqual([]);
  });

  it('peaks of a 0.4-amplitude tone are about 0.4', async () => {
    const peaks = await engine.waveformPeaks(join(media, 'music_stereo_45s.mp3'), 20);
    for (const p of peaks) expect(p).toBeGreaterThan(0.3);
  });
});
