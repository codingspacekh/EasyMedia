// X8 + V13 in the real app: built-in sound effects on the two effects tracks, heard in the
// exported MP4 exactly where they are on the timeline; Audio mode adds one as a new track.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { measure, rms } from '../integration/helpers/measure.ts';
import { answerDialogs, exportVideo, launchApp, openTab } from './app.ts';

const BEE = 'clip_1080p30_10s.mp4';
/** Set to a folder to keep screenshots of the timeline and the Sound effects box. */
const SHOTS = process.env.ONEEDITOR_SHOTS;
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-sfx-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === BEE),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const box = (page: Page) => page.getByRole('dialog', { name: 'Sound effects' });

test('X8 sound effects on both effects tracks are heard in the MP4 where they are placed', async () => {
  test.setTimeout(180_000);
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: [join(dir, BEE)] });
  await page.getByRole('button', { name: 'Import' }).click();
  await page.getByRole('button', { name: `Add ${BEE} to the timeline` }).click();
  // The clip's own tone is removed, so only the effects are heard.
  await page.locator('[data-item]').first().click();
  await openTab(page, 'Audio');
  await page.getByLabel('Remove sound').check();

  await page.getByRole('button', { name: 'Sound effects' }).click();
  await expect(box(page)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'sound-effects-box.png') });
  await box(page).getByRole('button', { name: 'Add Ding' }).click();
  await box(page).getByRole('button', { name: 'Add Drum roll' }).click();
  await box(page).getByRole('button', { name: 'Close' }).click();
  await expect(
    page.getByLabel('Effects 1 track').getByRole('button', { name: /ding/i }),
  ).toBeVisible();
  await expect(
    page.getByLabel('Effects 2 track').getByRole('button', { name: /drum roll/i }),
  ).toBeVisible();
  // The drum roll is moved to start at 5 s.
  const starts = page.getByLabel('Starts at', { exact: true });
  await starts.fill('5');
  await starts.press('Enter');
  if (SHOTS) await page.screenshot({ path: join(SHOTS, 'sound-effects-timeline.png') });

  const output = join(dir, 'effects.mp4');
  await answerDialogs(app, { exportTo: output });
  await exportVideo(page, output);
  const m = await measure(output);
  expect(m.audioDuration).toBeGreaterThan(9.9);
  expect(await rms(output, 0.05, 0.5)).toBeGreaterThan(0.02); // the ding
  expect(await rms(output, 2.5, 4.9)).toBeLessThan(0.001); // nothing
  expect(await rms(output, 5.5, 7)).toBeGreaterThan(0.02); // the drum roll
  expect(await rms(output, 7.6, 9.9)).toBeLessThan(0.001);
  await app.close();
});
