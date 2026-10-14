// M7 exit gate: coursebook tasks with fades, transitions, filters, pan & zoom and snapshots,
// done through the real app's UI and checked on the exported files.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { brightness, grayFrame, measure, tinyFrame } from '../integration/helpers/measure.ts';
import { answerDialogs, launchApp, openTab } from './app.ts';

const FRAME = 1 / 30;
const BEE = 'clip_1080p30_10s.mp4'; // a detailed moving test pattern with sound (BeeFly, balloon…)
const LAKE = 'lake_1080p30_20s.mp4'; // brightness rises with time (Naivasha2, BeeFlower…)
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m7-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [BEE, LAKE].includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function importAndAdd(page: Page, files: string[]) {
  await page.getByRole('button', { name: 'Import' }).click();
  for (const f of files) {
    await expect(page.getByText(f, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Add ${f} to the timeline` }).click();
  }
}
const item = (page: Page, n: number) => page.locator('[data-item]').nth(n);
const CLIP_FIELDS = ['Start point', 'End point'];
const EFFECT_FIELDS = ['Fade in', 'Fade out', 'Starts at (in the clip)', 'Ends at (in the clip)'];
async function setTime(page: Page, label: string, value: string) {
  if (CLIP_FIELDS.includes(label)) await openTab(page, 'Clip');
  if (EFFECT_FIELDS.includes(label)) await openTab(page, 'Effects');
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}
async function exportTo(page: Page, output: string) {
  await page.getByRole('button', { name: 'Export' }).click();
  await expect(page.getByText(`Saved to ${output}`)).toBeVisible({ timeout: 180_000 });
}
/** Clicks the ruler at `seconds` (40 px per second at the default zoom), moving the playhead. */
async function toEnd(page: Page, seconds: number) {
  await page.locator('.ruler').click({ position: { x: seconds * 40 - 1, y: 5 } });
}
/** How much detail a frame has: the average change between neighbouring pixels. */
async function detail(file: string, t: number) {
  const f = await grayFrame(file, t);
  let sum = 0;
  for (let y = 0; y < f.height; y += 4)
    for (let x = 1; x < f.width; x += 2) sum += Math.abs(f.at(x, y) - f.at(x - 1, y));
  return sum / ((f.height / 4) * (f.width / 2));
}
/** How different two frames are, on a 16 × 9 grid (0 = the same). */
async function difference(a: [string, number], b: [string, number]) {
  const [fa, fb] = [await tinyFrame(...a), await tinyFrame(...b)];
  let sum = 0;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 16; x++)
      fa.at(x, y).forEach((v, i) => (sum += Math.abs(v - fb.at(x, y)[i]!)));
  return sum / (16 * 9 * 3);
}

test('Book A 11.06 + 11.09: fades between clips and a dissolve between two parts of a clip', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'fades.mp4');
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [BEE, LAKE]);
  await page.getByRole('button', { name: `Add ${LAKE} to the timeline` }).click();

  // BeeFly: fades in at its beginning (the coursebook's "dissolve" from nothing) and out at its end.
  await item(page, 0).click();
  await setTime(page, 'Fade in', '1');
  await setTime(page, 'Fade out', '1');
  // BeeFlower (first lake copy, 5 s): fades in.
  await item(page, 1).click();
  await setTime(page, 'End point', '5');
  await setTime(page, 'Fade in', '1');
  // The second lake copy (5 s) joins the first with a smooth dissolve.
  await item(page, 2).click();
  await setTime(page, 'Start point', '5');
  await setTime(page, 'End point', '10');
  await openTab(page, 'Effects');
  await page.getByLabel('Transition', { exact: true }).selectOption('transition.dissolve');
  await expect(item(page, 2)).toContainText('⇄ 1.0 s');
  await exportTo(page, output);

  const m = await measure(output);
  expect(Math.abs(m.videoDuration - 19)).toBeLessThanOrEqual(FRAME + 0.001); // 10 + 5 + 5 − 1
  expect(Math.abs(m.audioDuration! - 19)).toBeLessThan(0.05);
  expect(await brightness(output, 0.02)).toBeLessThan(25); // starts from black
  expect(await brightness(output, 5)).toBeGreaterThan(40);
  expect(await brightness(output, 9.95)).toBeLessThan(25); // fades out to black
  await app.close();
});

test('Book A 11.07: an 8 s clip zooms in from 5 s to its end', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'zoom.mp4');
  await answerDialogs(app, { open: [join(dir, BEE)], exportTo: output });
  await importAndAdd(page, [BEE]);
  await item(page, 0).click();
  await setTime(page, 'End point', '8');
  await openTab(page, 'Effects');
  await page.getByLabel('Pan and zoom', { exact: true }).selectOption('zoom-in');
  await setTime(page, 'Starts at (in the clip)', '5');
  await exportTo(page, output);

  expect(Math.abs((await measure(output)).videoDuration - 8)).toBeLessThanOrEqual(FRAME + 0.001);
  const source = join(dir, BEE);
  expect(await difference([output, 3], [source, 3])).toBeLessThan(6); // not zoomed yet
  expect(await difference([output, 7.9], [source, 7.9])).toBeGreaterThan(15); // zoomed in
  await app.close();
});

test('Book A 11.11 + 11.12: a TIFF still without text at the end, with a box blur', async () => {
  const { app, window: page } = await launchApp();
  const still = join(dir, 'BeeStill.tiff');
  const output = join(dir, 'blurred.mp4');
  await answerDialogs(app, { open: [join(dir, BEE)], exportTo: output });
  await importAndAdd(page, [BEE]);
  await page.getByRole('button', { name: 'Add caption' }).click(); // text over the clip at 0 s
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as never;
  }, still);
  await item(page, 0).click();
  await page.getByRole('button', { name: 'Snapshot' }).click();
  const snap = page.getByRole('dialog', { name: 'Snapshot' });
  await expect(snap.getByLabel(/hide text/i)).toBeChecked();
  await snap.getByLabel('TIFF').check();
  await snap.getByLabel(/add to the timeline/i).check();
  await snap.getByRole('button', { name: 'Save snapshot' }).click();
  await expect(page.locator('.bin').getByText('BeeStill.tiff', { exact: true })).toBeVisible();
  expect((await measure(still)).width).toBe(1920);
  // No caption on the still: it matches the clip's own frame at the same moment.
  expect(await difference([still, 0], [join(dir, BEE), 0])).toBeLessThan(4);

  await item(page, 1).click();
  await openTab(page, 'Effects');
  await page.getByRole('button', { name: 'Add Box blur' }).click();
  await answerDialogs(app, { exportTo: output });
  await exportTo(page, output);
  expect(Math.abs((await measure(output)).videoDuration - 15)).toBeLessThanOrEqual(FRAME + 0.001);
  expect(await detail(output, 12)).toBeLessThan((await detail(still, 0)) * 0.7);
  await app.close();
});

test('Book B Task 11g: a 2-second transition between Naivasha1 (4.2 s) and Naivasha2 (4.5 s)', async () => {
  const { app, window: page } = await launchApp();
  const output = join(dir, 'Task_11g.mp4');
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [BEE, LAKE]);
  await item(page, 0).click();
  await setTime(page, 'End point', '4.2');
  await item(page, 1).click();
  await setTime(page, 'Start point', '8');
  await setTime(page, 'End point', '12.5');
  await openTab(page, 'Effects');
  await page.getByLabel('Transition', { exact: true }).selectOption('transition.dissolve');
  await page.getByRole('button', { name: '2 s', exact: true }).click();
  await expect(page.getByText('00:00.00 / 00:06.70').first()).toBeVisible();
  await exportTo(page, output);

  const m = await measure(output);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(Math.abs(m.videoDuration - 6.7)).toBeLessThanOrEqual(FRAME + 0.001);
  await app.close();
});

test('Book B Tasks 11h + 11i: zoom in right, a zoomed snapshot, a cold cyan tone, fade to black, 7 s of credits', async () => {
  const { app, window: page } = await launchApp();
  const snapshot = join(dir, 'balloon_end.png');
  const output = join(dir, 'Task_11i.mp4');
  await answerDialogs(app, { open: [join(dir, BEE)], exportTo: output });
  await importAndAdd(page, [BEE]);
  // 11h: pan & zoom removes the left edge.
  await item(page, 0).click();
  await openTab(page, 'Effects');
  await page.getByLabel('Pan and zoom', { exact: true }).selectOption('zoom-in-right');
  // 11h: a snapshot of the final frame, zoomed in.
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as never;
  }, snapshot);
  await toEnd(page, 10);
  await page.getByRole('button', { name: 'Snapshot' }).click();
  const snap = page.getByRole('dialog', { name: 'Snapshot' });
  await expect(snap).toContainText('00:09.97'); // the last frame (10 s − 1/30 s)
  await snap.getByLabel(/add to the timeline/i).check();
  await snap.getByRole('button', { name: 'Save snapshot' }).click();
  await expect(page.locator('.bin').getByText('balloon_end.png', { exact: true })).toBeVisible();
  await item(page, 1).click();
  await openTab(page, 'Effects');
  await page.getByLabel('Pan and zoom', { exact: true }).selectOption('zoom-in');
  // 11i: the savannah looks cold; the frames fade to black before the credits.
  await item(page, 0).click();
  await openTab(page, 'Effects');
  await page.getByRole('button', { name: 'Add Cyan tone' }).click();
  await item(page, 1).click();
  await setTime(page, 'Fade out', '1');
  // 11i: credits on a black background for 7 s.
  await page.getByRole('button', { name: 'Add title' }).click();
  await page.getByLabel('Text', { exact: true }).fill('');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Duration', '7');
  await page.getByRole('button', { name: 'Add credits' }).click();
  await page.getByLabel('Text', { exact: true }).fill('Made by\nA Student');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Starts at', '15');
  await setTime(page, 'Duration', '7');
  await answerDialogs(app, { exportTo: output });
  await exportTo(page, output);

  const m = await measure(output);
  expect(Math.abs(m.videoDuration - 22)).toBeLessThanOrEqual(FRAME + 0.001); // 10 + 5 + 7
  // Cold: on the cyan-toned clip blue is never weaker than red.
  const cold = await tinyFrame(output, 4);
  for (let x = 0; x < 16; x++) {
    const [r, , b] = cold.at(x, 4);
    expect(b).toBeGreaterThanOrEqual(r);
  }
  expect(await brightness(output, 14.95)).toBeLessThan(25); // faded to black
  expect(await brightness(output, 18)).toBeLessThan(60); // credits on black
  await app.close();
});

test('Book B Task 11d: the last frame of Naivasha2 as a 10 s background for captions, then credits', async () => {
  const { app, window: page } = await launchApp();
  const still = join(dir, 'Naivasha2_end.png');
  const output = join(dir, 'Task_11d.mp4');
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, LAKE)], exportTo: output });
  await importAndAdd(page, [BEE, LAKE]);
  // Naivasha1 (4.2 s) then Naivasha2 (8–12.5 s of the lake clip, 4.5 s).
  await item(page, 0).click();
  await setTime(page, 'End point', '4.2');
  await item(page, 1).click();
  await setTime(page, 'Start point', '8');
  await setTime(page, 'End point', '12.5');
  // Snapshot of the final frame, on the timeline for 10 s.
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: path })) as never;
  }, still);
  await toEnd(page, 8.7);
  await page.getByRole('button', { name: 'Snapshot' }).click();
  const snap = page.getByRole('dialog', { name: 'Snapshot' });
  await expect(snap).toContainText('00:08.67');
  await snap.getByLabel(/add to the timeline/i).check();
  await setTime(page, 'Show it for', '10');
  await snap.getByRole('button', { name: 'Save snapshot' }).click();
  await expect(page.locator('.bin').getByText('Naivasha2_end.png', { exact: true })).toBeVisible();
  // Two captions over the still.
  for (const [text, start] of [
    ['Over 400 species of birds are seen in the Great Rift Valley', '9'],
    ['Lake Naivasha has some of the best bird-viewing', '14'],
  ] as const) {
    await page.getByRole('button', { name: 'Add caption' }).click();
    await page.getByLabel('Text', { exact: true }).fill(text);
    await page.getByLabel('Text', { exact: true }).blur();
    await setTime(page, 'Starts at', start);
  }
  // Fish_Eagle.mp4, then 6 s of credits on black.
  await page.getByRole('button', { name: `Add ${BEE} to the timeline` }).click();
  await item(page, 3).click();
  await page.getByRole('button', { name: 'Add title' }).click();
  await page.getByLabel('Text', { exact: true }).fill('Filmed by GBRvideo\nat Lake Naivasha, 2019');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Duration', '6');
  await answerDialogs(app, { exportTo: output });
  await exportTo(page, output);

  const m = await measure(output);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(Math.abs(m.videoDuration - 34.7)).toBeLessThanOrEqual(FRAME + 0.001); // 4.2 + 4.5 + 10 + 10 + 6
  // The still is the last frame of Naivasha2 (the lake clip just before 12.5 s).
  const lakeEnd = await brightness(join(dir, LAKE), 12.46);
  expect(Math.abs((await brightness(output, 18.5)) - lakeEnd)).toBeLessThan(6);
  await app.close();
});
