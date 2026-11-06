// M17a, from the animation benchmark: AN27 Turn about a chosen point (9626/04 M/J/20: a meter's
// needle turning about its end). On the stage the selected object shows the point as a dot with a
// cross: dragged, it moves (snapping to the box's centre, corners and edge middles); double-clicked,
// it goes back to the centre. In Properties it is typed as Turn about X / Y, in % of the box.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { animUi } from '../../../src/ui/animation/animation-ui.svelte.ts';
import { pivotOnStage, toStage } from '../../../src/core/animation/geometry.ts';
import type { AnimObject } from '../../../src/core/animation/types.ts';
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
  anim.setView({ snap: { grid: false, guides: false, objects: false, pixels: false } });
  const objects = (): AnimObject[] =>
    anim.store.get().history.present.layers.flatMap((l) => l.objects);
  return { ...t, anim, objects };
}

async function drag(target: Element, from: [number, number], to: [number, number]) {
  await fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], button: 0 });
  await fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1] });
  await fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1] });
}

const typeIn = async (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

describe('AN27 Turn about a chosen point', () => {
  it('AN27 Turn about X / Y are typed in % of the box beside the rotation; Centre puts it back', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 100, y: 100, width: 100, height: 50 });
    await tick();
    s.anim.setProperties({ rotation: 90 });
    await tick();
    const before = toStage(s.objects()[0]!, { x: 0, y: 0 });
    await typeIn('Turn about X', '50');
    await typeIn('Turn about Y', '100');
    const o = s.objects()[0]!;
    expect(o.pivot).toEqual({ x: 0.5, y: 1 });
    // The object has not moved on the stage.
    const after = toStage(o, { x: 0, y: 0 });
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    await typeIn('Turn about X', '2000');
    expect(screen.getByRole('alert').textContent).toBe(
      'The point it turns about must be between −1000 % and 1000 % of its box.',
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Turn about the centre' }));
    expect(s.objects()[0]!.pivot).toBeUndefined();
    // Each change is one undo step.
    s.anim.undo();
    expect(s.objects()[0]!.pivot).toEqual({ x: 0.5, y: 1 });
  });

  it('AN27 the dot on the stage: dragged it moves the point (snapping to the box), the knob turns about it, double-click centres it', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 100, y: 100, width: 100, height: 50 });
    await tick();
    const dot = screen.getByLabelText('Turn about point');
    // Let go a little off the middle of the bottom edge: it snaps there.
    await drag(dot, [150, 125], [152, 148]);
    expect(s.objects()[0]!.pivot).toEqual({ x: 0.5, y: 1 });
    expect(s.objects()[0]).toMatchObject({ x: 100, y: 100 });
    // Not snapped: wherever it is let go, in % of the box.
    await drag(screen.getByLabelText('Turn about point'), [150, 150], [125, 135]);
    expect(s.objects()[0]!.pivot).toEqual({ x: 0.25, y: 0.7 });
    await drag(screen.getByLabelText('Turn about point'), [125, 135], [150, 151]);
    // The knob above the box turns it about the point: a quarter turn clockwise.
    await drag(screen.getByLabelText('Rotate'), [150, 78], [300, 150]);
    const turned = s.objects()[0]!;
    expect(turned.rotation).toBe(90);
    expect(pivotOnStage(turned)).toEqual({ x: 150, y: 150 });
    const corner = toStage(turned, { x: 0, y: 0 });
    await fireEvent.dblClick(screen.getByLabelText('Turn about point'));
    const centred = s.objects()[0]!;
    expect(centred.pivot).toBeUndefined();
    expect(toStage(centred, { x: 0, y: 0 }).x).toBeCloseTo(corner.x);
    expect(toStage(centred, { x: 0, y: 0 }).y).toBeCloseTo(corner.y);
  });

  it('AN27 a double-click on the dot of text turning about its centre still edits its words', async () => {
    const s = await mode();
    s.anim.addText({ x: 100, y: 100 }, 'Needle');
    await tick();
    const before = animUi.focusText;
    const dot = screen.getByLabelText('Turn about point');
    await fireEvent.dblClick(dot, { clientX: 130, clientY: 115 });
    expect(animUi.focusText).toBe(before + 1);
    expect(s.objects()[0]!.pivot).toBeUndefined();
  });
});
