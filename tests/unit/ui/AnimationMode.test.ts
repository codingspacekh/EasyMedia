// Animation mode (M13): the fourth mode button, the tools, drawing on the stage, exact
// properties, layers, the stage settings, the status bar and the keyboard.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { animUi } from '../../../src/ui/animation/animation-ui.svelte.ts';
import type { AnimObject, StarObject } from '../../../src/core/animation/types.ts';
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
  return {
    ...t,
    anim,
    state: () => anim.store.get(),
    doc: () => anim.store.get().history.present,
    objects: (): AnimObject[] => anim.store.get().history.present.layers.flatMap((l) => l.objects),
    stage: () => screen.getByRole('application', { name: 'Stage' }),
  };
}

/** Drags on the stage from one point to another (the stage is at 100 % in jsdom). */
async function drag(stage: Element, from: [number, number], to: [number, number]) {
  await fireEvent.pointerDown(stage, { clientX: from[0], clientY: from[1], button: 0 });
  await fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1] });
  await fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1] });
}

const typeIn = async (label: string, value: string) => {
  const box = screen.getByLabelText(label, { exact: true });
  await fireEvent.change(box, { target: { value } });
};

describe('Animation mode layout', () => {
  it('has the drawing tools, the stage chip, Save, Undo, Redo and Export; the title names the animation', async () => {
    await animationMode();
    for (const name of [
      'Select',
      'Rectangle',
      'Ellipse',
      'Star',
      'Polygon',
      'Line',
      'Pen',
      'Brush',
      'Text',
      'Picture',
      'Rulers',
      'Grid',
      'Snap',
      'Save',
      'Undo',
      'Redo',
      'Export',
    ])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Stage settings: 16:9 · 1280 × 720 · 24 fps/ }),
    ).toBeTruthy();
    expect(screen.getByRole('application', { name: 'Stage' })).toBeTruthy();
    expect(document.title).toBe('Untitled animation — EasyMedia');
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the Layers panel lists the first layer; the Properties panel asks for an object', async () => {
    await animationMode();
    expect(
      within(screen.getByRole('listbox', { name: 'Layer list' })).getByRole('option', {
        name: 'Layer 1',
      }),
    ).toBeTruthy();
    expect(screen.getByText(/Click an object on the stage/)).toBeTruthy();
  });
});

describe('drawing (AN3, AN4)', () => {
  it('dragging a rectangle on the stage adds it to the selected layer with the dragged size, selected', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    await drag(s.stage(), [100, 100], [200, 150]);
    expect(s.objects()).toHaveLength(1);
    expect(s.objects()[0]).toMatchObject({ kind: 'rect', x: 100, y: 100, width: 100, height: 50 });
    expect(s.state().selection).toEqual([s.objects()[0]!.id]);
    expect(s.state().tool).toBe('select');
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(document.title).toBe('Untitled animation • — EasyMedia');
  });

  it('Task 1: a star dragged out, then typed to 135 × 135 at (128, 102) in the Properties panel', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Star' }));
    await drag(s.stage(), [300, 300], [400, 400]);
    await typeIn('X', '128');
    await typeIn('Y', '102');
    await typeIn('W', '135');
    await typeIn('H', '135');
    expect(s.objects()[0]).toMatchObject({ kind: 'star', x: 128, y: 102, width: 135, height: 135 });
    await typeIn('Points', '7');
    expect((s.objects()[0] as StarObject).points).toBe(7);
    await typeIn('Opacity', '57');
    expect(s.objects()[0]!.opacity).toBe(57);
    await typeIn('Opacity', '120');
    expect(screen.getByRole('alert').textContent).toMatch(/0 and 100/);
    expect(s.objects()[0]!.opacity).toBe(57);
  });

  it('a click with the Text tool adds words where clicked; the words box is focused', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Text' }));
    await fireEvent.pointerDown(s.stage(), { clientX: 193, clientY: 73, button: 0 });
    expect(s.objects()[0]).toMatchObject({ kind: 'text', x: 193, y: 73, text: 'Text' });
    await typeIn('Words', 'Task 1');
    expect(s.objects()[0]).toMatchObject({ text: 'Task 1' });
    await typeIn('Size', '64');
    expect(s.objects()[0]).toMatchObject({ size: 64 });
  });

  it('the fill can become a gradient with two colours, and the outline switched off', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    await drag(s.stage(), [0, 0], [300, 150]);
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'linear' },
    });
    await typeIn('From', '#FF1CC8');
    await typeIn('To', '#F0DB82');
    expect(s.objects()[0]!.fill).toEqual({
      kind: 'linear',
      from: '#FF1CC8',
      to: '#F0DB82',
      angle: 0,
    });
    await fireEvent.click(screen.getByLabelText('Outline'));
    expect(s.objects()[0]!.stroke).toBeUndefined();
  });

  it('selected objects move with the pointer and snap to the grid; Delete removes them', async () => {
    const s = await animationMode();
    s.anim.setView({
      grid: { show: true, size: 10, over: false },
      snap: { grid: true, guides: false, objects: false, pixels: false },
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Rectangle' }));
    await drag(s.stage(), [100, 100], [140, 140]);
    // Move it by (13, 0): the left edge at 113 snaps to 110 on the 10 px grid.
    await drag(s.stage(), [120, 120], [133, 120]);
    expect(s.objects()[0]).toMatchObject({ x: 110, y: 100 });
    await fireEvent.keyDown(window, { key: 'Delete' });
    expect(s.objects()).toEqual([]);
  });

  it('arrow keys nudge the selection by 1 px, 10 px with Shift', async () => {
    const s = await animationMode();
    s.anim.addShape('rect', { x: 50, y: 50, width: 20, height: 20 });
    await fireEvent.keyDown(window, { key: 'ArrowRight' });
    await fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
    expect(s.objects()[0]).toMatchObject({ x: 51, y: 60 });
  });
});

describe('layers (AN7)', () => {
  it('New layer adds and selects Layer 2; a shape then goes on it; Hide and Lock toggle', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: /Layer$/ }));
    expect(s.doc().layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2']);
    const list = screen.getByRole('listbox', { name: 'Layer list' });
    expect(
      within(list).getByRole('option', { name: 'Layer 2' }).getAttribute('aria-selected'),
    ).toBe('true');
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    expect(s.doc().layers[1]!.objects).toHaveLength(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Hide Layer 2' }));
    expect(s.doc().layers[1]!.visible).toBe(false);
    await fireEvent.click(screen.getByRole('button', { name: 'Lock Layer 1' }));
    expect(s.doc().layers[0]!.locked).toBe(true);
  });

  it('double-clicking a layer renames it', async () => {
    const s = await animationMode();
    const row = within(screen.getByRole('listbox', { name: 'Layer list' })).getByRole('option', {
      name: 'Layer 1',
    });
    await fireEvent.dblClick(row);
    await fireEvent.change(screen.getByLabelText('Layer name'), { target: { value: 'blue_oval' } });
    expect(s.doc().layers[0]!.name).toBe('blue_oval');
  });
});

describe('stage settings (AN1) and the status bar (AN2)', () => {
  it('Task 3: the stage chip opens the dialog; 1024 × 768 with #CBCDF0 is applied', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: /^Stage settings/ }));
    const dialog = screen.getByRole('dialog', { name: 'Stage settings' });
    await fireEvent.click(within(dialog).getByRole('button', { name: '4:3' }));
    await fireEvent.change(within(dialog).getByLabelText('Colour', { exact: true }), {
      target: { value: '#CBCDF0' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(s.doc().stage).toMatchObject({ width: 1024, height: 768, background: '#CBCDF0' });
    expect(screen.queryByRole('dialog', { name: 'Stage settings' })).toBeNull();
    expect(screen.getByRole('button', { name: /^Stage settings: 4:3 · 1024 × 768/ })).toBeTruthy();
  });

  it('a bad size is refused inside the dialog', async () => {
    await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: /^Stage settings/ }));
    const dialog = screen.getByRole('dialog', { name: 'Stage settings' });
    await fireEvent.change(within(dialog).getByLabelText('Width', { exact: true }), {
      target: { value: '5' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(within(dialog).getByRole('alert').textContent).toMatch(/between 16 and 4096/);
  });

  it('Rulers and Grid toggle the view; the status bar shows the pointer and the saved state', async () => {
    const s = await animationMode();
    await fireEvent.click(screen.getByRole('button', { name: 'Rulers' }));
    expect(s.doc().view.rulers).toBe(true);
    expect(screen.getByLabelText('Horizontal ruler')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    expect(s.doc().view.grid.show).toBe(true);
    await fireEvent.pointerMove(s.stage(), { clientX: 100, clientY: 50 });
    expect(screen.getByLabelText('Pointer position').textContent).toMatch(/x 100, y 50/);
    expect(screen.getByText(/All changes saved/)).toBeTruthy();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    expect(await screen.findByText(/Unsaved changes/)).toBeTruthy();
  });

  it('Export writes the stage as a PNG through the dialog', async () => {
    const s = await animationMode();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/a/out.png');
    await fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    const dialog = screen.getByRole('dialog', { name: 'Export animation' });
    await fireEvent.click(within(dialog).getByRole('radio', { name: /PNG picture of this frame/ }));
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Export file' }));
    await vi.waitFor(() => expect(s.bytes.has('/a/out.png')).toBe(true));
    expect(animUi.dialog).toBeNull();
  });
});
