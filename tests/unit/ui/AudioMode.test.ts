// Audio mode (screens 13, 14): toolbar, tracks with waveforms, selection bar, Tracks and Effect
// menus, the generated effect dialogs, the side panel with the History, and the shortcuts.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import type { ProbeInfo } from '../../../src/core/ports.ts';
import { audioUi } from '../../../src/ui/audio/audio-ui.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

const SOUND: ProbeInfo = {
  kind: 'audio',
  container: 'mp3',
  duration: 4,
  sizeBytes: 64_000,
  audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
};
const VOICE: ProbeInfo = {
  kind: 'audio',
  container: 'wav',
  duration: 2,
  sizeBytes: 176_444,
  audio: { codec: 'pcm_s16le', sampleRate: 44100, channels: 1, bitDepth: 16 },
};

async function audioMode(...files: string[]) {
  const t = testApp({ '/m/Task_11j_audio_1.mp3': SOUND, '/m/Voiceover_3.wav': VOICE });
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', { name: 'Audio' }),
  );
  if (files.length) {
    t.dialogs.openMedia.mockResolvedValueOnce(files);
    await fireEvent.click(screen.getByRole('button', { name: 'Import audio' }));
    await vi.waitFor(() =>
      expect(t.app.audio.store.get().history.present.tracks).toHaveLength(files.length),
    );
  }
  const audio = t.app.audio;
  return {
    ...t,
    audio,
    state: () => audio.store.get(),
    doc: () => audio.store.get().history.present,
  };
}
const typeTime = async (label: string, value: string) => {
  const box = screen.getByLabelText(label, { exact: true });
  await fireEvent.change(box, { target: { value } });
};
const menuItem = async (menu: 'Tracks' | 'Effect', item: string | RegExp) => {
  await fireEvent.click(screen.getByRole('button', { name: menu }));
  await fireEvent.click(screen.getByRole('menuitem', { name: item }));
};

describe('Audio mode layout', () => {
  it('shows the audio toolbar and asks for a sound first', async () => {
    await audioMode();
    for (const name of [
      'Play',
      'Stop',
      'Selection tool',
      'Time shift tool',
      'Cut',
      'Copy',
      'Paste',
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByText(/import a sound/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add title' })).toBeNull();
  });

  it('A1 an imported file becomes a track with its name, channels, rate and waveform lane', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    const header = screen.getByRole('group', { name: 'Track Task_11j_audio_1' });
    expect(within(header).getByText('Stereo · 44 100 Hz')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Waveform of Task_11j_audio_1' })).toBeTruthy();
  });

  it('the side panel explains the uncompressed size and lists the History', async () => {
    await audioMode('/m/Voiceover_3.wav');
    const panel = screen.getByRole('complementary', { name: 'Selected track' });
    expect(within(panel).getByText('1 (mono)')).toBeTruthy();
    expect(within(panel).getByText('0.18 MB')).toBeTruthy(); // 44 100 × 16 × 1 × 2 ÷ 8
    expect(within(panel).getByText(/44 100 × 16 × 1 × 2\.00 ÷ 8/)).toBeTruthy();
    expect(within(panel).getByText('Import Voiceover_3.wav')).toBeTruthy();
  });

  it('zoom buttons change the scale shown in the ruler corner', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    const corner = () => screen.getByText(/px = 1 s/).textContent;
    const before = corner();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(corner()).not.toBe(before);
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(corner()).toBe(before);
  });
});

describe('A5 selection bar', () => {
  it('typed Selection start and end set the selection; length and samples follow', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Selection start', '1');
    await typeTime('Selection end', '2.5');
    expect(t.state().selection).toMatchObject({ start: 1, end: 2.5 });
    expect((screen.getByLabelText('Length') as HTMLInputElement).value).toBe('00:01.50');
    expect(
      screen.getByRole('group', { name: 'Selection' }).textContent!.replace(/\s+/g, ' '),
    ).toMatch(/1\.50 s × 44 100 = 66 150 samples per channel/);
  });

  it('an impossible end is explained', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Selection start', '2');
    await typeTime('Selection end', '1');
    expect(screen.getByRole('alert').textContent).toMatch(/after the selection start/i);
  });

  it('Audio position moves the playhead (Book B: 19.100 seconds)', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Audio position', '19.100');
    expect(t.state().position).toBe(19.1);
  });
});

describe('A5 editing from the toolbar, A18 undo and History', () => {
  it('Cut removes the selection; Undo puts it back', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Selection start', '1');
    await typeTime('Selection end', '3');
    await fireEvent.click(screen.getByRole('button', { name: 'Cut' }));
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(2 * 44100);
    expect(screen.getByText('Cut 1.00 – 3.00 s')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(4 * 44100);
  });

  it('a refused edit is explained in the status bar', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.click(screen.getByRole('button', { name: 'Trim to selection' }));
    expect(screen.getByRole('alert').textContent).toMatch(/select some sound/i);
  });

  it('Insert silence asks for the length', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Selection start', '1');
    await fireEvent.click(screen.getByRole('button', { name: 'Insert silence' }));
    const dialog = screen.getByRole('dialog', { name: 'Insert silence' });
    await fireEvent.change(within(dialog).getByLabelText('Length'), { target: { value: '0.5' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(4.5 * 44100);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('A2, A6, A15 Tracks menu', () => {
  it('adds, moves and removes tracks', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await menuItem('Tracks', 'Add new mono track');
    expect(t.doc().tracks.map((x) => x.name)).toEqual(['Task_11j_audio_1', 'Audio track 2']);
    await menuItem('Tracks', 'Move track up');
    expect(t.doc().tracks[0]!.name).toBe('Audio track 2');
    await menuItem('Tracks', 'Remove track');
    expect(t.doc().tracks.map((x) => x.name)).toEqual(['Task_11j_audio_1']);
  });

  it('Book B 11.2.5: select all, align end to end, mix and render', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3', '/m/Voiceover_3.wav');
    t.audio.selectAll();
    await menuItem('Tracks', 'Align end to end');
    expect(t.doc().tracks[1]!.offset).toBe(4);
    await menuItem('Tracks', 'Mix and render');
    expect(t.doc().tracks).toHaveLength(1);
  });

  it('A15 Mix stereo down to mono; the menu says how many tracks are selected', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.click(screen.getByRole('button', { name: 'Tracks' }));
    expect(screen.getByRole('menu').textContent).toMatch(/1 track selected/i);
    await fireEvent.click(screen.getByRole('menuitem', { name: /mix stereo down to mono/i }));
    expect(t.doc().tracks[0]!.channels).toHaveLength(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Escape closes a menu', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.click(screen.getByRole('button', { name: 'Tracks' }));
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Effect menu and the generated effect dialogs (P7)', () => {
  it('A7 Fade in / Fade out apply at once to the selection', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await typeTime('Selection end', '3');
    await menuItem('Effect', 'Fade in');
    expect(t.doc().tracks[0]!.channels[0]![0]).toBe(0);
    expect(screen.getByText('Fade in 0.00 – 3.00 s')).toBeTruthy();
  });

  it('A3 Normalise: checkboxes and the peak level, with the syllabus point and why', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.selectAll();
    await menuItem('Effect', 'Normalise…');
    const dialog = screen.getByRole('dialog', { name: 'Normalise' });
    expect((within(dialog).getByLabelText('Remove DC offset') as HTMLInputElement).checked).toBe(
      true,
    );
    expect((within(dialog).getByLabelText('Maximum peak') as HTMLInputElement).value).toBe('-1');
    expect(within(dialog).getByText('11.2 normalising, removing DC offset')).toBeTruthy();
    expect(within(dialog).getByText(/applies to 0\.00 – 4\.00 s/i)).toBeTruthy();
    await fireEvent.click(within(dialog).getByRole('button', { name: /why/i }));
    expect(within(dialog).getByText(/faulty recording device/i)).toBeTruthy();
    await fireEvent.change(within(dialog).getByLabelText('Maximum peak'), {
      target: { value: '2' },
    });
    expect(within(dialog).getByText(/clipped/i)).toBeTruthy();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(t.state().history.past.at(-1)!.label).toBe('Normalise 0.00 – 4.00 s');
  });

  it('A4 Amplify suggests the gain; too much is refused unless clipping is allowed', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.selectAll();
    await menuItem('Effect', 'Amplify…');
    const dialog = screen.getByRole('dialog', { name: 'Amplify' });
    const gain = within(dialog).getByLabelText('Amplification') as HTMLInputElement;
    expect(Number(gain.value)).toBeCloseTo(6.02, 1);
    expect(within(dialog).getByText(/new peak amplitude/i)).toBeTruthy();
    await fireEvent.change(gain, { target: { value: '12' } });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/clip/i);
    await fireEvent.click(within(dialog).getByLabelText('Allow clipping'));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(t.state().history.past).toHaveLength(2);
  });

  it('A8 Change speed: multiplier and percent stay in step, with the new length', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.selectAll();
    await menuItem('Effect', 'Change speed…');
    const dialog = screen.getByRole('dialog', { name: 'Change speed' });
    await fireEvent.change(within(dialog).getByLabelText('Speed multiplier'), {
      target: { value: '2' },
    });
    expect((within(dialog).getByLabelText('Percent change') as HTMLInputElement).value).toBe('100');
    expect(within(dialog).getByText('Length: 4.00 s → 2.00 s')).toBeTruthy();
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(2 * 44100);
  });

  it('A13 Noise reduction: step 1 takes the profile and closes; step 2 shows it and reduces', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.select({ start: 1, end: 2 });
    await menuItem('Effect', 'Noise reduction…');
    let dialog = screen.getByRole('dialog', { name: 'Noise reduction' });
    const step1 = within(dialog).getByRole('region', { name: 'Step 1 · Get a noise profile' });
    expect(within(step1).getByText(/no profile yet/i)).toBeTruthy();
    await fireEvent.click(within(step1).getByRole('button', { name: 'Get noise profile' }));
    expect(screen.queryByRole('dialog')).toBeNull(); // as Audacity: now select the sound to clean
    expect(t.state().noiseProfile).toMatchObject({ start: 1, end: 2 });

    t.audio.selectAll();
    await menuItem('Effect', 'Noise reduction…');
    dialog = screen.getByRole('dialog', { name: 'Noise reduction' });
    expect(within(dialog).getByText('Profile taken from 1.00 – 2.00 s')).toBeTruthy();
    expect(within(dialog).getByRole('region', { name: /Step 2/ })).toBeTruthy();
    expect((within(dialog).getByLabelText('Noise reduction') as HTMLInputElement).value).toBe('12');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(t.state().history.past.at(-1)!.label).toBe('Noise reduction 0.00 – 4.00 s');
  });

  it('A13 a failed step 1 keeps the dialog open and says why', async () => {
    await audioMode('/m/Task_11j_audio_1.mp3');
    await menuItem('Effect', 'Noise reduction…');
    const dialog = screen.getByRole('dialog', { name: 'Noise reduction' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Get noise profile' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/select a part/i);
  });

  it('A18 every effect dialog has Preview; Cancel changes nothing', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.selectAll();
    const preview = vi.spyOn(t.audio, 'previewEffect');
    await menuItem('Effect', 'Amplify…');
    const dialog = screen.getByRole('dialog', { name: 'Amplify' });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Preview' }));
    expect(preview).toHaveBeenCalledWith(
      'audio.amplify',
      expect.objectContaining({ allowClipping: 0 }),
    );
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(t.state().history.past).toHaveLength(1);
  });
});

describe('tracks: mute, solo, gain, pan; selecting and time-shifting with the mouse', () => {
  it('Mute and Solo are toggle buttons on each track', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    const mute = screen.getByRole('button', { name: 'Mute Task_11j_audio_1' });
    await fireEvent.click(mute);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Solo Task_11j_audio_1' }));
    expect(t.state().solo).toHaveLength(1);
  });

  it('gain and pan sliders change the track (undoable)', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.change(screen.getByLabelText('Gain of Task_11j_audio_1'), {
      target: { value: '-6' },
    });
    await fireEvent.change(screen.getByLabelText('Pan of Task_11j_audio_1'), {
      target: { value: '0.5' },
    });
    expect(t.doc().tracks[0]).toMatchObject({ gain: -6, pan: 0.5 });
  });

  it('dragging across a waveform selects that time on that track', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3', '/m/Voiceover_3.wav');
    audioUi.pxPerSecond = 24;
    const lane = screen.getByRole('region', { name: 'Waveform of Task_11j_audio_1' });
    await fireEvent.pointerDown(lane, { clientX: 24, pointerId: 1 });
    await fireEvent.pointerMove(lane, { clientX: 60, pointerId: 1 });
    await fireEvent.pointerUp(lane, { clientX: 60, pointerId: 1 });
    expect(t.state().selection).toEqual({ start: 1, end: 2.5, tracks: [t.doc().tracks[0]!.id] });
  });

  it('a click puts the cursor (and the Audio position) there', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    audioUi.pxPerSecond = 24;
    const lane = screen.getByRole('region', { name: 'Waveform of Task_11j_audio_1' });
    await fireEvent.pointerDown(lane, { clientX: 48, pointerId: 1 });
    await fireEvent.pointerUp(lane, { clientX: 48, pointerId: 1 });
    expect(t.state()).toMatchObject({ selection: { start: 2, end: 2 }, position: 2 });
  });

  it('A2 with the time shift tool, dragging moves the track (one undo step)', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    audioUi.pxPerSecond = 24;
    await fireEvent.click(screen.getByRole('button', { name: 'Time shift tool' }));
    const lane = screen.getByRole('region', { name: 'Waveform of Task_11j_audio_1' });
    await fireEvent.pointerDown(lane, { clientX: 24, pointerId: 1 });
    await fireEvent.pointerMove(lane, { clientX: 48, pointerId: 1 });
    await fireEvent.pointerMove(lane, { clientX: 72, pointerId: 1 });
    await fireEvent.pointerUp(lane, { clientX: 72, pointerId: 1 });
    expect(t.doc().tracks[0]!.offset).toBe(2);
    expect(t.state().history.past.at(-1)!.label).toBe('Time shift');
    expect(t.state().history.past).toHaveLength(2);
  });

  it('clicking the ruler sets the Audio position', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    audioUi.pxPerSecond = 24;
    await fireEvent.pointerDown(
      screen.getByRole('slider', { name: 'Audio position on the ruler' }),
      {
        clientX: 72,
        pointerId: 1,
      },
    );
    expect(t.state().position).toBe(3);
  });
});

describe('A18 transport and keyboard shortcuts (N10)', () => {
  it('Play becomes Pause while playing; Stop ends it; Loop is a toggle', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(t.state().playing).toBe(true);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(t.state().playing).toBe(false);
    const loop = screen.getByRole('button', { name: 'Loop the selection' });
    await fireEvent.click(loop);
    expect(loop.getAttribute('aria-pressed')).toBe('true');
  });

  it('Space plays and stops; Delete deletes the selection', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    await fireEvent.keyDown(window, { key: ' ' });
    expect(t.state().playing).toBe(true);
    await fireEvent.keyDown(window, { key: ' ' });
    expect(t.state().playing).toBe(false);
    t.audio.select({ start: 0, end: 1 });
    await fireEvent.keyDown(window, { key: 'Delete' });
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(3 * 44100);
  });

  it('the Edit menu’s cut / copy / paste reach the sound (clipboard events)', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    t.audio.select({ start: 0, end: 1 });
    await fireEvent.copy(document.body);
    expect(t.state().clipboard).not.toBeNull();
    t.audio.select({ start: 2, end: 2 });
    await fireEvent.paste(document.body);
    expect(t.doc().tracks[0]!.channels[0]!.length).toBe(5 * 44100);
  });

  it('shortcuts are left alone while typing in a box', async () => {
    const t = await audioMode('/m/Task_11j_audio_1.mp3');
    const box = screen.getByLabelText('Selection start');
    box.focus();
    await fireEvent.keyDown(box, { key: ' ' });
    expect(t.state().playing).toBe(false);
  });
});
