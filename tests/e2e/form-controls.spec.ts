// The app's own look for form controls (forms.css): a menu's open list is drawn by the app, as
// the font list is, not by the operating system; it opens in front of everything; the scrollbars
// are dark and thin, as the rest of the app.
import { expect, test } from '@playwright/test';
import { launchApp } from './app.ts';

test('a menu opens the app’s own list, in front of everything, and an option is picked from it', async () => {
  const { app, window: page } = await launchApp();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]!.setContentSize(1100, 700),
  );
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Add title' }).click();
  const menu = page.getByRole('combobox', { name: 'Entrance' });
  await menu.scrollIntoViewIfNeeded();
  await menu.click();
  await expect.poll(() => menu.evaluate((s) => s.matches(':open'))).toBe(true);

  const look = await menu.evaluate((s) => {
    const list = getComputedStyle(s, '::picker(select)');
    return {
      appearance: getComputedStyle(s).appearance,
      background: list.backgroundColor,
      radius: list.borderTopLeftRadius,
    };
  });
  expect(look).toEqual({ appearance: 'base-select', background: 'rgb(30, 34, 42)', radius: '8px' });

  // Every option in the list's first 300 px (it scrolls after 340) is what is under its centre:
  // the timeline does not cover the list.
  const covered = await menu.evaluate((s) => {
    const options = [...(s as HTMLSelectElement).options];
    const top = options[0]!.getBoundingClientRect().top;
    return options
      .filter((o) => {
        const r = o.getBoundingClientRect();
        return r.height > 0 && r.bottom <= top + 300 && r.bottom <= innerHeight;
      })
      .filter((o) => {
        const r = o.getBoundingClientRect();
        return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) !== o;
      })
      .map((o) => o.textContent);
  });
  expect(covered).toEqual([]);

  const option = menu.locator('option').nth(2);
  const name = (await option.textContent())!;
  await option.click();
  await expect.poll(() => menu.evaluate((s) => s.matches(':open'))).toBe(false);
  await expect(menu.locator('option:checked')).toHaveText(name);
  await app.close();
});

test('the scrollbars are thin and dark, as the rest of the app', async () => {
  const { app, window: page } = await launchApp();
  const bars = await page.locator('.inspector').evaluate((e) => {
    const s = getComputedStyle(e);
    return { width: s.scrollbarWidth, colour: s.scrollbarColor };
  });
  expect(bars.width).toBe('thin');
  expect(bars.colour).not.toBe('auto');
  await app.close();
});

/** Each menu shown keeps its width when its longest option is chosen (no jumping). */
const jumps = () =>
  [...document.querySelectorAll('select')]
    .filter((s) => s.offsetParent)
    .flatMap((s) => {
      const before = s.getBoundingClientRect().width;
      const old = s.selectedIndex;
      const longest = [...s.options].reduce(
        (a, o, i) => (o.text.length > s.options[a]!.text.length ? i : a),
        0,
      );
      s.selectedIndex = longest;
      const after = s.getBoundingClientRect().width;
      s.selectedIndex = old;
      return Math.abs(after - before) > 0.5
        ? [`${s.getAttribute('aria-label') ?? s.id}: ${before} → ${after}`]
        : [];
    });

test('a menu keeps its width whichever option is chosen', async () => {
  const { app, window: page } = await launchApp();
  await page.getByRole('button', { name: 'Add title' }).click();
  expect(await page.evaluate(jumps)).toEqual([]);
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await page.getByRole('button', { name: 'Library' }).click();
  await page.getByRole('button', { name: 'Add Car' }).click();
  // Two keyframes on X, the first picked: the keyframe bar shows Easing and Repeat.
  const x = page.getByLabel('X', { exact: true });
  const go = page.getByLabel('Go to frame');
  await x.fill('100');
  await x.press('Tab');
  await go.fill('24');
  await go.press('Enter');
  await x.fill('400');
  await x.press('Tab');
  await page
    .getByRole('region', { name: 'Timeline' })
    .getByRole('button', { name: 'X keyframe at frame 0' })
    .click();
  await expect(page.getByLabel('Easing')).toBeVisible();
  expect(await page.evaluate(jumps)).toEqual([]);
  await app.close();
});
