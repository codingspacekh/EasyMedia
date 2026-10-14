import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Inspector from '../../../src/ui/Inspector.svelte';
import { testApp } from '../../helpers/test-app.ts';

async function selected(path: string) {
  const t = testApp();
  await t.importFiles(path);
  const asset = t.app.store.get().history.present.media[0]!;
  t.app.addToTimeline(asset.id);
  const item = () => t.app.store.get().history.present.timeline.main[0]!;
  t.app.select(item().id);
  render(Inspector, { props: { app: t.app } });
  return { ...t, item };
}
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe('M5 inspector', () => {
  it('asks the student to select something first', () => {
    render(Inspector, { props: { app: testApp().app } });
    expect(screen.getByText(/select a clip on the timeline/i)).toBeTruthy();
  });

  it('shows a video clip: start, end and length on the timeline', async () => {
    await selected('/m/clip.mp4');
    expect([field('Start point').value, field('End point').value]).toEqual(['0.00', '10.00']);
    expect(screen.getByText('10.00 s')).toBeTruthy();
  });

  it('V2: typing an end point trims the clip (Enter or leaving the box)', async () => {
    const { item } = await selected('/m/clip.mp4');
    await type('End point', '6.3');
    expect(item()).toMatchObject({ in: 0, out: 6.3 });
    expect(screen.getByText('6.30 s')).toBeTruthy();
  });

  it('Book B Task 11c through the inspector: 0–6.3 s, 1.5×, sound removed → 4.20 s', async () => {
    const { item } = await selected('/m/clip.mp4');
    await type('End point', '6.3');
    await fireEvent.click(screen.getByRole('button', { name: '1.5×' }));
    await fireEvent.click(screen.getByLabelText('Remove sound'));
    expect(item()).toMatchObject({ in: 0, out: 6.3, speed: 1.5, muted: true });
    expect(screen.getByText('4.20 s')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1.5×' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('explains a time it cannot read, next to the box, and changes nothing', async () => {
    const { item } = await selected('/m/clip.mp4');
    await type('End point', 'abc');
    expect(screen.getByRole('alert').textContent).toMatch(
      /type a time such as 12\.5 or 00:12\.50/i,
    );
    expect(item()).toMatchObject({ out: 10 });
  });

  it('explains an end point before the start point', async () => {
    const { item } = await selected('/m/clip.mp4');
    await type('Start point', '5');
    await type('End point', '3');
    expect(screen.getByRole('alert').textContent).toMatch(/after the start point/i);
    expect(item()).toMatchObject({ in: 5, out: 10 });
  });

  it('sets the end point to where the playhead is', async () => {
    const { app, item } = await selected('/m/clip.mp4');
    app.setPlayhead(3);
    await fireEvent.click(screen.getByRole('button', { name: 'Set end to playhead' }));
    expect(item()).toMatchObject({ out: 3 });
  });

  it('shows the old values again after Undo', async () => {
    const { app } = await selected('/m/clip.mp4');
    await type('End point', '6.3');
    app.undo();
    await Promise.resolve();
    expect(field('End point').value).toBe('10.00');
  });

  it('V12: a still image has a duration instead of start and end points', async () => {
    const { item } = await selected('/m/photo.jpg');
    expect(screen.queryByLabelText('Start point')).toBeNull();
    await type('Duration', '8');
    expect(item()).toMatchObject({ duration: 8 });
  });

  it('explains that the playhead must be over the clip to set a point from it', async () => {
    const { app, item } = await selected('/m/clip.mp4');
    app.setPlayhead(50);
    await fireEvent.click(screen.getByRole('button', { name: 'Set start to playhead' }));
    expect(screen.getByRole('alert').textContent).toMatch(/move the playhead over this clip/i);
    expect(item()).toMatchObject({ in: 0 });
  });
});
