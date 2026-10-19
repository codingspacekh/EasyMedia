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

  describe('M5 timeline tools', () => {
    const clips = () => screen.getAllByRole('button').filter((b) => b.dataset.item);
    const ids = (app: Awaited<ReturnType<typeof withTwoItems>>['app']) =>
      app.store.get().history.present.timeline.main.map((m) => m.type);

    it('Split cuts the clip under the playhead; it is off when the playhead is past the end', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      app.setPlayhead(4);
      await fireEvent.click(await screen.findByRole('button', { name: 'Split' }));
      expect(ids(app)).toEqual(['video', 'video', 'image']);
      app.setPlayhead(99);
      await Promise.resolve();
      expect((screen.getByRole('button', { name: 'Split' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it('Join puts a split clip back together', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      app.setPlayhead(4);
      await fireEvent.click(await screen.findByRole('button', { name: 'Split' }));
      await fireEvent.click(clips()[0]!);
      await fireEvent.click(screen.getByRole('button', { name: 'Join' }));
      expect(ids(app)).toEqual(['video', 'image']);
    });

    it('Zoom in makes clips twice as wide', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      const before = parseFloat(clips()[0]!.style.width);
      await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
      expect(parseFloat(clips()[0]!.style.width)).toBeCloseTo(before * 2, 5);
    });

    it('Zoom out halves the width; Join is off for the last clip', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      const before = parseFloat(clips()[0]!.style.width);
      await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
      expect(parseFloat(clips()[0]!.style.width)).toBeCloseTo(before / 2, 5);
      await fireEvent.click(clips()[1]!);
      expect((screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });

    it('dragging a clip onto another moves it there', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      const [video, still] = clips();
      await fireEvent.dragStart(still!);
      await fireEvent.drop(video!);
      expect(ids(app)).toEqual(['image', 'video']);
    });

    it('dragging the end handle 80 px left at 40 px/s trims 2 s', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      const handle = screen.getByLabelText('Trim the end of clip.mp4');
      await fireEvent.mouseDown(handle, { clientX: 400 });
      await fireEvent.mouseMove(window, { clientX: 320 });
      await fireEvent.mouseUp(window, { clientX: 320 });
      expect(app.store.get().history.present.timeline.main[0]).toMatchObject({ in: 0, out: 8 });
    });

    it('the end snaps to the playhead when dropped close to it', async () => {
      const { app } = await withTwoItems();
      render(Timeline, { props: { app } });
      app.setPlayhead(7);
      const handle = screen.getByLabelText('Trim the end of clip.mp4');
      await fireEvent.mouseDown(handle, { clientX: 400 });
      await fireEvent.mouseUp(window, { clientX: 284 }); // −2.9 s → 7.1 s, within 8 px of the playhead
      expect(app.store.get().history.present.timeline.main[0]).toMatchObject({ out: 7 });
    });
  });
});

describe('N10 Video mode keyboard', () => {
  it('Delete (or Backspace) removes the selected clip; typing in a box does not', async () => {
    const { app } = await withTwoItems();
    render(Timeline, { props: { app } });
    const main = () => app.store.get().history.present.timeline.main;
    app.select(main()[1]!.id);
    const box = document.body.appendChild(document.createElement('input'));
    await fireEvent.keyDown(box, { key: 'Delete' });
    expect(main()).toHaveLength(2);
    await fireEvent.keyDown(window, { key: 'Delete' });
    expect(main()).toHaveLength(1);
    app.select(main()[0]!.id);
    await fireEvent.keyDown(window, { key: 'Backspace' });
    expect(main()).toHaveLength(0);
  });
});
