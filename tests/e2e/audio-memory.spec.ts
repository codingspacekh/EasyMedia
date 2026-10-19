// N4 regression: Audio mode's memory must not grow with the undo history. Undo steps keep their
// sound on disk (as Audacity); nothing on screen may hold old samples (two such leaks were
// found in M9: the History list and the waveform blocks).
import { expect, test } from '@playwright/test';
import { _electron as electron } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { answerDialogs, answerUnsaved, root } from './app.ts';

const SONG = 'song_dc_offset_90s.mp3';

test('N4 five Amplify steps on 85 s of stereo do not make the page hold more sound', async () => {
  test.setTimeout(300_000);
  const dir = mkdtempSync(join(tmpdir(), 'mve-mem-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === SONG),
  );
  writeFileSync(join(dir, 'preferences.json'), '{"welcomeSeen":true}\n'); // no Welcome (X7)
  const app = await electron.launch({
    args: ['--js-flags=--expose-gc', root], // lets the test collect garbage before measuring
    cwd: root,
    env: { ...process.env, EASYMEDIA_USER_DATA: dir },
  });
  const page = await app.firstWindow();
  await answerUnsaved(app, 'discard'); // the unsaved edits are thrown away when the test closes
  const pageMB = async () => {
    await page.evaluate(() => (globalThis as { gc?: () => void }).gc?.());
    await page.waitForTimeout(1000);
    return app.evaluate(
      ({ app }) => app.getAppMetrics().find((p) => p.type === 'Tab')!.memory.workingSetSize / 1024,
    );
  };
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Audio' })
    .click();
  await answerDialogs(app, { open: [join(dir, SONG)] });
  await page.getByRole('button', { name: 'Import audio' }).click();
  await expect(page.getByRole('region', { name: /^Waveform of / })).toHaveCount(1, {
    timeout: 30_000,
  });
  const sizes: number[] = [];
  for (let i = 0; i < 5; i++) {
    await page.getByLabel('Selection end', { exact: true }).fill('85');
    await page.getByLabel('Selection end', { exact: true }).press('Enter');
    await page.getByRole('button', { name: 'Effect', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Amplify…', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Amplify' });
    await dialog.getByLabel('Amplification').fill('-0.5');
    await dialog.getByLabel('Amplification').press('Tab');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/^Amplify 0\.00 – 85\.00 s$/)).toHaveCount(i + 1);
    await page.waitForTimeout(500); // the step is written to disk
    sizes.push(await pageMB());
  }
  // Each step replaces 30 MB of sound: kept in memory, four more steps would add 120 MB.
  expect(sizes.at(-1)! - sizes[0]!).toBeLessThan(25);
  await app.close();
});
