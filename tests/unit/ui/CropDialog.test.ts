import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import { testApp, VIDEO } from '../../helpers/test-app.ts';

const EAGLE = {
  kind: 'image' as const,
  container: 'jpg',
  sizeBytes: 4_000_000,
  video: { codec: 'mjpeg', width: 3764, height: 3092 },
};

async function open() {
  const t = testApp({ '/m/Fish_Eagle.jpg': EAGLE, '/m/clip.mp4': VIDEO });
  await t.importFiles('/m/Fish_Eagle.jpg', '/m/clip.mp4');
  render(MediaBin, { props: { app: t.app } });
  await fireEvent.click(screen.getByRole('button', { name: 'Resize and crop Fish_Eagle.jpg' }));
  const project = () => t.app.store.get().history.present;
  return { ...t, project };
}

describe('resize & crop dialog (V11, screen 10)', () => {
  it('is offered for pictures only', async () => {
    await open();
    expect(screen.queryByRole('button', { name: 'Resize and crop clip.mp4' })).toBeNull();
  });

  it('Book B Task 11a: shows the two steps — 1920 × 1577, then 497 px removed from the top', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    expect(dialog.textContent).toMatch(/Original\s*3764 × 3092/);
    expect(dialog.textContent).toMatch(/Width\s*1920 px/);
    expect(dialog.textContent).toMatch(/Height\s*1577 px/);
    await fireEvent.click(screen.getByRole('button', { name: 'Keep Bottom' }));
    expect(dialog.textContent).toMatch(/Removes 497 px from the top/);
    expect(dialog.textContent).toMatch(/Result\s*1920 × 1080/);
  });

  // In these tests the picture is not laid out, so 1 screen pixel = 1 picture pixel from (0, 0).
  const drag = async (el: Element, from: [number, number], to: [number, number]) => {
    await fireEvent.mouseDown(el, { clientX: from[0], clientY: from[1] });
    await fireEvent.mouseMove(window, { clientX: to[0], clientY: to[1] });
    await fireEvent.mouseUp(window, { clientX: to[0], clientY: to[1] });
  };

  it('drawing on the picture selects a new part with the project shape (zooming in)', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    await drag(
      screen.getByLabelText('Picture — drag to select the part to keep'),
      [100, 100],
      [1100, 150],
    );
    expect(dialog.textContent).toMatch(/Keeps 1000 × 563 of the original/);
    expect(dialog.textContent).toMatch(/Removes 192 px from the top/);
    expect(dialog.textContent).toMatch(/enlarged.*blurry/i);
    expect(screen.getByRole('button', { name: 'Keep Centre' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('dragging inside the selected part moves it', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    await fireEvent.click(screen.getByRole('button', { name: /^Keep Bottom$/ }));
    await drag(screen.getByLabelText('Part to keep — drag to move'), [500, 500], [500, 450]);
    expect(dialog.textContent).toMatch(/Removes 472 px from the top and 25 px from the bottom/);
  });

  it('dragging a corner handle makes the part smaller or bigger', async () => {
    await open();
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    await drag(
      screen.getByLabelText('Resize from the bottom-right corner'),
      [3764, 2604],
      [1882, 1546],
    );
    expect(dialog.textContent).toMatch(/Keeps 1882 × 1059 of the original/);
    // A button brings back the largest part.
    await fireEvent.click(screen.getByRole('button', { name: /^Keep Bottom$/ }));
    expect(dialog.textContent).toMatch(/Removes 497 px from the top/);
    expect(dialog.textContent).not.toMatch(/blurry/);
  });

  it('shows the result: exactly the part that will be saved', async () => {
    await open();
    expect(screen.getByLabelText('Result preview')).toBeTruthy();
  });

  it('saves a new file, keeps the original and can put it on the timeline', async () => {
    const { project } = await open();
    await fireEvent.click(screen.getByLabelText('Add to the timeline'));
    await fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    await screen.findByText('Fish_Eagle1.jpg');
    expect(project().media.map((m) => m.path)).toContain('/m/Fish_Eagle.jpg');
    const made = project().media.find((m) => m.path === '/m/Fish_Eagle1.jpg')!;
    expect(project().timeline.main).toEqual([expect.objectContaining({ assetId: made.id })]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel closes without saving anything', async () => {
    const { project } = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(project().media).toHaveLength(2);
  });
});
