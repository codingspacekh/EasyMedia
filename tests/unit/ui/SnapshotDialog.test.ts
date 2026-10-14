import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { testApp } from '../../helpers/test-app.ts';

async function open() {
  const t = testApp();
  await t.importFiles('/m/clip.mp4');
  t.app.addToTimeline(t.app.store.get().history.present.media[0]!.id);
  t.app.setPlayhead(6);
  render(App, { props: { app: t.app } });
  await fireEvent.click(screen.getByRole('button', { name: 'Snapshot' }));
  return { ...t, dialog: screen.getByRole('dialog', { name: 'Snapshot' }) };
}

describe('snapshot dialog (V10, screen 09)', () => {
  it('starts at the playhead and steps one frame at a time, moving the preview', async () => {
    const { app, dialog } = await open();
    expect(dialog.textContent).toContain('00:06.00');
    await fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    expect(app.store.get().playhead).toBeCloseTo(6 + 1 / 30, 10);
    await fireEvent.click(screen.getByRole('button', { name: 'Previous frame' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Previous frame' }));
    expect(app.store.get().playhead).toBeCloseTo(6 - 1 / 30, 10);
  });

  it('saves a TIFF with text hidden and puts it on the timeline for 10 s (Book A 11.11, Task 11d)', async () => {
    const { app, dialogs } = await open();
    dialogs.saveImage.mockResolvedValueOnce('/m/still.tiff');
    expect((screen.getByLabelText(/hide text/i) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(screen.getByLabelText('TIFF'));
    await fireEvent.click(screen.getByLabelText(/add to the timeline/i));
    await fireEvent.change(screen.getByLabelText('Show it for'), { target: { value: '10' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Save snapshot' }));
    await screen.findByText('Saved still.tiff.');
    expect(dialogs.saveImage).toHaveBeenCalledWith('Snapshot_6.00s.tiff');
    const main = app.store.get().history.present.timeline.main;
    expect(main.map((m) => m.type)).toEqual(['video', 'image']);
    expect(main[1]).toMatchObject({ duration: 10 });
    expect(screen.queryByRole('dialog', { name: 'Snapshot' })).toBeNull();
  });

  it('explains why a still is useful (T5) and can be cancelled', async () => {
    await open();
    expect(screen.getByText(/background for captions or credits/i)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Snapshot' })).toBeNull();
  });
});
