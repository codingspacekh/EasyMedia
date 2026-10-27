// M13 exit gate through the real app: Animation mode. Workbook Task 1's set-up (a 600 × 400
// stage, the star and the circle with their exact numbers, the text), saved as .mvea, exported
// as a PNG that FFmpeg sees as 600 × 400, closed and opened again; Task 3's stage with rulers
// and grid; Practical Activity 19.01's layers.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp, menu } from './app.ts';
import { shot } from './audio.ts';

let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-m13-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function animationMode(page: Page) {
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await expect(page.getByRole('application', { name: 'Stage' })).toBeVisible();
}

/** Types an exact value into a Properties / Stage settings box (applied when the box is left). */
async function type(page: Page, label: string, value: string, within: Page | Locator = page) {
  const box = within.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Tab');
}

/** A layer's row in the Layers panel (a select's options are options too, so li only). */
const layerRow = (page: Page, name: string) =>
  page.locator('li[role="option"]', { has: page.locator(`xpath=self::*[@aria-label="${name}"]`) });

/** Drags on the stage from one fraction of it to another. */
async function dragOnStage(page: Page, from: [number, number], to: [number, number]) {
  const stage = page.getByRole('application', { name: 'Stage' });
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
  await page.mouse.up();
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

test('Workbook Task 1 set-up: stage, star, circle and text with exact numbers; saved, exported as PNG, reopened', async () => {
  test.setTimeout(180_000);
  const { app, window: page } = await launchApp();
  await animationMode(page);

  // The stage: 600 × 400.
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Stage settings' });
  await type(page, 'Width', '600', dialog);
  await type(page, 'Height', '400', dialog);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(
    page.getByRole('button', { name: /^Stage settings: 3:2 · 600 × 400/ }),
  ).toBeVisible();

  // A star, then its exact numbers.
  await page.getByRole('button', { name: 'Star', exact: true }).click();
  await dragOnStage(page, [0.3, 0.3], [0.5, 0.6]);
  await type(page, 'X', '128');
  await type(page, 'Y', '102');
  await type(page, 'W', '135');
  await type(page, 'H', '135');
  await expect(page.getByLabel('W', { exact: true })).toHaveValue('135.00');

  // The circle of radius 102 at (0, 0).
  await page.getByRole('button', { name: 'Ellipse', exact: true }).click();
  await dragOnStage(page, [0.6, 0.3], [0.8, 0.6]);
  await type(page, 'X', '0');
  await type(page, 'Y', '0');
  await type(page, 'W', '204');
  await type(page, 'H', '204');

  // The text "Task 1" at (193, 73), 64 px.
  await page.getByRole('button', { name: 'Text', exact: true }).click();
  const stage = page.getByRole('application', { name: 'Stage' });
  const box = (await stage.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await type(page, 'Words', 'Task 1');
  await type(page, 'X', '193');
  await type(page, 'Y', '73');
  await type(page, 'Size', '64');
  await expect(layerRow(page, 'Layer 1')).toContainText('3 objects');
  await shot(page, 'animation-m13-task1');

  // Saved in the native format.
  const file = join(dir, 'Chapter07_Task1_1.mvea');
  await answerDialogs(app, { save: file });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => exists(file)).toBe(true);
  await expect(page.getByText(/All changes saved/)).toBeVisible();
  const saved = JSON.parse(await readFile(file, 'utf8'));
  const objects = saved.layers[0].objects;
  expect(objects.map((o: { kind: string }) => o.kind)).toEqual(['star', 'ellipse', 'text']);
  expect(objects[0]).toMatchObject({ x: 128, y: 102, width: 135, height: 135 });
  expect(objects[1]).toMatchObject({ x: 0, y: 0, width: 204, height: 204 });
  expect(objects[2]).toMatchObject({ x: 193, y: 73, size: 64, text: 'Task 1' });

  // Exported as a picture that FFmpeg sees as 600 × 400.
  const png = join(dir, 'Chapter07_Task1_1.png');
  await answerDialogs(app, { exportTo: png });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect.poll(() => exists(png), { timeout: 30_000 }).toBe(true);
  await expect(page.getByText(/Saved Chapter07_Task1_1\.png/)).toBeVisible();
  const info = await createNodeMediaEngine(bundledFfmpeg()).probe(png);
  expect(info.kind).toBe('image');
  expect(info.video).toMatchObject({ width: 600, height: 400 });

  // Closed and opened again: the three objects are back.
  await menu(app, 'File', 'New Animation');
  await expect(layerRow(page, 'Layer 1')).toContainText('0 objects');
  await answerDialogs(app, { open: [file] });
  await menu(app, 'File', 'Open Animation…');
  await expect(layerRow(page, 'Layer 1')).toContainText('3 objects');
  await expect(page).toHaveTitle('Chapter07_Task1_1 — EasyMedia');
  await menu(app, 'Edit', 'Select All');
  await expect(page.getByText('3 selected')).toBeVisible();
  await app.close();
});

test('Workbook Task 3 stage (1024 × 768, #CBCDF0, rulers and grid) and Activity 19.01 layers in a folder', async () => {
  const { app, window: page } = await launchApp();
  await animationMode(page);
  await page.getByRole('button', { name: /^Stage settings/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Stage settings' });
  await dialog.getByRole('button', { name: '4:3' }).click();
  await type(page, 'Width', '1024', dialog);
  await type(page, 'Height', '768', dialog);
  await type(page, 'Colour', '#CBCDF0', dialog);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(
    page.getByRole('button', { name: /^Stage settings: 4:3 · 1024 × 768/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Rulers' }).click();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.getByLabel('Horizontal ruler')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true');

  // 19.01: the stick person's parts, each on its own layer, in a folder.
  await page.getByRole('button', { name: 'Folder' }).click();
  for (const part of ['head', 'body', 'left-arm']) {
    await page.getByRole('button', { name: 'Layer', exact: true }).click();
    const row = page.locator('li[role="option"]').first();
    await row.dblclick();
    const name = page.getByLabel('Layer name');
    await name.fill(part);
    await name.press('Enter');
    await expect(layerRow(page, part)).toBeVisible();
    await page.getByLabel(`Folder of ${part}`).selectOption({ label: 'Folder' });
  }
  // The layer rows only (a folder select's options are options too).
  await expect(page.locator('li[role="option"]')).toHaveCount(4);
  await shot(page, 'animation-m13-task3-layers');
  await app.close();
});
