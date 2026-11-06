// V20: a picture or video over the video in the media bin, the timeline, the inspector and the
// preview.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import Inspector from '../../../src/ui/Inspector.svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import Preview from '../../../src/ui/Preview.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { IMAGE, testApp, VIDEO } from '../../helpers/test-app.ts';

const media = { '/m/clip.mp4': VIDEO, '/m/Logo.png': IMAGE };

async function withLogo() {
  const t = testApp(media);
  await t.importFiles('/m/clip.mp4', '/m/Logo.png');
  const id = (path: string) =>
    t.app.store.get().history.present.media.find((m) => m.path === path)!.id;
  t.app.addToTimeline(id('/m/clip.mp4'));
  const overlay = () => t.app.store.get().history.present.timeline.overlay ?? [];
  return { ...t, id, overlay };
}
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe('V20 over the video in the screens', () => {
  it('V20: the media bin puts a picture or video over the video at the playhead (not a sound)', async () => {
    const { app, overlay } = await withLogo();
    render(MediaBin, { props: { app } });
    app.setPlayhead(1);
    const put = screen.getByRole('button', { name: 'Put Logo.png over the video at the playhead' });
    expect(put.title).toMatch(/logo|picture-in-picture/i);
    await fireEvent.click(put);
    expect(overlay()).toMatchObject([{ type: 'image', start: 1 }]);
    expect(screen.getByRole('button', { name: /put clip\.mp4 over the video/i })).toBeTruthy();
    // It is marked as used.
    expect(screen.getAllByText(/used/).length).toBe(2);
  });

  it('V20: the timeline shows it on its own track above the video; select, drag and delete', async () => {
    const { app, id, overlay } = await withLogo();
    render(Timeline, { props: { app } });
    app.addOverTheVideo(id('/m/Logo.png'));
    const track = await screen.findByLabelText('Over the video track');
    const item = within(track).getByRole('button', { name: /Logo\.png 10\.00 s/ });
    await fireEvent.click(item);
    expect(app.store.get().selection).toBe(overlay()[0]!.id);
    // Dragging 40 px at 40 px a second moves it 1 s later.
    await fireEvent.mouseDown(item, { clientX: 100 });
    await fireEvent.mouseUp(window, { clientX: 140 });
    expect(overlay()[0]!.start).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(app.store.get().history.present.timeline).not.toHaveProperty('overlay');
  });

  it('V20: the inspector sets its time, size, place, opacity and fades, with "Why use this?"', async () => {
    const { app, id, overlay } = await withLogo();
    app.setPlayhead(2);
    app.addOverTheVideo(id('/m/Logo.png'));
    render(Inspector, { props: { app } });
    expect(screen.getByText(/Picture over the video/)).toBeTruthy();
    await type('Starts at', '1.25');
    await type('Duration', '4.5');
    await type('Width', '40');
    await type('Margin', '10');
    await fireEvent.click(screen.getByRole('button', { name: 'Bottom left' }));
    await type('Opacity', '60');
    await type('Fade in', '0.5');
    await type('Fade out', '1');
    expect(overlay()[0]).toMatchObject({
      start: 1.25,
      duration: 4.5,
      widthPercent: 40,
      margin: 10,
      position: 'bottom-left',
      opacity: 0.6,
      fadeIn: 0.5,
      fadeOut: 1,
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Show for the whole video' }));
    expect(overlay()[0]).toMatchObject({ start: 0, duration: 10 });
    await type('Width', '0');
    expect(screen.getByRole('alert').textContent).toMatch(/between 1 and 100 %/);
    expect(screen.getByRole('button', { name: /why use this/i })).toBeTruthy();
  });

  it('V20: a video over the video: trim, and its own sound off until turned on', async () => {
    const { app, id, overlay } = await withLogo();
    app.addOverTheVideo(id('/m/clip.mp4'));
    render(Inspector, { props: { app } });
    expect(screen.getByText(/Video over the video/)).toBeTruthy();
    await type('Start point', '1');
    await type('End point', '4');
    expect(overlay()[0]).toMatchObject({ in: 1, out: 4 });
    const sound = screen.getByRole('checkbox', { name: /play its sound/i }) as HTMLInputElement;
    expect(sound.checked).toBe(false);
    expect(screen.queryByLabelText('Volume')).toBeNull();
    await fireEvent.click(sound);
    expect(overlay()[0]).toMatchObject({ muted: false });
    await type('Volume', '50');
    expect(overlay()[0]).toMatchObject({ volume: 0.5 });
  });

  it('V20: the preview shows the picture over the video, under the text', async () => {
    const { app, id } = await withLogo();
    render(Preview, { props: { app } });
    app.addOverTheVideo(id('/m/Logo.png'));
    const logo = await waitFor(() => {
      const img = document.querySelector<HTMLImageElement>('.overlay img');
      if (!img) throw new Error('no overlay yet');
      return img;
    });
    expect(logo.getAttribute('src')).toBe(toMediaUrl('/m/Logo.png'));
    const place = logo.parentElement!;
    // 25 % wide, 20 px from the top-right corner of a 1920 × 1080 frame (a square picture).
    expect(place.style.width).toBe('25%');
    expect(place.style.left).toBe(`${Number((((1920 - 480 - 20) / 1920) * 100).toFixed(4))}%`);
    // The text is drawn above it.
    const text = document.querySelector('canvas.text')!;
    expect(place.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
