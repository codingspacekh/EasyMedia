// Help ▸ About OneEditor in the real app: from the OneEditor menu on a Mac (Help on Windows), the
// version running, the copyright and licence, and the website opened in the browser by the main
// process (the call is caught here, so no browser opens).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, menu, root } from './app.ts';

test('About OneEditor shows the version and licence, and opens codingspacekh.dev', async () => {
  const { app, window } = await launchApp();
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version as string;
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { opened?: string[] }).opened = opened;
    shell.openExternal = async (url: string) => void opened.push(url);
  });
  const page = window.url();
  await menu(app, process.platform === 'darwin' ? 'OneEditor' : 'Help', 'About OneEditor');
  const about = window.getByRole('dialog', { name: 'About OneEditor' });
  await expect(about).toContainText(`Version ${version}`);
  await expect(about).toContainText('© 2026 CodingSpaceKH.');
  await expect(about).toContainText('Free software under the GNU GPL v3.');
  await about.screenshot({ path: test.info().outputPath('about.png') });
  await about.getByRole('link', { name: 'codingspacekh.dev' }).click();
  await expect
    .poll(() => app.evaluate(() => (globalThis as { opened?: string[] }).opened))
    .toEqual(['https://codingspacekh.dev']);
  // The page did not go anywhere itself.
  expect(window.url()).toBe(page);
  await about.getByRole('button', { name: 'Close' }).click();
  await expect(about).toBeHidden();
  await app.close();
});
