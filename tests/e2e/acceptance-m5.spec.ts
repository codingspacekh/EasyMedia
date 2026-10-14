// M5 exit gate: coursebook tasks done through the real app's UI, checked on the exported files.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { brightness, measure } from '../integration/helpers/measure.ts';
import { answerDialogs, launchApp, menu } from './app.ts';

const FRAME = 1 / 30;
const LAKE = 'lake_1080p30_20s.mp4'; // stand-in for Lake_Naivasha.mp4 (brightness rises with time)
const BEE = 'clip_1080p30_10s.mp4';
const BEE_SLOW = 'clip_4x3_640x480.mov';
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m5-'));
  const wanted = [LAKE, BEE, BEE_SLOW];
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => wanted.includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function importAndAdd(page: Page, files: string[]) {
  await page.getByRole('button', { name: 'Import' }).click();
  for (const f of files) {
    await expect(page.getByText(f)).toBeVisible();
    await page.getByRole('button', { name: `Add ${f} to the timeline` }).click();
  }
}
async function setTime(page: Page, label: string, value: string) {
  const box = page.getByLabel(label);
  await box.fill(value);
  await box.press('Enter');
}
async function exportTo(page: Page, output: string) {
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByText(`Saved to ${output}`)).toBeVisible({ timeout: 120_000 });
}

test('Book B Task 11b through the UI: start after 8 s, 4.5 s long, no sound', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'Naivasha2.mp4');
  await answerDialogs(app, { open: [join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [LAKE]);
  await page.locator('[data-item]').first().click();
  await setTime(page, 'Start point', '8');
  await setTime(page, 'End point', '12.5');
  await page.getByLabel('Remove sound').check();
  await expect(page.locator('.inspector .len')).toHaveText('4.50 s');
  await exportTo(page, output);

  const m = await measure(output);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(Math.abs(m.videoDuration - 4.5)).toBeLessThanOrEqual(FRAME + 0.001);
  expect(m.audioDuration).toBeUndefined();
  expect(
    Math.abs((await brightness(output, 0.1)) - (await brightness(join(dir, LAKE), 8.1))),
  ).toBeLessThan(2);
  await app.close();
});

test('Book B Task 11c through the UI: first 6.3 s, no sound, 1.5× → 4.2 s', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'Naivasha1.mp4');
  await answerDialogs(app, { open: [join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [LAKE]);
  await page.locator('[data-item]').first().click();
  await setTime(page, 'End point', '6.3');
  await page.getByRole('button', { name: '1.5×' }).click();
  await page.getByLabel('Remove sound').check();
  await expect(page.locator('.inspector .len')).toHaveText('4.20 s');
  await exportTo(page, output);

  const m = await measure(output);
  expect(Math.abs(m.videoDuration - 4.2)).toBeLessThanOrEqual(FRAME + 0.001);
  expect(m.audioDuration).toBeUndefined();
  expect(
    Math.abs((await brightness(output, 2)) - (await brightness(join(dir, LAKE), 3))),
  ).toBeLessThan(2);
  await app.close();
});

test('Book A Activity 11.01: 1920 × 1080 project saved as BeeProject', async () => {
  const { app, window: page } = await launchApp();
  const project = join(dir, 'BeeProject.mve');
  await answerDialogs(app, { save: project });
  await page.getByRole('button', { name: /16:9 · 1920 × 1080 · 30 fps/ }).click();
  await expect(page.getByRole('radio', { name: '1920 × 1080' })).toBeChecked();
  await page.getByRole('button', { name: 'Apply' }).click();
  await menu(app, 'File', 'Save As…');
  await expect(page).toHaveTitle('BeeProject.mve — EasyMedia');
  expect(JSON.parse(await readFile(project, 'utf8')).settings).toMatchObject({
    width: 1920,
    height: 1080,
  });
  await app.close();
});

test('Book A Activity 11.13: remove the sound from all the clips', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'silent.mp4');
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, BEE_SLOW)], exportTo: output });
  await importAndAdd(page, [BEE, BEE_SLOW]);
  for (const clip of await page.locator('[data-item]').all()) {
    await clip.click();
    await page.getByLabel('Remove sound').check();
  }
  await exportTo(page, output);
  const m = await measure(output);
  expect(m.audioDuration).toBeUndefined();
  expect(m.videoDuration).toBeCloseTo(15, 1);
  await app.close();
});
