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
    for (const name of [
      'MP4 video',
      'Animated GIF',
      'HTML web animation',
      'PNG sequence',
      'PNG picture of this frame',
      'SVG picture of this frame',
    ])
      expect(d.getByRole('radio', { name: new RegExp(name) })).toBeTruthy();
    expect((d.getByRole('radio', { name: /MP4 video/ }) as HTMLInputElement).checked).toBe(true);
    expect(d.getByText('72 frames · 3.00 s · about 108 KB')).toBeTruthy();
    expect(d.getByText(/Plays almost everywhere/)).toBeTruthy();
  });

  it('AN22 choosing SVG explains it is a vector picture of one frame', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /SVG picture/ }));
    expect(within(dialog()).getByText(/sharp at any size/i)).toBeTruthy();
    expect(within(dialog()).getByText(/1 frame/)).toBeTruthy();
  });

  it('choosing GIF shows its pros and cons and a bigger size', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /Animated GIF/ }));
    expect(within(dialog()).getByText(/At most 256 colours/)).toBeTruthy();
    expect(within(dialog()).getByText('72 frames · 3.00 s · about 2.1 MB')).toBeTruthy();
  });

  it('AN15: choosing HTML shows a small page that plays in any browser, then makes it', async () => {
    const s = await animationMode();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Task1.html');
    let release = () => {};
    s.pageAssets.playerScript.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve('/* player */'))),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /HTML web animation/ }));
    expect(
      within(dialog()).getByText(/plays in any web browser, without the internet/),
    ).toBeTruthy();
    expect(within(dialog()).getByText('72 frames · 3.00 s · about 40 KB')).toBeTruthy();
    await fireEvent.click(within(dialog()).getByRole('button', { name: 'Export file' }));
    await vi.waitFor(() => expect(within(dialog()).getByText('Making the web page…')).toBeTruthy());
    release();
    await vi.waitFor(() => expect(animUi.dialog).toBeNull());
    expect(s.disk.get('/work/Task1.html')).toContain('/* player */');
  });

  it('AN8 AN15 GIF and HTML: When it ends — Loop or Play once and stop (M/J/19 "should then stop")', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    // An MP4 simply stops at its end.
    expect(within(dialog()).queryByRole('radiogroup', { name: 'When it ends' })).toBeNull();
    expect(within(dialog()).getByText(/A video plays once and stops/)).toBeTruthy();
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /Animated GIF/ }));
    const ends = within(within(dialog()).getByRole('radiogroup', { name: 'When it ends' }));
    expect((ends.getByRole('radio', { name: /^Loop/ }) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(
      ends.getByRole('radio', { name: /Play once and stop on the last frame/ }),
    );
    expect(s.anim.store.get().history.present.stage.playOnce).toBe(true);
    // Saved with the animation, so it is still chosen for the web page and next time.
    await fireEvent.click(within(dialog()).getByRole('radio', { name: /HTML web animation/ }));
    const again = within(within(dialog()).getByRole('radiogroup', { name: 'When it ends' }));
    expect(
      (again.getByRole('radio', { name: /Play once and stop/ }) as HTMLInputElement).checked,
    ).toBe(true);
    await fireEvent.click(again.getByRole('radio', { name: /^Loop/ }));
    expect(s.anim.store.get().history.present.stage.playOnce).toBeUndefined();
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

describe('more export choices (AN15, AN28)', () => {
  it('AN15 offers AVI and MOV; a width keeps the proportions (1024 × 768 at 600 px is 600 × 450)', async () => {
    await animationMode(1024, 768);
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = within(dialog());
    expect(d.getByRole('radio', { name: /AVI video/ })).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /MOV video/ }));
    expect(d.getByText(/Apple’s own QuickTime type/)).toBeTruthy();
    expect(d.getByText('px → 1024 × 768')).toBeTruthy();
    await fireEvent.input(d.getByRole('textbox', { name: 'Width in pixels' }), {
      target: { value: '600' },
    });
    expect(d.getByText('px → 600 × 450')).toBeTruthy();
    // An SVG is vector: no width to choose.
    await fireEvent.click(d.getByRole('radio', { name: /SVG picture/ }));
    expect(d.queryByRole('textbox', { name: 'Width in pixels' })).toBeNull();
  });

  it('AN15 a range of frames: its frames and length; one that cannot be used is explained', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = within(dialog());
    await fireEvent.input(d.getByRole('textbox', { name: 'From frame' }), {
      target: { value: '24' },
    });
    await fireEvent.input(d.getByRole('textbox', { name: 'To frame' }), {
      target: { value: '2 s' },
    });
    expect(d.getByText(/^25 frames · 1\.04 s/)).toBeTruthy();
    await fireEvent.input(d.getByRole('textbox', { name: 'To frame' }), {
      target: { value: '10' },
    });
    expect(d.getByRole('alert').textContent).toMatch(/first frame must come before/);
    expect((d.getByRole('button', { name: 'Export file' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await fireEvent.click(d.getByRole('button', { name: 'Whole animation' }));
    expect(d.getByText(/^72 frames · 3\.00 s/)).toBeTruthy();
    // A picture of the frame has no range.
    await fireEvent.click(d.getByRole('radio', { name: /PNG picture/ }));
    expect(d.queryByRole('textbox', { name: 'From frame' })).toBeNull();
  });

  it('AN15 Export file makes a part at the width typed', async () => {
    const s = await animationMode();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/work/Part.mp4');
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = within(dialog());
    await fireEvent.input(d.getByRole('textbox', { name: 'Width in pixels' }), {
      target: { value: '300' },
    });
    await fireEvent.input(d.getByRole('textbox', { name: 'From frame' }), {
      target: { value: '0' },
    });
    await fireEvent.input(d.getByRole('textbox', { name: 'To frame' }), {
      target: { value: '23' },
    });
    await fireEvent.click(d.getByRole('button', { name: 'Export file' }));
    await vi.waitFor(() => expect(animUi.dialog).toBeNull());
    expect(await s.engine.probe('/work/Part.mp4')).toMatchObject({
      duration: 1,
      video: { width: 300, height: 200 },
    });
  });

  it('AN28 says where the sounds go: into a video, inside the page, left out of a GIF', async () => {
    const s = await animationMode();
    s.engine.addFile('/m/alarm.mp3', {
      kind: 'audio',
      container: 'mp3',
      duration: 2,
      sizeBytes: 32_000,
      audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
    });
    s.dialogs.openSound.mockResolvedValueOnce('/m/alarm.mp3');
    await s.anim.addSound();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = within(dialog());
    expect(d.getByText('Its sound goes into the video, each at its time.')).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /HTML web animation/ }));
    expect(d.getByText(/goes inside the page.*Click to play with sound/)).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /Animated GIF/ }));
    expect(d.getByText(/A GIF has no sound: the animation’s sound is left out/)).toBeTruthy();
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
