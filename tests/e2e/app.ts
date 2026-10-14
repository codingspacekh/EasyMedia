// Launches the built EasyMedia app for end-to-end tests, with its own empty user-data folder.
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// No trailing separator: on Windows a trailing backslash before the closing quote of a
// command-line argument escapes the quote, so Electron received a garbled app path and never started.
export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export async function launchApp(): Promise<{
  app: ElectronApplication;
  window: Page;
  userData: string;
}> {
  const userData = mkdtempSync(join(tmpdir(), 'mve-e2e-userdata-'));
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...process.env, EASYMEDIA_USER_DATA: userData },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window, userData };
}

/** Native dialogs cannot be clicked by a test: answer them automatically in the main process. */
export async function answerDialogs(
  app: ElectronApplication,
  answers: { open?: string[]; save?: string; exportTo?: string },
) {
  await app.evaluate(({ dialog }, a) => {
    dialog.showOpenDialog = (async () => ({
      canceled: !a.open,
      filePaths: a.open ?? [],
    })) as typeof dialog.showOpenDialog;
    dialog.showSaveDialog = (async (_w: unknown, options: { title?: string }) => {
      const path = options?.title === 'Export video' ? a.exportTo : a.save;
      return { canceled: !path, filePath: path ?? '' };
    }) as unknown as typeof dialog.showSaveDialog;
  }, answers);
}

/** Clicks a native menu item, e.g. menu(app, 'File', 'Save'). */
export async function menu(app: ElectronApplication, top: string, label: string) {
  await app.evaluate(
    ({ Menu, BrowserWindow }, [t, l]) => {
      const item = Menu.getApplicationMenu()!
        .items.find((i) => i.label === t)!
        .submenu!.items.find((i) => i.label === l)!;
      item.click(undefined, BrowserWindow.getAllWindows()[0], undefined as never);
    },
    [top, label] as const,
  );
}
