import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import StatusBar from '../../../src/ui/StatusBar.svelte';
import { testApp } from '../../helpers/test-app.ts';

describe('status bar', () => {
  it('shows a message that can be dismissed', async () => {
    const { app } = testApp();
    render(StatusBar, { props: { app } });
    await app.exportVideo(); // empty timeline → message
    expect(screen.getByRole('alert').textContent).toMatch(/add a clip/i);
    await fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows export progress with a Cancel button', async () => {
    const { app } = testApp();
    render(StatusBar, { props: { app } });
    const cancel = vi.spyOn(app, 'cancelExport');
    app.store.update((s) => ({
      ...s,
      exporting: { state: 'running', progress: 0.5, output: '/out/x.mp4' },
    }));
    expect(await screen.findByText(/exporting… 50 %/i)).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalled();
  });

  it('says where the exported video was saved', async () => {
    const { app } = testApp();
    render(StatusBar, { props: { app } });
    app.store.update((s) => ({ ...s, exporting: { state: 'done', output: '/out/x.mp4' } }));
    expect(await screen.findByText(/saved to \/out\/x\.mp4/i)).toBeTruthy();
  });
});
