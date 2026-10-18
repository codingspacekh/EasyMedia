// T3 with the bundled FFmpeg: the compression comparison makes real files, and their real sizes
// show what lossy and lossless compression do.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import { createLearnApp } from '../../../src/app/learn.ts';
import type { Dialogs, ProjectFiles } from '../../../src/core/ports.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';

const engine = createNodeMediaEngine(bundledFfmpeg());
const CLIP = 'clip_1080p30_10s.mp4';
const MUSIC = 'music_stereo_45s.mp3';
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-learn-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [CLIP, MUSIC].includes(f.name)),
  );
});
afterAll(() => rm(dir, { recursive: true, force: true }));

function learnApp() {
  const learn = createLearnApp({
    engine,
    dialogs: {} as Dialogs,
    files: {} as ProjectFiles,
    paths: {
      proxies: dir,
      recovery: join(dir, 'r.mve'),
      snapshots: dir,
      learn: join(dir, 'learn'),
    },
  });
  return { learn, state: () => learn.store.get() };
}

describe('T3 compression comparison with real files', () => {
  it('audio: WAV is biggest, FLAC smaller, MP3 smaller again as its bit rate falls', async () => {
    const { learn, state } = learnApp();
    await learn.inspect(join(dir, MUSIC));
    await learn.compareAudio();
    expect(state().message).toBeNull();
    const items = state().comparison!.items;
    const [wav, flac, mp3_192, mp3_128, mp3_64] = items;
    // 10 s × 44 100 Hz × 16 bits × 2 channels ÷ 8 = 1 764 000 bytes, plus the header.
    expect(Math.abs(wav!.bytes - 1_764_000)).toBeLessThan(200);
    expect(flac!.bytes).toBeLessThan(wav!.bytes);
    // A constant bit rate: 10 s at 128 kbit/s ≈ 160 000 bytes.
    expect(mp3_128!.bytes / 160_000).toBeGreaterThan(0.9);
    expect(mp3_128!.bytes / 160_000).toBeLessThan(1.1);
    expect(mp3_192!.bytes).toBeGreaterThan(mp3_128!.bytes);
    expect(mp3_64!.bytes).toBeLessThan(mp3_128!.bytes);
    expect(mp3_128!.saving).toBeGreaterThan(0.9);
    const probes = await Promise.all(items.map((i) => engine.probe(i.path)));
    expect(probes.map((p) => p.audio!.codec)).toEqual(['pcm_s16le', 'flac', 'mp3', 'mp3', 'mp3']);
    for (const p of probes) expect(Math.abs(p.duration! - 10)).toBeLessThan(0.1);
  });

  it('video: lossless is far bigger than MP4, and a smaller picture is smaller again', async () => {
    const { learn, state } = learnApp();
    await learn.inspect(join(dir, CLIP));
    await learn.compareVideo();
    expect(state().message).toBeNull();
    const items = state().comparison!.items;
    const sizes = items.map((i) => i.bytes);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
    expect(sizes[0]! / sizes[1]!).toBeGreaterThan(5);
    const probes = await Promise.all(items.map((i) => engine.probe(i.path)));
    expect(
      probes.map((p) => [p.container, p.video!.codec, p.video!.width, p.video!.height]),
    ).toEqual([
      ['avi', 'ffv1', 1920, 1080],
      ['mp4', 'h264', 1920, 1080],
      ['mp4', 'h264', 640, 360],
      ['mp4', 'h264', 426, 240],
    ]);
    for (const p of probes) expect(Math.abs(p.duration! - 5)).toBeLessThan(0.1);
  });
});
