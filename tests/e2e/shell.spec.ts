import { expect, test } from '@playwright/test';
import { launchApp } from './app.ts';

test.describe('M4 app shell', () => {
  test('opens the EasyMedia window', async () => {
    const { app, window: page } = await launchApp();
    await expect(page).toHaveTitle('Untitled — EasyMedia');
    await expect(page.getByRole('heading', { name: 'EasyMedia' })).toBeVisible();
    await app.close();
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
    const hit = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x!, y!)?.textContent?.trim(),
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
