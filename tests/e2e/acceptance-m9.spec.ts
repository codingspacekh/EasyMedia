// M9 exit gate: Audio mode coursebook tasks done through the real app's UI (screens 13, 14, 20)
// and checked on the exported files.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp, menu } from './app.ts';
import {
  applyEffect,
  audioMode,
  exportAudio as exportTo,
  importAudio as importFile,
  menuItem,
  select,
  setTime,
  shot,
} from './audio.ts';

const PIANO = 'piano_stereo_60s.mp3';
const SONG_DC = 'song_dc_offset_90s.mp3';
const SONG = 'song_48s.mp3';
const engine = createNodeMediaEngine(bundledFfmpeg());
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m9-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [PIANO, SONG_DC, SONG].includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const importAudio = (app: ElectronApplication, page: Page, file: string, count: number) =>
  importFile(app, page, join(dir, file), count);
const exportAudio = (
  app: ElectronApplication,
  page: Page,
  name: string,
  choose: { mono?: boolean; title?: string } = {},
) => exportTo(app, page, join(dir, name), choose);
/** How many undo steps keep their sound in the app's IndexedDB. */
const stepsOnDisk = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const r = indexedDB.open('easymedia-undo');
        r.onsuccess = () => {
          const count = r.result.transaction('steps').objectStore('steps').count();
          count.onsuccess = () => resolve(count.result);
          count.onerror = () => reject(count.error);
        };
        r.onerror = () => reject(r.error);
      }),
  );

test('Book B Task 11j: normalise, a clipped track before it, 45 s, fades, mono, MP3 with tags', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, SONG_DC, 1);
  // 11.2.2 Normalise with Remove DC offset (everything selected with Ctrl/Cmd + A).
  await menu(app, 'Edit', 'Select All');
  await applyEffect(page, 'Normalise…', 'Normalise');
  // 11.2.3 / 11.2.4 the second file as a new track, only its first 19.1 s kept.
  await answerDialogs(app, { open: [join(dir, SONG)] });
  await menuItem(page, 'Tracks', 'Import audio as new track…');
  await expect(page.getByRole('region', { name: /^Waveform of / })).toHaveCount(2, {
    timeout: 30_000,
  });
  await setTime(page, 'Audio position', '19.100');
  await select(page, '19.1', '48');
  await shot(page, '11j-selection');
  await page.getByRole('button', { name: 'Cut' }).click();
  // 11.2.5 Move track up, select all, align end to end, mix and render; keep 45 s.
  await menuItem(page, 'Tracks', 'Move track up');
  await menu(app, 'Edit', 'Select All');
  await menuItem(page, 'Tracks', 'Align end to end');
  await shot(page, '11j-aligned');
  await menuItem(page, 'Tracks', 'Mix and render');
  await expect(page.getByRole('region', { name: /^Waveform of / })).toHaveCount(1);
  await select(page, '45', '200');
  await page.getByRole('button', { name: 'Cut' }).click();
  // 11.2.6 fade in 3 s, fade out 5 s; 11.2.7 mono; 11.2.8 amplify the quieter part.
  await select(page, '0', '3');
  await menuItem(page, 'Effect', 'Fade in');
  await select(page, '40', '45');
  await menuItem(page, 'Effect', 'Fade out');
  await menuItem(page, 'Tracks', 'Mix stereo down to mono');
  await select(page, '19.1', '40');
  await applyEffect(page, 'Amplify…', 'Amplify');
  const history = page.getByRole('complementary', { name: 'Selected track' });
  await expect(history.getByText('Mix stereo down to mono')).toBeVisible();
  await shot(page, '11j-done');
  // 11.2.9 Export as MP3, forced to mono, with a title.
  const file = await exportAudio(app, page, 'Task_11j.mp3', { mono: true, title: 'Task 11j' });
  const info = await engine.probe(file);
  expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1, sampleRate: 44100 });
  expect(Math.abs(info.duration! - 45)).toBeLessThan(0.1);
  const { stdout } = await run(bundledFfmpeg().ffprobe, [
    ...['-v', 'error', '-show_entries', 'format_tags=title', '-of', 'default=nw=1:nk=1', file],
  ]);
  expect(stdout.trim()).toBe('Task 11j');
  await app.close();
});

test('Book A 11.16–11.19, 11.27, 11.29: trim to 41 s, paste the 39 s section at 16 s, fade, mono, MP3', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, PIANO, 1);
  await select(page, '41', '60');
  await page.getByRole('button', { name: 'Cut' }).click();
  await answerDialogs(app, { open: [join(dir, PIANO)] });
  await menuItem(page, 'Tracks', 'Import audio as new track…');
  const headers = page.getByRole('group', { name: 'Track piano_stereo_60s' });
  await expect(headers).toHaveCount(2, { timeout: 30_000 });
  await select(page, '39', '40'); // on the copy just imported
  await page.getByRole('button', { name: 'Copy' }).click();
  await headers.nth(0).getByRole('button', { name: 'piano_stereo_60s', exact: true }).click();
  await select(page, '16', '16');
  await page.getByRole('button', { name: 'Paste' }).click();
  await headers.nth(1).getByRole('button', { name: 'Remove track piano_stereo_60s' }).click();
  await expect(headers).toHaveCount(1);
  await headers.nth(0).getByRole('button', { name: 'piano_stereo_60s', exact: true }).click();
  await select(page, '41', '60');
  await page.getByRole('button', { name: 'Cut' }).click();
  // A18 + N4: the cut sound goes to disk (IndexedDB); Undo brings it back, Redo cuts it again.
  const length = page
    .getByRole('complementary', { name: 'Selected track' })
    .getByText(/^\d+\.\d\d s$/);
  await expect(length).toHaveText('41.00 s');
  // The write can take seconds on a slow CI disk (Windows: one count took 4.5 s).
  await expect.poll(() => stepsOnDisk(page), { timeout: 30_000 }).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(length).toHaveText('42.00 s');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(length).toHaveText('41.00 s');
  await select(page, '36', '41');
  await menuItem(page, 'Effect', 'Fade out');
  await menuItem(page, 'Tracks', 'Mix stereo down to mono');
  await shot(page, 'bookA-done');
  const file = await exportAudio(app, page, 'BeeProject_sound.mp3', { mono: true });
  const info = await engine.probe(file);
  expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1 });
  expect(Math.abs(info.duration! - 41)).toBeLessThan(0.1);
  await app.close();
});
