import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import Inspector from '../../../src/ui/Inspector.svelte';
import App from '../../../src/ui/App.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { testApp } from '../../helpers/test-app.ts';

const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const change = (name: string, value: string) =>
  fireEvent.change(field(name), { target: { value } });

/** Opens the font chooser and picks a font by its name. */
async function chooseFont(name: string) {
  await fireEvent.click(screen.getByRole('button', { name: /^Font:/ }));
  await fireEvent.click(
    within(screen.getByRole('radiogroup', { name: 'Font' })).getByRole('radio', { name }),
  );
}

function withCaption() {
  const t = testApp();
  t.app.setPlayhead(2);
  t.app.addText('caption');
  render(Inspector, { props: { app: t.app } });
  const item = () => t.app.store.get().history.present.timeline.text[0]!;
  return { ...t, item };
}

async function withTitle() {
  const t = testApp();
  await t.importFiles('/m/photo.jpg', '/m/clip.mp4');
  t.app.addTitle();
  render(Inspector, { props: { app: t.app } });
  const item = () => {
    const main = t.app.store.get().history.present.timeline.main[0]!;
    if (main.type !== 'title') throw new Error('not a title');
    return main;
  };
  return { ...t, item };
}

describe('text inspector (screens 02–04)', () => {
  it('V4 changes the words, font, size, colour and style of a caption', async () => {
    const { item } = withCaption();
    expect(screen.getByText(/^Caption ·/)).toBeTruthy();
    await change('Text', 'Fish eagle\nat the lake');
    await chooseFont('Courier Prime');
    await change('Size', '48');
    await fireEvent.change(field('Colour'), { target: { value: '#ffcc00' } });
    await fireEvent.click(field('Bold'));
    await fireEvent.click(field('Italic'));
    expect(item()).toMatchObject({
      text: 'Fish eagle\nat the lake',
      style: { font: 'Courier Prime', size: 48, colour: '#ffcc00', bold: true, italic: true },
    });
  });

  it('X2 fonts are shown in groups, each name in its own letters; choosing one closes the list', async () => {
    const { item } = withCaption();
    const open = screen.getByRole('button', { name: 'Font: Inter' });
    expect(open.getAttribute('aria-expanded')).toBe('false');
    await fireEvent.click(open);
    const list = screen.getByRole('radiogroup', { name: 'Font' });
    for (const group of ['Sans-serif', 'Serif', 'Display', 'Handwriting', 'Typewriter & retro'])
      expect(within(list).getByText(group)).toBeTruthy();
    const lobster = within(list).getByRole('radio', { name: 'Lobster' });
    expect(lobster.style.fontFamily).toMatch(/Lobster/);
    expect(within(list).getByRole('radio', { name: 'Inter' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await fireEvent.click(lobster);
    expect(item().style.font).toBe('Lobster');
    expect(screen.queryByRole('radiogroup', { name: 'Font' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Font: Lobster' })).toBeTruthy();
  });

  it('V4 places text with the 3 × 3 position grid and aligns its lines', async () => {
    const { item } = withCaption();
    await fireEvent.click(screen.getByRole('button', { name: 'Bottom right' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Align right' }));
    expect(item().style).toMatchObject({ position: 'bottom-right', align: 'right' });
    expect(screen.getByRole('button', { name: 'Bottom right' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('explains a size that is too big, and changes nothing', async () => {
    const { item } = withCaption();
    await change('Size', '900');
    expect(screen.getByRole('alert').textContent).toMatch(/between 8 and 300/);
    expect(item().style.size).toBe(36);
  });

  it('V5 moves a caption in time and changes how long it shows', async () => {
    const { item } = withCaption();
    await change('Starts at', '16.7');
    await change('Duration', '5');
    expect(item()).toMatchObject({ start: 16.7, duration: 5 });
  });

  it('V6 adds readability: outline and a dark box (captions start with a shadow)', async () => {
    const { item } = withCaption();
    expect(field('Shadow').checked).toBe(true);
    await fireEvent.click(field('Outline'));
    await fireEvent.click(field('Dark box'));
    expect(item().style).toMatchObject({ shadow: true, outline: true, box: true });
  });

  it('V7 fades text in and out and gives it an entrance', async () => {
    const { item } = withCaption();
    await change('Text fade in', '0.5');
    await change('Text fade out', '1');
    await change('Entrance', 'fly-left');
    expect(item()).toMatchObject({ fadeIn: 0.5, fadeOut: 1, entrance: 'fly-left' });
  });

  it('credits can stop scrolling', async () => {
    const t = testApp();
    t.app.addText('credits');
    render(Inspector, { props: { app: t.app } });
    expect(field('Scroll up the screen').checked).toBe(true);
    await fireEvent.click(field('Scroll up the screen'));
    expect(t.app.store.get().history.present.timeline.text[0]!.scroll).toBe(false);
  });
});

describe('title slide inspector (screen 03)', () => {
  it('V6 warns when the words are hard to read on the background colour', async () => {
    const { item } = await withTitle();
    expect(screen.getByText(/easy to read/i)).toBeTruthy();
    await fireEvent.change(field('Background colour'), { target: { value: '#eeeeee' } });
    expect(item().background).toEqual({ kind: 'colour', colour: '#eeeeee' });
    expect(screen.getByText(/hard to read/i)).toBeTruthy();
  });

  it('V4 puts the title over an imported picture or video', async () => {
    const { item, app } = await withTitle();
    const [photo, clip] = app.store.get().history.present.media;
    await change('Background', 'image');
    await change('Background picture', photo!.id);
    expect(item().background).toEqual({ kind: 'image', assetId: photo!.id });
    await change('Background', 'video');
    await change('Background video', clip!.id);
    expect(item().background).toEqual({ kind: 'video', assetId: clip!.id });
  });

  it('changes the words and how long the slide lasts', async () => {
    const { item } = await withTitle();
    await change('Text', 'My holiday');
    await change('Duration', '3');
    expect(item()).toMatchObject({ text: 'My holiday', duration: 3 });
  });
});

describe('timeline text track', () => {
  it('adds a title, caption, subtitle and credits from the toolbar', async () => {
    const t = testApp();
    render(App, { props: { app: t.app } });
    for (const name of ['Add title', 'Add caption', 'Add subtitle', 'Add credits'])
      await fireEvent.click(screen.getByRole('button', { name }));
    const { main, text } = t.app.store.get().history.present.timeline;
    expect(main.map((m) => m.type)).toEqual(['title']);
    expect(text.map((x) => x.kind)).toEqual(['caption', 'subtitle', 'credits']);
  });

  it('shows text items at their time on the text track; clicking one selects it', async () => {
    const t = testApp();
    t.app.setPlayhead(3);
    t.app.addText('caption');
    t.app.select(null);
    render(Timeline, { props: { app: t.app } });
    const caption = screen.getByRole('button', { name: /^Caption: Caption/ });
    expect(parseFloat(caption.style.left)).toBe(3 * 40);
    await fireEvent.click(caption);
    expect(t.app.store.get().selection).toBe(
      t.app.store.get().history.present.timeline.text[0]!.id,
    );
  });

  it('drags a caption along the text track to a new start time', async () => {
    const t = testApp();
    t.app.setPlayhead(3);
    t.app.addText('caption'); // 3–8 s
    render(Timeline, { props: { app: t.app } });
    const caption = screen.getByRole('button', { name: /^Caption: Caption/ });
    // 40 px = 1 s: dragging 80 px right moves it 2 s later.
    await fireEvent.mouseDown(caption, { clientX: 130 });
    await fireEvent.mouseMove(window, { clientX: 210 });
    await fireEvent.mouseUp(window, { clientX: 210 });
    expect(t.app.store.get().history.present.timeline.text[0]!.start).toBe(5);
    expect(parseFloat(caption.style.left)).toBe(5 * 40);
    t.app.undo();
    expect(t.app.store.get().history.present.timeline.text[0]!.start).toBe(3);
  });

  it('a click without moving only selects the caption', async () => {
    const t = testApp();
    t.app.addText('caption');
    t.app.select(null);
    render(Timeline, { props: { app: t.app } });
    const caption = screen.getByRole('button', { name: /^Caption: Caption/ });
    await fireEvent.mouseDown(caption, { clientX: 10 });
    await fireEvent.mouseUp(window, { clientX: 11 });
    await fireEvent.click(caption);
    expect(t.app.store.get().history.present.timeline.text[0]!.start).toBe(0);
    expect(t.app.store.get().selection).toBe(
      t.app.store.get().history.present.timeline.text[0]!.id,
    );
  });
});
