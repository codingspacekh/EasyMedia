// X8 built-in sound effects and V13's two effects tracks, as the student sees them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import AudioInspector from '../../../src/ui/AudioInspector.svelte';
import Timeline from '../../../src/ui/Timeline.svelte';
import { SOUND_EFFECTS, SOUND_GROUPS } from '../../../src/core/audio/sound-effects.ts';
import { testApp } from '../../helpers/test-app.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';

afterEach(() => {
  ui.mode = 'Video';
  ui.soundEffects = false;
});

describe('V13 the sound effects tracks on the timeline', () => {
  it('shows Effects 1 and Effects 2 below the voiceover, with the effect on its track', async () => {
    const t = testApp();
    t.app.setPlayhead(2);
    await t.app.addSoundEffect('ding');
    render(Timeline, { props: { app: t.app } });
    for (const name of ['Music', 'Voiceover', 'Effects 1', 'Effects 2'])
      expect(screen.getByText(name)).toBeTruthy();
    const lane = screen.getByLabelText('Effects 1 track');
    const clip = within(lane).getByRole('button', { name: /^Ding / });
    expect(clip.style.left).toBe(`${2 * 40}px`);
    expect(within(screen.getByLabelText('Effects 2 track')).queryAllByRole('button')).toEqual([]);
  });

  it('the inspector moves a sound to any of the four tracks', async () => {
    const t = testApp();
    await t.app.addSoundEffect('pop');
    const item = t.app.store.get().history.present.timeline.audio[2]![0]!;
    render(AudioInspector, { props: { app: t.app, item, track: 2 } });
    const select = screen.getByLabelText('Track') as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Music (Audio 1)',
      'Voiceover (Audio 2)',
      'Effects 1 (Audio 3)',
      'Effects 2 (Audio 4)',
    ]);
    expect(screen.queryByLabelText(/lower under voiceover/i)).toBeNull();
    await fireEvent.change(select, { target: { value: '3' } });
    expect(t.app.store.get().history.present.timeline.audio[3]!.map((a) => a.id)).toEqual([
      item.id,
    ]);
  });
});

describe('X8 the Sound effects box', () => {
  it('opens from Video mode, lists every sound by group, plays one and adds one at the playhead', async () => {
    const t = testApp();
    const play = vi.spyOn(t.app.audio, 'hearSoundEffect');
    render(App, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Sound effects' }));
    const box = screen.getByRole('dialog', { name: 'Sound effects' });
    for (const group of SOUND_GROUPS) expect(within(box).getByText(group)).toBeTruthy();
    expect(within(box).getAllByRole('button', { name: /^Add / })).toHaveLength(
      SOUND_EFFECTS.length,
    );
    await fireEvent.click(within(box).getByRole('button', { name: 'Play Whoosh' }));
    expect(play).toHaveBeenCalledWith('whoosh');
    await fireEvent.click(within(box).getByRole('button', { name: 'Add Whoosh' }));
    await vi.waitFor(() =>
      expect(t.app.store.get().history.present.timeline.audio[2]).toHaveLength(1),
    );
    expect(screen.getByRole('dialog', { name: 'Sound effects' })).toBeTruthy(); // stays open
    await fireEvent.click(within(box).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Sound effects' })).toBeNull();
  });

  it('opens from Audio mode’s Tracks menu and adds the sound as a new track', async () => {
    const t = testApp();
    ui.mode = 'Audio';
    render(App, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: /^Tracks/ }));
    await fireEvent.click(screen.getByRole('menuitem', { name: /sound effect/i }));
    const box = screen.getByRole('dialog', { name: 'Sound effects' });
    await fireEvent.click(within(box).getByRole('button', { name: 'Add Drum roll' }));
    expect(t.app.audio.store.get().history.present.tracks.map((tr) => tr.name)).toEqual([
      'Drum roll',
    ]);
  });
});
