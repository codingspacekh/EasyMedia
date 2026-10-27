// Animation mode's stage, panels and keyboard in detail (M13): every tool, the handles, the
// guides, the marquee, the layers and properties controls, the zoom and the shortcuts.
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { animUi } from '../../../src/ui/animation/animation-ui.svelte.ts';
import type {
  AnimObject,
  GroupObject,
  PathObject,
  StarObject,
  TextObject,
} from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

async function mode() {
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  // Exact numbers from drags: no snapping unless a test turns it on.
  anim.setView({ snap: { grid: false, guides: false, objects: false, pixels: false } });
  const objects = (): AnimObject[] =>
    anim.store.get().history.present.layers.flatMap((l) => l.objects);
  return {
    ...t,
    anim,
    objects,
    state: () => anim.store.get(),
    doc: () => anim.store.get().history.present,
    stage: () => screen.getByRole('application', { name: 'Stage' }),
    tool: (name: string) =>
      fireEvent.click(screen.getByRole('button', { name, exact: true } as object)),
  };
}

async function drag(
  target: Element,
  from: [number, number],
  to: [number, number],
  init: Record<string, unknown> = {},
) {
  await fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], button: 0, ...init });
  await fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], ...init });
  await fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], ...init });
}
const typeIn = async (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
const key = (k: string, init: Record<string, unknown> = {}) =>
  fireEvent.keyDown(window, { key: k, ...init });

describe('the drawing tools', () => {
  it('ellipse, star, polygon and line are dragged out; Shift makes a square box', async () => {
    const s = await mode();
    await s.tool('Ellipse');
    await drag(s.stage(), [0, 0], [204, 204]);
    await s.tool('Star');
    await drag(s.stage(), [300, 300], [360, 340], { shiftKey: true });
    await s.tool('Polygon');
    await drag(s.stage(), [400, 400], [450, 420]);
    await s.tool('Line');
    await drag(s.stage(), [0, 500], [600, 500]);
    expect(s.objects().map((o) => o.kind)).toEqual(['ellipse', 'star', 'polygon', 'path']);
    expect(s.objects()[1]).toMatchObject({ width: 60, height: 60 });
    expect(s.objects()[3]).toMatchObject({ x: 0, y: 500, width: 600, height: 0 });
    // A drag too small to be a shape adds nothing.
    await s.tool('Rectangle');
    await drag(s.stage(), [10, 10], [11, 11]);
    expect(s.objects()).toHaveLength(4);
    // Dragged up and to the left works too.
    await s.tool('Rectangle');
    await drag(s.stage(), [100, 100], [60, 70]);
    expect(s.objects().at(-1)).toMatchObject({ x: 60, y: 70, width: 40, height: 30 });
  });

  it('the pen clicks points; Enter finishes an open path, the first point closes it, Escape cancels', async () => {
    const s = await mode();
    await s.tool('Pen');
    for (const [x, y] of [
      [10, 10],
      [110, 10],
      [110, 110],
    ] as [number, number][]) {
      await fireEvent.pointerDown(s.stage(), { clientX: x, clientY: y, button: 0 });
      await fireEvent.pointerMove(s.stage(), { clientX: x + 5, clientY: y + 5 });
    }
    await key('Enter');
    const open = s.objects()[0] as PathObject;
    expect(open).toMatchObject({
      kind: 'path',
      closed: false,
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
    expect(open.points).toHaveLength(3);
    await s.tool('Pen');
    for (const [x, y] of [
      [200, 200],
      [300, 200],
      [300, 300],
      [201, 201],
    ])
      await fireEvent.pointerDown(s.stage(), { clientX: x, clientY: y, button: 0 });
    expect((s.objects()[1] as PathObject).closed).toBe(true);
    await s.tool('Pen');
    await fireEvent.pointerDown(s.stage(), { clientX: 400, clientY: 400, button: 0 });
    await key('Escape');
    expect(s.state().tool).toBe('select');
    await s.tool('Pen');
    await fireEvent.dblClick(s.stage());
    expect(s.objects()).toHaveLength(2);
    // Two clicks then a double-click finish an open path.
    await fireEvent.pointerDown(s.stage(), { clientX: 400, clientY: 400, button: 0 });
    await fireEvent.pointerDown(s.stage(), { clientX: 500, clientY: 400, button: 0 });
    await fireEvent.dblClick(s.stage());
    expect(s.objects()).toHaveLength(3);
  });

  it('the brush draws a freehand path from the pointer’s way', async () => {
    const s = await mode();
    await s.tool('Brush');
    await fireEvent.pointerDown(s.stage(), { clientX: 10, clientY: 10, button: 0 });
    for (const x of [20, 30, 40, 40.5])
      await fireEvent.pointerMove(window, { clientX: x, clientY: 10 + x });
    await fireEvent.pointerUp(window, { clientX: 40, clientY: 50 });
    const path = s.objects()[0] as PathObject;
    expect(path.kind).toBe('path');
    expect(path.points.length).toBeGreaterThanOrEqual(4);
    // A tap adds nothing.
    await s.tool('Brush');
    await fireEvent.pointerDown(s.stage(), { clientX: 100, clientY: 100, button: 0 });
    await fireEvent.pointerUp(window, { clientX: 100, clientY: 100 });
    expect(s.objects()).toHaveLength(1);
  });

  it('the Picture tool places a chosen file; a right button does nothing', async () => {
    const s = await mode();
    await s.tool('Picture');
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/photo.jpg']);
    await fireEvent.pointerDown(s.stage(), { clientX: 30, clientY: 40, button: 0 });
    await vi.waitFor(() => expect(s.objects()).toHaveLength(1));
    expect(s.objects()[0]).toMatchObject({ kind: 'picture', x: 30, y: 40 });
    await fireEvent.pointerDown(s.stage(), { clientX: 30, clientY: 40, button: 2 });
    expect(s.objects()).toHaveLength(1);
  });
});

describe('selecting, moving, resizing and turning', () => {
  it('click selects, Shift-click adds and removes, a click on nothing clears, a marquee selects what it touches', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    await tick();
    s.anim.addShape('rect', { x: 100, y: 0, width: 50, height: 50 });
    await tick();
    const [a, b] = s.objects();
    await drag(s.stage(), [10, 10], [10, 10]);
    expect(s.state().selection).toEqual([a!.id]);
    await fireEvent.pointerDown(s.stage(), {
      clientX: 110,
      clientY: 10,
      button: 0,
      shiftKey: true,
    });
    expect(s.state().selection).toEqual([a!.id, b!.id]);
    await fireEvent.pointerDown(s.stage(), {
      clientX: 110,
      clientY: 10,
      button: 0,
      shiftKey: true,
    });
    expect(s.state().selection).toEqual([a!.id]);
    await drag(s.stage(), [300, 300], [301, 301]);
    expect(s.state().selection).toEqual([]);
    await drag(s.stage(), [-10, -10], [120, 60]);
    expect(s.state().selection).toEqual([a!.id, b!.id]);
    expect(screen.getByText('2 selected')).toBeTruthy();
  });

  it('a drag moves the selection (Shift keeps it straight, Alt skips snapping); the status bar says what snapped', async () => {
    const s = await mode();
    s.anim.setView({
      grid: { show: true, size: 10, over: true },
      snap: { grid: true, guides: true, objects: true, pixels: true },
    });
    await tick();
    s.anim.addShape('rect', { x: 0, y: 0, width: 40, height: 40 });
    await tick();
    await fireEvent.pointerDown(s.stage(), { clientX: 10, clientY: 10, button: 0 });
    await fireEvent.pointerMove(window, { clientX: 23, clientY: 12, shiftKey: true });
    await fireEvent.pointerUp(window, { clientX: 23, clientY: 12, shiftKey: true });
    expect(s.objects()[0]).toMatchObject({ x: 10, y: 0 });
    await drag(s.stage(), [20, 10], [23.4, 10], { altKey: true });
    expect(s.objects()[0]!.x).toBeCloseTo(13.4, 5);
    s.anim.addGuide('x', 250);
    await tick();
    await fireEvent.pointerDown(s.stage(), { clientX: 20, clientY: 10, button: 0 });
    await fireEvent.pointerMove(window, { clientX: 20 + 250 - 13.4 - 2, clientY: 10 });
    expect(animUi.snapped).toBe('guide');
    await fireEvent.pointerUp(window, { clientX: 20 + 250 - 13.4 - 2, clientY: 10 });
    expect(s.objects()[0]!.x).toBe(250);
  });

  it('the handles resize (Shift keeps proportions) and the knob turns (Shift in 15° steps)', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 100, y: 100, width: 100, height: 50 });
    await tick();
    await drag(screen.getByLabelText('Resize se'), [200, 150], [250, 170]);
    expect(s.objects()[0]).toMatchObject({ width: 150, height: 70 });
    await drag(screen.getByLabelText('Resize se'), [250, 170], [400, 170], { shiftKey: true });
    expect(s.objects()[0]).toMatchObject({ width: 300, height: 140 });
    await drag(screen.getByLabelText('Rotate'), [250, 60], [500, 170]);
    expect(s.objects()[0]!.rotation).toBe(90);
    await drag(screen.getByLabelText('Rotate'), [250, 60], [500, 160], { shiftKey: true });
    expect(s.objects()[0]!.rotation % 15).toBe(0);
    expect(screen.getByLabelText('Resize n')).toBeTruthy();
  });

  it('double-clicking text focuses its words; the pointer leaving clears the coordinates', async () => {
    const s = await mode();
    s.anim.addText({ x: 10, y: 10 }, 'Hello');
    await tick();
    s.anim.select([]);
    await tick();
    const before = animUi.focusText;
    await fireEvent.dblClick(s.stage(), { clientX: 20, clientY: 20 });
    expect(animUi.focusText).toBe(before + 1);
    expect(s.state().selection).toHaveLength(1);
    await fireEvent.pointerMove(s.stage(), { clientX: 5, clientY: 6 });
    expect(animUi.pointer).toEqual({ x: 5, y: 6 });
    await fireEvent.pointerLeave(s.stage());
    expect(animUi.pointer).toBeNull();
  });
});

describe('guides (AN2)', () => {
  it('a guide is dragged out of a ruler, moved, and removed by dragging it off the stage', async () => {
    const s = await mode();
    s.anim.setView({ rulers: true });
    await tick();
    await drag(screen.getByLabelText('Horizontal ruler'), [0, 0], [100, 150]);
    expect(s.doc().guides.y).toEqual([150]);
    await drag(screen.getByLabelText('Vertical ruler'), [0, 0], [250, 100]);
    expect(s.doc().guides.x).toEqual([250]);
    // Dropped outside the stage: no guide.
    await drag(screen.getByLabelText('Vertical ruler'), [0, 0], [-50, 100]);
    expect(s.doc().guides.x).toEqual([250]);
    const line = document.querySelector('line.guide')!;
    await drag(line, [250, 100], [260, 100]);
    expect(s.doc().guides.x).toEqual([260]);
    await drag(document.querySelector('line.guide')!, [260, 100], [-20, 100]);
    expect(s.doc().guides.x).toEqual([]);
    const horizontal = document.querySelector('line.guide')!;
    await drag(horizontal, [100, 150], [100, 160]);
    expect(s.doc().guides.y).toEqual([160]);
  });
});

describe('keyboard and clipboard', () => {
  it('letters choose tools; Escape goes back to Select, then clears the selection', async () => {
    const s = await mode();
    for (const [k, tool] of [
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
      expect(s.state().tool).toBe(tool);
    }
    await key('r');
    await key('Escape');
    expect(s.state().tool).toBe('select');
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    await key('Escape');
    expect(s.state().selection).toEqual([]);
    // A letter with Shift is not a tool.
    await key('R', { shiftKey: true });
    expect(s.state().tool).toBe('select');
  });

  it('Ctrl/Cmd + D duplicates, G groups, Shift + G ungroups, 0 fits, + and − zoom', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    await key('d', { ctrlKey: true });
    expect(s.objects()).toHaveLength(2);
    s.anim.selectAll();
    await tick();
    await key('g', { metaKey: true });
    expect(s.objects().map((o) => o.kind)).toEqual(['group']);
    await key('G', { metaKey: true, shiftKey: true });
    expect(s.objects().map((o) => o.kind)).toEqual(['rect', 'rect']);
    await key('=', { ctrlKey: true });
    expect(s.state().zoom).toBe(1.5);
    await key('-', { ctrlKey: true });
    await key('-', { ctrlKey: true });
    expect(s.state().zoom).toBe(0.75);
    await key('0', { ctrlKey: true });
    expect(s.state().zoom).toBe('fit');
    // With Alt it is not a shortcut; in a box neither.
    await key('d', { ctrlKey: true, altKey: true });
    expect(s.objects()).toHaveLength(2);
  });

  it('the Edit menu’s cut, copy and paste work on the selection, not in a text box', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    await fireEvent.copy(document);
    await fireEvent.paste(document);
    expect(s.objects()).toHaveLength(2);
    await fireEvent.cut(document);
    expect(s.objects()).toHaveLength(1);
    s.anim.select([s.objects()[0]!.id]);
    await tick();
    const box = screen.getByLabelText('X', { exact: true });
    box.focus();
    await fireEvent.paste(box);
    expect(s.objects()).toHaveLength(1);
    await fireEvent.keyDown(box, { key: 'Delete' });
    expect(s.objects()).toHaveLength(1);
  });
});

describe('toolbar, status bar and stage settings', () => {
  it('zoom buttons and the Snap toggle; the message can be dismissed', async () => {
    const s = await mode();
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(s.state().zoom).toBe(1.5);
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
    expect(s.state().zoom).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom to fit' }));
    expect(s.state().zoom).toBe('fit');
    await fireEvent.click(screen.getByRole('button', { name: 'Zoom to fit' }));
    expect(s.state().zoom).toBe(1);
    s.anim.setView({ snap: { grid: true, guides: true, objects: true, pixels: false } });
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Snap' }));
    expect(s.doc().view.snap).toMatchObject({ grid: false, guides: false, objects: false });
    await fireEvent.click(screen.getByRole('button', { name: 'Snap' }));
    expect(s.doc().view.snap.guides).toBe(true);
    s.anim.moveGuide('x', 9, 1);
    await tick();
    expect(screen.getByRole('alert').textContent).toMatch(/guide/);
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('stage settings: a preset keeps the width, the frame rate list, length in frames or seconds, Cancel', async () => {
    const s = await mode();
    await fireEvent.click(screen.getByRole('button', { name: /^Stage settings/ }));
    const dialog = screen.getByRole('dialog', { name: 'Stage settings' });
    await fireEvent.click(within(dialog).getByRole('button', { name: '16:10' }));
    expect(
      (within(dialog).getByLabelText('Height', { exact: true }) as HTMLInputElement).value,
    ).toBe('800');
    await fireEvent.change(within(dialog).getByLabelText('Width', { exact: true }), {
      target: { value: '600' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: '2.35:1' }));
    expect(
      (within(dialog).getByLabelText('Height', { exact: true }) as HTMLInputElement).value,
    ).toBe('256');
    await fireEvent.change(within(dialog).getByLabelText('Frame rate'), {
      target: { value: '30' },
    });
    await fireEvent.change(within(dialog).getByLabelText('= seconds', { exact: true }), {
      target: { value: '3' },
    });
    expect(
      (within(dialog).getByLabelText('Length', { exact: true }) as HTMLInputElement).value,
    ).toBe('90');
    await fireEvent.change(within(dialog).getByLabelText('Length', { exact: true }), {
      target: { value: '72' },
    });
    await fireEvent.change(within(dialog).getByLabelText('Colour swatch'), {
      target: { value: '#123456' },
    });
    await fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    expect(s.doc().stage).toMatchObject({
      width: 600,
      height: 256,
      fps: 30,
      length: 72,
      background: '#123456',
    });
    await fireEvent.click(screen.getByRole('button', { name: /^Stage settings/ }));
    await fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Stage settings' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('the Layers panel in detail', () => {
  it('move up and down, delete, folders: open and close, pick a folder, delete the folder', async () => {
    const s = await mode();
    await fireEvent.click(screen.getByRole('button', { name: /Layer$/ }));
    const [bottom, top] = s.doc().layers.map((l) => l.id) as [string, string];
    await fireEvent.click(screen.getByRole('button', { name: 'Move layer down' }));
    expect(s.doc().layers.map((l) => l.id)).toEqual([top, bottom]);
    await fireEvent.click(screen.getByRole('button', { name: 'Move layer up' }));
    expect(s.doc().layers.map((l) => l.id)).toEqual([bottom, top]);
    await fireEvent.click(screen.getByRole('button', { name: 'Folder' }));
    const folder = s.doc().folders[0]!;
    await fireEvent.change(screen.getByLabelText('Folder of Layer 2'), {
      target: { value: folder.id },
    });
    expect(s.doc().layers[1]!.folderId).toBe(folder.id);
    await fireEvent.click(screen.getByRole('button', { name: 'Close folder Folder' }));
    expect(s.doc().folders[0]!.open).toBe(false);
    expect(screen.queryByText('Layer 2')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Open folder Folder' }));
    await fireEvent.change(screen.getByLabelText('Folder of Layer 2'), { target: { value: '' } });
    expect(s.doc().layers[1]!.folderId).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete folder Folder' }));
    expect(s.doc().folders).toEqual([]);
    const row = within(screen.getByRole('listbox', { name: 'Layer list' })).getByRole('option', {
      name: 'Layer 2',
    });
    await fireEvent.keyDown(row, { key: 'Enter' });
    await fireEvent.click(row);
    await fireEvent.click(screen.getByRole('button', { name: 'Delete layer' }));
    expect(s.doc().layers).toHaveLength(1);
    await fireEvent.dblClick(
      within(screen.getByRole('listbox', { name: 'Layer list' })).getByRole('option', {
        name: 'Layer 1',
      }),
    );
    await fireEvent.change(screen.getByLabelText('Layer name'), { target: { value: ' ' } });
    expect(screen.getByRole('alert').textContent).toMatch(/name/);
    await fireEvent.keyDown(screen.getByLabelText('Layer name'), { key: 'Escape' });
    expect(screen.queryByLabelText('Layer name')).toBeNull();
  });
});

describe('the Properties panel in detail', () => {
  it('name, rotation, radial gradient, stroke colour, width and style, corners, lock proportions', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 200, height: 100 });
    await tick();
    await typeIn('Name', ' Box ');
    expect(s.objects()[0]!.name).toBe('Box');
    await typeIn('Name', '  ');
    expect(s.objects()[0]!.name).toBe('Box');
    await typeIn('Rotation', '370');
    expect(s.objects()[0]!.rotation).toBe(10);
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'radial' },
    });
    expect(s.objects()[0]!.fill.kind).toBe('radial');
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'linear' },
    });
    await typeIn('Angle', '90');
    expect(s.objects()[0]!.fill).toMatchObject({ kind: 'linear', angle: 90 });
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'solid' },
    });
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'none' },
    });
    expect(s.objects()[0]!.fill).toEqual({ kind: 'none' });
    await fireEvent.change(screen.getByLabelText('Fill', { exact: true }), {
      target: { value: 'solid' },
    });
    const fillColour = (value: string) =>
      fireEvent.change(screen.getAllByLabelText('Colour', { exact: true })[0]!, {
        target: { value },
      });
    await fillColour('FF1CC8');
    expect(s.objects()[0]!.fill).toEqual({ kind: 'solid', colour: '#FF1CC8' });
    await fillColour('red');
    expect(screen.getByRole('alert').textContent).toMatch(/colour such as/);
    await fireEvent.change(screen.getAllByLabelText(/Colour swatch/)[1]!, {
      target: { value: '#00ff00' },
    });
    expect(s.objects()[0]!.stroke!.colour).toBe('#00ff00');
    await typeIn('Width', '3.5');
    await fireEvent.change(screen.getByLabelText('Style'), { target: { value: 'dotted' } });
    expect(s.objects()[0]!.stroke).toMatchObject({ width: 3.5, dash: 'dotted' });
    await typeIn('Radius', '12');
    expect(s.objects()[0]).toMatchObject({ radius: 12 });
    await fireEvent.click(screen.getByLabelText('Lock proportions'));
    await typeIn('W', '100');
    expect(s.objects()[0]).toMatchObject({ width: 100, height: 50 });
    await typeIn('H', '25');
    expect(s.objects()[0]).toMatchObject({ width: 50, height: 25 });
    await typeIn('X', 'abc');
    expect(screen.getAllByRole('alert').some((a) => /number/.test(a.textContent ?? ''))).toBe(true);
    // Outline off then on again gives the default outline back.
    await fireEvent.click(screen.getByLabelText('Outline'));
    await fireEvent.click(screen.getByLabelText('Outline'));
    expect(s.objects()[0]!.stroke).toMatchObject({ width: 2 });
  });

  it('star points and inner radius, polygon sides, text font, alignment, bold and italic', async () => {
    const s = await mode();
    s.anim.addShape('star', { x: 0, y: 0, width: 100, height: 100 });
    await tick();
    await typeIn('Inner', '40');
    expect((s.objects()[0] as StarObject).inner).toBe(0.4);
    s.anim.addShape('polygon', { x: 0, y: 0, width: 100, height: 100 });
    await tick();
    await typeIn('Sides', '8');
    expect(s.objects()[1]).toMatchObject({ sides: 8 });
    s.anim.addText({ x: 0, y: 0 }, 'Hi');
    await tick();
    await fireEvent.change(screen.getByLabelText('Align'), { target: { value: 'centre' } });
    await fireEvent.click(screen.getByRole('button', { name: /Bold/ }));
    await fireEvent.click(screen.getByRole('button', { name: /Italic/ }));
    const t = s.objects()[2] as TextObject;
    expect(t).toMatchObject({ align: 'centre', bold: true, italic: true });
    await fireEvent.click(screen.getByRole('button', { name: /^Font:/ }));
    await fireEvent.click(screen.getByRole('radio', { name: /Montserrat/ }));
    expect((s.objects()[2] as TextObject).font).toBe('Montserrat');
  });

  it('arrange buttons, the layer picker, Group / Ungroup / Duplicate / Delete, several selected', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 10, height: 10 });
    await tick();
    s.anim.addShape('ellipse', { x: 20, y: 0, width: 10, height: 10 });
    await tick();
    s.anim.addLayer();
    await tick();
    s.anim.select([s.objects()[0]!.id]);
    await tick();
    for (const name of ['Bring to front', 'Send backward', 'Bring forward', 'Send to back'])
      await fireEvent.click(screen.getByRole('button', { name }));
    expect(s.objects().map((o) => o.kind)).toEqual(['rect', 'ellipse']);
    await fireEvent.change(screen.getByLabelText('On layer'), {
      target: { value: s.doc().layers[1]!.id },
    });
    expect(s.doc().layers[1]!.objects).toHaveLength(1);
    s.anim.selectLayer(s.doc().layers[0]!.id);
    await tick();
    s.anim.selectAll();
    await tick();
    s.anim.select(s.objects().map((o) => o.id));
    await tick();
    expect(screen.getByText('2 objects')).toBeTruthy();
    await typeIn('Opacity', '50');
    expect(s.objects().every((o) => o.opacity === 50)).toBe(true);
    await fireEvent.change(screen.getByLabelText('On layer'), {
      target: { value: s.doc().layers[0]!.id },
    });
    s.anim.select(s.objects().map((o) => o.id));
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Group' }));
    expect((s.objects()[0] as GroupObject).kind).toBe('group');
    await fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));
    expect(s.objects()).toHaveLength(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Ungroup' }));
    expect(s.objects()).toHaveLength(3);
    s.anim.select(
      s
        .objects()
        .slice(1)
        .map((o) => o.id),
    );
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(s.objects()).toHaveLength(1);
  });
});
