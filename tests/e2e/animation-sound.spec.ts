// AN28, AN15 through the real app (9626/04 M/J/19: an alarm sound in the animation; 9626/04 M/19:
// an AVI): a sound added on the timeline goes into the MP4 and the AVI (exported smaller), and
// into the web page, which plays it in a browser — at once where sound is allowed, after a click
// on "Click to play with sound" where the browser blocks sound until a click.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bundledFfmpeg, run } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp } from './app.ts';

let dir: string;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-sound-'));
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** The codec and size of each stream of a file, as ffprobe reads them. */
async function streams(file: string): Promise<string> {
  const { stdout } = await run(bundledFfmpeg().ffprobe, [
    ...['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height'],
    ...['-of', 'compact=p=0:nk=1', file],
  ]);
  return stdout.trim();
}

async function exportAs(page: Page, format: RegExp, width?: string) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Export animation' });
  await box.getByRole('radio', { name: format }).check();
  if (width) await box.getByRole('textbox', { name: 'Width in pixels' }).fill(width);
  await box.getByRole('button', { name: 'Export file' }).click();
  await expect(box).toBeHidden({ timeout: 60_000 });
}

test('AN28 M/J/19 alarm: the sound goes into the MP4, a smaller AVI and the web page, which plays it', async () => {
  test.setTimeout(240_000);
  const alarm = join(dir, 'alarm.mp3');
  await run(bundledFfmpeg().ffmpeg, [
    ...['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=880:duration=2', alarm],
  ]);
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await answerDialogs(app, { open: [alarm] });
  const timeline = page.getByRole('region', { name: 'Timeline' });
  await timeline.getByRole('button', { name: 'Add sound…' }).click();
  await expect(timeline.getByRole('button', { name: 'alarm.mp3 from frame 0' })).toBeVisible();

  const mp4 = join(dir, 'Alarm.mp4');
  await answerDialogs(app, { exportTo: mp4 });
  await exportAs(page, /MP4 video/);
  await expect.poll(() => exists(mp4), { timeout: 30_000 }).toBe(true);
  expect(await streams(mp4)).toMatch(/h264\|video\|1280\|720[\s\S]*aac\|audio/);

  const avi = join(dir, 'Alarm.avi');
  await answerDialogs(app, { exportTo: avi });
  await exportAs(page, /AVI video/, '640');
  await expect.poll(() => exists(avi), { timeout: 30_000 }).toBe(true);
  expect(await streams(avi)).toMatch(/mpeg4\|video\|640\|360[\s\S]*mp3\|audio/);

  const html = join(dir, 'Alarm.html');
  await answerDialogs(app, { exportTo: html });
  await exportAs(page, /HTML web animation/);
  await expect.poll(() => exists(html), { timeout: 30_000 }).toBe(true);
  expect(await readFile(html, 'utf8')).toContain('data:audio/mpeg;base64,');

  // A browser window that lets sound play at once, and one that waits for a click.
  const seen = await app.evaluate(async ({ BrowserWindow }, file) => {
    const look = async (
      policy: 'no-user-gesture-required' | 'document-user-activation-required',
    ) => {
      const win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: { autoplayPolicy: policy },
      });
      await win.loadFile(file);
      const read = () =>
        win.webContents.executeJavaScript(`(() => {
          const p = window.oneeditor && window.oneeditor.player;
          return p ? { state: p.state(), button: !!document.getElementById('sound-start') } : null;
        })()`);
      let before = null;
      for (let i = 0; i < 100 && !before; i++) {
        before = await read();
        if (!before) await new Promise((r) => setTimeout(r, 100));
      }
      // A real click in the middle of the window (a browser counts only a person's click).
      win.webContents.sendInputEvent({
        type: 'mouseDown',
        x: 400,
        y: 300,
        button: 'left',
        clickCount: 1,
      });
      win.webContents.sendInputEvent({
        type: 'mouseUp',
        x: 400,
        y: 300,
        button: 'left',
        clickCount: 1,
      });
      await new Promise((r) => setTimeout(r, 800));
      const after = await read();
      win.destroy();
      return { before, after };
    };
    return {
      allowed: await look('no-user-gesture-required'),
      blocked: await look('document-user-activation-required'),
    };
  }, html);
  expect(seen.allowed.before).toMatchObject({ button: false, state: { playing: true } });
  expect(seen.blocked.before).toMatchObject({ button: true, state: { frame: 0, playing: false } });
  expect(seen.blocked.after).toMatchObject({ button: false, state: { playing: true } });
  await app.close();
});
