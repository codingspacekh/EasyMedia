// M14 / AN15, T7, N12: the animation's export dialog — the four formats with their pros and cons,
// the frames, length and estimated size, then progress and Cancel while it works.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { animUi } from '../../../src/ui/animation/animation-ui.svelte.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

async function animationMode(width = 600, height = 400) {
  animUi.exportFormat = 'mp4'; // the dialog remembers the last choice; each test starts afresh
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  const stage = anim.store.get().history.present.stage;
  anim.setStage({ ...stage, width, height, length: 72 });
  await Promise.resolve();
  return { ...t, anim };
}

const dialog = () => screen.getByRole('dialog', { name: 'Export animation' });

describe('the export dialog (AN15, T7)', () => {
  it('Export opens it with MP4 chosen, the four formats, and the frames, length and size', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = within(dialog());
    for (const name of ['MP4 video', 'Animated GIF', 'PNG sequence', 'PNG picture of this frame'])
      expect(d.getByRole('radio', { name: new RegExp(name) })).toBeTruthy();
    expect((d.getByRole('radio', { name: /MP4 video/ }) as HTMLInputElement).checked).toBe(true);
    expect(d.getByText('72 frames · 3.00 s · about 108 KB')).toBeTruthy();
    expect(d.getByText(/Plays almost everywhere/)).toBeTruthy();
  });

  it('choosing GIF shows its pros and cons and a bigger size', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /Animated GIF/ }));
    expect(within(dialog()).getByText(/At most 256 colours/)).toBeTruthy();
    expect(within(dialog()).getByText('72 frames · 3.00 s · about 2.1 MB')).toBeTruthy();
  });

  it('an odd-sized stage: MP4 says it will be padded to even', async () => {
    await animationMode(601, 401);
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(within(dialog()).getByText(/MP4 needs even sizes: it will be 602 × 402/)).toBeTruthy();
  });

  it('Export file makes the MP4, showing the progress, then closes', async () => {
    const s = await animationMode();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Export file' }));
    await vi.waitFor(() => expect(animUi.dialog).toBeNull());
    expect(s.dialogs.exportAnimation).toHaveBeenCalledWith('Untitled', 'mp4');
    expect((await s.engine.probe('/work/Task1.mp4')).video).toMatchObject({ width: 600 });
  });

  it('while it works the dialog shows the progress and Cancel stops it', async () => {
    const s = await animationMode();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.mp4');
    let release: () => void = () => {};
    s.stageRenderer.renderPng.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(new Uint8Array([1])))),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Export file' }));
    await vi.waitFor(() => expect(within(dialog()).getByRole('progressbar')).toBeTruthy());
    expect(within(dialog()).getByText(/Drawing frame/)).toBeTruthy();
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel export' }));
    release();
    await vi.waitFor(() => expect(animUi.dialog).toBeNull());
    expect(s.anim.store.get().message?.text).toBe('Export cancelled.');
  });

  it('Close shuts the dialog without exporting', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(animUi.dialog).toBeNull();
    expect(s.dialogs.exportAnimation).not.toHaveBeenCalled();
  });
});

describe('Send to Video mode (M14)', () => {
  it('makes the MP4 beside the animation, puts it on the video timeline and shows Video mode', async () => {
    const s = await animationMode();
    s.dialogs.saveAnimation.mockResolvedValueOnce('/work/Task1.mvea');
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Send to Video mode' }));
    await vi.waitFor(() => expect(ui.mode).toBe('Video'));
    expect(animUi.dialog).toBeNull();
    expect(s.app.store.get().history.present.timeline.main).toHaveLength(1);
  });
});
