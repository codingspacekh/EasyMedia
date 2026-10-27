// M14 through the real app: Animation mode's timeline and export. Workbook Task 1.1's circle
// moves from (0, 0) to (396, 196) over 3 s; the playhead at 1.50 s shows it halfway; the
// animation is exported as an MP4 and an animated GIF that FFmpeg checks.
import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp } from './app.ts';

const execFileAsync = promisify(execFile);
let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m14-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function type(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Tab');
}

async function goTo(page: Page, time: string) {
  const box = page.getByLabel('Go to frame');
  await box.fill(time);
  await box.press('Enter');
}

async function exportAs(page: Page, format: RegExp) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Export animation' });
  await box.getByRole('radio', { name: format }).check();
  await box.getByRole('button', { name: 'Export file' }).click();
  await expect(box).toBeHidden({ timeout: 60_000 });
}

test('Task 1.1: a circle tweened over 3 s, seen halfway at 1.50 s, exported as MP4 and GIF', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();

  // The stage: 600 × 400, 3 s at 24 fps.
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const settings = page.getByRole('dialog', { name: 'Stage settings' });
  await type(page, 'Width', '600');
  await type(page, 'Height', '400');
  await type(page, 'Length', '72');
  await settings.getByRole('button', { name: 'Apply' }).click();

  // The circle, radius 102 at (0, 0), moved to (396, 196) at 3 s.
  await page.getByRole('button', { name: 'Ellipse' }).click();
  const stage = page.getByRole('application', { name: 'Stage' });
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6, { steps: 5 });
  await page.mouse.up();
  for (const [label, value] of [
    ['X', '0'],
    ['Y', '0'],
    ['W', '204'],
    ['H', '204'],
  ])
    await type(page, label, value);
  await goTo(page, '3 s');
  await type(page, 'X', '396');
  await type(page, 'Y', '196');
  await expect(page.getByRole('button', { name: 'X keyframe at frame 72' })).toBeVisible();

  await goTo(page, '1.5 s');
  await expect(page.getByText('0:01.50 · frame 36')).toBeVisible();
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('198.00');
  await expect(page.getByLabel('Y', { exact: true })).toHaveValue('98.00');

  // MP4: 600 × 400, 24 fps, 3.00 s, H.264.
  const mp4 = join(dir, 'Chapter07_Task1_1.mp4');
  await answerDialogs(app, { exportTo: mp4 });
  await exportAs(page, /MP4 video/);
  await expect.poll(() => exists(mp4), { timeout: 60_000 }).toBe(true);
  await expect(page.getByText(/Saved Chapter07_Task1_1\.mp4/)).toBeVisible();
  const engine = createNodeMediaEngine(bundledFfmpeg());
  const info = await engine.probe(mp4);
  expect(info.video).toMatchObject({ codec: 'h264', width: 600, height: 400, fps: 24 });
  expect(info.duration).toBeCloseTo(3, 1);

  // The circle really moves: the first and the middle frame differ where it starts.
  const pixel = async (time: string) => {
    const { stdout } = await execFileAsync(
      bundledFfmpeg().ffmpeg,
      [
        ...['-v', 'error', '-ss', time, '-i', mp4, '-frames:v', '1'],
        ...['-vf', 'format=gray,crop=1:1:100:100', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
      ],
      { encoding: 'buffer' },
    );
    return (stdout as Buffer)[0]!;
  };
  // At 0 s (100, 100) is inside the grey circle; at 2.9 s the circle has gone from there.
  expect(Math.abs((await pixel('0')) - (await pixel('2.9')))).toBeGreaterThan(40);

  // GIF: one picture per frame.
  const gif = join(dir, 'Chapter07_Task1_1.gif');
  await answerDialogs(app, { exportTo: gif });
  await exportAs(page, /Animated GIF/);
  await expect.poll(() => exists(gif), { timeout: 60_000 }).toBe(true);
  const { stdout } = await execFileAsync(bundledFfmpeg().ffprobe, [
    ...['-v', 'error', '-count_frames', '-select_streams', 'v:0'],
    ...['-show_entries', 'stream=nb_read_frames,width,height', '-of', 'csv=p=0', gif],
  ]);
  expect(stdout.trim()).toBe('600,400,72');
  await app.close();
});
