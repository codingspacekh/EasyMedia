// M16 through the real app: pictures (AN5). An SVG (which FFmpeg cannot draw) and a PNG placed
// with the Picture tool, exported and checked pixel by pixel; the animation saved, opened again
// in a new start of the app (the pictures still drawn), and packaged with its pictures.
import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp, menu } from './app.ts';

const execFileAsync = promisify(execFile);
let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m16-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function type(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Tab');
}

const tools = (page: Page) => page.getByRole('toolbar', { name: 'Animation tools' });

async function animationMode(page: Page) {
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
}

/** Places a picture with the Picture tool, waits for it (named after its file), then types where it goes. */
async function placePicture(page: Page, name: string, at: [number, number]) {
  await tools(page).getByRole('button', { name: 'Picture', exact: true }).click();
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.click(stage.x + stage.width * 0.3, stage.y + stage.height * 0.3);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await type(page, 'X', String(at[0]));
  await type(page, 'Y', String(at[1]));
}

async function exportPng(page: Page, app: Parameters<typeof answerDialogs>[0], file: string) {
  await answerDialogs(app, { exportTo: file });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: /PNG picture of this frame/ }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => exists(file), { timeout: 30_000 }).toBe(true);
}

/** The colour of one pixel of a picture, as [r, g, b]. */
async function rgb(file: string, x: number, y: number): Promise<number[]> {
  const { stdout } = await execFileAsync(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-i', file, '-frames:v', '1'],
      ...['-vf', `crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    ],
    { encoding: 'buffer' },
  );
  return [...(stdout as Buffer).subarray(0, 3)];
}

const near = (actual: number[], expected: number[]) =>
  actual.every((v, i) => Math.abs(v - expected[i]!) < 40);

test('AN5 an SVG and a PNG are placed, exported, opened again in a new start and packaged', async () => {
  test.setTimeout(300_000);
  const svg = join(dir, 'blue box.svg');
  await writeFile(
    svg,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100" fill="#0000ff"/></svg>',
  );
  const png = join(dir, 'red.png');
  await execFileAsync(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=120x80', '-frames:v', '1', png],
  ]);

  const first = await launchApp();
  await animationMode(first.window);
  await answerDialogs(first.app, { open: [svg] });
  await placePicture(first.window, 'blue box.svg', [100, 100]);
  // The SVG's own size, read from the file (FFmpeg reports 0 × 0).
  await expect(first.window.getByLabel('W', { exact: true })).toHaveValue(/^200(\.0+)?$/);
  await expect(first.window.getByLabel('H', { exact: true })).toHaveValue(/^100(\.0+)?$/);
  await answerDialogs(first.app, { open: [png] });
  await placePicture(first.window, 'red.png', [500, 100]);

  const shot = join(dir, 'pictures.png');
  await exportPng(first.window, first.app, shot);
  expect(near(await rgb(shot, 200, 150), [0, 0, 255])).toBe(true); // inside the SVG
  expect(near(await rgb(shot, 560, 140), [255, 0, 0])).toBe(true); // inside the PNG
  expect(near(await rgb(shot, 50, 50), [255, 255, 255])).toBe(true); // the stage

  const saved = join(dir, 'Pictures.mvea');
  await answerDialogs(first.app, { save: saved });
  await menu(first.app, 'File', 'Save');
  await expect.poll(() => exists(saved), { timeout: 10_000 }).toBe(true);
  await first.app.close();

  // A new start of the app: only files it has checked may be shown, so opening must check them.
  const second = await launchApp();
  await animationMode(second.window);
  await answerDialogs(second.app, { open: [saved] });
  await menu(second.app, 'File', 'Open Animation…');
  await expect(second.window.getByText('blue box.svg').first()).toBeVisible();
  const again = join(dir, 'again.png');
  await exportPng(second.window, second.app, again);
  expect(near(await rgb(again, 200, 150), [0, 0, 255])).toBe(true);
  expect(near(await rgb(again, 560, 140), [255, 0, 0])).toBe(true);

  const folder = join(dir, 'hand-in');
  await second.app.evaluate(({ dialog }, f) => {
    dialog.showOpenDialog = (async () => ({
      canceled: false,
      filePaths: [f],
    })) as typeof dialog.showOpenDialog;
  }, folder);
  await menu(second.app, 'File', 'Package Project…');
  await expect.poll(() => exists(join(folder, 'Pictures.mvea')), { timeout: 10_000 }).toBe(true);
  expect(await exists(join(folder, 'pictures', 'blue box.svg'))).toBe(true);
  expect(await exists(join(folder, 'pictures', 'red.png'))).toBe(true);
  expect(await readFile(join(folder, 'Pictures.mvea'), 'utf8')).toContain('"pictures/red.png"');
  await second.app.close();
});

test('AN5 Trace bitmap turns a picture into coloured shapes that export the same', async () => {
  test.setTimeout(240_000);
  // A red square on white, 100 × 100.
  const png = join(dir, 'square.png');
  await execFileAsync(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-filter_complex'],
    'color=white:s=100x100,format=rgb24[bg];color=red:s=50x50,format=rgb24[fg];[bg][fg]overlay=25:25:format=rgb',
    ...['-frames:v', '1', png],
  ]);
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await answerDialogs(app, { open: [png] });
  await placePicture(page, 'square.png', [100, 100]);

  await page.getByRole('button', { name: 'Trace bitmap…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Trace bitmap' });
  await expect(dialog.getByText(/2 shapes in 2 colours/)).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole('button', { name: 'Trace', exact: true }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText('Traced square.png').first()).toBeVisible();

  const shot = join(dir, 'traced.png');
  await exportPng(page, app, shot);
  expect(near(await rgb(shot, 150, 150), [255, 0, 0])).toBe(true); // the red shape
  expect(near(await rgb(shot, 110, 110), [255, 255, 255])).toBe(true); // the white shape
  await app.close();
});

test('AN15 HTML web animation: one file that plays by itself in a browser, with its picture and font', async () => {
  test.setTimeout(240_000);
  const png = join(dir, 'paris.png');
  await execFileAsync(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=120x80', '-frames:v', '1', png],
  ]);
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await answerDialogs(app, { open: [png] });
  await placePicture(page, 'paris.png', [100, 100]);
  await tools(page).getByRole('button', { name: 'Text', exact: true }).click();
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.click(stage.x + stage.width * 0.6, stage.y + stage.height * 0.7);

  const html = join(dir, 'Paris.html');
  await answerDialogs(app, { exportTo: html });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: /HTML web animation/ }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect.poll(() => exists(html), { timeout: 30_000 }).toBe(true);
  const text = await readFile(html, 'utf8');
  expect(text).not.toMatch(/https?:\/\//);
  expect(text).not.toContain(dir); // no path of the student's folder

  // A plain browser window of its own, with nothing of the app: the page alone must play.
  const seen = await app.evaluate(async ({ BrowserWindow }, file) => {
    const win = new BrowserWindow({ show: false, width: 800, height: 600 });
    await win.loadFile(file);
    const read = () =>
      win.webContents.executeJavaScript(`(() => {
        const p = window.easymedia && window.easymedia.player;
        if (!p) return null;
        const c = document.getElementById('stage');
        const px = c.getContext('2d').getImageData(150, 140, 1, 1).data;
        const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family);
        return { state: p.state(), size: [c.width, c.height], pixel: [...px].slice(0, 3), fonts };
      })()`);
    let first = null;
    for (let i = 0; i < 100 && !first; i++) {
      first = await read();
      if (!first) await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 600));
    const later = await read();
    win.destroy();
    return { first, later };
  }, html);
  expect(seen.first).not.toBeNull();
  expect(seen.first.size).toEqual([1280, 720]);
  expect(near(seen.first.pixel, [255, 0, 0])).toBe(true); // the picture, from inside the file
  expect(seen.later.state.playing).toBe(true);
  expect(seen.later.state.frame).toBeGreaterThan(seen.first.state.frame); // it plays
  expect(seen.later.fonts.join(' ')).toMatch(/Inter/); // the text's font, from inside the file
  await app.close();
});
