// Audio mode layout regressions the teacher found (issues/audio-1.png, audio-2.png): the Tracks
// and Effect menus were cut off by the header, so they seemed to open behind the side panel; the
// Recording panel opened at the top left, over the timeline, instead of in the middle.
import { expect, test, type Page } from '@playwright/test';
import { FAKE_MICROPHONE, launchApp } from './app.ts';
import { audioMode } from './audio.ts';

/** The menu item itself must be what is under its centre: not cut off, not covered. */
async function covered(page: Page, menu: string): Promise<string[]> {
  return page.evaluate((name) => {
    const items = document.querySelectorAll<HTMLElement>(
      `[role="menu"][aria-label="${name}"] [role="menuitem"]`,
    );
    const bad: string[] = [];
    for (const item of items) {
      const r = item.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      if (!hit || !item.contains(hit)) bad.push(item.textContent!.trim());
    }
    return bad;
  }, menu);
}

for (const top of ['Tracks', 'Effect'] as const) {
  test(`the ${top} menu opens in front of the timeline and the side panel`, async () => {
    const { app, window: page } = await launchApp();
    await audioMode(page);
    await page.getByRole('button', { name: top, exact: true }).click();
    await expect(page.getByRole('menu', { name: top })).toBeVisible();
    expect(await covered(page, top)).toEqual([]);
    await app.close();
  });
}

test('the Recording panel opens in the middle of the window', async () => {
  const { app, window: page } = await launchApp(FAKE_MICROPHONE);
  await audioMode(page);
  await page.getByRole('button', { name: 'Record' }).click();
  const panel = (await page.getByRole('dialog', { name: 'Recording' }).boundingBox())!;
  const { w, h } = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(Math.abs(panel.x + panel.width / 2 - w / 2)).toBeLessThan(2);
  expect(Math.abs(panel.y + panel.height / 2 - h / 2)).toBeLessThan(2);
  await app.close();
});
