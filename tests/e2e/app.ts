// Launches the built EasyMedia app for end-to-end tests.
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));

export async function launchApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({ args: [root], cwd: root });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}
