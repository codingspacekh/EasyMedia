// M16b / N16: every editor's panels sit in a slot with a splitter on the inner edge — resized
// with the keyboard (and the mouse, checked in the real app), hidden with its button, shown
// again from the thin strip left behind; double-click gives back the usual size.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { PANELS } from '../../../src/app/layout.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

const splitter = (label: string) => screen.getByRole('separator', { name: `Resize the ${label}` });

async function editor(mode: 'Video' | 'Audio' | 'Animation') {
  const t = testApp();
  ui.mode = mode;
  render(App, { props: { app: t.app } });
  await tick();
  return t;
}

describe('resizable, hideable panels (N16)', () => {
  it('each editor has a splitter for each of its panels', async () => {
    await editor('Video');
    for (const label of ['Media bin', 'Inspector', 'Timeline'])
      expect(splitter(label)).toBeTruthy();
    ui.mode = 'Animation';
    await tick();
    for (const label of ['Layers', 'Properties', 'Timeline']) expect(splitter(label)).toBeTruthy();
    ui.mode = 'Audio';
    await tick();
    expect(splitter('Selection panel')).toBeTruthy();
    ui.mode = 'Video';
  });

  it('the arrow keys resize a side panel (Shift: bigger steps), Home and End go to the limits', async () => {
    const t = await editor('Animation');
    const edge = splitter('Layers');
    expect(edge.getAttribute('aria-valuenow')).toBe('230');
    await fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(edge.getAttribute('aria-valuenow')).toBe('246');
    await fireEvent.keyDown(edge, { key: 'ArrowLeft', shiftKey: true });
    expect(edge.getAttribute('aria-valuenow')).toBe('182');
    await fireEvent.keyDown(edge, { key: 'End' });
    expect(t.app.layout.store.get().sizes['animation.layers']).toBe(PANELS['animation.layers'].max);
    // A right-hand panel grows to the left.
    const props = splitter('Properties');
    await fireEvent.keyDown(props, { key: 'ArrowLeft' });
    expect(props.getAttribute('aria-valuenow')).toBe('320');
    // The timeline grows upwards.
    const rows = splitter('Timeline');
    await fireEvent.keyDown(rows, { key: 'ArrowUp' });
    expect(rows.getAttribute('aria-valuenow')).toBe('168');
    await fireEvent.dblClick(edge);
    expect(edge.getAttribute('aria-valuenow')).toBe('230');
    ui.mode = 'Video';
  });

  it('a panel is hidden with its button and shown again from the strip it leaves', async () => {
    await editor('Animation');
    expect(screen.getByRole('complementary', { name: 'Layers' })).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Hide the Layers' }));
    expect(screen.queryByRole('complementary', { name: 'Layers' })).toBeNull();
    expect(screen.queryByRole('separator', { name: 'Resize the Layers' })).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Show the Layers' }));
    expect(screen.getByRole('complementary', { name: 'Layers' })).toBeTruthy();
    ui.mode = 'Video';
  });

  it('the side panel takes the size chosen', async () => {
    const t = await editor('Video');
    await t.app.layout.resize('video.bin', 300);
    await tick();
    const slot = splitter('Media bin').parentElement as HTMLElement;
    expect(slot.style.width).toBe('300px');
    expect(within(slot).getAllByRole('button').length).toBeGreaterThan(0);
  });
});
