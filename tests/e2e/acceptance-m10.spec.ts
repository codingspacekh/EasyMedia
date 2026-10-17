// M10 exit gate: Audio mode coursebook tasks with the M10 effects, done through the real app's UI
// (screens 15–19) and checked on the exported files.
import { expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { launchApp, menu } from './app.ts';
import { applyEffect, audioMode, exportAudio, importAudio, select, shot } from './audio.ts';

const TWO_KEYS = 'two_keys_45s.mp3';
const BEEPS = 'beeps_30s.mp3';
const TONES = 'bass_treble_120s.mp3';
const engine = createNodeMediaEngine(bundledFfmpeg());
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m10-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => [TWO_KEYS, BEEPS, TONES].includes(f.name)),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

test('Book B Task 11k: the first 19 s from C to F, then 1.4× faster', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, TWO_KEYS), 1);
  await select(page, '0', '19');
  await applyEffect(page, 'Change pitch…', 'Change pitch', async (dialog) => {
    await dialog.getByLabel('From key').selectOption({ label: 'C' });
    await dialog.getByLabel('To key').selectOption({ label: 'F' });
    await expect(dialog.getByRole('button', { name: 'Up' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(dialog.getByLabel('Semitones')).toHaveValue('5');
    await expect(dialog.getByText(/261\.6 Hz → 349\.2 Hz/)).toBeVisible();
    await shot(page, '11k-pitch');
  });
  await menu(app, 'Edit', 'Select All');
  await applyEffect(page, 'Change speed…', 'Change speed', async (dialog) => {
    await dialog.getByLabel('Speed multiplier').fill('1.4');
    await dialog.getByLabel('Speed multiplier').press('Tab');
    await expect(dialog.getByText(/45\.00 s → 32\.14 s/)).toBeVisible();
  });
  const file = await exportAudio(app, page, join(dir, 'Task_11k.mp3'), { mono: true });
  const info = await engine.probe(file);
  expect(info.audio).toMatchObject({ codec: 'mp3', channels: 1 });
  expect(Math.abs(info.duration! - 32.14)).toBeLessThan(0.1);
  await app.close();
});

test('Book A 11.20 (5 % lower) with the percent box: semitones and the direction follow', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, TWO_KEYS), 1);
  await menu(app, 'Edit', 'Select All');
  await applyEffect(page, 'Change pitch…', 'Change pitch', async (dialog) => {
    await dialog.getByLabel('Percent change').fill('-5');
    await dialog.getByLabel('Percent change').press('Tab');
    await expect(dialog.getByLabel('Semitones')).toHaveValue('-0.89');
    await expect(dialog.getByRole('button', { name: 'Down' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  const history = page.getByRole('complementary', { name: 'Selected track' });
  await expect(history.getByText(/Change pitch/)).toBeVisible();
  await app.close();
});

test('Book B Task 11o: echo 0.5 s / 0.8 between 10 and 20 s; Delay offers its three types', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, BEEPS), 1);
  await select(page, '10', '20');
  await applyEffect(page, 'Echo…', 'Echo', async (dialog) => {
    await dialog.getByLabel('Delay time').fill('0.5');
    await dialog.getByLabel('Decay factor').fill('0.8');
    await dialog.getByLabel('Decay factor').press('Tab');
    await expect(dialog.getByText(/0\.50 s \(×0\.80\), 1\.00 s \(×0\.64\)/)).toBeVisible();
    await shot(page, '11o-echo');
  });
  await select(page, '26', '30');
  await applyEffect(page, 'Delay…', 'Delay', async (dialog) => {
    // The three type buttons fit inside the dialog, each on one line.
    const box = (await dialog.boundingBox())!;
    for (const name of ['Regular', 'Bouncing ball', 'Reverse bouncing ball']) {
      const b = (await dialog.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
      expect(b.height).toBeLessThan(40);
    }
    await dialog.getByRole('button', { name: 'Bouncing ball', exact: true }).click();
    await expect(dialog.getByText(/closer to the one before/)).toBeVisible();
    await shot(page, 'delay');
  });
  const file = await exportAudio(app, page, join(dir, 'Task_11o.mp3'), { mono: true });
  const info = await engine.probe(file);
  expect(Math.abs(info.duration! - (30 + 0.5 + 0.4 + 0.3 + 0.2 + 0.1))).toBeLessThan(0.1);
  await app.close();
});

test('Book B Task 11m (reverb part): reverb between 4 and 6 s, Vocal preset; presets fill the settings', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, BEEPS), 1);
  await select(page, '4', '6');
  await applyEffect(page, 'Reverb…', 'Reverb', async (dialog) => {
    await expect(dialog.getByLabel('Room size')).toHaveValue('60');
    await expect(dialog.getByLabel('Reverberance')).toHaveValue('40');
    await dialog.getByLabel('Preset').selectOption({ label: 'Cathedral' });
    await expect(dialog.getByLabel('Room size')).toHaveValue('100');
    await dialog.getByLabel('Preset').selectOption({ label: 'Vocal' });
    await expect(dialog.getByText(/rings on for about/)).toBeVisible();
    await shot(page, '11m-reverb');
  });
  const history = page.getByRole('complementary', { name: 'Selected track' });
  await expect(history.getByText(/Reverb/)).toBeVisible();
  await app.close();
});

test('Book B Task 11m (EQ part) and Task 11n: Treble boost on 8–11.8 s; a high-pass filter', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, TONES), 1);
  await select(page, '8', '11.8');
  await applyEffect(page, 'Graphic EQ…', 'Graphic EQ', async (dialog) => {
    await dialog.getByLabel('Preset').selectOption({ label: 'Treble boost' });
    // The chosen preset's name is not cut off.
    const fits = await dialog.getByLabel('Preset').evaluate((el: HTMLSelectElement) => {
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = getComputedStyle(el).font;
      const text = el.options[el.selectedIndex]!.text;
      return context.measureText(text).width + 28 <= el.clientWidth;
    });
    expect(fits).toBe(true);
    const bands = dialog.getByRole('group', { name: 'Frequency bands' });
    await expect(bands.getByRole('slider')).toHaveCount(10);
    await expect(bands.getByRole('slider', { name: '8 kHz' })).toHaveValue('10');
    await expect(dialog.getByText(/Louder: 1 kHz \+2/)).toBeVisible();
    // The ten sliders fit in the dialog.
    const box = (await dialog.boundingBox())!;
    const last = (await bands.getByRole('slider', { name: '16 kHz' }).boundingBox())!;
    expect(last.x + last.width).toBeLessThanOrEqual(box.x + box.width);
    await shot(page, '11m-eq');
  });
  await select(page, '10', '20');
  await applyEffect(page, 'High-pass filter…', 'High-pass filter', async (dialog) => {
    await expect(dialog.getByLabel('Cut-off')).toHaveValue('1000');
    await expect(dialog.getByText(/500 Hz −7 dB/)).toBeVisible();
    await shot(page, '11n-highpass');
  });
  const history = page.getByRole('complementary', { name: 'Selected track' });
  await expect(history.getByText(/High-pass filter/)).toBeVisible();
  await app.close();
});
