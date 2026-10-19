// M8 exit gate: coursebook tasks with music, voiceover and every export format, done through the
// real app's UI and checked on the exported files.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { measure, rms } from '../integration/helpers/measure.ts';
import { answerDialogs, exportVideo, launchApp, openTab } from './app.ts';

const FRAME = 1 / 30;
const BEE = 'clip_1080p30_10s.mp4'; // moving pattern with a tone (Naivasha1, Shark, BeeProject…)
const LAKE = 'lake_1080p30_20s.mp4'; // Naivasha2, Swim_through…
const MUSIC = 'music_stereo_45s.mp3'; // Task_11e_audio.mp3, Activity_11c_audio.mp3…
const probe = createNodeMediaEngine(bundledFfmpeg()).probe;
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m8-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [BEE, LAKE, MUSIC].includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const item = (page: Page, n: number) => page.locator('[data-item]').nth(n);
const CLIP_FIELDS = ['Start point', 'End point'];
async function setTime(page: Page, label: string, value: string) {
  if (CLIP_FIELDS.includes(label)) await openTab(page, 'Clip');
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}
async function importAndAdd(page: Page, files: string[]) {
  await page.getByRole('button', { name: 'Import' }).click();
  for (const f of files) {
    await expect(page.getByText(f, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: `Add ${f} to the timeline` }).click();
  }
}
async function removeSound(page: Page, n: number) {
  await item(page, n).click();
  await openTab(page, 'Audio');
  await page.getByLabel('Remove sound').check();
}
/** "Add music at the current point", then type its exact start. */
async function addMusicAt(page: Page, start: string) {
  await page.getByRole('button', { name: 'Add music' }).click();
  await expect(
    page.getByLabel('Music track').getByRole('button', { name: /music_stereo/ }),
  ).toBeVisible();
  await setTime(page, 'Starts at', start);
}
/** Exports to `name` in the app's folder, answering the save dialog. */
async function exportAs(
  page: Page,
  app: Parameters<typeof answerDialogs>[0],
  name: string,
  choose: Parameters<typeof exportVideo>[2] = {},
) {
  const output = join(dir, name);
  await answerDialogs(app, { open: [join(dir, MUSIC)], exportTo: output });
  await exportVideo(page, output, choose);
  return output;
}
const near = (a: number, b: number, by = FRAME + 0.001) => Math.abs(a - b) <= by;

test('Book B Tasks 11e + 11f: music after 5 s; MP4, WMV, MOV, AVI; YouTube, Android and DVD', async () => {
  test.setTimeout(600_000);
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, LAKE)] });
  await importAndAdd(page, [BEE, LAKE]);
  // Task 11d's clips have no sound: Naivasha1 (4.2 s) then Naivasha2 (8–12.5 s).
  await item(page, 0).click();
  await setTime(page, 'End point', '4.2');
  await removeSound(page, 0);
  await item(page, 1).click();
  await setTime(page, 'Start point', '8');
  await setTime(page, 'End point', '12.5');
  await removeSound(page, 1);
  // 11e: the soundtrack starts after exactly 5 seconds.
  await answerDialogs(app, { open: [join(dir, MUSIC)] });
  await addMusicAt(page, '5');
  await expect(page.getByText(/plays 5\.00 – 8\.70 s, ending with the video/i)).toBeVisible();

  const mp4 = await exportAs(page, app, 'Task_11e.mp4');
  const m = await measure(mp4);
  expect([m.width, m.height]).toEqual([1920, 1080]);
  expect(near(m.videoDuration, 8.7)).toBe(true);
  expect(near(m.audioDuration!, 8.7, 0.05)).toBe(true);
  expect(await rms(mp4, 0, 4.95)).toBeLessThan(0.001); // silent until 5 s
  expect(await rms(mp4, 5.05, 8.6)).toBeGreaterThan(0.2);

  // 11e: the same movie in .wmv, .mov and .avi.
  for (const [container, video, audio] of [
    ['wmv', 'wmv2', 'wmav2'],
    ['mov', 'h264', 'aac'],
    ['avi', 'mpeg4', 'mp3'],
  ] as const) {
    const file = await exportAs(page, app, `Task_11e.${container}`, {
      container: container.toUpperCase(),
    });
    const info = await probe(file);
    expect(info).toMatchObject({
      container,
      video: { codec: video, width: 1920, height: 1080 },
      audio: { codec: audio },
    });
    expect(near(info.duration!, 8.7, 0.1)).toBe(true);
    expect(await rms(file, 0, 4.9)).toBeLessThan(0.001);
  }

  // 11f: YouTube at 1280 × 720 (a smaller file), an Android phone (medium), and a DVD.
  const youtube = await exportAs(page, app, 'Task_11f.mp4', {
    preset: /internet \/ youtube/i,
    size: '1280x720',
  });
  expect(await probe(youtube)).toMatchObject({
    container: 'mp4',
    video: { width: 1280, height: 720 },
  });
  expect((await probe(youtube)).sizeBytes).toBeLessThan((await probe(mp4)).sizeBytes);
  const android = await exportAs(page, app, 'Task_11f_android.mp4', {
    preset: /mobile phone \(medium\)/i,
  });
  expect(await probe(android)).toMatchObject({ video: { width: 960, height: 540 } });
  const dvd = await exportAs(page, app, 'Task_11f.mpg', { preset: /dvd player \(pal\)/i });
  expect(await probe(dvd)).toMatchObject({
    container: 'mpg',
    video: { codec: 'mpeg2video', width: 720, height: 576, fps: 25 },
    audio: { codec: 'ac3' },
  });
  await app.close();
});

test('Book A 11.30 + 11.15: the BeeProject with music, for the web and lossless', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, MUSIC)] });
  // 11.30: the sound file is imported and put on the timeline from the media bin.
  await importAndAdd(page, [BEE, MUSIC]);
  await expect(
    page.getByLabel('Music track').getByRole('button', { name: /music_stereo/ }),
  ).toBeVisible();
  await removeSound(page, 0);

  // 11.15: a file format suitable for the web…
  const web = await exportAs(page, app, 'BeeProject.mp4', { preset: /internet \/ youtube/i });
  const webInfo = await probe(web);
  expect(webInfo).toMatchObject({
    container: 'mp4',
    video: { codec: 'h264' },
    audio: { codec: 'aac' },
  });
  expect(near((await measure(web)).audioDuration!, 10, 0.05)).toBe(true);
  expect(await rms(web, 0.5, 9.5)).toBeGreaterThan(0.2); // the music is heard

  // …and a lossless one (AVI: FFV1 + PCM; MOV: PNG + PCM), much bigger.
  const avi = await exportAs(page, app, 'BeeProject_lossless.avi', {
    container: 'AVI',
    lossless: true,
  });
  const aviInfo = await probe(avi);
  expect(aviInfo).toMatchObject({
    container: 'avi',
    video: { codec: 'ffv1' },
    audio: { codec: 'pcm_s16le' },
  });
  expect(aviInfo.sizeBytes).toBeGreaterThan(webInfo.sizeBytes * 3);
  const mov = await exportAs(page, app, 'BeeProject_lossless.mov', {
    container: 'MOV',
    lossless: true,
  });
  expect(await probe(mov)).toMatchObject({
    video: { codec: 'png' },
    audio: { codec: 'pcm_s16le' },
  });
  await app.close();
});

test('Book B Activities 11b, 11c, 11d: the Cozumel storyboard at 960 × 720, a soundtrack after 3 s, then 1 s transitions', async () => {
  test.setTimeout(600_000);
  const { app, window: page } = await launchApp();
  await page.getByRole('button', { name: /16:9 · 1920 × 1080/ }).click();
  await page.getByRole('radio', { name: '4:3' }).check();
  await page.getByRole('radio', { name: '960 × 720' }).check();
  await page.getByRole('button', { name: 'Apply' }).click();
  await page.getByLabel('Timeline zoom').fill('10'); // the whole 40 s storyboard fits on screen
  const toTime = (s: number) => page.locator('.ruler').click({ position: { x: s * 10 + 5, y: 5 } }); // just after s

  // 11b, 0 s: title frames (6 s).
  await page.getByRole('button', { name: 'Add title' }).click();
  await page.getByLabel('Text', { exact: true }).fill('Diving in Cozumel, Mexico');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Duration', '6');
  // 6 s: Swim_through, starting 5 s in and 10 s long (the book: 15 s in, 51 s long).
  await answerDialogs(app, { open: [join(dir, BEE), join(dir, LAKE)] });
  await importAndAdd(page, [LAKE]);
  await item(page, 1).click();
  await setTime(page, 'Start point', '5');
  await setTime(page, 'End point', '15');
  // 16 s: the final frame of Swim_through behind the caption frames, for 8 s.
  await toTime(16);
  await page.getByRole('button', { name: 'Snapshot', exact: true }).click();
  let snap = page.getByRole('dialog', { name: 'Snapshot' });
  await expect(snap).toContainText('00:15.97');
  await snap.getByLabel(/add to the timeline/i).check();
  await setTime(page, 'Show it for', '8');
  await snap.getByRole('button', { name: 'Add to media' }).click();
  await expect(page.locator('.bin').getByText('Snapshot_15.97s.png', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Add caption' }).click();
  await page
    .getByLabel('Text', { exact: true })
    .fill('Jacques Cousteau once called Cozumel\n‘the most spectacular diving site in the world’');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Starts at', '16');
  await setTime(page, 'Duration', '8');
  // 24 s: Shark, the first 6 seconds only.
  await page.getByRole('button', { name: `Add ${BEE} to the timeline` }).click();
  await item(page, 3).click();
  await setTime(page, 'End point', '6');
  // 30 s: the final frame of Shark behind 10 s of credits.
  await toTime(30);
  await page.getByRole('button', { name: 'Snapshot', exact: true }).click();
  snap = page.getByRole('dialog', { name: 'Snapshot' });
  await expect(snap).toContainText('00:29.97');
  await snap.getByLabel(/add to the timeline/i).check();
  await setTime(page, 'Show it for', '10');
  await snap.getByRole('button', { name: 'Add to media' }).click();
  await expect(page.locator('.bin').getByText('Snapshot_29.97s.png', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Add credits' }).click();
  await page
    .getByLabel('Text', { exact: true })
    .fill('Diving in Cozumel\n\nDate filmed:\nAugust 2019\n\nEdited by:\nA Student');
  await page.getByLabel('Text', { exact: true }).blur();
  await setTime(page, 'Starts at', '30');
  await setTime(page, 'Duration', '10');

  const storyboard = await exportAs(page, app, 'Activity_11b.mp4');
  let m = await measure(storyboard);
  expect([m.width, m.height]).toEqual([960, 720]);
  expect(near(m.videoDuration, 40)).toBe(true); // 6 + 10 + 8 + 6 + 10

  // 11c: the soundtrack starts after 3 seconds; 960 × 720 in .mp4, .wmv, .mov and .avi.
  await answerDialogs(app, { open: [join(dir, MUSIC)] });
  await addMusicAt(page, '3');
  for (const container of ['mp4', 'wmv', 'mov', 'avi'] as const) {
    const file = await exportAs(page, app, `Activity_11c.${container}`, {
      container: container.toUpperCase(),
    });
    const info = await probe(file);
    expect(info).toMatchObject({ container, video: { width: 960, height: 720 } });
    expect(near(info.duration!, 40, 0.1)).toBe(true);
    expect(await rms(file, 0, 2.9)).toBeLessThan(0.001); // the title is silent until the music
    expect(await rms(file, 3.1, 5.9)).toBeGreaterThan(0.2);
  }

  // 11d: 1-second transitions after the title frames and after the caption frames.
  for (const n of [1, 3]) {
    await item(page, n).click();
    await openTab(page, 'Effects');
    await page
      .getByRole('radiogroup', { name: 'Transition' })
      .getByRole('radio', { name: 'Dissolve', exact: true })
      .click();
    await expect(item(page, n)).toContainText('⇄ 1.0 s');
  }
  const withTransitions = await exportAs(page, app, 'Activity_11d.mp4');
  m = await measure(withTransitions);
  expect([m.width, m.height]).toEqual([960, 720]);
  expect(near(m.videoDuration, 38)).toBe(true); // 40 − 2 × 1 s overlap
  await app.close();
});
