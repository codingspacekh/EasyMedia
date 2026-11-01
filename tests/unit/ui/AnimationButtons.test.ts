// AN18 in Animation mode: the Button tool (workbook Task 4's Pause and Continue), what a button
// does chosen in the Properties panel, and Test, which opens the animation's web page in a window
// of its own where the buttons work.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import type { ButtonObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

async function animationMode() {
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  const buttons = () =>
    anim.store
      .get()
      .history.present.layers.flatMap((l) => l.objects)
      .filter((o): o is ButtonObject => o.kind === 'button');
  return { ...t, anim, buttons, stage: () => screen.getByRole('application', { name: 'Stage' }) };
}

const tools = () => screen.getByRole('toolbar', { name: 'Animation tools' });

describe('buttons in Animation mode (AN18)', () => {
  it('the Button tool, with its "Why use this?", places a Pause button where clicked', async () => {
    const s = await animationMode();
    const tool = within(tools()).getByRole('button', { name: 'Button' });
    expect(tool.title).toMatch(/Why\?.*stop/is);
    await fireEvent.click(tool);
    await fireEvent.pointerDown(s.stage(), { clientX: 10, clientY: 10, button: 0 });
    expect(s.buttons()).toMatchObject([{ label: 'Pause', action: 'pause', x: 10, y: 10 }]);
    expect(screen.getByRole('heading', { name: /^Button 20.1 stopping animations/ })).toBeTruthy();
  });

  it('U picks the Button tool', async () => {
    const s = await animationMode();
    await fireEvent.keyDown(window, { key: 'u' });
    expect(s.anim.store.get().tool).toBe('button');
  });

  it('Task 4: the Action list makes it Continue; the words can be typed', async () => {
    const s = await animationMode();
    s.anim.addButton({ x: 10, y: 40 });
    await fireEvent.change(await screen.findByLabelText('Action'), {
      target: { value: 'continue' },
    });
    expect(s.buttons()[0]).toMatchObject({ action: 'continue', label: 'Continue' });
    await fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Play' } });
    expect(s.buttons()[0]!.label).toBe('Play');
  });

  it('Go to frame shows a box for the frame', async () => {
    const s = await animationMode();
    s.anim.addButton({ x: 0, y: 0 });
    expect(screen.queryByLabelText('Go to')).toBeNull();
    await fireEvent.change(await screen.findByLabelText('Action'), { target: { value: 'goto' } });
    await fireEvent.change(screen.getByLabelText('Go to'), { target: { value: '48' } });
    expect(s.buttons()[0]!.frame).toBe(48);
  });

  it('a button cannot morph: the Morph section is not offered', async () => {
    const s = await animationMode();
    s.anim.addButton({ x: 0, y: 0 });
    await screen.findByLabelText('Action');
    expect(screen.queryByLabelText('Morph into')).toBeNull();
  });

  it('Test opens the web page in a window of its own', async () => {
    const s = await animationMode();
    s.anim.addButton({ x: 10, y: 10 });
    const test = screen.getByRole('button', { name: 'Test' });
    expect(test.title).toMatch(/buttons/);
    await fireEvent.click(test);
    await vi.waitFor(() => expect(s.pageAssets.openTest).toHaveBeenCalledTimes(1));
  });

  it('Ctrl+Enter tests the animation too', async () => {
    const s = await animationMode();
    await fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });
    await vi.waitFor(() => expect(s.pageAssets.openTest).toHaveBeenCalledTimes(1));
  });
});
