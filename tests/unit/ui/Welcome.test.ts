// X7 Welcome and Help ▸ Licences, shown over the app; Help ▸ About OneEditor.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { testApp } from '../../helpers/test-app.ts';
import { UPDATES_IDLE } from '../../helpers/fake-updates.ts';

describe('Welcome', () => {
  it('introduces the four modes and where work is saved; Start closes it', async () => {
    const { app } = testApp();
    render(App, { props: { app } });
    expect(screen.queryByRole('dialog', { name: 'Welcome to OneEditor' })).toBeNull();
    app.showWelcome();
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to OneEditor' });
    for (const mode of ['Video', 'Audio', 'Learn', 'Animation'])
      expect(within(welcome).getByRole('heading', { name: mode })).toBeTruthy();
    expect(welcome.textContent).toMatch(/Package Project/);
    expect(welcome.textContent).toMatch(/Help ▸ Welcome/);
    await fireEvent.click(within(welcome).getByRole('button', { name: 'Start' }));
    expect(app.store.get().welcome).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'Welcome to OneEditor' })).toBeNull();
  });

  it('Escape closes it too', async () => {
    const { app } = testApp();
    render(App, { props: { app } });
    app.showWelcome();
    await screen.findByRole('dialog', { name: 'Welcome to OneEditor' });
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

describe('Help ▸ About OneEditor', () => {
  it('shows the version, the copyright, the licence and the website; Licences and Close', async () => {
    const website = vi.fn(async () => {});
    const { app } = testApp(undefined, { website });
    render(App, { props: { app } });
    app.updates.store.update((v) => ({ ...v, state: { ...UPDATES_IDLE, current: '1.5.1' } }));
    app.showAbout();
    const about = await screen.findByRole('dialog', { name: 'About OneEditor' });
    expect(about.textContent).toContain('Version 1.5.1');
    expect(about.textContent).toContain('© 2026 CodingSpaceKH.');
    expect(about.textContent).toContain('Free software under the GNU GPL v3.');
    expect(about.textContent).toMatch(/To contribute, visit\s*codingspacekh\.dev/);
    await fireEvent.click(within(about).getByRole('link', { name: 'codingspacekh.dev' }));
    expect(website).toHaveBeenCalledTimes(1);
    const licences = vi.spyOn(app, 'showLicences');
    await fireEvent.click(within(about).getByRole('button', { name: 'Licences' }));
    expect(licences).toHaveBeenCalledTimes(1);
    expect(app.store.get().about).toBe(false);
    app.showAbout();
    await fireEvent.click(
      within(await screen.findByRole('dialog', { name: 'About OneEditor' })).getByRole('button', {
        name: 'Close',
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'About OneEditor' })).toBeNull();
  });
});
