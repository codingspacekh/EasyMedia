import { describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import ColourPicker from '../../../src/ui/ColourPicker.svelte';

function picker(value = '#333333') {
  const onchange = vi.fn<(colour: string) => null>(() => null);
  render(ColourPicker, { props: { label: 'Second colour', value, onchange } });
  const button = screen.getByRole('button', { name: 'Second colour' });
  return { onchange, button };
}
const open = async (button: HTMLElement) => {
  await fireEvent.click(button);
  return screen.getByRole('dialog', { name: 'Second colour' });
};

describe("the app's own colour picker (not the operating system's white box)", () => {
  it('no part of the app uses the browser’s colour box', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? files(join(dir, e.name))
          : e.name.endsWith('.svelte')
            ? [join(dir, e.name)]
            : [],
      );
    const native = files('src/ui').filter((f) => /type="color"/.test(readFileSync(f, 'utf8')));
    expect(native).toEqual([]);
  });

  it('a swatch shows the colour; clicking it opens the picker beside it', async () => {
    const { button } = picker('#ff3b1f');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.querySelector<HTMLElement>('.chip')!.style.background).toMatch(
      /255, 59, 31|#ff3b1f/,
    );
    const dialog = await open(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(within(dialog).getByLabelText('Second colour hex')).toBeTruthy();
    expect(within(dialog).getByRole('slider', { name: 'Hue' })).toBeTruthy();
    expect(within(dialog).getByRole('slider', { name: 'Saturation and brightness' })).toBeTruthy();
    expect(within(dialog).getAllByRole('button', { name: /^Use #/ }).length).toBeGreaterThanOrEqual(
      12,
    );
  });

  it('a typed hex code is used when complete; a wrong one is explained and not used', async () => {
    const { button, onchange } = picker();
    const dialog = await open(button);
    const hex = within(dialog).getByLabelText('Second colour hex');
    await fireEvent.change(hex, { target: { value: 'zz' } });
    expect(onchange).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert').textContent).toMatch(/#F4C8EE/);
    await fireEvent.change(hex, { target: { value: 'F4C8EE' } });
    expect(onchange).toHaveBeenLastCalledWith('#f4c8ee');
  });

  it('a ready-made swatch is used at once, and the colour is kept under Recent', async () => {
    const { button, onchange } = picker();
    let dialog = await open(button);
    const first = within(dialog).getAllByRole('button', { name: /^Use #/ })[0]!;
    const colour = first.getAttribute('aria-label')!.slice(4).toLowerCase();
    await fireEvent.click(first);
    expect(onchange).toHaveBeenLastCalledWith(colour);
    await fireEvent.keyDown(document, { key: 'Escape' });
    dialog = await open(button);
    expect(
      within(within(dialog).getByRole('group', { name: 'Recent colours' }))
        .getAllByRole('button')[0]!
        .getAttribute('aria-label'),
    ).toBe(`Use ${colour.toUpperCase()}`);
  });

  it('the arrow keys move around the colour square: right is stronger, up is brighter', async () => {
    const { button, onchange } = picker('#806060');
    const dialog = await open(button);
    const square = within(dialog).getByRole('slider', { name: 'Saturation and brightness' });
    await fireEvent.keyDown(square, { key: 'ArrowRight' });
    const [after] = onchange.mock.lastCall!;
    expect(after).not.toBe('#806060');
    await fireEvent.keyDown(square, { key: 'ArrowUp' });
    expect(onchange.mock.lastCall![0]).not.toBe(after);
  });

  it('Escape closes the picker first (not the box it is in) and gives the swatch the focus back', async () => {
    const outer = vi.fn();
    window.addEventListener('keydown', outer);
    const { button } = picker();
    await open(button);
    await fireEvent.keyDown(document.activeElement ?? document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Second colour' })).toBeNull();
    expect(outer).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
    window.removeEventListener('keydown', outer);
  });
});
