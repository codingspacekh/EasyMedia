// M4 walking skeleton: import → timeline → preview → export, in the real app with real FFmpeg.
import { expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { measure } from '../integration/helpers/measure.ts';
import { answerDialogs, launchApp, menu, exportVideo } from './app.ts';

let dir: string;
const CLIP = 'clip_1080p30_10s.mp4';

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-e2e-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === CLIP),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

test('import → timeline → preview → export', async () => {
  const { app, window } = await launchApp();
  const output = join(dir, 'export.mp4');
  await answerDialogs(app, { open: [join(dir, CLIP)], exportTo: output });

  await window.getByRole('button', { name: 'Import' }).click();
  await expect(window.getByText(CLIP)).toBeVisible();
  await expect(window.getByText('Ready')).toBeVisible({ timeout: 60_000 });

  await window.getByRole('button', { name: `Add ${CLIP} to the timeline` }).click();
  await expect(window.locator('[data-item]')).toHaveCount(1);

  // The preview really plays the proxy through media:// (protocol, ranges, allow-list).
  await window.waitForFunction(
    () =>
      ((document.querySelector('[data-preview="video"] video') as HTMLVideoElement | null)
        ?.readyState ?? 0) >= 2,
  );
  await window.getByRole('button', { name: 'Play' }).click();
  await expect(window.locator('.transport .tc')).not.toHaveText(/^00:00\.00/, { timeout: 5_000 });
  await window.getByRole('button', { name: 'Pause' }).click();

  await exportVideo(window, output, {}, 120_000);
  const m = await measure(output);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(m.videoDuration).toBeCloseTo(10, 1);
  expect(m.audioDuration).toBeCloseTo(10, 1);
  await app.close();
});

test('File ▸ Save writes a project with relative media paths; the title shows its name', async () => {
  const { app, window } = await launchApp();
  const project = join(dir, 'Task_11b.mve');
  await answerDialogs(app, { open: [join(dir, CLIP)], save: project });
  await window.getByRole('button', { name: 'Import' }).click();
  await expect(window.getByText(CLIP)).toBeVisible();
  await expect(window).toHaveTitle('Untitled • — EasyMedia');

  await menu(app, 'File', 'Save');
  await expect(window).toHaveTitle('Task_11b.mve — EasyMedia');
  expect(JSON.parse(await readFile(project, 'utf8')).media[0].path).toBe(CLIP);
  await app.close();
});

test('Edit ▸ Undo and Redo from the menu', async () => {
  const { app, window } = await launchApp();
  await answerDialogs(app, { open: [join(dir, CLIP)] });
  await window.getByRole('button', { name: 'Import' }).click();
  await window.getByRole('button', { name: `Add ${CLIP} to the timeline` }).click();
  await expect(window.locator('[data-item]')).toHaveCount(1);
  await menu(app, 'Edit', 'Undo');
  await expect(window.locator('[data-item]')).toHaveCount(0);
  await menu(app, 'Edit', 'Redo');
  await expect(window.locator('[data-item]')).toHaveCount(1);
  await app.close();
});
