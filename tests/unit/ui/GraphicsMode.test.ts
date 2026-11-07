// M18: Graphics mode on screen — its tab, the canvas chip, New image… in the papers' sizes, the
// Image section, positions in cm, Align, Export image, Send to Animation, and the colour picker's
// RGB / HSL / CMYK numbers.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { animUi } from '../../../src/ui/animation/animation-ui.svelte.ts';
import { ui } from '../../../src/ui/ui-state.svelte.ts';
import { testApp } from '../../helpers/test-app.ts';

async function graphicsMode() {
  animUi.dialog = null;
  animUi.graphicFormat = 'png';
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Graphics',
    }),
  );
  const g = t.app.graphics;
  const doc = () => g.store.get().history.present;
  return { ...t, g, doc };
}

const dialog = (name: string) => within(screen.getByRole('dialog', { name }));

describe('Graphics mode (M18)', () => {
  it('has its own tab, the drawing tools without Button or Import frames, and no timeline', async () => {
    await graphicsMode();
    expect(ui.mode).toBe('Graphics');
    const tools = within(screen.getByRole('toolbar', { name: 'Drawing tools' }));
    for (const name of ['Select', 'Rectangle', 'Ellipse', 'Star', 'Pen', 'Text', 'Picture'])
      expect(tools.getByRole('button', { name })).toBeTruthy();
    expect(tools.queryByRole('button', { name: 'Button' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Import frames' })).toBeNull();
    expect(screen.queryByRole('region', { name: /timeline/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /Image settings: 1280 × 720 px · 96 dpi/ }),
    ).toBeTruthy();
    expect(document.title).toBe('Untitled image — OneEditor');
  });

  it('G1 New image… makes an A4 page at 300 dpi, shown in cm', async () => {
    const s = await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: 'New image' }));
    const d = dialog('New image');
    await fireEvent.click(d.getByRole('button', { name: 'A4 portrait' }));
    expect(d.getByText(/2480 × 3508 pixels/)).toBeTruthy();
    await fireEvent.click(d.getByRole('button', { name: 'Create' }));
    expect(s.doc().stage).toMatchObject({ width: 2480, height: 3508 });
    expect(s.doc().graphic).toEqual({ dpi: 300, units: 'cm' });
    expect(
      screen.getByRole('button', { name: /2480 × 3508 px · 21 × 29.7 cm · 300 dpi/ }),
    ).toBeTruthy();
  });

  it('G1, G10 says a size that cannot be made, and that 72 dpi is blocky in print', async () => {
    await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: 'New image' }));
    const d = dialog('New image');
    const units = d.getByLabelText('Units') as HTMLSelectElement;
    await fireEvent.change(units, { target: { value: 'cm' } });
    const width = d.getByLabelText('Width') as HTMLInputElement;
    await fireEvent.change(width, { target: { value: '500' } });
    expect(d.getByText(/must come to between 16 and 8192 pixels/)).toBeTruthy();
    expect((d.getByRole('button', { name: 'Create' }) as HTMLButtonElement).disabled).toBe(true);
    const dpi = d.getByLabelText('Resolution') as HTMLInputElement;
    await fireEvent.change(dpi, { target: { value: '72' } });
    expect(d.getByText(/printed, it would look blocky/)).toBeTruthy();
  });

  it('G1 shows the image in Properties when nothing is selected, and objects in its units', async () => {
    const s = await graphicsMode();
    await s.g.newImage({
      name: 'Jigsaw',
      size: { width: 80, height: 80, units: 'mm', dpi: 300 },
      background: 'none',
    });
    const props = within(screen.getByRole('complementary', { name: 'Properties' }));
    expect(props.getByText('945 × 945 px')).toBeTruthy();
    expect(props.getByText('Transparent')).toBeTruthy();
    s.g.addShape('rect', { x: 0, y: 0, width: 472.5, height: 472.5 });
    await Promise.resolve();
    expect((props.getByLabelText('W') as HTMLInputElement).value).toBe('40.0');
    await fireEvent.change(props.getByLabelText('X'), { target: { value: '10' } });
    expect(s.doc().layers[0]!.objects[0]!.x).toBeCloseTo(118.11, 2);
  });

  it('G5 aligns from the Properties panel', async () => {
    const s = await graphicsMode();
    s.g.addShape('rect', { x: 10, y: 10, width: 40, height: 40 });
    s.g.addShape('rect', { x: 200, y: 100, width: 20, height: 20 });
    s.g.select(s.doc().layers[0]!.objects.map((o) => o.id));
    await Promise.resolve();
    const props = within(screen.getByRole('complementary', { name: 'Properties' }));
    await fireEvent.click(props.getByRole('button', { name: 'Align bottom edges' }));
    expect(s.doc().layers[0]!.objects.map((o) => o.y + o.height)).toEqual([120, 120]);
    expect(
      (props.getByRole('button', { name: 'Distribute across' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('G11 Export image… saves a PNG at another width', async () => {
    const s = await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = dialog('Export image');
    expect(d.getByText(/Pixels, compressed without losing any/)).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Size'), { target: { value: 'width' } });
    await fireEvent.input(d.getByLabelText('Width'), { target: { value: '640' } });
    expect(d.getByText('640 × 360 px')).toBeTruthy();
    s.dialogs.exportGraphic.mockResolvedValueOnce('/work/Venice.png');
    await fireEvent.click(d.getByRole('button', { name: 'Export…' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(s.bytes.has('/work/Venice.png')).toBe(true);
    expect(screen.queryByRole('dialog', { name: 'Export image' })).toBeNull();
  });

  it('G11 JPG asks for a quality; SVG says it is shapes, sharp at any size', async () => {
    await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const d = dialog('Export image');
    await fireEvent.click(d.getByRole('radio', { name: /JPG/ }));
    expect(d.getByLabelText('Quality')).toBeTruthy();
    expect(d.getByText(/No transparency/)).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /SVG/ }));
    expect(d.getByText(/sharp at any size/)).toBeTruthy();
  });

  it('GL3 To Animation sends the drawing and shows Animation mode', async () => {
    const s = await graphicsMode();
    s.g.addShape('star', { x: 40, y: 40, width: 100, height: 100 });
    s.g.select([]);
    await fireEvent.click(screen.getByRole('button', { name: 'Send to Animation' }));
    expect(ui.mode).toBe('Animation');
    expect(s.app.animation.store.get().history.present.layers.at(-1)!.objects[0]!.kind).toBe(
      'star',
    );
  });
});

describe('the colour picker in RGB, HSL and CMYK (G7, G9)', () => {
  it('shows and takes a colour as RGB numbers (9626/04 O/N/25: RGB 180,0,0)', async () => {
    const s = await graphicsMode();
    s.g.addShape('ellipse', { x: 0, y: 0, width: 300, height: 300 });
    await Promise.resolve();
    const props = within(screen.getByRole('complementary', { name: 'Properties' }));
    // The fill's swatch comes first (the outline has one too).
    await fireEvent.click(props.getAllByRole('button', { name: 'Colour swatch' })[0]!);
    await fireEvent.change(screen.getByLabelText('Colour swatch R'), { target: { value: '180' } });
    await fireEvent.change(screen.getByLabelText('Colour swatch G'), { target: { value: '0' } });
    await fireEvent.change(screen.getByLabelText('Colour swatch B'), { target: { value: '0' } });
    const fill = s.doc().layers[0]!.objects[0]!.fill;
    expect(fill).toEqual({ kind: 'solid', colour: '#b40000' });
    await fireEvent.change(screen.getByLabelText('Colour swatch colour system'), {
      target: { value: 'cmyk' },
    });
    expect((screen.getByLabelText('Colour swatch M') as HTMLInputElement).value).toBe('100');
    expect(screen.getByText(/For print/)).toBeTruthy();
  });
});
