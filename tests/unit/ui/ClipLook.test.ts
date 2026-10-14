import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Inspector from '../../../src/ui/Inspector.svelte';
import { testApp } from '../../helpers/test-app.ts';

async function twoClips(select: 0 | 1 = 0) {
  const t = testApp();
  await t.importFiles('/m/clip.mp4', '/m/photo.jpg');
  const [clip, photo] = t.app.store.get().history.present.media;
  t.app.addToTimeline(clip!.id); // 10 s
  t.app.addToTimeline(photo!.id); // 5 s
  const item = () => t.app.store.get().history.present.timeline.main[select]!;
  t.app.select(item().id);
  render(Inspector, { props: { app: t.app } });
  return { ...t, item };
}
const type = async (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('fades, filters, pan & zoom and transitions in the inspector (screens 05–07)', () => {
  it('V7 fades the clip in and out, to black or white', async () => {
    const { item } = await twoClips();
    await type('Fade in', '1');
    await type('Fade out', '2');
    await fireEvent.click(screen.getByLabelText('White'));
    expect(item().fade).toEqual({ in: 1, out: 2, colour: 'white' });
  });

  it('explains a fade longer than the clip', async () => {
    const { item } = await twoClips(1);
    await type('Fade in', '9');
    expect(screen.getByRole('alert').textContent).toMatch(/longer than the clip/);
    expect(item().fade).toBeUndefined();
  });

  it('V15 adds filters, changes their generated settings and removes them', async () => {
    const { item } = await twoClips();
    await fireEvent.click(screen.getByRole('button', { name: 'Add Cyan tone' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Add Box blur' }));
    await type('Strength', '12');
    expect(item().effects).toEqual([
      { effectId: 'video.cyan', params: {} },
      { effectId: 'video.blur', params: { radius: 12 } },
    ]);
    await fireEvent.click(screen.getByRole('button', { name: 'Remove Cyan tone' }));
    expect(item().effects).toEqual([{ effectId: 'video.blur', params: { radius: 12 } }]);
  });

  it('T5 every tool explains why it is used', async () => {
    await twoClips(1);
    expect(screen.getAllByText('Why use this?').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText(/shows that time has passed/i)).toBeTruthy();
  });

  it('V8 chooses a pan & zoom preset and when it starts in the clip (Book A 11.07)', async () => {
    const { item } = await twoClips();
    await type('Pan and zoom', 'zoom-in');
    await type('Starts at (in the clip)', '5');
    expect(item().panZoom).toMatchObject({
      preset: 'zoom-in',
      from: { zoom: 1 },
      to: { zoom: 1.5 },
      start: 5,
    });
  });

  it('V8 custom frames: zoom and centre of the start and end', async () => {
    const { item } = await twoClips();
    await type('Pan and zoom', 'zoom-in');
    await type('End zoom', '180');
    await type('End across', '62');
    await type('End down', '38');
    expect(item().panZoom!.to).toEqual({ zoom: 1.8, x: 0.62, y: 0.38 });
    await type('Pan and zoom', 'none');
    expect(item().panZoom).toBeUndefined();
  });

  it('V9 sets the transition into the second clip and its length', async () => {
    const { item } = await twoClips(1);
    await type('Transition', 'transition.fadeblack');
    expect(item().transitionIn).toEqual({ effectId: 'transition.fadeblack', duration: 1 });
    await fireEvent.click(screen.getByRole('button', { name: '2 s' }));
    expect(item().transitionIn!.duration).toBe(2);
    await type('Transition', 'none');
    expect(item().transitionIn).toBeUndefined();
  });

  it('the first clip has no transition into it', async () => {
    await twoClips(0);
    expect(screen.queryByLabelText('Transition')).toBeNull();
  });
});
