// Every dialog closes with Escape (not while it is saving or exporting), as the shared Dialog does.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

describe('Escape closes a dialog', () => {
  it('project settings (Video) and stage settings (Animation)', async () => {
    const t = testApp();
    render(App, { props: { app: t.app } });
    await fireEvent.click(screen.getByRole('button', { name: /^Project settings/ }));
    expect(screen.getByRole('dialog', { name: 'Project settings' })).toBeTruthy();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Project settings' })).toBeNull();
    ui.mode = 'Animation';
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: /^Stage settings/ }));
    expect(screen.getByRole('dialog', { name: 'Stage settings' })).toBeTruthy();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Stage settings' })).toBeNull();
    ui.mode = 'Video';
  });
});
