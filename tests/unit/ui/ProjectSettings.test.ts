import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ProjectSettings from '../../../src/ui/ProjectSettings.svelte';
import { setClipTurn } from '../../../src/app/commands.ts';
import { IMAGE, VIDEO, testApp } from '../../helpers/test-app.ts';

function open() {
  const t = testApp();
  const onclose = vi.fn();
  render(ProjectSettings, { props: { app: t.app, onclose } });
  const settings = () => t.app.store.get().history.present.settings;
  return { ...t, onclose, settings };
}
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe('V1 project settings dialog (screen 11)', () => {
  it('shows the current settings', () => {
    open();
    expect(radio('16:9').checked).toBe(true);
    expect(radio('1920 × 1080').checked).toBe(true);
    expect(radio('30 fps').checked).toBe(true);
    expect(radio('Fit with black bars').checked).toBe(true);
  });

  it('choosing 4:3 offers 4:3 sizes; Apply changes the project and closes', async () => {
    const { settings, onclose } = open();
    await fireEvent.click(radio('4:3'));
    expect(screen.queryByRole('radio', { name: '1920 × 1080' })).toBeNull();
    await fireEvent.click(radio('960 × 720'));
    await fireEvent.click(radio('25 fps'));
    await fireEvent.click(radio('Crop to fill'));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(settings()).toMatchObject({
      aspect: '4:3',
      width: 960,
      height: 720,
      fps: 25,
      fit: 'crop',
    });
    expect(onclose).toHaveBeenCalled();
  });

  it('M/23, J/25, N/25: 16:9 offers 854 × 480, the size the papers ask for', async () => {
    const { settings } = open();
    await fireEvent.click(radio('854 × 480'));
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(settings()).toMatchObject({ aspect: '16:9', width: 854, height: 480 });
  });

  it('a custom size that cannot be used is explained, and the dialog stays open', async () => {
    const { settings, onclose } = open();
    await fireEvent.click(radio('Custom'));
    await fireEvent.input(screen.getByLabelText('Width'), { target: { value: '1081' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('alert').textContent).toMatch(/even number/i);
    expect(settings().width).toBe(1920);
    expect(onclose).not.toHaveBeenCalled();
  });

  it('a valid custom size is applied', async () => {
    const { settings } = open();
    await fireEvent.click(radio('Custom'));
    await fireEvent.input(screen.getByLabelText('Width'), { target: { value: '1080' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(settings()).toMatchObject({ aspect: 'custom', width: 1080, height: 1080 });
  });

  it('Cancel closes without changing anything', async () => {
    const { settings, onclose } = open();
    await fireEvent.click(radio('4:3'));
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(settings().aspect).toBe('16:9');
    expect(onclose).toHaveBeenCalled();
  });

  it('explains why the aspect ratio matters', () => {
    open();
    expect(screen.getByText(/ratio of the width of each frame to its height/i)).toBeTruthy();
  });
});

describe('V1 "Match a clip": the project takes its size and shape from a video clip', () => {
  const phone = { ...VIDEO, video: { ...VIDEO.video!, width: 1080, height: 1920 } };
  const old = { ...VIDEO, video: { ...VIDEO.video!, width: 640, height: 480 } };
  async function withClips() {
    const t = testApp({ '/m/phone.mp4': phone, '/m/old.mp4': old, '/m/photo.jpg': IMAGE });
    await t.importFiles('/m/phone.mp4', '/m/old.mp4', '/m/photo.jpg');
    const onclose = vi.fn();
    const settings = () => t.app.store.get().history.present.settings;
    return { ...t, onclose, settings };
  }
  const choose = () => screen.getByRole('button', { name: 'Use this clip’s size' });

  it('V1: lists the video files with their sizes; the first clip on the timeline is chosen', async () => {
    const t = await withClips();
    const old = t.app.store.get().history.present.media[1]!;
    t.app.addToTimeline(old.id);
    render(ProjectSettings, { props: { app: t.app, onclose: t.onclose } });
    const list = screen.getByLabelText('Clip') as HTMLSelectElement;
    expect([...list.options].map((o) => o.textContent?.trim())).toEqual([
      'phone.mp4 · 1080 × 1920',
      'old.mp4 · 640 × 480',
    ]);
    expect(list.selectedOptions[0]!.textContent?.trim()).toBe('old.mp4 · 640 × 480');
  });

  it('V1: a phone clip makes the project 1080 × 1920 (Custom) only when Apply is pressed', async () => {
    const t = await withClips();
    render(ProjectSettings, { props: { app: t.app, onclose: t.onclose } });
    await fireEvent.click(choose());
    expect(radio('Custom').checked).toBe(true);
    expect([field('Width').value, field('Height').value]).toEqual(['1080', '1920']);
    expect(t.settings().width).toBe(1920); // nothing changes on its own
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(t.settings()).toMatchObject({ aspect: 'custom', width: 1080, height: 1920 });
  });

  it('V1: a 4:3 clip chooses 4:3 and its size', async () => {
    const t = await withClips();
    render(ProjectSettings, { props: { app: t.app, onclose: t.onclose } });
    await fireEvent.change(screen.getByLabelText('Clip'), {
      target: { value: t.app.store.get().history.present.media[1]!.id },
    });
    await fireEvent.click(choose());
    expect(radio('4:3').checked).toBe(true);
    expect(radio('640 × 480').checked).toBe(true);
  });

  it('V1: a 16:9 clip of a size not in the list shows its own size, chosen', async () => {
    const laptop = { ...VIDEO, video: { ...VIDEO.video!, width: 1366, height: 768 } };
    const t = testApp({ '/m/laptop.mp4': laptop });
    await t.importFiles('/m/laptop.mp4');
    render(ProjectSettings, { props: { app: t.app, onclose: vi.fn() } });
    await fireEvent.click(choose());
    expect(radio('16:9').checked).toBe(true);
    expect(radio('1366 × 768').checked).toBe(true);
    await fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(t.app.store.get().history.present.settings).toMatchObject({ width: 1366, height: 768 });
  });

  it('V1, V19: a clip turned a quarter on the timeline gives its turned size', async () => {
    const t = await withClips();
    const phone = t.app.store.get().history.present.media[0]!;
    t.app.addToTimeline(phone.id);
    const clip = t.app.store.get().history.present.timeline.main[0]!;
    t.app.edit(setClipTurn(clip.id, { turn: 90 }));
    render(ProjectSettings, { props: { app: t.app, onclose: t.onclose } });
    expect(screen.getByRole('option', { name: 'phone.mp4 · 1920 × 1080' })).toBeTruthy();
    await fireEvent.click(choose());
    expect(radio('16:9').checked).toBe(true);
    expect(radio('1920 × 1080').checked).toBe(true);
  });

  it('V1: with no video imported, there is nothing to match', () => {
    open();
    expect(screen.queryByRole('button', { name: 'Use this clip’s size' })).toBeNull();
  });
});
