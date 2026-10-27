import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, launchApp, menu } from './app.ts';
import { shot } from './audio.ts';

test.describe('M4 app shell', () => {
  test('opens the EasyMedia window', async () => {
    const { app, window: page } = await launchApp();
    await expect(page).toHaveTitle('Untitled — EasyMedia');
    await expect(page.getByRole('heading', { name: 'EasyMedia' })).toBeVisible();
    await app.close();
  });

  test('X7 the first launch shows the Welcome once; Help ▸ Licences shows the licences', async () => {
    const first = await launchApp([], { firstLaunch: true });
    const welcome = first.window.getByRole('dialog', { name: 'Welcome to EasyMedia' });
    await expect(welcome).toBeVisible();
    await shot(first.window, 'welcome');
    await welcome.getByRole('button', { name: 'Start' }).click();
    await expect(welcome).toBeHidden();
    await first.app.close();

    const again = await launchApp([], { userData: first.userData });
    await expect(again.window.getByRole('heading', { name: 'EasyMedia' })).toBeVisible();
    await expect(again.window.getByRole('dialog', { name: 'Welcome to EasyMedia' })).toHaveCount(0);
    await menu(again.app, 'Help', 'Licences');
    const licences = again.window.getByRole('dialog', { name: 'Licences' });
    await expect(licences).toContainText('FFmpeg 9.0.2');
    await expect(licences).toContainText('SIL OPEN FONT LICENSE');
    await shot(again.window, 'licences');
    await again.app.close();
  });

  test('ARCHITECTURE §2 security: isolated, sandboxed, no Node.js in the page; only window.mve', async () => {
    const { app, window: page } = await launchApp();
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0]!.webContents as unknown as {
        getLastWebPreferences(): {
          contextIsolation: boolean;
          sandbox: boolean;
          nodeIntegration: boolean;
        };
      };
      const p = contents.getLastWebPreferences();
      return {
        contextIsolation: p.contextIsolation,
        sandbox: p.sandbox,
        nodeIntegration: p.nodeIntegration,
      };
    });
    expect(prefs).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false });
    const exposed = await page.evaluate(() => ({
      hasRequire: typeof (globalThis as { require?: unknown }).require !== 'undefined',
      hasProcess: typeof (globalThis as { process?: unknown }).process !== 'undefined',
      bridge: typeof (globalThis as { mve?: unknown }).mve,
    }));
    expect(exposed).toEqual({ hasRequire: false, hasProcess: false, bridge: 'object' });
    await app.close();
  });

  test('blocks pop-up windows and navigation away from the app', async () => {
    const { app, window: page } = await launchApp();
    await page.evaluate(() => window.open('https://example.com'));
    await page
      .evaluate(() => {
        location.href = 'https://example.com';
      })
      .catch(() => {});
    await page.waitForTimeout(500);
    expect(app.windows()).toHaveLength(1);
    expect(page.url()).toMatch(/^file:/);
    await app.close();
  });
});

// Regression: in a short window the 16:9 preview grew taller than its space and covered the
// toolbar (seen on the macOS Apple Silicon CI runner): the Import button could not be clicked.
test('at the smallest window size (1100 × 700) nothing covers the toolbar and the preview fits', async () => {
  const { app, window: page } = await launchApp();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setContentSize(1100, 700),
  );
  await page.waitForTimeout(300);
  for (const name of ['Import', 'Undo', 'Save', 'Export']) {
    const box = (await page.getByRole('button', { name }).boundingBox())!;
    // The button itself (or something inside it, like its icon) must be what is under its centre.
    const hit = await page.evaluate(
      ([x, y]) => {
        const button = document.elementFromPoint(x!, y!)?.closest('button');
        return button?.getAttribute('aria-label') ?? button?.textContent?.trim();
      },
      [box.x + box.width / 2, box.y + box.height / 2],
    );
    expect(hit, `${name} button is covered`).toBe(name);
  }
  const screen = (await page.locator('.screen').boundingBox())!;
  const stage = (await page.locator('.stage').boundingBox())!;
  expect(screen.y).toBeGreaterThanOrEqual(stage.y - 1);
  expect(screen.y + screen.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
  await app.close();
});

test('quitting while previews are being made stops FFmpeg and closes at once (regression)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mve-quit-'));
  const names = ['clip_1080p30_10s.mp4', 'lake_1080p30_20s.mp4'];
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => names.includes(f.name)),
  );
  const { app, window: page } = await launchApp();
  await answerDialogs(app, { open: names.map((n) => join(dir, n)) });
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByText(names[1]!, { exact: true })).toBeVisible();
  const pid = app.process().pid!;
  // Quit at once, while the preview copies and thumbnails are still being made.
  const closed = await Promise.race([
    app.close().then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 15_000)),
  ]);
  expect(closed, 'the app closed within 15 s').toBe(true);
  expect(() => process.kill(pid, 0), 'the app process is gone').toThrow();
  if (process.platform !== 'win32') {
    // -l shows the command, so a failure says whether it was ffmpeg or ffprobe.
    const left = execSync(`pgrep -lf "ffmpeg.*${dir}" || true`).toString().trim();
    expect(left, 'no FFmpeg left running').toBe('');
  }
  await rm(dir, { recursive: true, force: true });
});
