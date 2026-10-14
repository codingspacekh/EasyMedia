import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';

describe('App shell', () => {
  it('shows the app name', () => {
    render(App);
    expect(screen.getByRole('heading', { name: 'Mini Video Editor' })).toBeTruthy();
  });

  it('starts in Video mode with three modes to choose from', () => {
    render(App);
    const modes = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(modes).toEqual(['Video', 'Audio', 'Learn']);
    expect(screen.getByRole('button', { name: 'Video' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('switches mode when another mode is clicked', async () => {
    render(App);
    await fireEvent.click(screen.getByRole('button', { name: 'Audio' }));
    expect(screen.getByRole('button', { name: 'Audio' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Video' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
