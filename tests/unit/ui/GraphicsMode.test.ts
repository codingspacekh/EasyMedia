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

const tick = () => new Promise((r) => setTimeout(r, 0));
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(window, { key: k, ...init });

describe('Graphics mode from the keyboard (M18)', () => {
  it('letters choose the tools, as in Animation mode; Escape goes back to Select, then deselects', async () => {
    const s = await graphicsMode();
    const tool = () => s.g.store.get().tool;
    for (const [k, t] of [
      ['r', 'rect'],
      ['e', 'ellipse'],
      ['s', 'star'],
      ['g', 'polygon'],
      ['l', 'line'],
      ['p', 'pen'],
      ['b', 'brush'],
      ['t', 'text'],
      ['i', 'picture'],
      ['v', 'select'],
    ] as const) {
      await key(k);
      expect(tool()).toBe(t);
    }
    await key('R', { shiftKey: true });
    expect(tool()).toBe('select');
    await key('q');
    expect(tool()).toBe('select');
    await key('r');
    await key('Escape');
    expect(tool()).toBe('select');
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    expect(s.g.store.get().selection).toHaveLength(1);
    await key('Escape');
    expect(s.g.store.get().selection).toEqual([]);
  });

  it('arrows nudge (Shift: 10 px), Delete removes; Ctrl/Cmd D, G, Shift G, + − 0', async () => {
    const s = await graphicsMode();
    const objects = () => s.doc().layers[0]!.objects;
    s.g.addShape('rect', { x: 50, y: 50, width: 10, height: 10 });
    await key('ArrowRight');
    await key('ArrowDown', { shiftKey: true });
    await key('ArrowLeft');
    await key('ArrowUp');
    expect(objects()[0]).toMatchObject({ x: 50, y: 59 });
    await key('d', { ctrlKey: true });
    expect(objects()).toHaveLength(2);
    s.g.select(objects().map((o) => o.id));
    await key('g', { metaKey: true });
    expect(objects().map((o) => o.kind)).toEqual(['group']);
    await key('G', { metaKey: true, shiftKey: true });
    expect(objects().map((o) => o.kind)).toEqual(['rect', 'rect']);
    await key('=', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe(1.5);
    await key('+', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe(2);
    await key('-', { ctrlKey: true });
    await key('-', { ctrlKey: true });
    await key('-', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe(0.75);
    await key('0', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe('fit');
    await key('-', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe(0.75);
    await key('0', { ctrlKey: true });
    await key('=', { ctrlKey: true });
    expect(s.g.store.get().zoom).toBe(1.5);
    // Not shortcuts: with Alt, or another letter.
    await key('d', { ctrlKey: true, altKey: true });
    await key('x', { ctrlKey: true });
    expect(objects()).toHaveLength(2);
    s.g.select(objects().map((o) => o.id));
    await key('Delete');
    expect(objects()).toHaveLength(0);
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await key('Backspace');
    expect(objects()).toHaveLength(0);
  });

  it('K opens the library; keys typed in a box or with a dialog open are left alone', async () => {
    const s = await graphicsMode();
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    const props = within(screen.getByRole('complementary', { name: 'Properties' }));
    const box = props.getByLabelText('X', { exact: true });
    await fireEvent.keyDown(box, { key: 'Delete' });
    await fireEvent.keyDown(box, { key: 'd', ctrlKey: true });
    expect(s.doc().layers[0]!.objects).toHaveLength(1);
    await key('K', { shiftKey: true });
    expect(animUi.dialog).toBeNull();
    await key('k');
    expect(animUi.dialog).toBe('library');
    expect(screen.getByRole('dialog', { name: /Library/ })).toBeTruthy();
    await key('Delete');
    await key('r');
    expect(s.doc().layers[0]!.objects).toHaveLength(1);
    expect(s.g.store.get().tool).toBe('select');
    animUi.dialog = null;
  });

  it('cut, copy and paste work on the selection, not in a text box', async () => {
    const s = await graphicsMode();
    const objects = () => s.doc().layers[0]!.objects;
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    await fireEvent.copy(document);
    await fireEvent.paste(document);
    expect(objects()).toHaveLength(2);
    await fireEvent.cut(document);
    expect(objects()).toHaveLength(1);
    s.g.select([objects()[0]!.id]);
    await tick();
    const box = screen.getByLabelText('X', { exact: true });
    await fireEvent.paste(box);
    expect(objects()).toHaveLength(1);
  });
});

describe('Graphics mode toolbar (M18)', () => {
  it('zooms, saves, undoes and redoes; the chip shows a printed size and a transparent canvas', async () => {
    const s = await graphicsMode();
    const bar = within(screen.getByRole('group', { name: 'Zoom' }));
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom to fit' }));
    expect(s.g.store.get().zoom).toBe(1);
    expect(bar.getByText('100 %')).toBeTruthy();
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom in' }));
    expect(s.g.store.get().zoom).toBe(1.5);
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom out' }));
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom out' }));
    expect(s.g.store.get().zoom).toBe(0.75);
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom to fit' }));
    expect(s.g.store.get().zoom).toBe('fit');
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom out' }));
    expect(s.g.store.get().zoom).toBe(0.75);
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom to fit' }));
    await fireEvent.click(bar.getByRole('button', { name: 'Zoom in' }));
    expect(s.g.store.get().zoom).toBe(1.5);

    const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    const redo = screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    s.g.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    await fireEvent.click(undo);
    expect(s.doc().layers[0]!.objects).toHaveLength(0);
    expect(redo.disabled).toBe(false);
    await fireEvent.click(redo);
    expect(s.doc().layers[0]!.objects).toHaveLength(1);

    s.dialogs.saveGraphic.mockResolvedValueOnce('/work/Logo.mveg');
    await fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await tick();
    expect(s.dialogs.saveGraphic).toHaveBeenCalled();

    await s.g.newImage({
      name: 'Badge',
      size: { width: 10, height: 10, units: 'cm', dpi: 300 },
      background: 'none',
    });
    await tick();
    expect(
      screen.getByRole('button', { name: /Image settings: 1181 × 1181 px · 10 × 10 cm · 300 dpi/ }),
    ).toBeTruthy();
    // Nothing to send: it stays in Graphics mode.
    await fireEvent.click(screen.getByRole('button', { name: 'Send to Animation' }));
    expect(ui.mode).toBe('Graphics');
  });
});

describe('Image settings (G1, G10)', () => {
  it('changes the canvas of the image open: units shown in another unit, transparent, Apply', async () => {
    const s = await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: /Image settings:/ }));
    const d = dialog('Image settings');
    expect(d.queryByLabelText('Name')).toBeNull();
    expect(d.getByText(/a bigger canvas adds room/)).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Resolution'), { target: { value: '300' } });
    expect(d.getByText(/300 dpi suits print/)).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Resolution'), { target: { value: '200' } });
    expect(d.getByText(/a little soft in print/)).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Units'), { target: { value: 'in' } });
    // Both sides (the height was lost once: it was worked out from the new width in pixels).
    expect((d.getByLabelText('Width') as HTMLInputElement).value).toBe('6.40');
    expect((d.getByLabelText('Height') as HTMLInputElement).value).toBe('3.60');
    expect(d.getByText(/1280 × 720 pixels/)).toBeTruthy();
    await fireEvent.click(d.getByRole('checkbox', { name: /Transparent/ }));
    await fireEvent.click(d.getByRole('button', { name: 'Apply' }));
    expect(screen.queryByRole('dialog', { name: 'Image settings' })).toBeNull();
    expect(s.doc().graphic).toEqual({ dpi: 200, units: 'in' });
    expect(s.doc().stage).toMatchObject({ width: 1280, height: 720, background: 'none' });

    // Opened again it shows the transparent canvas in inches; a size too big is refused.
    await fireEvent.click(screen.getByRole('button', { name: /Image settings:/ }));
    const again = dialog('Image settings');
    expect((again.getByRole('checkbox', { name: /Transparent/ }) as HTMLInputElement).checked).toBe(
      true,
    );
    await fireEvent.change(again.getByLabelText('Width'), { target: { value: '900' } });
    expect(again.getByText(/must come to between/)).toBeTruthy();
    await fireEvent.change(again.getByLabelText('Units'), { target: { value: 'px' } });
    expect(again.getByText(/must come to between/)).toBeTruthy();
  });

  it('New image: a named image from a preset, the preset shown as chosen', async () => {
    const s = await graphicsMode();
    await fireEvent.click(screen.getByRole('button', { name: 'New image' }));
    const d = dialog('New image');
    const logo = d.getByRole('button', { name: 'Logo 200 × 200 px' });
    expect(logo.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(logo);
    expect(logo.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.input(d.getByLabelText('Name'), { target: { value: '  ' } });
    await fireEvent.click(d.getByRole('button', { name: 'Create' }));
    await tick();
    expect(s.doc().name).toBe('Untitled');
    expect(s.doc().stage).toMatchObject({ width: 200, height: 200 });
  });
});

describe('Export image sizes and parts (G11)', () => {
  async function exportDialog(setup?: (s: Awaited<ReturnType<typeof graphicsMode>>) => void) {
    const s = await graphicsMode();
    setup?.(s);
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    return { s, d: dialog('Export image') };
  }

  it('a height, a percentage, or a printed width at a resolution', async () => {
    const { d } = await exportDialog();
    await fireEvent.change(d.getByLabelText('Size'), { target: { value: 'height' } });
    await fireEvent.input(d.getByLabelText('Height'), { target: { value: '360' } });
    expect(d.getByText('640 × 360 px')).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Size'), { target: { value: 'percent' } });
    await fireEvent.input(d.getByLabelText('Scale'), { target: { value: '50' } });
    expect(d.getByText('640 × 360 px')).toBeTruthy();
    await fireEvent.input(d.getByLabelText('Scale'), { target: { value: '0' } });
    expect((d.getByRole('button', { name: 'Export…' }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.change(d.getByLabelText('Size'), { target: { value: 'print' } });
    await fireEvent.input(d.getByLabelText('Width'), { target: { value: '2' } });
    await fireEvent.change(d.getByLabelText('Printed width unit'), { target: { value: 'in' } });
    await fireEvent.input(d.getByLabelText('Resolution'), { target: { value: '300' } });
    expect(d.getByText('600 × 338 px')).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /SVG/ }));
    expect(d.getByText(/2 in wide: sharp at any size/)).toBeTruthy();
    await fireEvent.click(d.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Export image' })).toBeNull();
  });

  it('the selection, or each object in its own file; a JPG of a part gets a background', async () => {
    const { d } = await exportDialog((s) => {
      s.g.addShape('rect', { x: 0, y: 0, width: 100, height: 50 });
      s.g.addShape('rect', { x: 200, y: 0, width: 30, height: 30 });
    });
    await fireEvent.change(d.getByLabelText('Export'), { target: { value: 'selection' } });
    expect(d.getByText('30 × 30 px')).toBeTruthy();
    expect(d.getByText(/see-through where nothing is drawn/)).toBeTruthy();
    await fireEvent.change(d.getByLabelText('Export'), { target: { value: 'each' } });
    expect(d.getByText(/Each file/)).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /JPG/ }));
    expect(d.getByText(/transparent parts become this colour/)).toBeTruthy();
  });

  it('an SVG of a printed image keeps its printed size', async () => {
    const { d } = await exportDialog(
      (s) =>
        void s.g.newImage({
          name: 'Card',
          size: { width: 10, height: 10, units: 'cm', dpi: 300 },
          background: 'none',
        }),
    );
    await fireEvent.click(d.getByRole('radio', { name: /SVG/ }));
    expect(d.getByText(/at its printed size: sharp at any size/)).toBeTruthy();
    await fireEvent.click(d.getByRole('radio', { name: /JPG/ }));
    expect(d.getByText(/transparent parts become this colour/)).toBeTruthy();
  });
});

describe('the colour picker in HSL and CMYK (G9)', () => {
  it('takes a colour typed as HSL or CMYK numbers', async () => {
    const s = await graphicsMode();
    s.g.addShape('ellipse', { x: 0, y: 0, width: 300, height: 300 });
    await tick();
    const props = within(screen.getByRole('complementary', { name: 'Properties' }));
    await fireEvent.click(props.getAllByRole('button', { name: 'Colour swatch' })[0]!);
    const system = screen.getByLabelText('Colour swatch colour system');
    await fireEvent.change(system, { target: { value: 'hsl' } });
    await fireEvent.change(screen.getByLabelText('Colour swatch H'), { target: { value: '120' } });
    await fireEvent.change(screen.getByLabelText('Colour swatch S'), { target: { value: '100' } });
    await fireEvent.change(screen.getByLabelText('Colour swatch L'), { target: { value: '50' } });
    expect(s.doc().layers[0]!.objects[0]!.fill).toEqual({ kind: 'solid', colour: '#00ff00' });
    await fireEvent.change(system, { target: { value: 'cmyk' } });
    for (const [part, v] of [
      ['C', '0'],
      ['M', '100'],
      ['Y', '100'],
      ['K', '0'],
    ])
      await fireEvent.change(screen.getByLabelText(`Colour swatch ${part}`), {
        target: { value: v },
      });
    expect(s.doc().layers[0]!.objects[0]!.fill).toEqual({ kind: 'solid', colour: '#ff0000' });
    // Not a number: nothing changes.
    await fireEvent.change(screen.getByLabelText('Colour swatch K'), { target: { value: 'x' } });
    expect(s.doc().layers[0]!.objects[0]!.fill).toEqual({ kind: 'solid', colour: '#ff0000' });
  });
});
