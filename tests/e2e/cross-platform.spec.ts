// M12 cross-platform (X1, X2, X6), as a student moves work between computers: a project made on
// one OS is packaged (File ▸ Package Project), opened on the other OS with every file found, and
// exported there the same: same size and length, and the same pictures (fonts included).
// M17 step 3: the same for an animation with pictures (.mvea), packaged in Animation mode.
// Run by .github/workflows/cross-platform.yml in two steps, on two computers:
//   CROSS_STEP=make  CROSS_DIR=<folder>  → <folder>/package/Untitled.mve and <folder>/made.mp4;
//                                          <folder>/anim-package/Cross.mvea and <folder>/anim-made.mp4
//   CROSS_STEP=check CROSS_DIR=<folder from the other OS> → opens them, exports, compares
// Without CROSS_STEP the tests are skipped (they are not part of the normal E2E run).
import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
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
  await expect(page).toHaveTitle('Untitled.mve — OneEditor');
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

  await expectSameVideo(join(DIR, 'made.mp4'), join(DIR, 'check.mp4'));
});

/** X6: the other computer's export and this one's: same size, length and pictures. */
async function expectSameVideo(madeFile: string, checkFile: string) {
  const made = await measure(madeFile);
  const again = await measure(checkFile);
  expect([again.width, again.height]).toEqual([made.width, made.height]);
  expect(Math.abs(again.videoDuration - made.videoDuration)).toBeLessThanOrEqual(1 / 30 + 0.001);
  // The same pictures: average PSNR between the two exports (different encoders may be used).
  const { stderr } = await promisify(execFile)(bundledFfmpeg().ffmpeg, [
    ...['-hide_banner', '-i', madeFile, '-i', checkFile],
    ...['-lavfi', '[0:v][1:v]psnr', '-f', 'null', '-'],
  ]);
  const average = /average:([\d.]+|inf)/.exec(stderr)?.[1];
  const psnr = average === 'inf' ? Infinity : Number(average); // inf: identical pictures
  console.log(`PSNR between the exports of ${madeFile}: ${psnr} dB`);
  expect(psnr).toBeGreaterThanOrEqual(40);
}

// ---- M17 step 3: an animation with pictures (.mvea) ----

const SVG = 'blue box.svg';
const PNG = 'pattern.png';

async function animationMode(page: Page) {
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
}

async function type(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Tab');
}

async function clickStage(page: Page, at: [number, number]) {
  const box = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.click(box.x + box.width * at[0], box.y + box.height * at[1]);
}

async function exportMp4(page: Page, app: Parameters<typeof answerDialogs>[0], file: string) {
  await answerDialogs(app, { exportTo: file });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: /MP4 video/ }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => existsSync(file), { timeout: 60_000 }).toBe(true);
}

test('make: an animation with an SVG and a PNG picture, a moving star and text, packaged', async () => {
  test.skip(STEP !== 'make');
  const media = mkdtempSync(join(tmpdir(), 'mve-cross-anim-'));
  writeFileSync(
    join(media, SVG),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#0000ff"/><circle cx="100" cy="50" r="40" fill="#ffd700"/></svg>',
  );
  // A picture with detail in it, so a picture drawn differently would lower the PSNR.
  await promisify(execFile)(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=160x120', '-frames:v', '1'],
    join(media, PNG),
  ]);
  const { app, window: page } = await launchApp();
  await animationMode(page);

  // The stage: 600 × 400, 2 s at 24 fps.
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const settings = page.getByRole('dialog', { name: 'Stage settings' });
  await type(page, 'Width', '600');
  await type(page, 'Height', '400');
  await type(page, 'Length', '48');
  await settings.getByRole('button', { name: 'Apply' }).click();

  // Two pictures (X1: their paths relative to the file), placed with the Picture tool.
  for (const [file, x, y] of [
    [SVG, '40', '40'],
    [PNG, '400', '60'],
  ] as const) {
    await answerDialogs(app, { open: [join(media, file)] });
    await page.getByRole('button', { name: 'Picture', exact: true }).click();
    await clickStage(page, [0.3, 0.3]);
    await expect(page.getByText(file, { exact: true }).first()).toBeVisible();
    await type(page, 'X', x);
    await type(page, 'Y', y);
  }

  // A star that moves across the stage over the 2 s.
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  const box = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.9, { steps: 5 });
  await page.mouse.up();
  for (const [label, value] of [
    ['X', '40'],
    ['Y', '240'],
    ['W', '100'],
    ['H', '100'],
  ] as const)
    await type(page, label, value);
  const goTo = page.getByLabel('Go to frame');
  await goTo.fill('2 s');
  await goTo.press('Enter');
  await type(page, 'X', '460');
  await expect(page.getByRole('button', { name: 'X keyframe at frame 48' })).toBeVisible();

  // Text in the bundled font (X2: the same letters on every computer).
  await goTo.fill('0');
  await goTo.press('Enter');
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  await clickStage(page, [0.5, 0.85]);
  await type(page, 'Words', 'Lake Naivasha');
  await type(page, 'X', '200');
  await type(page, 'Y', '200');
  await type(page, 'Size', '40');

  const saved = join(media, 'Cross.mvea');
  await answerDialogs(app, { save: saved });
  await menu(app, 'File', 'Save');
  await expect.poll(() => existsSync(saved), { timeout: 10_000 }).toBe(true);

  mkdirSync(join(DIR, 'anim-package'), { recursive: true });
  await answerDialogs(app, { open: [join(DIR, 'anim-package')] });
  await menu(app, 'File', 'Package Project…');
  await expect
    .poll(() => existsSync(join(DIR, 'anim-package', 'Cross.mvea')), { timeout: 30_000 })
    .toBe(true);
  for (const file of [SVG, PNG])
    expect(existsSync(join(DIR, 'anim-package', 'pictures', file))).toBe(true);
  await exportMp4(page, app, join(DIR, 'anim-made.mp4'));
  await app.close();
});

test('check: the packaged animation opens on this OS with its pictures, and exports the same MP4', async () => {
  test.skip(STEP !== 'check');
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await answerDialogs(app, { open: [join(DIR, 'anim-package', 'Cross.mvea')] });
  await menu(app, 'File', 'Open Animation…');
  for (const file of [SVG, PNG])
    await expect(page.getByText(file, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/missing|could not be found/i)).toHaveCount(0);
  const check = join(DIR, 'anim-check.mp4');
  await exportMp4(page, app, check);
  await app.close();

  const engine = createNodeMediaEngine(bundledFfmpeg());
  const [made, again] = await Promise.all([
    engine.probe(join(DIR, 'anim-made.mp4')),
    engine.probe(check),
  ]);
  expect(again.video).toMatchObject({ width: 600, height: 400, fps: 24 });
  expect(made.video).toMatchObject({ width: 600, height: 400, fps: 24 });
  await expectSameVideo(join(DIR, 'anim-made.mp4'), check);
});
