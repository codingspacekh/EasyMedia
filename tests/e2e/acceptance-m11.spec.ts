// M11 exit gate through the real app: Learn mode (screens 21–22). Book A Activity 11.28 in the
// sampling visualiser; the media inspector and the compression comparison on real files made by
// FFmpeg; the task checker with a saved task file.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp } from './app.ts';
import { shot } from './audio.ts';

const CLIP = 'clip_1080p30_10s.mp4';
const MUSIC = 'music_stereo_45s.mp3';
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m11-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [CLIP, MUSIC].includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function learnMode(page: Page) {
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Learn' })
    .click();
}
const card = (page: Page, name: string) => page.getByRole('region', { name });

test('Book A Activity 11.28: the sound wave sampled 10 times, then twice as often', async () => {
  const { app, window: page } = await launchApp();
  await learnMode(page);
  const box = card(page, 'Sampling visualiser');
  const values = box.locator('td[data-kind="value"]');
  await expect(values).toHaveText(['6', '8.5', '2.5', '8', '3.5', '2', '4.5', '3', '8.5', '3.5']);
  const distance = async () => Number(await box.getByTestId('distance').textContent());
  const ten = await distance();
  await box.getByLabel('Sample rate').fill('20');
  await expect(box.getByText('20 samples')).toBeVisible();
  await expect(values).toHaveCount(20);
  expect(await distance()).toBeLessThan(ten * 0.75);
  await box.getByLabel('Resolution').fill('3');
  await expect(box.getByText('3-bit · 8 levels')).toBeVisible();
  await shot(page, 'learn-21-sampling');
  await app.close();
});

test('T1 + T3: inspect real files and compare their compression (screens 21–22)', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await learnMode(page);
  const inspector = card(page, 'Media inspector');
  await answerDialogs(app, { open: [join(dir, MUSIC)] });
  await inspector.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(inspector.getByRole('button', { name: 'Audio codec' })).toBeVisible();
  await expect(inspector.locator('tr', { hasText: 'Audio codec' })).toContainText('MP3');
  await expect(inspector.locator('tr', { hasText: 'Audio codec' })).toContainText('lossy');
  await expect(inspector.locator('tr', { hasText: 'Sample rate' })).toContainText('44 100 Hz');

  const compare = card(page, 'Compression comparison');
  await compare.getByRole('button', { name: 'Compare 10 s of the sound' }).click();
  const rows = compare.getByRole('listitem');
  await expect(rows).toHaveCount(5, { timeout: 120_000 });
  // 10 s of 16-bit stereo at 44 100 Hz: 1 764 000 bytes and a header.
  await expect(rows.nth(0)).toContainText('1.76 MB');
  await expect(rows.nth(3)).toContainText(/MP3 128 kbps.*\b(9[01]) % smaller/);
  await shot(page, 'learn-21-compare');

  await answerDialogs(app, { open: [join(dir, CLIP)] });
  await inspector.getByRole('button', { name: 'Choose a file…' }).click();
  await expect(inspector.locator('tr', { hasText: 'Resolution' })).toContainText(
    '1920 × 1080 (16:9)',
  );
  await page.getByRole('tab', { name: 'Formats & compression' }).click();
  const quality = card(page, 'Video compression & quality');
  await quality.getByRole('button', { name: `Make real files from ${CLIP}` }).click();
  await expect(quality.locator('video')).toHaveCount(3, { timeout: 180_000 });
  // Each MP4 really loads in the app's player (a frame is shown); the lossless still too.
  await expect
    .poll(() =>
      quality
        .locator('video')
        .evaluateAll((vs) => vs.map((v) => (v as HTMLVideoElement).readyState >= 2)),
    )
    .toEqual([true, true, true]);
  await expect
    .poll(() => quality.getByRole('img').evaluate((i) => (i as HTMLImageElement).naturalWidth))
    .toBe(1920);
  await expect(quality).toContainText('Lossless · 1920 × 1080');
  await expect(quality).toContainText('MP4 · 426 × 240');
  await shot(page, 'learn-22-formats');
  await app.close();
});

test('T6: the teacher saves a task; a student checks an export against it', async () => {
  const { app, window: page } = await launchApp();
  await learnMode(page);
  await page.getByRole('tab', { name: 'Task checker' }).click();
  const task = card(page, 'Task');
  await task.getByLabel('Task name').fill('Task 11b');
  await task.getByLabel('Duration (s)').fill('10');
  await task.getByLabel('Duration (s)').blur();
  const saved = join(dir, 'Task 11b.mvetask');
  await answerDialogs(app, { save: saved });
  await task.getByRole('button', { name: 'Save task…' }).click();
  await expect(page.getByText('Saved Task 11b.mvetask')).toBeVisible();
  expect(JSON.parse(await readFile(saved, 'utf8'))).toMatchObject({
    name: 'Task 11b',
    container: 'mp4',
    width: 1920,
    height: 1080,
    duration: 10,
  });

  await task.getByLabel('Width').fill('1280');
  await task.getByLabel('Width').blur();
  await answerDialogs(app, { open: [saved] });
  await task.getByRole('button', { name: 'Open task…' }).click();
  await expect(task.getByLabel('Width')).toHaveValue('1920');

  const check = card(page, 'Check an export');
  await answerDialogs(app, { open: [join(dir, CLIP)] });
  await check.getByRole('button', { name: 'Check a file…' }).click();
  await expect(check).toContainText('Passed');
  await shot(page, 'learn-task-checker');
  await app.close();
});

test('Glossary: the exam-style questions can be answered from it', async () => {
  const { app, window: page } = await launchApp();
  await learnMode(page);
  await page.getByRole('button', { name: 'Glossary' }).click();
  const glossary = page.getByRole('dialog', { name: 'Glossary' });
  await glossary.getByRole('searchbox').fill('sample rate');
  await expect(glossary).toContainText('doubling the sample rate doubles the file size');
  await shot(page, 'learn-glossary');
  await page.keyboard.press('Escape');
  await expect(glossary).toHaveCount(0);
  await app.close();
});
