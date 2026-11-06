// V20: pictures and videos over the video through real FFmpeg. The pixels are checked where the
// preview puts the picture (overlayBox), so the preview and the export agree.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  assetFromProbe,
  createProject,
  createTitleSlide,
} from '../../../src/core/model/factory.ts';
import { createOverlayItem } from '../../../src/core/model/overlay.ts';
import { setItemDuration } from '../../../src/core/model/timeline.ts';
import type { MediaAsset, OverlayItem, Project } from '../../../src/core/model/types.ts';
import { overlayBox } from '../../../src/core/render/overlay.ts';
import { createNodeMediaEngine } from '../../../src/main/media/engine.ts';
import { bundledFfmpeg, run } from '../helpers/ffmpeg.ts';
import { measure } from '../helpers/measure.ts';

const engine = createNodeMediaEngine(bundledFfmpeg());
const execBuffer = promisify(execFile);
const HD = { width: 1920, height: 1080 };
let dir: string;
let logo: MediaAsset; // 400 × 200, red
let pip: MediaAsset; // 2 s, 320 × 240, blue, with a tone

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-render-overlay-'));
  const { ffmpeg } = bundledFfmpeg();
  await run(ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=400x200'],
    ...['-frames:v', '1', '-y', join(dir, 'Logo.png')],
  ]);
  await run(ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:r=30:d=2'],
    ...['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'],
    ...['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest'],
    ...['-y', join(dir, 'Clip2.mp4')],
  ]);
  logo = assetFromProbe('Logo.png', await engine.probe(join(dir, 'Logo.png')), { id: 'logo' });
  pip = assetFromProbe('Clip2.mp4', await engine.probe(join(dir, 'Clip2.mp4')), { id: 'pip' });
});
afterAll(() => rm(dir, { recursive: true, force: true }));

/** 4 s of black, with these over it. */
async function render(overlay: OverlayItem[], name: string) {
  const p = createProject({ name });
  const project: Project = {
    ...p,
    media: [logo, pip],
    timeline: {
      ...p.timeline,
      main: [setItemDuration(createTitleSlide('', { id: 'bg' }), 4)],
      overlay,
    },
  };
  const file = join(dir, name);
  await engine.renderVideo(project, file, { projectDir: dir, textImages: {} }).done;
  return file;
}

/** The whole frame at `time`, as RGB pixels. */
async function frame(file: string, time: number) {
  const { stdout } = await execBuffer(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-ss', String(time), '-i', file, '-frames:v', '1'],
      ...['-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
    ],
    { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 },
  );
  return (x: number, y: number) =>
    [...stdout.subarray((y * HD.width + x) * 3, (y * HD.width + x) * 3 + 3)] as number[];
}

const isRed = ([r, g, b]: number[]) => r! > 200 && g! < 60 && b! < 60;
const isBlue = ([r, g, b]: number[]) => b! > 200 && r! < 60 && g! < 60;
const isBlack = (c: number[]) => c.every((v) => v < 30);

describe('V20 pictures and videos over the video in the exported file', () => {
  // Made when the files are ready (their assets come from the probe).
  const logoItem = () => createOverlayItem(logo, 1, { id: 'o', duration: 2 });
  const pipItem = (): OverlayItem => ({
    ...createOverlayItem(pip, 2, { id: 'p' }),
    position: 'bottom-left',
  });

  it('V20: a logo in the top-right corner and a video in the bottom-left, each only in its time', async () => {
    const file = await render([logoItem(), pipItem()], 'overlay-v20-both.mp4');
    expect(await measure(file)).toMatchObject({
      width: 1920,
      height: 1080,
      audioDuration: undefined,
    });
    const a = overlayBox(HD, { width: 400, height: 200 }, logoItem());
    const b = overlayBox(HD, { width: 320, height: 240 }, pipItem());
    expect(a).toEqual({ x: 1420, y: 20, width: 480, height: 240 });

    const before = await frame(file, 0.5);
    expect(isBlack(before(a.x + 10, a.y + 10))).toBe(true);

    const during = await frame(file, 2.5);
    // Inside the logo's box, near each corner; black just outside it.
    expect(isRed(during(a.x + 4, a.y + 4))).toBe(true);
    expect(isRed(during(a.x + a.width - 5, a.y + a.height - 5))).toBe(true);
    expect(isBlack(during(a.x - 5, a.y + 20))).toBe(true);
    expect(isBlack(during(a.x + 20, a.y + a.height + 5))).toBe(true);
    expect(isBlack(during(a.x + a.width + 5, a.y + 20))).toBe(true);
    // The video over the video, in its box.
    expect(isBlue(during(b.x + 4, b.y + 4))).toBe(true);
    expect(isBlue(during(b.x + b.width - 5, b.y + b.height - 5))).toBe(true);
    expect(isBlack(during(b.x + b.width + 5, b.y + 20))).toBe(true);
    expect(isBlack(during(b.x + 20, b.y - 5))).toBe(true);
    // The middle of the frame is untouched.
    expect(isBlack(during(960, 540))).toBe(true);

    const after = await frame(file, 3.5);
    expect(isBlack(after(a.x + 10, a.y + 10))).toBe(true);
  });

  it('V20: half see-through: the picture is half as bright over black', async () => {
    const file = await render([{ ...logoItem(), opacity: 0.5 }], 'overlay-v20-half.mp4');
    const a = overlayBox(HD, { width: 400, height: 200 }, logoItem());
    const [r, g] = (await frame(file, 2))(a.x + 40, a.y + 40);
    expect(r).toBeGreaterThan(100);
    expect(r).toBeLessThan(160);
    expect(g).toBeLessThan(40);
  });

  it('V20: a video over the video with its sound on gives the file sound, for the whole video', async () => {
    const heard = { ...pipItem(), muted: false } as OverlayItem;
    const file = await render([heard], 'overlay-v20-sound.mp4');
    const m = await measure(file);
    expect(m.audioDuration).toBeCloseTo(4, 1);
    expect(m.videoDuration).toBeCloseTo(4, 1);
  });
});
