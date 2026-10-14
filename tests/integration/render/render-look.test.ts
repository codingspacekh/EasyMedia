// Fades, filters, pan & zoom and transitions through real FFmpeg (V7, V8, V9, V15).
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
import { setItemDuration, trimVideo } from '../../../src/core/model/timeline.ts';
import type { MainItem, MediaAsset, Project, TitleSlide } from '../../../src/core/model/types.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';
import { brightness, measure, tinyFrame } from '../helpers/measure.ts';

const FRAME = 1 / 30;
const engine = createNodeMediaEngine(bundledFfmpeg());
let dir: string;
let hd: MediaAsset; // test pattern with sound, 10 s
let halves: MediaAsset; // left half black, right half white

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-render-look-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === 'clip_1080p30_10s.mp4'),
  );
  hd = assetFromProbe(
    'clip_1080p30_10s.mp4',
    await engine.probe(join(dir, 'clip_1080p30_10s.mp4')),
    {
      id: 'hd',
    },
  );
  await run(bundledFfmpeg().ffmpeg, [
    ...[
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=white:s=960x1080,pad=1920:1080:960:0:color=black',
    ],
    ...['-frames:v', '1', '-y', join(dir, 'halves.png')],
  ]);
  halves = assetFromProbe('halves.png', await engine.probe(join(dir, 'halves.png')), {
    id: 'halves',
  });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

async function render(main: MainItem[], name: string) {
  const p = createProject({ name });
  const project: Project = { ...p, media: [hd, halves], timeline: { ...p.timeline, main } };
  const file = join(dir, name);
  await engine.renderVideo(project, file, { projectDir: dir }).done;
  return file;
}
const clip = (id: string, from: number, to: number) =>
  trimVideo(createVideoClip(hd, { id }), { in: from, out: to }, hd);
const still = (id: string, seconds: number) =>
  setItemDuration(createImageClip(halves, { id }), seconds);

describe('looks in the exported video', () => {
  it('V7 fades in from black and out to black, with the sound', async () => {
    const file = await render(
      [{ ...clip('v', 0, 4), fade: { in: 1, out: 1, colour: 'black' } }],
      'fade.mp4',
    );
    expect(await brightness(file, 0.02)).toBeLessThan(25);
    expect(await brightness(file, 2)).toBeGreaterThan(40);
    expect(await brightness(file, 3.95)).toBeLessThan(25);
    expect(Math.abs((await measure(file)).videoDuration - 4)).toBeLessThanOrEqual(FRAME + 0.001);
  });

  it('V7 fades to white', async () => {
    const file = await render(
      [{ ...clip('v', 0, 2), fade: { in: 0, out: 1, colour: 'white' } }],
      'white.mp4',
    );
    expect(await brightness(file, 1.95)).toBeGreaterThan(230);
  });

  it('V15 black & white leaves no colour', async () => {
    const file = await render(
      [{ ...clip('v', 0, 2), effects: [{ effectId: 'video.blackwhite', params: {} }] }],
      'bw.mp4',
    );
    const frame = await tinyFrame(file, 1);
    for (let x = 0; x < 16; x++) {
      const [r, g, b] = frame.at(x, 4);
      expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(12);
    }
  });

  it('V8 zooming into the white half fills the frame with white by the end', async () => {
    const file = await render(
      [
        {
          ...still('s', 3),
          panZoom: { from: { zoom: 1, x: 0.5, y: 0.5 }, to: { zoom: 2, x: 0.75, y: 0.5 } },
        },
      ],
      'zoom.mp4',
    );
    const start = await tinyFrame(file, 0.02);
    expect(start.columnBrightness(2)).toBeLessThan(30); // the black half shows at first
    const end = await tinyFrame(file, 2.95);
    expect(end.columnBrightness(2)).toBeGreaterThan(220);
    expect(end.columnBrightness(13)).toBeGreaterThan(220);
    expect(Math.abs((await measure(file)).videoDuration - 3)).toBeLessThanOrEqual(FRAME + 0.001);
  });

  it('V9 a 1 s dissolve blends the two clips and shortens the video by 1 s, sound too', async () => {
    const file = await render(
      [
        { ...title('#000000', 'black'), duration: 2 },
        {
          ...title('#ffffff', 'white'),
          duration: 2,
          transitionIn: { effectId: 'transition.dissolve', duration: 1 },
        },
        { ...clip('v', 0, 2), transitionIn: { effectId: 'transition.fadeblack', duration: 0.5 } },
      ],
      'dissolve.mp4',
    );
    const m = await measure(file);
    expect(Math.abs(m.videoDuration - 4.5)).toBeLessThanOrEqual(FRAME + 0.001);
    expect(Math.abs(m.audioDuration! - 4.5)).toBeLessThan(0.05);
    expect(await brightness(file, 0.5)).toBeLessThan(25);
    const halfway = await brightness(file, 1.5);
    expect(halfway).toBeGreaterThan(90);
    expect(halfway).toBeLessThan(170);
    expect(await brightness(file, 2.5)).toBeGreaterThan(230);
  });

  it('V10 a snapshot at 16.66 s (text hidden) is the clip frame itself', async () => {
    const p = createProject({ name: 'snap' });
    const project: Project = {
      ...p,
      media: [hd, halves],
      timeline: {
        ...p.timeline,
        main: [{ ...title('#000000', 't'), duration: 10 }, clip('v', 0, 10)],
      },
    };
    const snap = join(dir, 'snap.png');
    await engine.renderFrame(project, 16.66, snap, { projectDir: dir });
    const direct = join(dir, 'direct.png');
    await engine.extractFrame(join(dir, 'clip_1080p30_10s.mp4'), 6.66, direct);
    const [a, b] = [await tinyFrame(snap, 0), await tinyFrame(direct, 0)];
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 16; x++)
        a.at(x, y).forEach((v, i) => expect(Math.abs(v - b.at(x, y)[i]!)).toBeLessThan(10));
  });
});

function title(colour: string, id: string): TitleSlide {
  return { ...createTitleSlide('', { id }), background: { kind: 'colour', colour } };
}
