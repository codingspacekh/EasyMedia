// M16b / N15, N16 in the real app: Learn from the menu bar; panels resized by dragging their edge,
// hidden from the View menu, and the same after the app is started again.
import { expect, test } from '@playwright/test';
import { launchApp, menu } from './app.ts';

test('N16 a panel dragged wider and one hidden stay so after a restart; Reset Layout undoes both', async () => {
  const first = await launchApp();
  const page = first.window;
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  const edge = page.getByRole('separator', { name: 'Resize the Layers' });
  const box = (await edge.boundingBox())!;
  // Grabbed above its middle, where the hide button is.
  const y = box.y + box.height / 4;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, y, { steps: 6 });
  await page.mouse.up();
  await expect(edge).toHaveAttribute('aria-valuenow', '310');
  const panel = page.getByRole('complementary', { name: 'Layers' });
  // The slot is 310 px: the panel and its 4 px edge.
  expect(Math.round((await panel.boundingBox())!.width)).toBe(306);
  await menu(first.app, 'View', 'Show / Hide Right Panel');
  await expect(page.getByRole('button', { name: 'Show the Properties' })).toBeVisible();
  await first.app.close();

  const second = await launchApp([], { userData: first.userData });
  const again = second.window;
  await again
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Animation' })
    .click();
  await expect(again.getByRole('separator', { name: 'Resize the Layers' })).toHaveAttribute(
    'aria-valuenow',
    '310',
  );
  await expect(again.getByRole('button', { name: 'Show the Properties' })).toBeVisible();
  await menu(second.app, 'View', 'Reset Layout');
  await expect(again.getByRole('separator', { name: 'Resize the Layers' })).toHaveAttribute(
    'aria-valuenow',
    '230',
  );
  await expect(again.getByRole('complementary', { name: 'Properties' })).toBeVisible();
  await second.app.close();
});

test('N15 Learn opens from the menu bar and Back returns to the editor', async () => {
  const { app, window: page } = await launchApp();
  await page
    .getByRole('navigation', { name: 'Mode' })
    .getByRole('button', { name: 'Audio' })
    .click();
  await menu(app, 'Learn', 'Animation Theory');
  await expect(page.getByRole('region', { name: 'Types of animation' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to Audio' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Mode' }).getByRole('button', { name: 'Audio' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await menu(app, 'Learn', 'Glossary');
  await expect(page.getByRole('dialog', { name: 'Glossary' })).toBeVisible();
  await app.close();
});
