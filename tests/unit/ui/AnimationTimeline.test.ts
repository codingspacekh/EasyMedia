// M14 / AN8, AN9: the timeline under the stage — frames numbered every 5 with the seconds, the
// playhead (dragged or typed), keyframe dots made by editing at the playhead, play / loop, and
// a selected keyframe's easing, hold, repeat, move, copy and delete.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import App from '../../../src/ui/App.svelte';
import { trackOf } from '../../../src/core/animation/tween.ts';
import type { AnimObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

async function withCircle() {
  const t = testApp();
  render(App, { props: { app: t.app } });
  await fireEvent.click(
    within(screen.getByRole('navigation', { name: 'Mode' })).getByRole('button', {
      name: 'Animation',
    }),
  );
  const anim = t.app.animation;
  anim.addShape('ellipse', { x: 0, y: 0, width: 204, height: 204 });
  await Promise.resolve();
  return {
    ...t,
    anim,
    state: () => anim.store.get(),
    objects: (): AnimObject[] => anim.store.get().history.present.layers.flatMap((l) => l.objects),
    timeline: () => screen.getByRole('region', { name: 'Timeline' }),
  };
}

const typeIn = async (label: string, value: string) => {
  await fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
};

const PX = 8; // a frame's width at the default frame zoom
const PAD = 12; // the room before frame 0

afterEach(() => vi.useRealTimers());

describe('the timeline (AN8)', () => {
  it('numbers the frames every 5 and shows the seconds under them', async () => {
    const s = await withCircle();
    const ruler = within(s.timeline()).getByRole('slider', { name: 'Playhead' });
    for (const n of ['0', '5', '10', '25', '120']) expect(within(ruler).getByText(n)).toBeTruthy();
    expect(within(ruler).queryByText('7')).toBeNull();
    for (const t of ['1 s', '2 s', '5 s']) expect(within(ruler).getByText(t)).toBeTruthy();
    expect(within(s.timeline()).getByText('0:00.00 · frame 0')).toBeTruthy();
  });

  it('dragging the playhead to frame 36 shows the circle halfway; typing 3 s goes to frame 72', async () => {
    const s = await withCircle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    const ruler = within(s.timeline()).getByRole('slider', { name: 'Playhead' });
    await fireEvent.pointerDown(ruler, { clientX: PAD + 10 * PX, button: 0 });
    await fireEvent.pointerMove(window, { clientX: PAD + 36 * PX });
    await fireEvent.pointerUp(window, { clientX: PAD + 36 * PX });
    expect(s.state().frame).toBe(36);
    expect((screen.getByLabelText('X', { exact: true }) as HTMLInputElement).value).toBe('198.00');
    expect(within(s.timeline()).getByText('0:01.50 · frame 36')).toBeTruthy();
    await typeIn('Go to frame', '3 s');
    expect(s.state().frame).toBe(72);
    await typeIn('Go to frame', 'soon');
    expect(within(s.timeline()).getByRole('alert').textContent).toMatch(/frame number/);
  });

  it('the arrow-key slider and the step buttons move one frame; Stop goes back to 0', async () => {
    const s = await withCircle();
    const ruler = within(s.timeline()).getByRole('slider', { name: 'Playhead' });
    expect(ruler.getAttribute('aria-valuemax')).toBe('120');
    await fireEvent.keyDown(ruler, { key: 'ArrowRight' });
    expect(s.state().frame).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Next frame' }));
    expect(s.state().frame).toBe(2);
    await fireEvent.click(screen.getByRole('button', { name: 'Previous frame' }));
    expect(s.state().frame).toBe(1);
    await fireEvent.keyDown(window, { key: '.' });
    expect(s.state().frame).toBe(2);
    await fireEvent.keyDown(window, { key: ',' });
    expect(s.state().frame).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(s.state().frame).toBe(0);
  });
});

describe('keyframes on the timeline (AN9)', () => {
  it('changing X at frame 72 adds a keyframe dot on the X row, and one at frame 0', async () => {
    const s = await withCircle();
    s.anim.setFrame(72);
    await Promise.resolve();
    await typeIn('X', '396');
    const tl = within(s.timeline());
    expect(tl.getByRole('button', { name: 'X keyframe at frame 72' })).toBeTruthy();
    expect(tl.getByRole('button', { name: 'X keyframe at frame 0' })).toBeTruthy();
    expect(tl.getByText('Ellipse')).toBeTruthy();
  });

  it('a selected keyframe can be eased, held, repeated, reversed and deleted', async () => {
    const s = await withCircle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    await Promise.resolve();
    const x = () => trackOf(s.objects()[0]!, 'x')!;
    await fireEvent.click(screen.getByRole('button', { name: 'X keyframe at frame 0' }));
    await fireEvent.change(screen.getByLabelText('Easing'), { target: { value: 'bounce' } });
    expect(x().keyframes[0]!.easing).toBe('bounce');
    await fireEvent.click(screen.getByLabelText('Hold'));
    expect(x().keyframes[0]!.hold).toBe(true);
    await fireEvent.click(screen.getByLabelText('Hold'));
    await fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'end' } });
    expect(x().repeat).toBe('end');
    await fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: '' } });
    expect(x().repeat).toBeUndefined();
    await fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(x().keyframes.map((k) => k.frame)).toEqual([0, 72, 144]);
    await fireEvent.click(screen.getByRole('button', { name: 'X keyframe at frame 144' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Delete keyframe' }));
    expect(x().keyframes.map((k) => k.frame)).toEqual([0, 72]);
  });

  it('a dot dragged moves its keyframe; Alt-drag copies it', async () => {
    const s = await withCircle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    await Promise.resolve();
    const x = () => trackOf(s.objects()[0]!, 'x')!.keyframes.map((k) => k.frame);
    const dot = screen.getByRole('button', { name: 'X keyframe at frame 72' });
    await fireEvent.pointerDown(dot, { clientX: 72 * PX, button: 0 });
    await fireEvent.pointerMove(window, { clientX: 48 * PX });
    await fireEvent.pointerUp(window, { clientX: 48 * PX });
    expect(x()).toEqual([0, 48]);
    const moved = screen.getByRole('button', { name: 'X keyframe at frame 48' });
    await fireEvent.pointerDown(moved, { clientX: 48 * PX, button: 0, altKey: true });
    await fireEvent.pointerMove(window, { clientX: 96 * PX });
    await fireEvent.pointerUp(window, { clientX: 96 * PX, altKey: true });
    expect(x()).toEqual([0, 48, 96]);
  });

  it('Insert keyframe fixes every property of the selection at the playhead', async () => {
    const s = await withCircle();
    s.anim.setFrame(24);
    await Promise.resolve();
    await fireEvent.click(screen.getByRole('button', { name: 'Insert keyframe' }));
    expect(s.objects()[0]!.tracks!.length).toBeGreaterThanOrEqual(6);
    expect(
      within(s.timeline()).getByRole('button', { name: 'Opacity keyframe at frame 24' }),
    ).toBeTruthy();
  });
});

describe('play and loop (AN8)', () => {
  it('Space plays and the playhead advances; Space again pauses', async () => {
    vi.useFakeTimers();
    const s = await withCircle();
    await fireEvent.keyDown(window, { key: ' ' });
    expect(s.state().playing).toBe(true);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeTruthy();
    vi.advanceTimersByTime(1000);
    expect(s.state().frame).toBe(24);
    await fireEvent.keyDown(window, { key: ' ' });
    expect(s.state().playing).toBe(false);
    s.anim.dispose();
  });

  it('Loop keeps it playing past the end; a range can be typed', async () => {
    vi.useFakeTimers();
    const s = await withCircle();
    await fireEvent.click(screen.getByRole('button', { name: 'Loop' }));
    expect(screen.getByRole('button', { name: 'Loop' }).getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    vi.advanceTimersByTime(5500);
    expect(s.state()).toMatchObject({ playing: true, frame: 12 });
    await typeIn('Loop from', '24');
    await typeIn('Loop to', '47');
    expect(s.state().loop).toEqual({ on: true, from: 24, to: 47 });
    await typeIn('Loop to', '10');
    expect(within(s.timeline()).getByRole('alert').textContent).toMatch(/before/);
    s.anim.dispose();
  });
});
