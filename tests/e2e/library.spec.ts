// M16b / AN19, AN20 in the real app: a library car placed in the middle of the stage, given Fly in
// from the left; the exported pictures show it off the stage at the start and in place at the end.
import { expect, test, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp } from './app.ts';

const run = promisify(execFile);
let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-library-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

async function rgb(file: string, x: number, y: number): Promise<number[]> {
  const { stdout } = await run(
    bundledFfmpeg().ffmpeg,
    ['-v', 'error', '-i', file, '-vf', `format=rgb24,crop=1:1:${x}:${y}`, '-f', 'rawvideo', '-'],
    { encoding: 'buffer' },
  );
  return [...(stdout as Buffer).subarray(0, 3)];
}

async function exportFrame(
  page: Page,
  app: Parameters<typeof answerDialogs>[0],
  frame: number,
  file: string,
) {
  const box = page.getByLabel('Go to frame');
  await box.fill(String(frame));
  await box.press('Enter');
  await answerDialogs(app, { exportTo: file });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export animation' });
  await dialog.getByRole('radio', { name: /PNG picture of this frame/ }).check();
  await dialog.getByRole('button', { name: 'Export file' }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });
  await expect
    .poll(() =>
      stat(file).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true);
}

test('AN19, AN20 a library car flies in from the left, and the export shows it', async () => {
  test.setTimeout(240_000);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: 'Library', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Library' })
    .getByRole('button', { name: 'Add Car' })
    .click();
  const panel = page.getByRole('complementary', { name: 'Properties' });
  await panel.getByLabel('Effect').selectOption('flyInLeft');
  await panel.getByLabel('Lasts (s)').fill('1');
  await panel.getByRole('button', { name: 'Add effect' }).click();
  // The car's body is red, in the middle of the 1280 × 720 stage once it has landed.
  const start = join(dir, 'start.png');
  const end = join(dir, 'end.png');
  await exportFrame(page, app, 0, start);
  await exportFrame(page, app, 24, end);
  const red = (p: number[]) => p[0]! > 180 && p[1]! < 110 && p[2]! < 110;
  expect(red(await rgb(end, 640, 360))).toBe(true);
  expect(red(await rgb(start, 640, 360))).toBe(false);
  await app.close();
});
