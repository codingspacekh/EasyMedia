// X7 Welcome and Help ▸ Licences, shown over the app.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { testApp } from '../../helpers/test-app.ts';

describe('Welcome', () => {
  it('introduces the four modes and where work is saved; Start closes it', async () => {
    const { app } = testApp();
    render(App, { props: { app } });
    expect(screen.queryByRole('dialog', { name: 'Welcome to EasyMedia' })).toBeNull();
    app.showWelcome();
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to EasyMedia' });
    for (const mode of ['Video', 'Audio', 'Learn', 'Animation'])
      expect(within(welcome).getByRole('heading', { name: mode })).toBeTruthy();
    expect(welcome.textContent).toMatch(/Package Project/);
    expect(welcome.textContent).toMatch(/Help ▸ Welcome/);
    await fireEvent.click(within(welcome).getByRole('button', { name: 'Start' }));
    expect(app.store.get().welcome).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'Welcome to EasyMedia' })).toBeNull();
  });

  it('Escape closes it too', async () => {
    const { app } = testApp();
    render(App, { props: { app } });
    app.showWelcome();
    await screen.findByRole('dialog', { name: 'Welcome to EasyMedia' });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(app.store.get().welcome).toBe(false);
  });
});

describe('Help ▸ Licences', () => {
  it('shows the licences text in a dialog with a Close button', async () => {
    const { app } = testApp();
    render(App, { props: { app } });
    app.store.update((s) => ({ ...s, licences: 'FFmpeg 9.0.2 — GPL v3' }));
    const dialog = await screen.findByRole('dialog', { name: 'Licences' });
    expect(dialog.textContent).toContain('FFmpeg 9.0.2 — GPL v3');
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(app.store.get().licences).toBeNull();
  });
});
