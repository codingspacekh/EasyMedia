// Export audio (screen 20; A15–A17, T7).
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import AudioExportDialog from '../../../src/ui/audio/AudioExportDialog.svelte';
import App from '../../../src/ui/App.svelte';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

async function withSound() {
  const t = testApp({
    '/m/Task_11j.mp3': {
      kind: 'audio',
      container: 'mp3',
      duration: 45,
      sizeBytes: 1,
      audio: { codec: 'mp3', sampleRate: 44100, channels: 2 },
    },
  });
  t.dialogs.openMedia.mockResolvedValueOnce(['/m/Task_11j.mp3']);
  await t.app.audio.importAudio();
  const onclose = vi.fn();
  render(AudioExportDialog, { props: { app: t.app, onclose } });
  return { ...t, onclose, dialog: screen.getByRole('dialog', { name: 'Export audio' }) };
}
const pressed = (group: string, name: string | RegExp) =>
  within(screen.getByRole('group', { name: group }))
    .getByRole('button', { name })
    .getAttribute('aria-pressed');
const size = () => screen.getByLabelText('Estimated file size').textContent;

describe('audio export dialog', () => {
  it('starts as MP3, 128 kbps, 44 100 Hz stereo: ≈ 0.72 MB for 45 s, 11× smaller than WAV', async () => {
    const { dialog } = await withSound();
    expect(pressed('Format', 'MP3')).toBe('true');
    expect(pressed('Bit rate', '128 kbps')).toBe('true');
    expect(pressed('Sample rate', /44 100 Hz/)).toBe('true');
    expect(pressed('Channels', 'Stereo')).toBe('true');
    expect(size()).toBe('≈ 0.72 MB');
    expect(dialog.textContent).toMatch(/7\.94 MB/);
    expect(dialog.textContent).toMatch(/about 11× smaller/);
    expect(within(dialog).getByText('Lossy')).toBeTruthy();
    expect(within(dialog).getByText(/plays on almost every device/i)).toBeTruthy();
  });

  it('A16 MP3 cannot be 96 kHz; WAV can, and has 16 / 24 / 32-bit instead of a bit rate', async () => {
    await withSound();
    const card = (name: RegExp) =>
      within(screen.getByRole('group', { name: 'Sample rate' })).getByRole('button', { name });
    expect((card(/96 000 Hz/) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: '24-bit' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await fireEvent.click(screen.getByRole('button', { name: 'WAV' }));
    expect((card(/96 000 Hz/) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole('group', { name: 'Bit rate' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: '24-bit' }));
    await fireEvent.click(card(/48 000 Hz/));
    expect(size()).toBe('≈ 12.96 MB'); // 48 000 × 24 × 2 × 45 ÷ 8
    expect(screen.getByText('Lossless')).toBeTruthy();
  });

  it('a rate the new format cannot have is lowered; FLAC shows "up to"', async () => {
    await withSound();
    await fireEvent.click(screen.getByRole('button', { name: 'WAV' }));
    await fireEvent.click(
      within(screen.getByRole('group', { name: 'Sample rate' })).getByRole('button', {
        name: /96 000 Hz/,
      }),
    );
    await fireEvent.click(screen.getByRole('button', { name: 'MP3' }));
    expect(pressed('Sample rate', /48 000 Hz/)).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'FLAC' }));
    expect(size()).toMatch(/^up to /);
  });

  it('A15 Mono halves the size; variable bit rate is for MP3 only', async () => {
    await withSound();
    await fireEvent.click(screen.getByRole('button', { name: 'Mono' }));
    expect(screen.getByText(/3\.97 MB/)).toBeTruthy(); // the WAV comparison, mono
    await fireEvent.click(screen.getByLabelText(/variable/i));
    expect(size()).toMatch(/about/);
    await fireEvent.click(screen.getByRole('button', { name: 'M4A (MP4a)' }));
    expect((screen.getByLabelText(/variable/i) as HTMLInputElement).disabled).toBe(true);
  });

  it('A17 tags; an AAC stream cannot hold them', async () => {
    await withSound();
    await fireEvent.input(screen.getByLabelText('Title'), { target: { value: 'Task 11j' } });
    await fireEvent.click(screen.getByRole('button', { name: 'AAC' }));
    expect(screen.getByText(/AAC files cannot hold tags/)).toBeTruthy();
    expect((screen.getByLabelText('Artist') as HTMLInputElement).disabled).toBe(true);
  });

  it('Export asks where to save and exports with the chosen settings', async () => {
    const { app, dialogs, onclose } = await withSound();
    dialogs.exportAudio.mockResolvedValueOnce('/out/Task_11j.mp3');
    const exportAudio = vi.spyOn(app.audio, 'exportAudio');
    await fireEvent.click(screen.getByRole('button', { name: 'Mono' }));
    await fireEvent.input(screen.getByLabelText('Artist'), { target: { value: 'Both artists' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(exportAudio).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'mp3', channels: 1, tags: { artist: 'Both artists' } }),
    );
    expect(onclose).toHaveBeenCalled();
    await vi.waitFor(() => expect(app.audio.store.get().exporting.state).toBe('done'));
  });

  it('opens from the Audio toolbar’s Export button', async () => {
    const t = testApp();
    render(App, { props: { app: t.app } });
    ui.mode = 'Audio';
    await vi.waitFor(() => screen.getByRole('toolbar', { name: 'Audio tools' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('dialog', { name: 'Export audio' })).toBeTruthy();
  });
});

describe('audio export dialog: settings follow each other', () => {
  it('an MP3 at 8 000 Hz can be at most 64 kbps, so 128 becomes 64', async () => {
    await withSound();
    await fireEvent.click(
      within(screen.getByRole('group', { name: 'Sample rate' })).getByRole('button', {
        name: /^8 000 Hz/,
      }),
    );
    expect(pressed('Bit rate', '64 kbps')).toBe('true');
    expect(screen.queryByRole('button', { name: '320 kbps' })).toBeNull();
  });

  it('a variable bit rate goes back to constant for M4A; 32-bit WAV becomes 16-bit FLAC', async () => {
    await withSound();
    await fireEvent.click(screen.getByLabelText(/variable/i));
    await fireEvent.click(screen.getByRole('button', { name: 'M4A (MP4a)' }));
    expect((screen.getByLabelText(/constant/i) as HTMLInputElement).checked).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'WAV' }));
    await fireEvent.click(screen.getByRole('button', { name: '32-bit' }));
    await fireEvent.click(screen.getByRole('button', { name: 'FLAC' }));
    expect(pressed('Resolution', '16-bit')).toBe('true');
  });

  it('Escape and Cancel close it without exporting', async () => {
    const { onclose, app } = await withSound();
    const exportAudio = vi.spyOn(app.audio, 'exportAudio');
    await fireEvent.keyDown(window, { key: 'Escape' });
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onclose).toHaveBeenCalledTimes(2);
    expect(exportAudio).not.toHaveBeenCalled();
  });
});
