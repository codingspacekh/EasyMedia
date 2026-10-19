// Every button says what it does when the mouse rests on it (or it gets keyboard focus): a
// quick tooltip, made from the button's title or, for an icon-only button, its label.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import Tooltip from '../../../src/ui/Tooltip.svelte';
import { TOOLTIP_DELAY } from '../../../src/ui/ui-state.svelte.ts';
import App from '../../../src/ui/App.svelte';
import { testApp } from '../../helpers/test-app.ts';

function button(html: string): HTMLElement {
  document.body.insertAdjacentHTML('beforeend', html);
  return document.body.lastElementChild as HTMLElement;
}

describe('tooltips on buttons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(Tooltip);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('shows the title after a short rest, instead of the slow built-in one', async () => {
    const play = button('<button title="Play (Space)"><svg></svg></button>');
    await fireEvent.pointerOver(play);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    expect(screen.getByRole('tooltip').textContent!.trim()).toBe('Play (Space)');
    expect(play.hasAttribute('title')).toBe(false); // so the built-in one does not show too
    await fireEvent.pointerOut(play);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(play.getAttribute('title')).toBe('Play (Space)');
  });

  it('an icon-only button without a title shows its label', async () => {
    const zoom = button('<button aria-label="Zoom in"><svg></svg></button>');
    await fireEvent.pointerOver(zoom);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    expect(screen.getByRole('tooltip').textContent!.trim()).toBe('Zoom in');
  });

  it('a button with its words on it and no title needs no tooltip', async () => {
    const save = button('<button aria-label="Save the project">Save</button>');
    await fireEvent.pointerOver(save);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('works for the icon inside a button, and splits off the "Why?" part', async () => {
    const cut = button(
      '<button title="Cut (Ctrl/Cmd + X)\n\nWhy? Cut removes the selected sound."><svg><path></path></svg></button>',
    );
    await fireEvent.pointerOver(cut.querySelector('path')!);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('.what')!.textContent).toBe('Cut (Ctrl/Cmd + X)');
    expect(tip.querySelector('.why')!.textContent).toBe('Why? Cut removes the selected sound.');
  });

  it('shows on keyboard focus too; a click or Escape hides it', async () => {
    const stop = button('<button title="Stop"><svg></svg></button>');
    await fireEvent.focusIn(stop);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    await fireEvent.pointerOver(stop);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    await fireEvent.pointerDown(stop);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(stop.getAttribute('title')).toBe('Stop');
  });

  it('leaving before the delay shows nothing', async () => {
    const stop = button('<button title="Stop"><svg></svg></button>');
    await fireEvent.pointerOver(stop);
    await fireEvent.pointerOut(stop);
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY * 2);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('the app has tooltips in every mode', () => {
  it('the Audio mode toolbar buttons explain themselves', async () => {
    vi.useFakeTimers();
    render(App, { props: { app: testApp().app } });
    await fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
        name: 'Audio',
      }),
    );
    await fireEvent.pointerOver(screen.getByRole('button', { name: 'Clip tool' }));
    await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
    expect(screen.getByRole('tooltip').textContent).toMatch(/drag it to move it/);
    vi.useRealTimers();
  });
});
