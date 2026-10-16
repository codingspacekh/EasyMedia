// Export video (screen 12, V16, V17, T7): where it will be played, the format and compression,
// the estimated size and the pros and cons of the format, before exporting.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import ExportDialog from '../../../src/ui/ExportDialog.svelte';
import { testApp } from '../../helpers/test-app.ts';

async function withClip() {
  const t = testApp();
  await t.importFiles('/m/clip.mp4');
  t.app.addToTimeline(t.app.store.get().history.present.media[0]!.id); // 10 s, 1080p, with sound
  const onclose = vi.fn();
  render(ExportDialog, { props: { app: t.app, onclose } });
  return { ...t, onclose };
}
const pressed = (name: string | RegExp) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed');
const sizeText = () => screen.getByLabelText('Estimated file size').textContent ?? '';

describe('export dialog', () => {
  it('opens from the toolbar Export button; with an empty timeline it explains instead', async () => {
    const t = testApp();
    render(App, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.queryByRole('dialog', { name: 'Export video' })).toBeNull();
    await vi.waitFor(() => expect(t.app.store.get().message?.text).toMatch(/add a clip/i));
    await t.importFiles('/m/clip.mp4');
    t.app.addToTimeline(t.app.store.get().history.present.media[0]!.id);
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByRole('dialog', { name: 'Export video' })).toBeTruthy();
  });

  it('starts as an MP4 of the project for the internet, with its estimated size and pros and cons', async () => {
    await withClip();
    expect(pressed(/internet \/ youtube/i)).toBe('true');
    expect(pressed('MP4')).toBe('true');
    expect((screen.getByLabelText('Lossy') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Resolution') as HTMLSelectElement).value).toBe('1920x1080');
    expect(sizeText()).toMatch(/≈ 8\.1 MB/); // (6221 + 192) kbit/s × 10 s
    expect(screen.getByText(/plays on almost all devices/i)).toBeTruthy();
    expect(screen.getByText(/lost for ever/i)).toBeTruthy();
  });

  it('Book B Task 11f: the mobile (medium) preset is 960 × 540 for a 16:9 project, and smaller', async () => {
    await withClip();
    const before = sizeText();
    await fireEvent.click(screen.getByRole('button', { name: /mobile phone \(medium\)/i }));
    expect((screen.getByLabelText('Resolution') as HTMLSelectElement).value).toBe('960x540');
    expect(sizeText()).not.toBe(before);
  });

  it('DVD: MPG, 720 × 576 at 25 fps; MPG has no lossless option', async () => {
    await withClip();
    await fireEvent.click(screen.getByRole('button', { name: /dvd player \(pal\)/i }));
    expect(pressed('MPG')).toBe('true');
    expect((screen.getByLabelText('Resolution') as HTMLSelectElement).value).toBe('720x576');
    expect((screen.getByLabelText('Frame rate') as HTMLSelectElement).value).toBe('25');
    expect((screen.getByLabelText('Lossless') as HTMLInputElement).disabled).toBe(true);
  });

  it('Book A 11.15: lossless AVI shows the codec, an "up to" size and that the file is very large', async () => {
    await withClip();
    await fireEvent.click(screen.getByRole('button', { name: 'AVI' }));
    await fireEvent.click(screen.getByLabelText('Lossless'));
    expect(screen.getByText(/FFV1 video · PCM sound/)).toBeTruthy();
    expect(sizeText()).toMatch(/up to/i);
    expect(screen.getByText(/very large file/i)).toBeTruthy();
    // Changing a setting by hand makes it a custom export.
    expect(pressed(/^custom/i)).toBe('true');
    // Going to a container without lossless goes back to lossy.
    await fireEvent.click(screen.getByRole('button', { name: 'WMV' }));
    expect((screen.getByLabelText('Lossy') as HTMLInputElement).checked).toBe(true);
  });

  it('compares this export with other choices', async () => {
    await withClip();
    const compare = screen.getByRole('list', { name: 'Compare sizes' });
    expect(within(compare).getByText('This export')).toBeTruthy();
    expect(within(compare).getByText(/lossless avi/i)).toBeTruthy();
  });

  it('exports in the chosen format, saving the project too if ticked', async () => {
    const { app, dialogs, onclose } = await withClip();
    const exportVideo = vi.spyOn(app, 'exportVideo').mockResolvedValue();
    await fireEvent.click(screen.getByRole('button', { name: 'MOV' }));
    await fireEvent.change(screen.getByLabelText('Resolution'), { target: { value: '1280x720' } });
    await fireEvent.click(screen.getByRole('button', { name: /smaller/i }));
    const saveToo = screen.getByLabelText(/also save the project/i) as HTMLInputElement;
    expect(saveToo.checked).toBe(true);
    await fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Export' }),
    );
    expect(exportVideo).toHaveBeenCalledWith({
      format: expect.objectContaining({
        container: 'mov',
        width: 1280,
        height: 720,
        quality: 'medium',
      }),
      alsoSaveProject: true,
    });
    expect(onclose).toHaveBeenCalled();
    expect(dialogs.exportVideo).not.toHaveBeenCalled(); // the app asks, not the dialog
  });

  it('Cancel closes without exporting', async () => {
    const { app, onclose } = await withClip();
    const exportVideo = vi.spyOn(app, 'exportVideo');
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onclose).toHaveBeenCalled();
    expect(exportVideo).not.toHaveBeenCalled();
  });
});
