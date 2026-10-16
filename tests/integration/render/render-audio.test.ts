// V13 with the bundled FFmpeg: music and voiceover tracks are heard where the timeline says.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import {
  assetFromProbe,
  createAudioItem,
  createProject,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import type { AudioItem, MediaAsset, Project } from '../../../src/core/model/types.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';
import { measure, rms } from '../helpers/measure.ts';

const engine = createNodeMediaEngine(bundledFfmpeg());
const CLIP = 'clip_1080p30_10s.mp4';
const MUSIC = 'music_stereo_45s.mp3';
const VOICE = 'voice_noisy.wav';
let media: string;
let clip: MediaAsset;
let music: MediaAsset;
let voice: MediaAsset;

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), 'mve-render-audio-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    media,
    selectFixtures(FIXTURES, 'test').filter((f) => [CLIP, MUSIC, VOICE].includes(f.name)),
  );
  const asset = async (name: string, id: string) =>
    assetFromProbe(name, await engine.probe(join(media, name)), { id });
  clip = await asset(CLIP, 'clip');
  music = await asset(MUSIC, 'music');
  voice = await asset(VOICE, 'voice');
});
afterAll(() => rm(media, { recursive: true, force: true }));

/** The 10 s clip with its own sound removed, plus the given audio tracks. */
async function render(name: string, audio: [AudioItem[], AudioItem[]]): Promise<string> {
  const p = createProject({ name });
  const project: Project = {
    ...p,
    media: [clip, music, voice],
    timeline: { ...p.timeline, main: [{ ...createVideoClip(clip), muted: true }], audio },
  };
  const output = join(media, `${name}.mp4`);
  await engine.renderVideo(project, output, { projectDir: media }).done;
  return output;
}

describe('V13 audio tracks rendered by FFmpeg', () => {
  it('music starting at 5.00 s: the first 5 s are silent, then the music plays to the end of the video', async () => {
    const file = await render('music-at-5', [[createAudioItem(music, 5)], []]);
    const m = await measure(file);
    expect(Math.abs(m.audioDuration! - 10)).toBeLessThan(0.05); // cut where the video ends
    expect(await rms(file, 0, 4.95)).toBeLessThan(0.001);
    expect(await rms(file, 5.05, 9.9)).toBeGreaterThan(0.2);
  });

  it('volume, fade out at the end of the video, and 6 dB lower under the voiceover', async () => {
    const quiet = { ...createAudioItem(voice, 2), volume: 0 }; // only its ducking is heard
    const file = await render('duck', [
      [{ ...createAudioItem(music, 0), volume: 0.5, fadeOut: 2, duck: true }],
      [{ ...quiet, out: 3 }],
    ]);
    const full = await rms(file, 0.2, 1.8);
    const ducked = await rms(file, 2.2, 4.8);
    expect(full).toBeGreaterThan(0.1);
    expect(20 * Math.log10(ducked / full)).toBeCloseTo(-6, 0);
    expect(await rms(file, 6, 7.5)).toBeCloseTo(full, 1); // back up after the voiceover
    expect(await rms(file, 9.9, 10)).toBeLessThan(full / 10); // faded out with the video
  });

  it('speed: 4 s of music at 2× plays for 2 s, then the rest is silent', async () => {
    const file = await render('fast', [[{ ...createAudioItem(music, 0), out: 4, speed: 2 }], []]);
    expect(await rms(file, 0.1, 1.9)).toBeGreaterThan(0.2);
    expect(await rms(file, 2.1, 9.9)).toBeLessThan(0.001);
  });
});
