// M15 through the real app: a mask, a morph and a motion path drawn by the real canvas and
// exported; the pictures checked pixel by pixel with FFmpeg.
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
  dir = await mkdtemp(join(tmpdir(), 'mve-m15-'));
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

const tools = (page: Page) => page.getByRole('toolbar', { name: 'Animation tools' });

/** Draws a shape anywhere, then types its exact box. */
async function shape(page: Page, tool: string, box: [number, number, number, number]) {
  await tools(page).getByRole('button', { name: tool, exact: true }).click();
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.4, stage.y + stage.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.5, stage.y + stage.height * 0.5, { steps: 4 });
  await page.mouse.up();
  for (const [label, v] of [
    ['X', box[0]],
    ['Y', box[1]],
    ['W', box[2]],
    ['H', box[3]],
  ] as const)
    await type(page, label, String(v));
}

async function exportAs(page: Page, format: RegExp) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: format }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
}

/** The grey level (0–255) of one pixel of a picture or of a video at a time. */
async function grey(file: string, x: number, y: number, at = '0'): Promise<number> {
  const { stdout } = await execFileAsync(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-ss', at, '-i', file, '-frames:v', '1'],
      ...['-vf', `format=gray,crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    ],
    { encoding: 'buffer' },
  );
  return (stdout as Buffer)[0]!;
}

test('a circle mask shows the layer beneath only through it; a circle morphs into a square', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  await type(page, 'Width', '600');
  await type(page, 'Height', '400');
  await page
    .getByRole('dialog', { name: 'Stage settings' })
    .getByRole('button', { name: 'Apply' })
    .click();

  // Layer 1: a black rectangle over the whole stage. Layer 2: a circle, made a mask.
  await shape(page, 'Rectangle', [0, 0, 600, 400]);
  await page.getByLabel('Colour', { exact: true }).first().fill('#000000');
  await page.getByLabel('Colour', { exact: true }).first().press('Tab');
  await page.getByRole('button', { name: 'Layer', exact: true }).click();
  await shape(page, 'Ellipse', [200, 100, 200, 200]);
  await page.getByRole('button', { name: 'Mask Layer 2' }).click();

  const masked = join(dir, 'mask.png');
  await answerDialogs(app, { exportTo: masked });
  await exportAs(page, /PNG picture of this frame/);
  await expect.poll(() => exists(masked), { timeout: 30_000 }).toBe(true);
  expect(await grey(masked, 300, 200)).toBeLessThan(40); // inside the circle: the black rectangle
  expect(await grey(masked, 20, 20)).toBeGreaterThan(215); // outside it: the white stage

  // A third layer, the two below hidden: a circle that becomes a square at frame 24 (the square
  // is removed).
  await page.getByRole('button', { name: 'Hide Layer 1' }).click();
  await page.getByRole('button', { name: 'Hide Layer 2' }).click();
  await page.getByRole('button', { name: 'Layer', exact: true }).click();
  await shape(page, 'Rectangle', [400, 250, 150, 120]);
  await shape(page, 'Ellipse', [400, 250, 150, 120]);
  await goTo(page, '24');
  await page.getByLabel('Morph into').selectOption({ label: 'Rectangle 2' });
  const square = join(dir, 'morph.png');
  await answerDialogs(app, { exportTo: square });
  await exportAs(page, /PNG picture of this frame/);
  await expect.poll(() => exists(square), { timeout: 30_000 }).toBe(true);
  // The corner of the box: filled by the square; a circle would leave it white.
  expect(await grey(square, 405, 255)).toBeLessThan(200);
  await goTo(page, '0');
  const round = join(dir, 'round.png');
  await answerDialogs(app, { exportTo: round });
  await exportAs(page, /PNG picture of this frame/);
  await expect.poll(() => exists(round), { timeout: 30_000 }).toBe(true);
  expect(await grey(round, 405, 255)).toBeGreaterThan(215);
  await app.close();
});

test('Task 5 in small: a car follows a curved road drawn with the pen, turning with it; exported as MP4', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  await type(page, 'Width', '640');
  await type(page, 'Height', '360');
  await type(page, 'Length', '48');
  await page
    .getByRole('dialog', { name: 'Stage settings' })
    .getByRole('button', { name: 'Apply' })
    .click();

  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  const at = (fx: number, fy: number) =>
    [stage.x + stage.width * fx, stage.y + stage.height * fy] as const;
  await tools(page).getByRole('button', { name: 'Pen' }).click();
  for (const [fx, fy] of [
    [0.05, 0.6],
    [0.5, 0.3],
    [0.95, 0.6],
  ] as const)
    await page.mouse.click(...at(fx, fy));
  await page.keyboard.press('Enter');
  await tools(page).getByRole('button', { name: 'Select', exact: true }).click();
  await page.mouse.click(...at(0.5, 0.3));
  await expect(page.getByLabel('Point 2')).toBeVisible();

  await shape(page, 'Rectangle', [0, 0, 60, 24]);
  await page.getByLabel('Follow path').selectOption({ label: 'Path' });
  await page.getByLabel('Orient to path 1').check();
  await expect(
    page.getByRole('region', { name: 'Timeline' }).getByLabel('Path from frame 0 to 48'),
  ).toBeVisible();

  const mp4 = join(dir, 'car.mp4');
  await answerDialogs(app, { exportTo: mp4 });
  await exportAs(page, /MP4 video/);
  await expect.poll(() => exists(mp4), { timeout: 60_000 }).toBe(true);
  const info = await createNodeMediaEngine(bundledFfmpeg()).probe(mp4);
  expect(info.video).toMatchObject({ width: 640, height: 360 });
  expect(info.duration).toBeCloseTo(2, 1);
  // At the start the car sits on the left end of the road; by the end it has gone from there.
  const x0 = Math.round(Number(await page.getByLabel('X', { exact: true }).inputValue()) + 30);
  const y0 = Math.round(Number(await page.getByLabel('Y', { exact: true }).inputValue()) + 12);
  expect(await grey(mp4, x0, y0 - 6, '0')).toBeLessThan(200);
  expect(await grey(mp4, x0, y0 - 6, '1.9')).toBeGreaterThan(215);
  await app.close();
});
