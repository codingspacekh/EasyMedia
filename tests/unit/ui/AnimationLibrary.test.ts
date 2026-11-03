// M16b / AN19, AN20 on screen: the Library dialog (tool strip button or K; search, categories,
// click to place) and the Properties panel's Effects section.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { objectAt } from '../../../src/core/animation/tween.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

async function animation() {
  const t = testApp();
  ui.mode = 'Animation';
  render(App, { props: { app: t.app } });
  await tick();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  return { ...t, anim, doc };
}

describe('the Library dialog (AN19)', () => {
  it('opens from the tool strip, shows a category, searches, and places an item', async () => {
    const s = await animation();
    await fireEvent.click(screen.getByRole('button', { name: 'Library' }));
    const d = within(screen.getByRole('dialog', { name: 'Library' }));
    expect(d.getByRole('tab', { name: 'Cartoons' }).getAttribute('aria-selected')).toBe('true');
    expect(d.getByRole('button', { name: 'Add Car' })).toBeTruthy();
    await fireEvent.click(d.getByRole('tab', { name: 'Icons & symbols' }));
    expect(d.queryByRole('button', { name: 'Add Car' })).toBeNull();
    expect(d.getByRole('button', { name: 'Add Speech bubble' })).toBeTruthy();
    await fireEvent.input(d.getByLabelText('Search the library'), { target: { value: 'weather' } });
    expect(d.getByRole('button', { name: 'Add Lightning' })).toBeTruthy();
    expect(d.getByRole('button', { name: 'Add Smiling sun' })).toBeTruthy(); // all categories
    await fireEvent.input(d.getByLabelText('Search the library'), { target: { value: 'zzz' } });
    expect(d.getByText(/Nothing found/)).toBeTruthy();
    await fireEvent.input(d.getByLabelText('Search the library'), { target: { value: 'car' } });
    await fireEvent.click(d.getByRole('button', { name: 'Add Car' }));
    expect(screen.queryByRole('dialog', { name: 'Library' })).toBeNull();
    expect(s.doc().layers[0]!.objects[0]).toMatchObject({ kind: 'group', name: 'Car' });
  });

  it('K opens it; a background goes behind everything', async () => {
    const s = await animation();
    await fireEvent.keyDown(window, { key: 'k' });
    const d = within(screen.getByRole('dialog', { name: 'Library' }));
    await fireEvent.click(d.getByRole('tab', { name: 'Backgrounds' }));
    await fireEvent.click(d.getByRole('button', { name: 'Add Night sky' }));
    expect(s.doc().layers[0]!.name).toBe('Background');
    ui.mode = 'Video';
  });
});

describe('the Effects section (AN20)', () => {
  it('adds the chosen effect to the selection from the playhead, for the time typed', async () => {
    const s = await animation();
    s.anim.addShape('rect', { x: 10, y: 10, width: 40, height: 40 });
    s.anim.setFrame(12);
    await tick();
    const panel = within(screen.getByRole('complementary', { name: 'Properties' }));
    await fireEvent.change(panel.getByLabelText('Effect'), { target: { value: 'spin' } });
    await fireEvent.input(panel.getByLabelText('Lasts (s)'), { target: { value: '2' } });
    await fireEvent.click(panel.getByRole('button', { name: 'Add effect' }));
    const o = s.doc().layers[0]!.objects[0]!;
    expect(objectAt(o, 12).rotation).toBe(0);
    expect(objectAt(o, 60).rotation).toBe(360);
    await fireEvent.change(panel.getByLabelText('Effect'), { target: { value: 'typewriter' } });
    await fireEvent.click(panel.getByRole('button', { name: 'Add effect' }));
    expect(panel.getByRole('alert').textContent).toMatch(/only for text/i);
    ui.mode = 'Video';
  });
});
