// The screen 01 layout: media filters, timeline tracks and tools, preview safe area.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MediaBin from '../../../src/ui/MediaBin.svelte';
import Preview from '../../../src/ui/Preview.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

async function twoItems() {
  const t = testApp();
  await t.importFiles('/m/clip.mp4', '/m/photo.jpg');
  for (const m of t.app.store.get().history.present.media) t.app.addToTimeline(m.id);
  return t;
}

describe('media bin filters', () => {
  it('shows all media, or only videos, pictures or sound', async () => {
    const { app } = await twoItems();
    render(MediaBin, { props: { app } });
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Images' }));
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('photo.jpg'),
    ]);
    await fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('marks media that is used on the timeline', async () => {
    const { app } = await twoItems();
    render(MediaBin, { props: { app } });
    expect(screen.getByText('100×100 · used')).toBeTruthy();
  });
});

describe('timeline tracks and tools', () => {
  it('has Video, Text, Music and Voiceover tracks and a labelled ruler', async () => {
    const { app } = await twoItems();
    render(Timeline, { props: { app } });
    for (const track of ['Video', 'Text', 'Music', 'Voiceover'])
      expect(screen.getByText(track)).toBeTruthy();
    expect(screen.getByText('0:00')).toBeTruthy();
    expect(screen.getByText('0:02')).toBeTruthy(); // a label every 2 s at 40 px per second
  });

  it('Snap can be turned off and on', async () => {
    const { app } = await twoItems();
    render(Timeline, { props: { app } });
    const snap = screen.getByRole('button', { name: 'Snap' });
    expect(snap.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(snap);
    expect(ui.snap).toBe(false);
  });

  it('Transition selects the clip’s Effects tab, where its transition is set', async () => {
    const { app } = await twoItems();
    app.select(app.store.get().history.present.timeline.main[1]!.id);
    render(Timeline, { props: { app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Transition' }));
    expect(ui.inspectorTab).toBe('effects');
  });

  it('the zoom slider changes how many pixels show one second', async () => {
    const { app } = await twoItems();
    render(Timeline, { props: { app } });
    await fireEvent.input(screen.getByLabelText('Timeline zoom'), { target: { value: '80' } });
    expect(screen.getByText('80 px = 1 s')).toBeTruthy();
  });
});

describe('preview safe area', () => {
  it('shows the 5 % safe area for titles and captions when asked', async () => {
    const { app } = await twoItems();
    render(Preview, { props: { app } });
    expect(document.querySelector('.safe')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: /safe area/i }));
    expect(document.querySelector('.safe')).not.toBeNull();
  });
});

describe('adding a title', () => {
  it('opens the new title on its Text tab, even if Effects was open before', async () => {
    const { render: r, screen: sc, fireEvent: fe } = await import('@testing-library/svelte');
    const App = (await import('../../../src/ui/App.svelte')).default;
    ui.inspectorTab = 'effects';
    r(App, { props: { app: testApp().app } });
    await fe.click(sc.getByRole('button', { name: 'Add title' }));
    expect(sc.getByRole('tab', { name: 'Text' }).getAttribute('aria-selected')).toBe('true');
    expect(sc.getByLabelText('Text')).toBeTruthy();
  });
});
