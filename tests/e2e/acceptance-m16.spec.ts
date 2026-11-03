// M16 through the real app: pictures (AN5). An SVG (which FFmpeg cannot draw) and a PNG placed
// with the Picture tool, exported and checked pixel by pixel; the animation saved, opened again
// in a new start of the app (the pictures still drawn), and packaged with its pictures.
import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
        const p = window.oneeditor && window.oneeditor.player;
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

/** In a window showing an animation's web page: clicks at a stage point, as a viewer would. */
const clickScript = (x: number, y: number) => `(() => {
  const c = document.getElementById('stage');
  const r = c.getBoundingClientRect();
  const at = { clientX: r.left + ${x} * r.width / c.width, clientY: r.top + ${y} * r.height / c.height, bubbles: true };
  c.dispatchEvent(new MouseEvent('click', at));
  return window.oneeditor.player.state();
})()`;

test('AN18 workbook Task 4: Pause and Continue buttons work in Test and in the exported web page', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  await animationMode(page);
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  const place = async (x: number, y: number) => {
    await tools(page).getByRole('button', { name: 'Button', exact: true }).click();
    await page.mouse.click(stage.x + stage.width * 0.5, stage.y + stage.height * 0.5);
    await type(page, 'X', String(x));
    await type(page, 'Y', String(y));
  };
  await place(10, 10);
  await place(10, 40);
  await page.getByLabel('Action', { exact: true }).selectOption('continue');
  await expect(page.getByLabel('Label', { exact: true })).toHaveValue('Continue');
  // Something that moves, so playing and pausing can be seen.
  await tools(page).getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.4, stage.y + stage.height * 0.4);
  await page.mouse.up();

  // Test: the page in a window of its own, where the buttons work.
  await page.getByRole('button', { name: 'Test', exact: true }).click();
  await expect
    .poll(() =>
      app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().some((w) => w.getTitle() === 'Test: Untitled'),
      ),
    )
    .toBe(true);
  const inTest = (script: string) =>
    app.evaluate(async ({ BrowserWindow }, s) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'Test: Untitled')!;
      for (let i = 0; i < 100; i++) {
        if (await win.webContents.executeJavaScript('!!window.oneeditor')) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      return win.webContents.executeJavaScript(s);
    }, script);
  const paused = await inTest(clickScript(55, 22));
  expect(paused.playing).toBe(false);
  await new Promise((r) => setTimeout(r, 400));
  expect(await inTest('window.oneeditor.player.state()')).toEqual(paused); // still on that frame
  expect((await inTest(clickScript(55, 52))).playing).toBe(true);

  // The exported web page does the same in a plain browser window.
  const html = join(dir, 'Chapter07_Task4.html');
  await answerDialogs(app, { exportTo: html });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: /HTML web animation/ }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect.poll(() => exists(html), { timeout: 30_000 }).toBe(true);
  const states = await app.evaluate(
    async ({ BrowserWindow }, [file, pause, resume]) => {
      const win = new BrowserWindow({ show: false, width: 1300, height: 760 });
      await win.loadFile(file);
      for (let i = 0; i < 100; i++) {
        if (await win.webContents.executeJavaScript('!!window.oneeditor')) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      const afterPause = await win.webContents.executeJavaScript(pause);
      await new Promise((r) => setTimeout(r, 400));
      const later = await win.webContents.executeJavaScript('window.oneeditor.player.state()');
      const afterContinue = await win.webContents.executeJavaScript(resume);
      win.destroy();
      return { afterPause, later, afterContinue };
    },
    [html, clickScript(55, 22), clickScript(55, 52)] as const,
  );
  expect(states.afterPause.playing).toBe(false);
  expect(states.later).toEqual(states.afterPause);
  expect(states.afterContinue.playing).toBe(true);
  await app.close();
});

// ---- M16 exit gate in the real app: real picture files, stop motion and frame-by-frame ----

/** The colour of one pixel of a video at a time (s), as [r, g, b]. */
async function rgbAt(file: string, seconds: number, x: number, y: number): Promise<number[]> {
  const { stdout } = await execFileAsync(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-ss', String(seconds), '-i', file, '-frames:v', '1'],
      // To RGB first: a 1 × 1 crop of yuv420p video would leave no colour plane.
      ...['-vf', `format=rgb24,crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    ],
    { encoding: 'buffer' },
  );
  return [...(stdout as Buffer).subarray(0, 3)];
}

async function stageSize(page: Page, width: number, height: number, length: number) {
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const settings = page.getByRole('dialog', { name: 'Stage settings' });
  await type(page, 'Width', String(width));
  await type(page, 'Height', String(height));
  await type(page, 'Length', String(length));
  await settings.getByRole('button', { name: 'Apply' }).click();
}

async function goTo(page: Page, frame: number) {
  const box = page.getByLabel('Go to frame');
  await box.fill(String(frame));
  await box.press('Enter');
}

async function exportAs(
  page: Page,
  app: Parameters<typeof answerDialogs>[0],
  format: RegExp,
  file: string,
) {
  await answerDialogs(app, { exportTo: file });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: format }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 120_000 });
  await expect.poll(() => exists(file), { timeout: 60_000 }).toBe(true);
}

/** A JPG photograph of one colour, made by FFmpeg. */
async function photo(name: string, colour: string, size: string) {
  const file = join(dir, name);
  await execFileAsync(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', `color=${colour}:s=${size}`, '-frames:v', '1'],
    ...['-q:v', '2', file],
  ]);
  return file;
}

test('Workbook Task 3 with real photographs: each slide moves in from the left and the MP4 shows it', async () => {
  test.setTimeout(300_000);
  const slides = [
    await photo('Paris1.jpg', 'red', '800x600'),
    await photo('Paris2.jpg', 'lime', '450x600'), // portrait
  ];
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await stageSize(page, 1024, 768, 144);
  // Paris1 comes in from the left over 3 s (frames 0–72) to (110, 80); Paris2 in the 4th–6th s.
  for (const [i, file] of slides.entries()) {
    await answerDialogs(app, { open: [file] });
    await goTo(page, 0);
    await placePicture(page, `Paris${i + 1}.jpg`, [-900, 80]);
    await goTo(page, 72 * i);
    await page.getByRole('button', { name: 'Insert keyframe' }).click();
    await goTo(page, 72 * i + 72);
    await type(page, 'X', '110');
  }
  const mp4 = join(dir, 'Chapter07_Task3.mp4');
  await exportAs(page, app, /MP4 video/, mp4);
  // At 1.5 s Paris1 is halfway in: its right edge has passed the middle of where it ends.
  expect(near(await rgbAt(mp4, 1.5, 50, 300), [255, 0, 0])).toBe(true);
  expect(near(await rgbAt(mp4, 3, 500, 300), [255, 0, 0])).toBe(true);
  // At 6 s the portrait Paris2 is in place over Paris1, keeping its own shape (450 × 600).
  expect(near(await rgbAt(mp4, 5.9, 300, 300), [0, 255, 0])).toBe(true);
  expect(near(await rgbAt(mp4, 5.9, 700, 300), [255, 0, 0])).toBe(true);
  await app.close();
});

test('AN14 Import frames: a folder of photographs becomes a stop motion, exported picture by picture', async () => {
  test.setTimeout(300_000);
  const folder = join(dir, 'clay');
  await mkdir(folder);
  const colours = ['red', 'lime', 'blue', 'yellow'];
  for (const [i, colour] of colours.entries())
    await execFileAsync(bundledFfmpeg().ffmpeg, [
      ...['-v', 'error', '-f', 'lavfi', '-i', `color=${colour}:s=320x240`, '-frames:v', '1'],
      join(folder, `shot${i + 1}.png`),
    ]);
  await writeFile(join(folder, 'notes.txt'), 'not a picture');
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await stageSize(page, 320, 240, 24);
  await page.getByRole('button', { name: 'Import frames', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Import frames' });
  await dialog.getByLabel('Pictures a second').fill('4');
  await answerDialogs(app, { open: [folder] });
  await dialog.getByRole('button', { name: 'Choose folder…' }).click();
  await expect(page.getByText(/Imported 4 pictures: 1 s at 4 pictures a second/)).toBeVisible();
  const mp4 = join(dir, 'clay.mp4');
  await exportAs(page, app, /MP4 video/, mp4);
  // Each picture is held for a quarter of a second, in the order of the names.
  expect(near(await rgbAt(mp4, 0.1, 160, 120), [255, 0, 0])).toBe(true);
  expect(near(await rgbAt(mp4, 0.35, 160, 120), [0, 255, 0])).toBe(true);
  expect(near(await rgbAt(mp4, 0.6, 160, 120), [0, 0, 255])).toBe(true);
  expect(near(await rgbAt(mp4, 0.85, 160, 120), [255, 255, 0])).toBe(true);
  await app.close();
});

test('AN14 frame-by-frame: Duplicate frame and onion skin on the stage; exported drawing by drawing', async () => {
  test.setTimeout(300_000);
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await stageSize(page, 400, 200, 24);
  // A black square at (20, 80) in the first drawing.
  await tools(page).getByRole('button', { name: 'Rectangle', exact: true }).click();
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  await page.mouse.move(stage.x + stage.width * 0.4, stage.y + stage.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * 0.5, stage.y + stage.height * 0.6, { steps: 4 });
  await page.mouse.up();
  for (const [label, value] of [
    ['X', '20'],
    ['Y', '80'],
    ['W', '40'],
    ['H', '40'],
  ] as const)
    await type(page, label, value);
  await page.getByRole('button', { name: 'Make frame-by-frame' }).click();
  // The next drawing at frame 12: a copy, moved to (300, 80).
  await goTo(page, 12);
  await page.getByRole('button', { name: 'Duplicate frame' }).click();
  await type(page, 'X', '300');

  /** The stage canvas's pixel at a stage point, as [r, g, b]. */
  const pixel = (x: number, y: number) =>
    page.evaluate(
      ([px, py]) => {
        const c = document.querySelector('.paper canvas') as HTMLCanvasElement;
        const scale = c.width / 400;
        const d = c
          .getContext('2d')!
          .getImageData(Math.round(px! * scale), Math.round(py! * scale), 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      },
      [x, y],
    );
  // Without onion skin only the drawing at frame 12 is seen; with it, the first one faintly.
  expect(await pixel(40, 100)).toEqual([255, 255, 255]);
  await page.getByRole('button', { name: 'Onion skin' }).click();
  await expect.poll(async () => (await pixel(40, 100))[0]).toBeLessThan(250);
  const faint = await pixel(40, 100);
  expect(faint[0]).toBeGreaterThan(120); // faint, not solid
  expect((await pixel(320, 100))[0]).toBeLessThan(160); // the drawing itself, solid

  // The export never shows the onion skin.
  const mp4 = join(dir, 'flipbook.mp4');
  await exportAs(page, app, /MP4 video/, mp4);
  expect(near(await rgbAt(mp4, 0.2, 40, 100), [154, 164, 178])).toBe(true); // the first drawing
  expect(near(await rgbAt(mp4, 0.2, 320, 100), [255, 255, 255])).toBe(true);
  expect(near(await rgbAt(mp4, 0.75, 40, 100), [255, 255, 255])).toBe(true); // the second drawing
  expect(near(await rgbAt(mp4, 0.75, 320, 100), [154, 164, 178])).toBe(true);
  await app.close();
});

test('N10 at 1100 × 700 the timeline keeps its rows when its bar wraps; a row can still be clicked', async () => {
  const { app, window: page } = await launchApp();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setSize(1100, 700));
  await animationMode(page);
  const stage = (await page.getByRole('application', { name: 'Stage' }).boundingBox())!;
  for (const tool of ['Rectangle', 'Ellipse', 'Star', 'Polygon']) {
    await tools(page).getByRole('button', { name: tool, exact: true }).click();
    await page.mouse.move(stage.x + stage.width * 0.2, stage.y + stage.height * 0.2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.3, stage.y + stage.height * 0.3, { steps: 3 });
    await page.mouse.up();
  }
  const timeline = page.getByRole('region', { name: 'Timeline' });
  await timeline.getByRole('button', { name: 'Make frame-by-frame' }).click();
  const sizes = await page.evaluate(() => {
    const t = document.querySelector('[aria-label="Timeline"]')!;
    const h = (sel: string) => t.querySelector(sel)!.getBoundingClientRect().height;
    return { bar: h('.bar'), grid: h('.grid') };
  });
  expect(sizes.bar).toBeGreaterThan(40); // the bar wraps onto two lines at this size…
  expect(sizes.grid).toBe(152); // …and the rows keep all their room
  // The first object's row, scrolled to, is not hidden under the ruler or the scroll bar.
  await timeline.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await expect(timeline.getByRole('button', { name: 'Rectangle', exact: true })).toHaveClass(
    /selected/,
  );
  await app.close();
});
