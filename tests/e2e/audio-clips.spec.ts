// Audio mode clips in the real app, as on the video timeline (the teacher's request after M11):
// click a clip, Split at the playhead, drag a clip along its track, drag an edge to trim it; and
// the tooltip every button shows when the mouse rests on it.
import { expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FIXTURES, generateFixtures, selectFixtures } from '../../scripts/lib/fixtures.ts';
import { bundledFfmpeg } from '../integration/helpers/ffmpeg.ts';
import { launchApp } from './app.ts';
import { audioMode, importAudio, setTime, shot } from './audio.ts';

const BEEPS = 'beeps_30s.mp3';
let dir: string;

test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mve-clips-'));
  await generateFixtures(
    bundledFfmpeg().ffmpeg,
    dir,
    selectFixtures(FIXTURES, 'test').filter((f) => f.name === BEEPS),
  );
});
test.afterAll(() => rm(dir, { recursive: true, force: true }));

test('split a sound at the playhead, drag the second clip later, trim its end', async () => {
  test.setTimeout(120_000);
  const { app, window: page } = await launchApp();
  await audioMode(page);
  await importAudio(app, page, join(dir, BEEPS), 1);
  const lane = page.getByRole('region', { name: 'Waveform of beeps_30s' });
  const clips = lane.getByRole('button', { name: /^Clip of beeps_30s/ });
  await expect(clips).toHaveCount(1);

  // Click the clip: it is selected and the playhead goes where the mouse was.
  const box = (await clips.first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 3, box.y + box.height / 2);
  await expect(clips.first()).toHaveAttribute('aria-pressed', 'true');
  await setTime(page, 'Audio position', '10');
  await page.getByRole('button', { name: 'Split' }).click();
  await expect(clips).toHaveCount(2);

  // Drag the second clip 5 s later (1 s = the zoom's px).
  const pxPerSecond = await zoom(page);
  const second = (await clips.nth(1).boundingBox())!;
  await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width / 2 + 5 * pxPerSecond, second.y + 40, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(clips.nth(1)).toHaveAccessibleName(/00:15\.\d\d to 00:35\.\d\d/);

  // Drag its end edge 10 s back: it ends at 25 s. (Fit first: the clip now ends past the view.)
  await page.getByRole('button', { name: 'Fit to window' }).click();
  const fitted = await zoom(page);
  const moved = (await clips.nth(1).boundingBox())!;
  await page.mouse.move(moved.x + moved.width - 2, moved.y + moved.height / 2);
  await page.mouse.down();
  await page.mouse.move(moved.x + moved.width - 2 - 10 * fitted, moved.y + 40, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(clips.nth(1)).toHaveAccessibleName(/00:15\.\d\d to 00:25\.\d\d/);
  await shot(page, 'audio-clips');

  // Resting the mouse on a button explains it.
  await page.getByRole('button', { name: 'Split' }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Split the clip at the playhead');
  await expect(page.getByRole('tooltip')).toContainText('Why?');
  await shot(page, 'audio-tooltip');
  await app.close();
});

/** Pixels per second of Audio mode's tracks, from the ruler's corner ("24 px = 1 s"). */
async function zoom(page: Page): Promise<number> {
  const text = await page.getByText(/px = 1 s$/).textContent();
  return Number(text!.replace(/ px = 1 s$/, ''));
}
