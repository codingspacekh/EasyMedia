// Chooses a colour with the app's own colour picker (ColourPicker.svelte), as a person does:
// open the swatch, type the hex code, close the picker.
import { fireEvent, screen, within } from '@testing-library/svelte';

export async function pickColour(
  label: string,
  hex: string,
  { index = 0, inside }: { index?: number; inside?: HTMLElement } = {},
): Promise<void> {
  const area = inside ? within(inside) : screen;
  await fireEvent.click(area.getAllByRole('button', { name: label })[index]!);
  const picker = screen.getByRole('dialog', { name: label });
  await fireEvent.change(within(picker).getByLabelText(`${label} hex`), {
    target: { value: hex },
  });
  await fireEvent.keyDown(document, { key: 'Escape' });
}
