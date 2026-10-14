import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ProjectSettings from '../../../src/ui/ProjectSettings.svelte';
import { testApp } from '../../helpers/test-app.ts';

function open() {
  const t = testApp();
  const onclose = vi.fn();
  render(ProjectSettings, { props: { app: t.app, onclose } });
  const settings = () => t.app.store.get().history.present.settings;
  return { ...t, onclose, settings };
}
const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;

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
