// M17 step 4: the smoke test of a packaged OneEditor, run by CI after "npm run package -- --dir"
// with PACKAGED_APP=1. The installed program, not the source, opens an animation with a picture
// and text (File ▸ Open Animation…) and exports it as an MP4 (with the packaged FFmpeg) and as a
// web page (with the bundled player), which then plays in a window.
// Without PACKAGED_APP the test is skipped (it is not part of the normal E2E run).
import { _electron as electron, expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { packagedProgram } from '../../scripts/lib/package.ts';
import { createAnimation, createPicture, createText } from '../../src/core/animation/factory.ts';
import { serializeAnimation } from '../../src/core/animation/serialize.ts';
import type { Picture } from '../../src/core/animation/types.ts';
import { newId } from '../../src/core/model/factory.ts';
import { createNodeMediaEngine } from '../../src/main/media/engine.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, BACKGROUND_ENV, menu, root } from './app.ts';

const execFileAsync = promisify(execFile);

test.skip(!process.env.PACKAGED_APP, 'run by CI on the packaged app (PACKAGED_APP=1)');

test('the packaged app opens an animation with a picture and text, and exports an MP4 and a web page', async () => {
  test.setTimeout(180_000);
  const dir = mkdtempSync(join(tmpdir(), 'mve-packaged-'));
  mkdirSync(join(dir, 'pictures'));
  await execFileAsync(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'color=red:s=160x120', '-frames:v', '1'],
    join(dir, 'pictures', 'red.png'),
  ]);
  // 320 × 240, 1 s at 24 fps: the picture at (20, 20), text under it. Its path is relative (X1).
  const picture: Picture = { id: newId(), path: 'pictures/red.png', width: 160, height: 120 };
  const doc = createAnimation({ name: 'Smoke' });
  const file = join(dir, 'Smoke.mvea');
  writeFileSync(
    file,
    serializeAnimation({
      ...doc,
      stage: { ...doc.stage, width: 320, height: 240, length: 24 },
      pictures: [picture],
      layers: [
        {
          ...doc.layers[0]!,
          objects: [
            createPicture(picture, { x: 20, y: 20 }),
            createText('OneEditor', { x: 20, y: 170, size: 32 }),
          ],
        },
      ],
    }),
  );

  const userData = mkdtempSync(join(tmpdir(), 'mve-packaged-userdata-'));
  writeFileSync(join(userData, 'preferences.json'), '{"welcomeSeen":true}\n');
  const app = await electron.launch({
    executablePath: join(root, packagedProgram(process.platform, process.arch)),
    env: { ...process.env, ...BACKGROUND_ENV, ONEEDITOR_USER_DATA: userData },
  });
  const page = await app.firstWindow();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await answerDialogs(app, { open: [file] });
  await menu(app, 'File', 'Open Animation…');
  await expect(page.getByText('red.png', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/missing|could not be found/i)).toHaveCount(0);

  const exportAs = async (format: RegExp, output: string) => {
    await answerDialogs(app, { exportTo: output });
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Export animation' });
    await dialog.getByRole('radio', { name: format }).check();
    await dialog.getByRole('button', { name: 'Export file' }).click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await expect.poll(() => existsSync(output), { timeout: 60_000 }).toBe(true);
  };

  // The MP4, made by the packaged FFmpeg, shows the picture.
  const mp4 = join(dir, 'Smoke.mp4');
  await exportAs(/MP4 video/, mp4);
  const info = await createNodeMediaEngine(bundledFfmpeg()).probe(mp4);
  expect(info.video).toMatchObject({ codec: 'h264', width: 320, height: 240, fps: 24 });
  expect(info.duration).toBeCloseTo(1, 1);
  const { stdout } = await execFileAsync(
    bundledFfmpeg().ffmpeg,
    [
      ...['-v', 'error', '-i', mp4, '-frames:v', '1'],
      ...['-vf', 'format=rgb24,crop=1:1:100:80', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    ],
    { encoding: 'buffer' },
  );
  const [r, g, b] = stdout as Buffer;
  expect(r).toBeGreaterThan(200);
  expect(g! + b!).toBeLessThan(120);

  // The web page carries the bundled player: it starts in a window.
  const html = join(dir, 'Smoke.html');
  await exportAs(/HTML web animation/, html);
  const started = await app.evaluate(async ({ BrowserWindow }, page) => {
    const win = new BrowserWindow({ show: false });
    await win.loadFile(page);
    for (let i = 0; i < 100; i++) {
      if (await win.webContents.executeJavaScript('!!window.oneeditor')) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const ok = await win.webContents.executeJavaScript('!!window.oneeditor?.player');
    win.destroy();
    return ok;
  }, html);
  expect(started).toBe(true);
  await app.close();
});
