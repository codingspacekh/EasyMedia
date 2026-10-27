// M12 cross-platform (X1, X2, X6), as a student moves work between computers: a project made on
// one OS is packaged (File ▸ Package Project), opened on the other OS with every file found, and
// exported there the same: same size and length, and the same pictures (fonts included).
// Run by .github/workflows/cross-platform.yml in two steps, on two computers:
//   CROSS_STEP=make  CROSS_DIR=<folder>  → <folder>/package/Untitled.mve and <folder>/made.mp4
//   CROSS_STEP=check CROSS_DIR=<folder from the other OS> → opens it, exports check.mp4, compares
// Without CROSS_STEP the tests are skipped (they are not part of the normal E2E run).
import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { measure } from '../integration/helpers/measure.ts';
import { answerDialogs, exportVideo, launchApp, menu, openTab } from './app.ts';
import { audioMode, importAudio } from './audio.ts';

const STEP = process.env.CROSS_STEP;
const DIR = process.env.CROSS_DIR ?? '';
const CLIP = 'clip_1080p30_10s.mp4';
const PHOTO = 'photo_3764x3092.jpg';
const MUSIC = 'music_stereo_45s.mp3';

test.skip(!STEP, 'run by the cross-platform workflow (CROSS_STEP=make or check)');
test.setTimeout(300_000);

test('make: a project with clips, a still, a transition, styled text, music and Audio mode work, packaged', async () => {
  test.skip(STEP !== 'make');
  const media = mkdtempSync(join(tmpdir(), 'mve-cross-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    media,
    selectFixtures(FIXTURES, 'test').filter((f) => [CLIP, PHOTO, MUSIC].includes(f.name)),
  );
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: [join(media, CLIP), join(media, PHOTO)] });
  await page.getByRole('button', { name: 'Import' }).click();
  for (const f of [CLIP, PHOTO]) {
    await expect(page.getByText(f, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Add ${f} to the timeline` }).click();
  }
  // A clock wipe into the still.
  await page.locator('.clip.image').first().click();
  await openTab(page, 'Effects');
  await page
    .getByRole('radiogroup', { name: 'Transition' })
    .getByRole('radio', { name: 'Clock wipe' })
    .click();
  // A caption in a bundled display font with a look (X2: the same letters on every computer).
  await page.getByRole('button', { name: 'Add caption' }).click();
  const text = page.getByLabel('Text', { exact: true });
  await text.fill('Lake Naivasha');
  await text.blur();
  await page.getByRole('button', { name: /^Font:/ }).click();
  await page
    .getByRole('radiogroup', { name: 'Font' })
    .getByRole('radio', { name: 'Lobster' })
    .click();
  await page
    .getByRole('group', { name: 'Text look' })
    .getByRole('button', { name: 'Gold' })
    .click();
  // Music from the start.
  await answerDialogs(app, { open: [join(media, MUSIC)] });
  await page.getByRole('button', { name: 'Add music' }).click();
  await expect(page.locator('[aria-label="Music track"] button')).toHaveCount(1);
  // Audio mode work goes in the package too (its sound as WAV files).
  await audioMode(page);
  await importAudio(app, page, join(media, MUSIC), 1);
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Video' })
    .click();

  mkdirSync(DIR, { recursive: true });
  await answerDialogs(app, { open: [join(DIR, 'package')], exportTo: join(DIR, 'made.mp4') });
  mkdirSync(join(DIR, 'package'), { recursive: true });
  await menu(app, 'File', 'Package Project…');
  await expect(page.getByText(/^Packaged into /)).toBeVisible({ timeout: 60_000 });
  await exportVideo(page, join(DIR, 'made.mp4'));
  writeFileSync(join(DIR, 'made-on.txt'), `${process.platform}-${process.arch}\n`);
  await app.close();
});

test('check: the package opens on this OS with every file, and exports the same video', async () => {
  test.skip(STEP !== 'check');
  const { app, window: page } = await launchApp();
  await answerDialogs(app, {
    open: [join(DIR, 'package', 'Untitled.mve')],
    exportTo: join(DIR, 'check.mp4'),
  });
  await menu(app, 'File', 'Open…');
  await expect(page).toHaveTitle('Untitled.mve — EasyMedia');
  // Every file is found: no "missing" in the media bin, and Audio mode has its track.
  for (const f of [CLIP, PHOTO, MUSIC])
    await expect(page.getByText(f, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/missing|could not be found/i)).toHaveCount(0);
  await audioMode(page);
  await expect(page.getByRole('region', { name: /^Waveform of / })).toHaveCount(1);
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Video' })
    .click();
  await exportVideo(page, join(DIR, 'check.mp4'));
  await app.close();

  const made = await measure(join(DIR, 'made.mp4'));
  const again = await measure(join(DIR, 'check.mp4'));
  expect([again.width, again.height]).toEqual([made.width, made.height]);
  expect(Math.abs(again.videoDuration - made.videoDuration)).toBeLessThanOrEqual(1 / 30 + 0.001);
  // The same pictures: average PSNR between the two exports (different encoders may be used).
  const { stderr } = await promisify(execFile)(bundledFfmpeg().ffmpeg, [
    ...['-hide_banner', '-i', join(DIR, 'made.mp4'), '-i', join(DIR, 'check.mp4')],
    ...['-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-'],
  ]);
  const average = /average:([\d.]+|inf)/.exec(stderr)?.[1];
  const psnr = average === 'inf' ? Infinity : Number(average); // inf: identical pictures
  console.log(`PSNR between the exports: ${psnr} dB`);
  expect(psnr).toBeGreaterThanOrEqual(40);
});
