// Text layers through real FFmpeg (V4–V7 for text): the PNGs stand in for the app's canvas.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../../scripts/lib/fixtures.ts';
import {
  assetFromProbe,
  createProject,
  createTextItem,
  createTitleSlide,
} from '../../../src/core/model/factory.ts';
import { setItemDuration } from '../../../src/core/model/timeline.ts';
import type { MainItem, MediaAsset, Project, TextItem } from '../../../src/core/model/types.ts';
import type { TextImage } from '../../../src/core/render/compile.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';
import { grayFrame, measure, tinyFrame } from '../helpers/measure.ts';

const engine = createNodeMediaEngine(bundledFfmpeg());
let dir: string;
let hd: MediaAsset;
let photo: MediaAsset;
let halfWhite: TextImage; // full frame, left half white, right half see-through
let creditsBlock: TextImage; // 1920 × 200, all white
let box: TextImage; // a 400 × 200 white box in the middle of a see-through frame

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-render-text-'));
  const wanted = ['clip_1080p30_10s.mp4', 'photo_3764x3092.jpg'];
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => wanted.includes(f.name)),
  );
  hd = assetFromProbe(
    'clip_1080p30_10s.mp4',
    await engine.probe(join(dir, 'clip_1080p30_10s.mp4')),
    {
      id: 'hd',
    },
  );
  photo = assetFromProbe(
    'photo_3764x3092.jpg',
    await engine.probe(join(dir, 'photo_3764x3092.jpg')),
    {
      id: 'photo',
    },
  );
  // A white rectangle padded with see-through pixels (drawbox would leave it see-through too).
  const png = async (name: string, white: string, width: number, height: number, at = '0:0') => {
    const path = join(dir, name);
    await run(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i'],
      `color=c=white:s=${white},format=rgba,pad=${width}:${height}:${at}:color=black@0`,
      ...['-frames:v', '1', '-y', path],
    ]);
    return { path, width, height };
  };
  halfWhite = await png('half.png', '960x1080', 1920, 1080);
  creditsBlock = await png('block.png', '1920x200', 1920, 200);
  box = { ...(await png('box.png', '400x200', 1920, 1080, '760:440')), anchor: { x: 960, y: 540 } };
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const black = (seconds: number, id = 'bg'): MainItem =>
  setItemDuration(createTitleSlide('', { id }), seconds);

async function render(
  main: MainItem[],
  text: TextItem[],
  textImages: Record<string, TextImage>,
  name: string,
) {
  const p = createProject({ name });
  const project: Project = { ...p, media: [hd, photo], timeline: { ...p.timeline, main, text } };
  const file = join(dir, name);
  await engine.renderVideo(project, file, { projectDir: dir, textImages }).done;
  return file;
}
const left = async (file: string, t: number) => (await tinyFrame(file, t)).columnBrightness(2);
const right = async (file: string, t: number) => (await tinyFrame(file, t)).columnBrightness(13);

describe('text in the exported video', () => {
  it('a caption shows only between its start and end, fading in', async () => {
    const caption = {
      ...createTextItem('caption', 'x', 1, { id: 'cap' }),
      duration: 2,
      fadeIn: 0.5,
    };
    const file = await render([black(4)], [caption], { cap: halfWhite }, 'caption.mp4');
    expect(await left(file, 0.5)).toBeLessThan(20);
    const fading = await left(file, 1.25);
    expect(fading).toBeGreaterThan(40);
    expect(fading).toBeLessThan(200);
    expect(await left(file, 2)).toBeGreaterThan(230);
    expect(await right(file, 2)).toBeLessThan(20); // see-through part shows the video
    expect(await left(file, 3.5)).toBeLessThan(20);
    expect((await measure(file)).videoDuration).toBeCloseTo(4, 1);
  });

  it('a title over a picture flies in from the left during its first second', async () => {
    const title = {
      ...setItemDuration(createTitleSlide('Welcome', { id: 't' }), 3),
      background: { kind: 'image' as const, assetId: 'photo' },
      entrance: 'fly-left' as const,
    };
    const file = await render([title], [], { t: halfWhite }, 'title-photo.mp4');
    const before = await left(file, 0.1);
    expect(await left(file, 2)).toBeGreaterThan(230);
    expect(before).toBeLessThan(200); // still off-screen to the left
  });

  it('a title over a video keeps the picture length and has no sound', async () => {
    const title = {
      ...setItemDuration(createTitleSlide('Hi', { id: 't' }), 2),
      background: { kind: 'video' as const, assetId: 'hd' },
    };
    const file = await render([title], [], { t: halfWhite }, 'title-video.mp4');
    const m = await measure(file);
    expect(m.videoDuration).toBeCloseTo(2, 1);
    expect(m.audioDuration).toBeUndefined();
  });

  it('credits scroll up from below the frame', async () => {
    const credits = { ...createTextItem('credits', 'x', 0, { id: 'c' }), duration: 4 };
    const file = await render([black(4)], [credits], { c: creditsBlock }, 'credits.mp4');
    const rows = async (t: number) => {
      const f = await tinyFrame(file, t);
      return [0, 2, 4, 6, 8].map((y) => f.at(8, y)[0]);
    };
    // At 2 s the block's top is at 1080 − ½ × (1080 + 200) = 440: the middle row.
    const [, , middle] = await rows(2);
    expect(middle).toBeGreaterThan(200);
    expect((await rows(0.2)).slice(0, 4).every((v) => v < 20)).toBe(true);
  });

  it('more text animations: zoom grows around the middle of the words, drop falls from above', async () => {
    const caption = (entrance: 'zoom' | 'drop'): TextItem => ({
      ...setItemDuration(createTextItem('caption', 'Box', 0, { id: 'c' }), 3),
      entrance,
    });
    const zoom = await render([black(3)], [caption('zoom')], { c: box }, 'zoom.mp4');
    const half = (await grayFrame(zoom, 0.5)).brightBox()!;
    const full = (await grayFrame(zoom, 2)).brightBox()!;
    expect(full.x1 - full.x0).toBeCloseTo(400, -1);
    // At 0.5 s the zoom is 87.5 % of the way: 350 × 175, still centred on the middle.
    expect(half.x1 - half.x0).toBeCloseTo(350, -1);
    expect((half.x0 + half.x1) / 2).toBeCloseTo(960, -1);
    expect((half.y0 + half.y1) / 2).toBeCloseTo(540, -1);

    const drop = await render([black(3)], [caption('drop')], { c: box }, 'drop.mp4');
    const falling = (await grayFrame(drop, 0.1)).brightBox();
    expect(falling === null || falling.y1 < 440).toBe(true); // still above its place
    expect((await grayFrame(drop, 2)).brightBox()!.y0).toBeCloseTo(440, -1);
  });
});
