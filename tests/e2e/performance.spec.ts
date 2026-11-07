// M4 gate: the app can record start-up time and peak RAM for the real-laptop check.
import { expect, test } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKGROUND_ENV, root } from './app.ts';

test('ONEEDITOR_PERF_REPORT writes start-up time and peak RAM when the app closes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mve-perf-'));
  const report = join(dir, 'performance-report.json');
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: {
      ...process.env,
      ...BACKGROUND_ENV,
      ONEEDITOR_USER_DATA: dir,
      ONEEDITOR_PERF_REPORT: report,
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.waitForTimeout(1500);
  await app.close();

  const r = JSON.parse(readFileSync(report, 'utf8'));
  expect(r.startupMs).toBeGreaterThan(0);
  expect(r.peakRamMB).toBeGreaterThan(50);
  expect(r).toMatchObject({
    platform: `${process.platform}-${process.arch}`,
    budget: { 'N5 start ≤ 5 s': expect.any(Boolean), 'N4 RAM ≤ 600 MB': expect.any(Boolean) },
  });
});

test('N1 the report has the frames the animation stage really showed while it played', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mve-perf-'));
  writeFileSync(join(dir, 'preferences.json'), '{"welcomeSeen":true}\n');
  const report = join(dir, 'performance-report.json');
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: {
      ...process.env,
      ...BACKGROUND_ENV,
      ONEEDITOR_USER_DATA: dir,
      ONEEDITOR_PERF_REPORT: report,
    },
  });
  const window = await app.firstWindow();
  await window
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  // A new animation lasts 5 s at 24 fps: played for 2 s, then paused.
  await window.getByRole('button', { name: 'Play', exact: true }).click();
  await window.waitForTimeout(2000);
  await window.getByRole('button', { name: 'Pause', exact: true }).click();
  await app.close();

  const r = JSON.parse(readFileSync(report, 'utf8'));
  expect(r.stage).toMatchObject({ plays: 1, targetFps: 24, fps: expect.any(Number) });
  expect(r.stage.seconds).toBeGreaterThan(1);
  expect(r.budget['N1 stage shows ≥ 95 % of its frames']).toEqual(expect.any(Boolean));
});
