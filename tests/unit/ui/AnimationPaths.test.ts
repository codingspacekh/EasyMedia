// M15 / AN3, AN10–AN12 in the UI: editing a pen path's points and curves on the stage; Follow
// path and Morph into… in the Properties panel; Mask on a layer; the path on the timeline.
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import App from '../../../src/ui/App.svelte';
import { anchorsOnStage } from '../../../src/core/animation/pen.ts';
import { trackOf } from '../../../src/core/animation/tween.ts';
import type { AnimObject, PathObject } from '../../../src/core/animation/types.ts';
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
  return { ...t, anim, objects, stage: () => screen.getByRole('application', { name: 'Stage' }) };
}

async function drag(target: Element, from: [number, number], to: [number, number], init = {}) {
  await fireEvent.pointerDown(target, { clientX: from[0], clientY: from[1], button: 0, ...init });
  await fireEvent.pointerMove(window, { clientX: to[0], clientY: to[1], ...init });
  await fireEvent.pointerUp(window, { clientX: to[0], clientY: to[1], ...init });
}

const anchors = (o: AnimObject) =>
  anchorsOnStage(o as PathObject).map((a) => [Math.round(a.x), Math.round(a.y)]);

describe('editing a pen path on the stage (AN3)', () => {
  async function zigzag() {
    const s = await mode();
    s.anim.addPath(
      [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 100 },
      ],
      false,
    );
    await tick();
    return s;
  }

  it('the points show on the selected path; dragging one moves it', async () => {
    const s = await zigzag();
    expect(screen.getByLabelText('Point 1')).toBeTruthy();
    // Its points, not the box's handles, which would sit on top of them.
    expect(screen.queryByLabelText('Resize se')).toBeNull();
    await drag(screen.getByLabelText('Point 2'), [200, 200], [200, 300]);
    expect(anchors(s.objects()[0]!)).toEqual([
      [100, 100],
      [200, 300],
      [300, 100],
    ]);
  });

  it('Alt-drag pulls out curve handles; a handle can then be dragged; Alt-click makes a corner again', async () => {
    const s = await zigzag();
    await drag(screen.getByLabelText('Point 2'), [200, 200], [250, 200], { altKey: true });
    const curved = (s.objects()[0] as PathObject).points[1]!;
    expect(curved.out).toBeDefined();
    expect(curved.in).toBeDefined();
    const handles = screen.getAllByLabelText('Curve handle');
    expect(handles).toHaveLength(2);
    await drag(handles[1]!, [250, 200], [250, 150]);
    expect(anchorsOnStage(s.objects()[0] as PathObject)[1]!.out).toEqual({ x: 250, y: 150 });
    await fireEvent.pointerDown(screen.getByLabelText('Point 2'), {
      clientX: 200,
      clientY: 200,
      button: 0,
      altKey: true,
    });
    await fireEvent.pointerUp(window, { clientX: 200, clientY: 200, altKey: true });
    expect((s.objects()[0] as PathObject).points[1]!.out).toBeUndefined();
  });

  it('double-clicking a point removes it; double-clicking the line adds one there', async () => {
    const s = await zigzag();
    await fireEvent.dblClick(screen.getByLabelText('Point 2'));
    expect(anchors(s.objects()[0]!)).toEqual([
      [100, 100],
      [300, 100],
    ]);
    await fireEvent.dblClick(s.stage(), { clientX: 200, clientY: 101 });
    expect(anchors(s.objects()[0]!)).toEqual([
      [100, 100],
      [200, 100],
      [300, 100],
    ]);
  });

  it('shapes that are not pen paths show no points', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 0, y: 0, width: 100, height: 100 });
    await tick();
    expect(screen.queryByLabelText('Point 1')).toBeNull();
    expect(screen.getByLabelText('Resize se')).toBeTruthy();
  });
});

describe('Follow path and Morph into… in the Properties panel', () => {
  it('Task 5: the car follows the road; its frames and Orient to path are set; Remove path', async () => {
    const s = await mode();
    s.anim.addPath(
      [
        { x: 0, y: 500 },
        { x: 600, y: 450 },
        { x: 1240, y: 500 },
      ],
      false,
    );
    const road = s.objects().at(-1)!;
    s.anim.addShape('rect', { x: 0, y: 0, width: 80, height: 30 });
    const car = s.objects().at(-1)!;
    await tick();
    await fireEvent.change(screen.getByLabelText('Follow path'), { target: { value: road.id } });
    expect(s.objects().at(-1)!.paths![0]).toMatchObject({ from: 0, to: 120 });
    await fireEvent.change(screen.getByLabelText('Path 1 from frame', { exact: true }), {
      target: { value: '24' },
    });
    await fireEvent.change(screen.getByLabelText('Path 1 to frame', { exact: true }), {
      target: { value: '144' },
    });
    await fireEvent.click(screen.getByLabelText('Orient to path 1'));
    expect(s.objects().at(-1)!.paths![0]).toMatchObject({ from: 24, to: 144, orient: true });
    const tl = within(screen.getByRole('region', { name: 'Timeline' }));
    expect(tl.getByLabelText('Path from frame 24 to 144')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove path 1' }));
    expect(s.objects().find((o) => o.id === car.id)!.paths).toBeUndefined();
  });

  it('Morph into… at the playhead: the circle becomes the square, which is removed', async () => {
    const s = await mode();
    s.anim.addShape('rect', { x: 300, y: 0, width: 100, height: 100 });
    const square = s.objects().at(-1)!;
    s.anim.addShape('ellipse', { x: 0, y: 0, width: 100, height: 100 });
    const circle = s.objects().at(-1)!;
    s.anim.setFrame(24);
    await tick();
    await fireEvent.change(screen.getByLabelText('Morph into'), { target: { value: square.id } });
    expect(s.objects().map((o) => o.id)).toEqual([circle.id]);
    expect(trackOf(s.objects()[0]!, 'shape')!.keyframes.map((k) => k.frame)).toEqual([0, 24]);
  });
});

describe('Mask on a layer (AN12)', () => {
  it('the Layers panel makes a layer a mask and back', async () => {
    const s = await mode();
    s.anim.addLayer();
    await tick();
    const button = screen.getByRole('button', { name: 'Mask Layer 2' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(button);
    expect(s.anim.store.get().history.present.layers[1]!.mask).toBe(true);
    expect(screen.getByRole('button', { name: 'Mask Layer 2' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });
});
