// M17a: steps of real 9626 papers through the real app, where only the real canvas and FFmpeg
// can show the result. AN21 (M/J/23 Conveyor, M/J/26 Gas): a stage with no background exports
// a PNG and a GIF that are see-through around the drawing. AN22 (O/N/25 Apple): the SVG of a
// frame looks like the PNG of the same frame.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp } from './app.ts';

let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-exam-'));
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

async function exportAs(page: Page, format: RegExp) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Export animation' });
  await box.getByRole('radio', { name: format }).check();
  await box.getByRole('button', { name: 'Export file' }).click();
  await expect(box).toBeHidden({ timeout: 60_000 });
}

/** The RGBA of one pixel of the first picture of a file, as FFmpeg decodes it. */
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

test('AN21 Conveyor / Gas: a transparent 400 × 100 stage exports a see-through PNG and GIF', async () => {
  test.setTimeout(180_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const settings = page.getByRole('dialog', { name: 'Stage settings' });
  await type(page, 'Width', '400');
  await type(page, 'Height', '100');
  await settings.getByLabel(/Transparent/).check();
  await settings.getByRole('button', { name: 'Apply' }).click();

  // A rectangle in the middle, with exact numbers.
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  const stage = page.getByRole('application', { name: 'Stage' });
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.7, { steps: 5 });
  await page.mouse.up();
  await type(page, 'X', '150');
  await type(page, 'Y', '25');
  await type(page, 'W', '100');
  await type(page, 'H', '50');

  const png = join(dir, 'Gas_ZZ999_9999.png');
  await answerDialogs(app, { exportTo: png });
  await exportAs(page, /PNG picture of this frame/);
  await expect.poll(() => exists(png), { timeout: 30_000 }).toBe(true);
  expect((await pixel(png, 5, 5, 400))[3]).toBe(0); // outside the drawing: see-through
  expect((await pixel(png, 200, 50, 400))[3]).toBe(255); // the rectangle: solid

  const gif = join(dir, 'ConveyorBelt_ZZ999_9999.gif');
  await answerDialogs(app, { exportTo: gif });
  await exportAs(page, /Animated GIF/);
  await expect.poll(() => exists(gif), { timeout: 60_000 }).toBe(true);
  expect((await pixel(gif, 5, 5, 400))[3]).toBe(0);
  expect((await pixel(gif, 200, 50, 400))[3]).toBe(255);
  await app.close();
});

test('AN22 Apple: the SVG of a frame, drawn by a browser, matches the PNG of that frame', async () => {
  test.setTimeout(180_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  const stage = page.getByRole('application', { name: 'Stage' });
  const draw = async (tool: string, from: [number, number], to: [number, number]) => {
    await page.getByRole('button', { name: tool, exact: true }).click();
    const box = (await stage.boundingBox())!;
    await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
    await page.mouse.up();
  };
  await draw('Ellipse', [0.1, 0.1], [0.4, 0.6]);
  await draw('Star', [0.45, 0.2], [0.7, 0.8]);
  await draw('Rectangle', [0.72, 0.3], [0.95, 0.9]);
  await type(page, 'Rotation', '30'); // turned 30°

  const png = join(dir, 'Apple.png');
  const svg = join(dir, 'Apple_ZZ999_9999.svg');
  await answerDialogs(app, { exportTo: png });
  await exportAs(page, /PNG picture of this frame/);
  await expect.poll(() => exists(png), { timeout: 30_000 }).toBe(true);
  await answerDialogs(app, { exportTo: svg });
  await exportAs(page, /SVG picture of this frame/);
  await expect.poll(() => exists(svg), { timeout: 30_000 }).toBe(true);

  const pngUrl = `data:image/png;base64,${(await readFile(png)).toString('base64')}`;
  const svgUrl = `data:image/svg+xml;base64,${(await readFile(svg)).toString('base64')}`;
  const differ = await page.evaluate(
    async ([a, b]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((done, fail) => {
          const img = new Image();
          img.onload = () => done(img);
          img.onerror = fail;
          img.src = src;
        });
      const [p, s] = await Promise.all([load(a!), load(b!)]);
      const pixels = (img: HTMLImageElement) => {
        const c = document.createElement('canvas');
        c.width = p.naturalWidth;
        c.height = p.naturalHeight;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, c.width, c.height);
        return g.getImageData(0, 0, c.width, c.height).data;
      };
      const [x, y] = [pixels(p), pixels(s)];
      let off = 0;
      for (let i = 0; i < x.length; i += 4) {
        const d = Math.max(
          Math.abs(x[i]! - y[i]!),
          Math.abs(x[i + 1]! - y[i + 1]!),
          Math.abs(x[i + 2]! - y[i + 2]!),
        );
        if (d > 64) off++;
      }
      return off / (x.length / 4);
    },
    [pngUrl, svgUrl],
  );
  // Only the edges' smoothing may differ: well under 1 % of the pixels.
  expect(differ).toBeLessThan(0.01);
  await app.close();
});
