import { describe, expect, it, vi } from 'vitest';
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

  it('M/J/26 Q1: Stretch resizes to the project size without cropping, and says the shape changes', async () => {
    const { app } = await open();
    const save = vi.spyOn(app, 'resizeCropImage');
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    await fireEvent.click(screen.getByLabelText(/Stretch to fit/));
    expect(dialog.textContent).toMatch(/Width\s*1920 px/);
    expect(dialog.textContent).toMatch(/Height\s*1080 px/);
    expect(dialog.textContent).toMatch(/Nothing is cut off/);
    expect(dialog.textContent).toMatch(/shape changes/i);
    expect(screen.queryByRole('group', { name: /Quick places/ })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    expect(save).toHaveBeenCalledWith(expect.any(String), 'stretch');
  });

  it('F/M/25 Q2: "Crop to any shape" keeps the part drawn, at its own size (cells A1:E5)', async () => {
    const { app } = await open();
    const save = vi.spyOn(app, 'resizeCropImage');
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    await fireEvent.click(screen.getByLabelText(/Crop to any shape/));
    // Nothing is resized, and the 9 places (which keep the project's shape) are not offered.
    expect(screen.queryByRole('group', { name: /Quick places/ })).toBeNull();
    await drag(
      screen.getByLabelText('Picture — drag to select the part to keep'),
      [335, 440],
      [25, 123],
    );
    expect(dialog.textContent).toMatch(/Result\s*310 × 317/);
    // The preview keeps one place and size (the project's shape) whatever the part's shape, so
    // the dialog does not grow and move the picture under the mouse while drawing; the part is
    // fitted inside it: 310 × 317 in a 1920 × 1080 frame fills its height and 55 % of its width.
    const preview = screen.getByLabelText('Result preview') as HTMLElement;
    expect(preview.parentElement!.style.aspectRatio).toBe('1920 / 1080');
    expect(preview.style.height).toBe('100%');
    expect(parseFloat(preview.style.width)).toBeCloseTo(55.0, 1);
    expect(dialog.textContent).toMatch(/not resized/i);
    expect(dialog.textContent).not.toMatch(/blurry/);
    await fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    expect(save).toHaveBeenCalledWith(expect.any(String), {
      free: { x: 25, y: 123, width: 310, height: 317 },
    });
  });

  it('saves under the file name typed (F/M/25 "save this image as credits.png")', async () => {
    const { project } = await open();
    await fireEvent.input(screen.getByLabelText('File name'), { target: { value: 'credits' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save image' }));
    await vi.waitFor(() => expect(project().media.map((m) => m.path)).toContain('/m/credits.jpg'));
  });

  it('Cancel closes without saving anything', async () => {
    const { project } = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(project().media).toHaveLength(2);
  });
});

describe('resize & crop of a picture that already has the project shape (a snapshot)', () => {
  it('drawing on it selects a new part, though the whole picture was the part', async () => {
    const t = testApp({
      '/m/frame.png': {
        kind: 'image' as const,
        container: 'png',
        sizeBytes: 100_000,
        video: { codec: 'png', width: 1920, height: 1080 },
      },
    });
    await t.importFiles('/m/frame.png');
    render(MediaBin, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Resize and crop frame.png' }));
    const dialog = screen.getByRole('dialog', { name: 'Resize and crop image' });
    expect(dialog.textContent).toMatch(/Keeps 1920 × 1080 of the original/);
    const part = screen.getByLabelText('Part to keep — drag to move');
    await fireEvent.mouseDown(part, { clientX: 100, clientY: 100 });
    await fireEvent.mouseMove(window, { clientX: 1060, clientY: 640 });
    await fireEvent.mouseUp(window, { clientX: 1060, clientY: 640 });
    expect(dialog.textContent).toMatch(/Keeps 960 × 540 of the original/);
  });
});
