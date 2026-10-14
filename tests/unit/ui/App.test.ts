import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { testApp } from '../../helpers/test-app.ts';

const mode = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', { name });

describe('App shell', () => {
  it('shows the app name', () => {
    render(App, { props: { app: testApp().app } });
    expect(screen.getByRole('heading', { name: 'EasyMedia' })).toBeTruthy();
  });

  it('starts in Video mode with three modes to choose from', () => {
    render(App, { props: { app: testApp().app } });
    const modes = within(screen.getByRole('navigation', { name: 'Mode' })).getAllByRole('button');
    expect(modes.map((b) => b.textContent?.trim())).toEqual(['Video', 'Audio', 'Learn']);
    expect(mode('Video').getAttribute('aria-pressed')).toBe('true');
  });

  it('switches mode when another mode is clicked', async () => {
    render(App, { props: { app: testApp().app } });
    await fireEvent.click(mode('Audio'));
    expect(mode('Audio').getAttribute('aria-pressed')).toBe('true');
    expect(mode('Video').getAttribute('aria-pressed')).toBe('false');
  });

  it('has the main actions; Undo and Redo are off until there is something to undo', async () => {
    const { app, importFiles } = testApp();
    render(App, { props: { app } });
    for (const name of ['Import', 'Save', 'Export'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
    await importFiles('/m/photo.jpg');
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('the window title shows the file name and unsaved work', async () => {
    const { app, importFiles } = testApp();
    render(App, { props: { app } });
    expect(document.title).toBe('Untitled — EasyMedia');
    await importFiles('/m/photo.jpg');
    expect(document.title).toBe('Untitled • — EasyMedia');
  });

  it('the settings button shows the project format and opens Project settings', async () => {
    render(App, { props: { app: testApp().app } });
    const button = screen.getByRole('button', { name: /16:9 · 1920 × 1080 · 30 fps/ });
    await fireEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Project settings' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
