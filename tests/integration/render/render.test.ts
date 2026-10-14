import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import {
  assetFromProbe,
  createImageClip,
  createProject,
  createTitleSlide,
  createVideoClip,
} from '../../../src/core/model/factory.ts';
import { setItemDuration, setVideoSpeed, trimVideo } from '../../../src/core/model/timeline.ts';
import type {
  MainItem,
  MediaAsset,
  Project,
  ProjectSettings,
} from '../../../src/core/model/types.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../helpers/ffmpeg.ts';
import { measure, tinyFrame } from '../helpers/measure.ts';

const FRAME = 1 / 30;
const engine = createNodeMediaEngine(bundledFfmpeg());
let media: string;
let out: string;
let hd: MediaAsset; // 1920×1080, 10 s, with sound
let fourThree: MediaAsset; // 640×480, 5 s, with sound
let photo: MediaAsset; // 3764×3092

beforeAll(async () => {
  media = await mkdtemp(join(tmpdir(), 'mve-render-media-'));
  out = await mkdtemp(join(tmpdir(), 'mve-render-out-'));
  const wanted = ['clip_1080p30_10s.mp4', 'clip_4x3_640x480.mov', 'photo_3764x3092.jpg'];
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    media,
    selectFixtures(FIXTURES, 'test').filter((f) => wanted.includes(f.name)),
  );
  const asset = async (name: string, id: string) =>
    assetFromProbe(name, await engine.probe(join(media, name)), { id });
  hd = await asset('clip_1080p30_10s.mp4', 'hd');
  fourThree = await asset('clip_4x3_640x480.mov', '43');
  photo = await asset('photo_3764x3092.jpg', 'photo');
});
afterAll(async () => {
  await rm(media, { recursive: true, force: true });
  await rm(out, { recursive: true, force: true });
});

function project(main: MainItem[], settings: Partial<ProjectSettings> = {}): Project {
  const p = createProject({ name: 'Render test' });
  return {
    ...p,
    settings: { ...p.settings, ...settings },
    media: [hd, fourThree, photo],
    timeline: { ...p.timeline, main },
  };
}
async function render(p: Project, name: string) {
  await engine.renderVideo(p, join(out, name), { projectDir: media }).done;
  return join(out, name);
}

describe('rendered files match the timeline (V1–V3, V12–V14)', () => {
  it('a still then a trimmed clip: exact length within one frame, sound as long as picture', async () => {
    const file = await render(
      project([
        setItemDuration(createImageClip(photo, { id: 'i' }), 2),
        trimVideo(createVideoClip(hd, { id: 'c' }), { in: 3, out: 4.5 }, hd),
      ]),
      'still-then-clip.mp4',
    );
    const m = await measure(file);
    expect([m.width, m.height]).toEqual([1920, 1080]);
    expect(Math.abs(m.videoDuration - 3.5)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(Math.abs(m.audioDuration! - 3.5)).toBeLessThan(0.05);
  });

  it.each([
    [0.25, { in: 0, out: 1 }, 4],
    [4, { in: 0, out: 8 }, 2],
  ])('speed %f× of %j lasts %f s, sound too', async (speed, range, expected) => {
    const clip = setVideoSpeed(trimVideo(createVideoClip(hd, { id: 'c' }), range, hd), speed);
    const m = await measure(await render(project([clip]), `speed-${speed}.mp4`));
    expect(Math.abs(m.videoDuration - expected)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(Math.abs(m.audioDuration! - expected)).toBeLessThan(0.05);
  });

  it.each([
    ['letterbox', true],
    ['crop', false],
    ['stretch', false],
  ] as const)(
    'a 4:3 clip in a 16:9 project, fit "%s": black bars at the edge = %s',
    async (fit, bars) => {
      const clip = trimVideo(createVideoClip(fourThree, { id: 'c' }), { in: 0, out: 2 }, fourThree);
      const file = await render(project([clip], { fit }), `fit-${fit}.mp4`);
      const m = await measure(file);
      expect([m.width, m.height]).toEqual([1920, 1080]);
      const frame = await tinyFrame(file, 1);
      if (bars) expect(frame.columnBrightness(0)).toBeLessThan(40);
      else expect(frame.columnBrightness(0)).toBeGreaterThan(40);
    },
  );

  it('a red title slide is a red frame', async () => {
    const red = {
      ...setItemDuration(createTitleSlide('', { id: 't' }), 1),
      background: { kind: 'colour' as const, colour: '#ff0000' },
    };
    const [r, g, b] = (await tinyFrame(await render(project([red]), 'red.mp4'), 0.5)).at(8, 4);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});
