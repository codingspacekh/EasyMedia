import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { testApp } from '../../helpers/test-app.ts';

async function withTwoItems() {
  const t = testApp();
  await t.importFiles('/m/clip.mp4', '/m/photo.jpg');
  const [clip, photo] = t.app.store.get().history.present.media;
  t.app.addToTimeline(clip!.id); // 10 s
  t.app.addToTimeline(photo!.id); // 5 s
  return t;
}

describe('timeline (main track)', () => {
  it('explains what to do when empty', () => {
    render(Timeline, { props: { app: testApp().app } });
    expect(screen.getByText(/add clips from the media bin/i)).toBeTruthy();
  });

  it('shows the clips one after another, as wide as they are long, with their length', async () => {
    const { app } = await withTwoItems();
    render(Timeline, { props: { app } });
    const [clip, still] = screen
      .getAllByRole('button', { name: /s$/ })
      .filter((b) => b.dataset.item);
    expect(clip!.textContent).toMatch(/clip\.mp4.*10\.00 s/);
    expect(still!.textContent).toMatch(/photo\.jpg.*5\.00 s/);
    expect(parseFloat(clip!.style.width)).toBeCloseTo(2 * parseFloat(still!.style.width), 5);
  });

  it('selects a clip and deletes it', async () => {
    const { app } = await withTwoItems();
    render(Timeline, { props: { app } });
    const clip = screen
      .getAllByRole('button')
      .find((b) => b.dataset.item && /clip\.mp4/.test(b.textContent ?? ''))!;
    await fireEvent.click(clip);
    expect(clip.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(app.store.get().history.present.timeline.main).toHaveLength(1);
  });

  it('shows the total length', async () => {
    const { app } = await withTwoItems();
    render(Timeline, { props: { app } });
    expect(screen.getByText(/00:15\.00/)).toBeTruthy();
  });
});
