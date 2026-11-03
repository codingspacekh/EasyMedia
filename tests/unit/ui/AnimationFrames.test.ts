// M16 / AN14: stop motion and frame-by-frame on screen — Import frames on the tool strip (the rate,
// then the folder), the timeline's Frame-by-frame, Blank keyframe, Duplicate frame, Remove and
// Onion skin, and F6 / F7 as in Animate.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { testApp } from '../../helpers/test-app.ts';

const shot: ProbeInfo = {
  kind: 'image',
  container: 'png',
  sizeBytes: 1,
  video: { codec: 'png', width: 320, height: 240 },
};

async function open() {
  const media = Object.fromEntries(
    ['/s/a1.png', '/s/a2.png', '/s/a3.png', '/s/a4.png'].map((p) => [p, shot]),
  );
  const t = testApp(media);
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  return { ...t, anim, doc };
}

describe('Import frames (AN14)', () => {
  it('asks for the rate, then the folder, and puts the stop motion on a new layer', async () => {
    const s = await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Import frames' }));
    const d = within(screen.getByRole('dialog', { name: 'Import frames' }));
    expect(d.getByText(/held for 2 frames of the stage’s 24 fps/)).toBeTruthy();
    await fireEvent.input(d.getByLabelText('Pictures a second'), { target: { value: '8' } });
    expect(d.getByText(/held for 3 frames/)).toBeTruthy();
    s.dialogs.openFrames.mockResolvedValueOnce([
      '/s/a2.png',
      '/s/a1.png',
      '/s/a3.png',
      '/s/a4.png',
    ]);
    await fireEvent.click(d.getByRole('button', { name: 'Choose folder…' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Import frames' })).toBeNull(),
    );
    const layer = s.doc().layers.at(-1)!;
    expect(layer.name).toBe('Stop motion');
    expect(layer.objects[0]!.tracks![0]!.keyframes.map((k) => k.frame)).toEqual([0, 3, 6, 9]);
  });
});

describe('the shared dialog', () => {
  it('Escape closes it, as every dialog', async () => {
    await open();
    await fireEvent.click(screen.getByRole('button', { name: 'Import frames' }));
    expect(screen.getByRole('dialog', { name: 'Import frames' })).toBeTruthy();
    expect(screen.getByText('20.1 stop motion')).toBeTruthy();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Import frames' })).toBeNull();
  });
});

describe('frame-by-frame on the timeline (AN14)', () => {
  it('Frame-by-frame, Duplicate frame, Blank keyframe, Remove and Onion skin', async () => {
    const s = await open();
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 30, height: 30 });
    const bar = within(screen.getByRole('region', { name: 'Timeline' }));
    await fireEvent.click(bar.getByRole('button', { name: 'Make frame-by-frame' }));
    const layer = () => s.doc().layers[0]!;
    expect(layer().drawings).toEqual([0]);
    const fbf = within(await bar.findByRole('group', { name: 'Frame-by-frame' }));
    expect(
      (fbf.getByRole('button', { name: 'Remove keyframe' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    s.anim.setFrame(4);
    await fireEvent.click(fbf.getByRole('button', { name: 'Duplicate frame' }));
    expect(layer().drawings).toEqual([0, 4]);
    expect(bar.getByLabelText('Keyframe of a drawing at frame 4')).toBeTruthy();
    s.anim.setFrame(8);
    await fireEvent.click(fbf.getByRole('button', { name: 'Insert blank keyframe' }));
    expect(layer().drawings).toEqual([0, 4, 8]);
    await fireEvent.click(fbf.getByRole('button', { name: 'Remove keyframe' }));
    expect(layer().drawings).toEqual([0, 4]);
    s.anim.setFrame(6);
    await Promise.resolve();
    expect(
      (fbf.getByRole('button', { name: 'Remove keyframe' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const onion = fbf.getByRole('button', { name: 'Onion skin' });
    await fireEvent.click(onion);
    expect(s.anim.store.get().onionSkin).toBe(true);
    expect(onion.getAttribute('aria-pressed')).toBe('true');
  });

  it('F6 duplicates the drawing and F7 adds a blank keyframe, as in Animate; Shift + F6 removes', async () => {
    const s = await open();
    s.anim.addShape('rect', { x: 0, y: 0, width: 30, height: 30 });
    s.anim.makeFrameByFrame();
    s.anim.setFrame(2);
    await fireEvent.keyDown(window, { key: 'F6' });
    expect(s.doc().layers[0]!.drawings).toEqual([0, 2]);
    expect(s.doc().layers[0]!.objects).toHaveLength(2);
    s.anim.setFrame(5);
    await fireEvent.keyDown(window, { key: 'F7' });
    expect(s.doc().layers[0]!.drawings).toEqual([0, 2, 5]);
    expect(s.doc().layers[0]!.objects).toHaveLength(2);
    await fireEvent.keyDown(window, { key: 'F6', shiftKey: true });
    expect(s.doc().layers[0]!.drawings).toEqual([0, 2]);
  });

  it('the timeline lists only the objects of the drawing at the playhead', async () => {
    const s = await open();
    s.anim.addShape('rect', { x: 0, y: 0, width: 30, height: 30 });
    s.anim.makeFrameByFrame();
    s.anim.setFrame(3);
    s.anim.insertDrawing('blank');
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 30, height: 30 });
    const bar = within(screen.getByRole('region', { name: 'Timeline' }));
    await vi.waitFor(() => expect(bar.queryByRole('button', { name: 'Ellipse' })).toBeTruthy());
    expect(bar.queryByRole('button', { name: 'Rectangle' })).toBeNull();
    s.anim.setFrame(0);
    await vi.waitFor(() => expect(bar.queryByRole('button', { name: 'Rectangle' })).toBeTruthy());
    expect(bar.queryByRole('button', { name: 'Ellipse' })).toBeNull();
  });
});
