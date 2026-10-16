// V13 in Video mode (screen 08): music and voiceover on the timeline, their inspector, and the
// sound of a video clip.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import Inspector from '../../../src/ui/Inspector.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { IMAGE, testApp, VIDEO } from '../../helpers/test-app.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';

const MUSIC: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 30,
  sizeBytes: 1,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
};

/** The 10 s clip on the main track and music.mp3 on the music track at 5 s, selected. */
async function withMusic() {
  const t = testApp({ '/m/clip.mp4': VIDEO, '/m/photo.jpg': IMAGE, '/m/music.mp3': MUSIC });
  await t.importFiles('/m/clip.mp4', '/m/music.mp3');
  const [clip, music] = t.app.store.get().history.present.media;
  t.app.addToTimeline(clip!.id);
  t.app.setPlayhead(5);
  t.app.addToTimeline(music!.id); // selects it
  const project = () => t.app.store.get().history.present;
  const sound = () => project().timeline.audio.flat()[0]!;
  return { ...t, project, sound };
}
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), { target: { value } });

describe('V13 music and voiceover on the timeline', () => {
  it('draws the music on the music track from its start, as wide as it is long, with its waveform', async () => {
    const { app } = await withMusic();
    render(Timeline, { props: { app } });
    const lane = screen.getByLabelText('Music track');
    const clip = within(lane).getByRole('button', { name: /music\.mp3/ });
    expect(clip.style.left).toBe(`${5 * 40}px`);
    expect(clip.style.width).toBe(`${30 * 40}px`);
    expect(clip.textContent).toMatch(/starts 5\.00 s/);
    await vi.waitFor(() => expect(clip.querySelector('svg.wave path')).not.toBeNull());
    expect(within(screen.getByLabelText('Voiceover track')).queryAllByRole('button')).toEqual([]);
  });

  it('selects a sound by clicking it, and deletes it', async () => {
    const { app, project } = await withMusic();
    app.select(null);
    render(Timeline, { props: { app } });
    const clip = screen.getByRole('button', { name: /music\.mp3/ });
    await fireEvent.mouseDown(clip);
    await fireEvent.mouseUp(window, { clientX: 0 });
    expect(clip.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(project().timeline.audio[0]).toEqual([]);
  });
});

describe('V13 audio inspector (screen 08)', () => {
  it('shows where the music plays: it ends with the video', async () => {
    const { app } = await withMusic();
    render(Inspector, { props: { app } });
    expect(screen.getByText(/music · audio 1/i)).toBeTruthy();
    expect([field('Starts at').value, field('Trim start').value, field('Trim end').value]).toEqual([
      '5.00',
      '0.00',
      '30.00',
    ]);
    expect(screen.getByText(/plays 5\.00 – 10\.00 s, ending with the video/i)).toBeTruthy();
  });

  it('Book B Task 11e: moves the music to start at 5 s, trims it, sets volume and fades', async () => {
    const { app, sound } = await withMusic();
    render(Inspector, { props: { app } });
    await type('Starts at', '3');
    await type('Trim start', '1.5');
    await type('Trim end', '20');
    await type('Volume', '80');
    await type('Fade in', '1');
    await type('Fade out', '3');
    expect(sound()).toMatchObject({
      start: 3,
      in: 1.5,
      out: 20,
      volume: 0.8,
      fadeIn: 1,
      fadeOut: 3,
    });
  });

  it('starts at the playhead with one click', async () => {
    const { app, sound } = await withMusic();
    app.setPlayhead(2.5);
    render(Inspector, { props: { app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Start at the playhead' }));
    expect(sound().start).toBe(2.5);
  });

  it('lowers the music under the voiceover, and moves a sound to the voiceover track', async () => {
    const { app, project, sound } = await withMusic();
    render(Inspector, { props: { app } });
    await fireEvent.click(screen.getByLabelText('Lower under voiceover (−6 dB)'));
    expect(sound().duck).toBe(true);
    await fireEvent.change(screen.getByLabelText('Track'), { target: { value: '1' } });
    expect(project().timeline.audio[1]).toHaveLength(1);
    expect(screen.queryByLabelText('Lower under voiceover (−6 dB)')).toBeNull();
    expect(screen.getByText(/voiceover · audio 2/i)).toBeTruthy();
  });

  it('explains a volume it cannot use, and changes nothing', async () => {
    const { app, sound } = await withMusic();
    render(Inspector, { props: { app } });
    await type('Volume', '300');
    expect(screen.getByRole('alert').textContent).toMatch(/0 % and 200 %/);
    expect(sound().volume).toBe(1);
  });
});

describe('V13 the sound of a video clip (Audio tab)', () => {
  async function clipSelected() {
    const t = await withMusic();
    t.app.removeSelected(); // the music
    t.app.select(t.project().timeline.main[0]!.id);
    ui.inspectorTab = 'audio';
    render(Inspector, { props: { app: t.app } });
    return t;
  }

  it('sets the clip volume', async () => {
    const { project } = await clipSelected();
    await type('Volume', '50');
    const clip = project().timeline.main[0]!;
    expect(clip.type === 'video' && clip.volume).toBe(0.5);
  });

  it('separates the sound onto an audio track and selects it', async () => {
    const { app, project } = await clipSelected();
    await fireEvent.click(screen.getByRole('button', { name: /separate sound/i }));
    const clip = project().timeline.main[0]!;
    expect(clip.type === 'video' && clip.muted).toBe(true);
    const [sound] = project().timeline.audio[1];
    expect(sound).toMatchObject({ start: 0, in: 0, out: 10 });
    expect(app.store.get().selection).toBe(sound!.id);
  });
});

describe('V13 Add music (toolbar)', () => {
  it('"Add music" adds a chosen sound at the playhead', async () => {
    const t = testApp({ '/m/music.mp3': MUSIC });
    render(App, { props: { app: t.app } });
    t.dialogs.openMedia.mockResolvedValueOnce(['/m/music.mp3']);
    await fireEvent.click(screen.getByRole('button', { name: /add music/i }));
    await vi.waitFor(() =>
      expect(t.app.store.get().history.present.timeline.audio[0]).toHaveLength(1),
    );
  });
});
