// M18: Graphics mode in the real app, where only the real canvas can show the result: a logo
// drawn on a new image of a chosen size is saved as a .mveg, exported as a PNG and a JPG whose
// pixels and resolution are right (G10, G11), as a 10 cm SVG (9626/04 M/22 HeronV10cm), and sent
// to Animation mode (GL3). The papers: J/23 BasicWheel (exact px and hex colours), J/17 HUNGRY
// (200 × 200 px, a compressed format for a website).
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jpegDpi, pngDpi } from '../../src/core/image/dpi.ts';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp, menu } from './app.ts';

let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-graphics-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function type(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Tab');
}

/** A PNG's width and height from its header. */
const pngSize = (b: Uint8Array) => ({
  width: (b[16]! << 24) | (b[17]! << 16) | (b[18]! << 8) | b[19]!,
  height: (b[20]! << 24) | (b[21]! << 16) | (b[22]! << 8) | b[23]!,
});

/** The RGBA of one pixel of a picture, as FFmpeg decodes it. */
async function pixel(file: string, x: number, y: number, width: number): Promise<number[]> {
  const raw = join(dir, `${Math.random().toString(36).slice(2)}.rgba`);
  await run(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-i', file, '-frames:v', '1', '-vf', 'format=rgba'],
    ...['-f', 'rawvideo', '-y', raw],
  ]);
  const bytes = await readFile(raw);
  const at = (y * width + x) * 4;
  return [...bytes.subarray(at, at + 4)];
}

async function newImage(page: Page, preset: string) {
  await page.getByRole('button', { name: 'New image' }).click();
  const box = page.getByRole('dialog', { name: 'New image' });
  await box.getByRole('button', { name: preset, exact: true }).click();
  await box.getByRole('button', { name: 'Create' }).click();
  await expect(box).toBeHidden();
}

async function drawEllipse(page: Page) {
  await page.getByRole('button', { name: 'Ellipse', exact: true }).click();
  const stage = page.getByRole('application', { name: 'Stage' });
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();
}

async function exportAs(
  page: Page,
  format: RegExp,
  set?: (box: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Export image' });
  await box.getByRole('radio', { name: format }).check();
  if (set) await set(box);
  await box.getByRole('button', { name: 'Export…' }).click();
  await expect(box).toBeHidden({ timeout: 30_000 });
}

test('J/23 BasicWheel and J/17 HUNGRY: a logo saved, exported as PNG and JPG with the right pixels and dpi', async () => {
  test.setTimeout(120_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Graphics' })
    .click();
  await newImage(page, 'Logo 200 × 200 px');
  await expect(page.getByRole('button', { name: /Image settings: 200 × 200 px/ })).toBeVisible();

  // A red hub of exact size and place: the hex colour typed, as the paper gives it.
  await drawEllipse(page);
  await type(page, 'X', '50');
  await type(page, 'Y', '50');
  await type(page, 'W', '100');
  await type(page, 'H', '100');
  const props = page.getByRole('complementary', { name: 'Properties' });
  const colour = props.getByRole('textbox', { name: 'Colour', exact: true }).first();
  await colour.fill('#FF0000');
  await colour.press('Tab');

  // Saved as a .mveg with its resolution.
  const saved = join(dir, 'Hungry_logo.mveg');
  await answerDialogs(app, { save: saved });
  await menu(app, 'File', 'Save');
  await expect
    .poll(async () => (await readFile(saved, 'utf8').catch(() => '')).includes('"graphic"'))
    .toBe(true);

  // PNG: 200 × 200, 96 dpi inside, red in the middle, white in the corner.
  const png = join(dir, 'Hungry_logo.png');
  await answerDialogs(app, { exportTo: png });
  await exportAs(page, /PNG/);
  const pngBytes = new Uint8Array(await readFile(png));
  expect(pngSize(pngBytes)).toEqual({ width: 200, height: 200 });
  expect(pngDpi(pngBytes)).toEqual({ x: 96, y: 96 });
  expect(await pixel(png, 100, 100, 200)).toEqual([255, 0, 0, 255]);
  expect(await pixel(png, 2, 2, 200)).toEqual([255, 255, 255, 255]);

  // JPG at 600 px wide (the other side in proportion), its dpi written in, the red still red.
  const jpg = join(dir, 'Hungry_logo.jpg');
  await answerDialogs(app, { exportTo: jpg });
  await exportAs(page, /JPG/, async (box) => {
    await box.getByLabel('Size').selectOption('width');
    await box.getByLabel('Width', { exact: true }).fill('600');
  });
  const jpgBytes = new Uint8Array(await readFile(jpg));
  expect(jpegDpi(jpgBytes)).toEqual({ x: 96, y: 96 });
  const [r, g, b] = await pixel(jpg, 300, 300, 600);
  expect(r).toBeGreaterThan(240);
  expect(g).toBeLessThan(15);
  expect(b).toBeLessThan(15);
  await app.close();
});

test('M/22 HeronV10cm: a 10 cm image exports as a 10 cm SVG and a 300 dpi PNG; Send to Animation', async () => {
  test.setTimeout(120_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Graphics' })
    .click();
  await newImage(page, '10 × 10 cm');
  await drawEllipse(page);

  const svg = join(dir, 'HeronV10cm.svg');
  await answerDialogs(app, { exportTo: svg });
  await exportAs(page, /SVG/);
  expect(await readFile(svg, 'utf8')).toMatch(/width="10cm" height="10cm" viewBox="0 0 1181 1181"/);

  const png = join(dir, 'HeronV10cm.png');
  await answerDialogs(app, { exportTo: png });
  await exportAs(page, /PNG/);
  const bytes = new Uint8Array(await readFile(png));
  expect(pngSize(bytes)).toEqual({ width: 1181, height: 1181 });
  expect(pngDpi(bytes)).toEqual({ x: 300, y: 300 });

  // GL3: the drawing goes on as editable objects in Animation mode.
  await page.getByRole('button', { name: 'Send to Animation' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Mode' }).getByRole('button', { name: 'Animation' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText(/One object from Untitled added/)).toBeVisible();
  await app.close();
});
