// M4 gate: the app can record start-up time and peak RAM for the real-laptop check.
import { expect, test } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { root } from './app.ts';

test('EASYMEDIA_PERF_REPORT writes start-up time and peak RAM when the app closes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mve-perf-'));
  const report = join(dir, 'performance-report.json');
  const app = await electron.launch({
    args: [root],
    cwd: root,
    env: { ...process.env, EASYMEDIA_USER_DATA: dir, EASYMEDIA_PERF_REPORT: report },
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
