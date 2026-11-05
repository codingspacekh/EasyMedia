// Layout regressions the teacher found: the font list was cut off by the Text panel and made the
// panel scroll (issues/video-1.png); the Library box changed height with each category.
import { expect, test, type Page } from '@playwright/test';
import { launchApp } from './app.ts';

/** The smallest window (N10), where the font list reaches the bottom of the panel. */
async function smallWindow(app: Awaited<ReturnType<typeof launchApp>>['app'], page: Page) {
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setContentSize(1100, 700),
  );
  await page.waitForTimeout(300);
}

const panelScroll = (page: Page) =>
  page.locator('.inspector').evaluate((e) => ({ top: e.scrollTop, height: e.scrollHeight }));

test('X2 the font list opens in front of everything, inside the window, without moving the panel', async () => {
  const { app, window: page } = await launchApp();
  await smallWindow(app, page);
  await page.getByRole('button', { name: 'Add title' }).click();
  const font = page.getByRole('button', { name: /^Font: / });
  await font.scrollIntoViewIfNeeded(); // as a person sees it before clicking it
  await page.waitForTimeout(100);
  const before = await panelScroll(page);
  await font.click();
  const list = page.getByRole('radiogroup', { name: 'Font' });
  await expect(list).toBeVisible();

  // Inside the window, and nothing (the timeline, the panel's edge) covers the fonts shown.
  const box = (await list.boundingBox())!;
  const view = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(view.h);
  expect(box.x + box.width).toBeLessThanOrEqual(view.w);
  const covered = await list.evaluate((l) => {
    const area = l.getBoundingClientRect();
    return [...l.querySelectorAll<HTMLElement>('[role="radio"]')]
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.top >= area.top && r.bottom <= area.bottom;
      })
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return !b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      })
      .map((b) => b.textContent);
  });
  expect(covered).toEqual([]);
  // Opening it does not make the panel longer or scroll it.
  expect(await panelScroll(page)).toEqual(before);

  // The wheel over the list scrolls only the list, even past its end.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 200);
  await expect.poll(() => list.evaluate((l) => l.scrollTop)).toBeGreaterThan(0);
  await page.mouse.wheel(0, 5000);
  await page.mouse.wheel(0, 5000);
  await page.waitForTimeout(200);
  expect(await panelScroll(page)).toEqual(before);
  await expect(list).toBeVisible();

  // The wheel anywhere else closes the list, and the panel scrolls as usual.
  const off = await page.evaluate(() => {
    const panel = document.querySelector('.inspector')!.getBoundingClientRect();
    const list = document.querySelector('[role="radiogroup"][aria-label="Font"]')!;
    for (let y = panel.top + 10; y < panel.bottom; y += 10)
      for (let x = panel.left + 10; x < panel.right; x += 10)
        if (!list.contains(document.elementFromPoint(x, y))) return { x, y };
    return null;
  });
  expect(off, 'a place on the panel the list does not cover').not.toBeNull();
  await page.mouse.move(off!.x, off!.y);
  await page.mouse.wheel(0, 100);
  await expect(list).toBeHidden();
  await app.close();
});

test('AN19 the Library box keeps one height; only its pictures scroll', async () => {
  const { app, window: page } = await launchApp();
  await smallWindow(app, page);
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: 'Library' }).click();
  const dialog = page.getByRole('dialog', { name: 'Library' });
  const grid = dialog.getByRole('group', { name: 'Library items' });
  const heights: number[] = [];
  for (const tab of ['Cartoons', 'Biology', 'Backgrounds']) {
    await dialog.getByRole('tab', { name: tab }).click();
    heights.push((await dialog.boundingBox())!.height);
  }
  await dialog.getByLabel('Search the library').fill('zzzz');
  heights.push((await dialog.boundingBox())!.height);
  expect(new Set(heights.map(Math.round)).size, `heights ${heights}`).toBe(1);

  await dialog.getByLabel('Search the library').fill('');
  await dialog.getByRole('tab', { name: 'Computers & IT' }).click();
  const g = await grid.evaluate((e) => ({ client: e.clientHeight, scroll: e.scrollHeight }));
  expect(g.scroll).toBeGreaterThan(g.client);
  const d = await dialog.evaluate((e) => ({ client: e.clientHeight, scroll: e.scrollHeight }));
  expect(d.scroll).toBeLessThanOrEqual(d.client); // the box itself does not scroll
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeInViewport();
  // Every category's tab is inside the box, none cut off at its edge.
  const inside = await dialog.evaluate((e) => {
    const box = e.getBoundingClientRect();
    return [...e.querySelectorAll('[role="tab"]')]
      .filter((t) => {
        const r = t.getBoundingClientRect();
        return r.left < box.left || r.right > box.right || t.scrollWidth > t.clientWidth + 1;
      })
      .map((t) => t.textContent);
  });
  expect(inside).toEqual([]);
  await app.close();
});
