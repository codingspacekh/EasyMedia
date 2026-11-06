// The pilot's helpers in the real app: Help ▸ Report a Problem… saves a report with the version,
// the computer and what happened (a menu command, an error in the page), even across a restart;
// File ▸ Candidate Details… makes the save boxes suggest the papers' file names.
import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerDialogs, launchApp, menu } from './app.ts';

test('Report a Problem: the report has the version, a menu command and an error from the page, after a restart too', async () => {
  const first = await launchApp();
  await menu(first.app, 'File', 'Candidate Details…');
  await expect(first.window.getByRole('dialog', { name: 'Candidate details' })).toBeVisible();
  await first.window.getByRole('button', { name: 'Cancel' }).click();
  await first.window.evaluate(() => {
    setTimeout(() => {
      throw new Error('pilot test: something broke');
    });
  });
  await first.window.waitForTimeout(500);
  await first.app.close();

  // A new start (as after a crash): the log is still there.
  const { app, window } = await launchApp([], { userData: first.userData });
  await window.waitForLoadState('domcontentloaded');
  const report = join(mkdtempSync(join(tmpdir(), 'mve-report-')), 'report.txt');
  await answerDialogs(app, { save: report });
  await app.evaluate(({ shell }) => {
    shell.showItemInFolder = () => {};
  });
  await menu(app, 'Help', 'Report a Problem…');
  const read = () => (existsSync(report) ? readFileSync(report, 'utf8') : '');
  await expect.poll(read, { timeout: 10_000 }).toMatch(/Nothing was noted|ERROR|menu/);
  const text = read();
  expect(text).toMatch(/^OneEditor problem report/);
  expect(text).toMatch(/OneEditor \d+\.\d+\.\d+ \(run from its source\)/);
  expect(text).toContain('menu    candidate');
  expect(text).toMatch(/ERROR page +Error: pilot test: something broke/);
  await app.close();
});

test('Candidate details: the save boxes suggest <name>_<centre>_<candidate>', async () => {
  const { app, window } = await launchApp();
  await menu(app, 'File', 'Candidate Details…');
  const dialog = window.getByRole('dialog', { name: 'Candidate details' });
  await dialog.getByLabel('Centre number').fill('kh012');
  await dialog.getByLabel('Candidate number').fill('0042');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  // The real save box is asked with that name (and closed).
  await app.evaluate(async ({ dialog: native }) => {
    const names: string[] = [];
    native.showSaveDialog = (async (_w: unknown, options: { defaultPath?: string }) => {
      names.push(options?.defaultPath ?? '');
      return { canceled: true, filePath: '' };
    }) as unknown as typeof native.showSaveDialog;
    (globalThis as { asked?: string[] }).asked = names;
  });
  await menu(app, 'File', 'Save As…');
  await expect
    .poll(() => app.evaluate(() => (globalThis as { asked?: string[] }).asked ?? []))
    .toEqual([expect.stringMatching(/Untitled_KH012_0042(\.mve)?$/)]);
  await app.close();
});
