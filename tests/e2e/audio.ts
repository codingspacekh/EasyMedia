// Audio mode steps shared by the end-to-end tests (screens 13–20).
import { expect, type ElectronApplication, type Page } from '@playwright/test';
import { basename, join } from 'node:path';
import { answerDialogs } from './app.ts';

/** Screenshots for comparing with the design screens (not checked by the tests). */
export const shots = process.env.EASYMEDIA_SHOTS;

export async function shot(page: Page, name: string) {
  if (shots) await page.screenshot({ path: join(shots, `${name}.png`) });
}

export async function audioMode(page: Page) {
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Audio' })
    .click();
}

/** Imports `file` (a full path) with the toolbar button; `count` tracks are then showing. */
export async function importAudio(
  app: ElectronApplication,
  page: Page,
  file: string,
  count: number,
) {
  await answerDialogs(app, { open: [file] });
  await page.getByRole('button', { name: 'Import audio', exact: true }).click();
  await expect(page.getByRole('region', { name: /^Waveform of / })).toHaveCount(count, {
    timeout: 30_000,
  });
}

export async function setTime(page: Page, label: string, value: string) {
  const box = page.getByLabel(label, { exact: true });
  await box.fill(value);
  await box.press('Enter');
}

export async function select(page: Page, start: string, end: string) {
  await setTime(page, 'Selection start', '0');
  await setTime(page, 'Selection end', end);
  await setTime(page, 'Selection start', start);
}

export async function menuItem(page: Page, top: 'Tracks' | 'Effect', item: string) {
  await page.getByRole('button', { name: top, exact: true }).click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/** Opens an effect from the Effect menu, lets `fill` change its settings, then applies it. */
export async function applyEffect(
  page: Page,
  item: string,
  title: string,
  fill?: (dialog: ReturnType<Page['getByRole']>) => Promise<void>,
) {
  await menuItem(page, 'Effect', item);
  const dialog = page.getByRole('dialog', { name: title });
  if (fill) await fill(dialog);
  await dialog.getByRole('button', { name: 'Apply' }).click();
  await expect(dialog).toBeHidden();
}

/** Exports with the Export audio dialog (screen 20) to `output`. */
export async function exportAudio(
  app: ElectronApplication,
  page: Page,
  output: string,
  choose: { mono?: boolean; title?: string } = {},
) {
  await answerDialogs(app, { exportTo: output });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export audio' });
  if (choose.mono) await dialog.getByRole('button', { name: 'Mono' }).click();
  if (choose.title) {
    await dialog.getByText('Tags (title, artist…)').click();
    await dialog.getByLabel('Title').fill(choose.title);
  }
  await shot(page, `${basename(output)}-export`);
  await dialog.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByText(`Saved to ${output}`)).toBeVisible({ timeout: 60_000 });
  return output;
}
