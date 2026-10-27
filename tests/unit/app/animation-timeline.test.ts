// M14 / AN8, AN9, AN13: the playhead, play / pause / stop / step, loop, and keyframes made by
// editing at the playhead. Every keyframe change is one undo step.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { objectAt, trackOf } from '../../../src/core/animation/tween.ts';
import type { AnimObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const objects = (): AnimObject[] => doc().layers.flatMap((l) => l.objects);
  const circle = () => {
    anim.addShape('ellipse', { x: 0, y: 0, width: 204, height: 204 });
    return objects().at(-1)!;
  };
  return { ...t, anim, doc, objects, circle, state: () => anim.store.get() };
}

describe('the playhead (AN8)', () => {
  it('starts at frame 0 and goes from 0 to the end of the animation', () => {
    const s = setup();
    expect(s.state().frame).toBe(0);
    s.anim.setFrame(72);
    expect(s.state().frame).toBe(72);
    s.anim.setFrame(500);
    expect(s.state().frame).toBe(120);
    s.anim.setFrame(-4);
    expect(s.state().frame).toBe(0);
    s.anim.step(1);
    s.anim.step(1);
    expect(s.state().frame).toBe(2);
    s.anim.step(-5);
    expect(s.state().frame).toBe(0);
  });

  it('a typed frame, seconds or clock time moves it; anything else is refused', () => {
    const s = setup();
    expect(s.anim.goTo('3 s')).toBeNull();
    expect(s.state().frame).toBe(72);
    expect(s.anim.goTo('0:01.50')).toBeNull();
    expect(s.state().frame).toBe(36);
    expect(s.anim.goTo('soon')).toMatch(/frame number/);
    expect(s.state().frame).toBe(36);
  });

  it('moving the playhead is not an edit', () => {
    const s = setup();
    s.anim.setFrame(10);
    expect(s.anim.isDirty()).toBe(false);
    expect(s.state().history.past).toHaveLength(0);
  });
});

describe('play, pause, stop and loop (AN8)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays at the frame rate and stops at the end', () => {
    const s = setup();
    s.anim.play();
    expect(s.state().playing).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(s.state().frame).toBe(24);
    vi.advanceTimersByTime(10_000);
    expect(s.state().frame).toBe(120);
    expect(s.state().playing).toBe(false);
    s.anim.dispose();
  });

  it('play from the end starts again from the beginning; pause keeps the frame; stop goes back to 0', () => {
    const s = setup();
    s.anim.setFrame(120);
    s.anim.play();
    vi.advanceTimersByTime(500);
    expect(s.state().frame).toBe(12);
    s.anim.pause();
    vi.advanceTimersByTime(1000);
    expect(s.state()).toMatchObject({ frame: 12, playing: false });
    s.anim.togglePlay();
    expect(s.state().playing).toBe(true);
    s.anim.stop();
    expect(s.state()).toMatchObject({ frame: 0, playing: false });
    s.anim.dispose();
  });

  it('Loop keeps it playing past the end, without showing the end frame twice', () => {
    const s = setup();
    s.anim.setLoop({ on: true });
    s.anim.play();
    vi.advanceTimersByTime(5000 + 500);
    expect(s.state().playing).toBe(true);
    expect(s.state().frame).toBe(12);
    s.anim.dispose();
  });

  it('a loop range plays only those frames, both ends included', () => {
    const s = setup();
    expect(s.anim.setLoop({ on: true, from: 24, to: 47 })).toBeNull();
    s.anim.play();
    expect(s.state().frame).toBe(24);
    vi.advanceTimersByTime(1000);
    expect(s.state().frame).toBe(24);
    vi.advanceTimersByTime(500);
    expect(s.state().frame).toBe(36);
    expect(s.anim.setLoop({ on: true, from: 50, to: 10 })).toMatch(/before/);
    s.anim.dispose();
  });

  it('an edit while playing pauses first, so the keyframe goes where the student sees it', () => {
    const s = setup();
    s.circle();
    s.anim.play();
    vi.advanceTimersByTime(1500);
    s.anim.setProperties({ x: 300 });
    expect(s.state().playing).toBe(false);
    expect(trackOf(s.objects()[0]!, 'x')!.keyframes.map((k) => k.frame)).toEqual([0, 36]);
    s.anim.dispose();
  });
});

describe('keyframes by editing at the playhead (AN9)', () => {
  it('Task 1: the circle moved at frame 72 is halfway at frame 36; undo takes the keyframe away', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(72);
    expect(s.anim.setProperties({ x: 396, y: 196 })).toBeNull();
    const moved = s.objects()[0]!;
    expect(objectAt(moved, 36)).toMatchObject({ x: 198, y: 98 });
    expect(s.anim.objectAtPlayhead(circle.id)).toMatchObject({ x: 396, y: 196 });
    s.anim.setFrame(36);
    expect(s.anim.objectAtPlayhead(circle.id)).toMatchObject({ x: 198, y: 98 });
    expect(s.state().history.past.at(-1)).toBeDefined();
    s.anim.undo();
    expect(s.objects()[0]!.tracks).toBeUndefined();
  });

  it('dragging, nudging, resizing and turning at a frame make keyframes there', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(24);
    s.anim.moveSelection(100, 0);
    s.anim.nudge(0, 10);
    s.anim.rotateSelected(circle.id, 90);
    s.anim.resizeSelected(circle.id, 'se', { x: 100 + 102 + 51, y: 10 + 102 + 51 }, false);
    const o = s.objects()[0]!;
    expect(o.tracks!.map((t) => t.property).sort()).toEqual([
      'height',
      'rotation',
      'width',
      'x',
      'y',
    ]);
    expect(o).toMatchObject({ x: 0, y: 0, rotation: 0, width: 204 });
    expect(s.anim.objectAtPlayhead(circle.id)!.rotation).toBe(90);
  });

  it('at frame 0 an object that does not move is simply changed', () => {
    const s = setup();
    s.circle();
    s.anim.moveSelection(5, 5);
    expect(s.objects()[0]).toMatchObject({ x: 5, y: 5 });
    expect(s.objects()[0]!.tracks).toBeUndefined();
  });

  it('Insert keyframe fixes one property or everything at the playhead', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    s.anim.setFrame(36);
    s.anim.insertKeyframe(circle.id, 'x');
    expect(trackOf(s.objects()[0]!, 'x')!.keyframes.map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [36, 198],
      [72, 396],
    ]);
    s.anim.insertKeyframe(circle.id, 'all');
    const props = s
      .objects()[0]!
      .tracks!.map((t) => t.property)
      .sort();
    expect(props).toEqual(
      [
        'fillColour',
        'height',
        'opacity',
        'rotation',
        'strokeColour',
        'strokeWidth',
        'width',
        'x',
        'y',
      ].sort(),
    );
  });

  it('keyframes can be moved, copied, deleted, eased, held, repeated and reversed', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    const keys = () => trackOf(s.objects()[0]!, 'x')!.keyframes;
    s.anim.moveKeyframe(circle.id, 'x', 72, 48);
    expect(keys().map((k) => k.frame)).toEqual([0, 48]);
    s.anim.copyKeyframe(circle.id, 'x', 0, 96);
    expect(keys().map((k) => [k.frame, k.value])).toEqual([
      [0, 0],
      [48, 396],
      [96, 0],
    ]);
    s.anim.removeKeyframe(circle.id, 'x', 96);
    s.anim.setEasing(circle.id, 'x', 0, 'bounce');
    expect(keys()[0]!.easing).toBe('bounce');
    s.anim.setHold(circle.id, 'x', 0, true);
    expect(keys()[0]!.hold).toBe(true);
    s.anim.setRepeat(circle.id, 'x', 'end');
    expect(trackOf(s.objects()[0]!, 'x')!.repeat).toBe('end');
    s.anim.setRepeat(circle.id, 'x', undefined);
    s.anim.setHold(circle.id, 'x', 0, false);
    s.anim.reverse(circle.id, 'x');
    expect(keys().map((k) => k.frame)).toEqual([0, 48, 96]);
    expect(
      s
        .state()
        .history.past.map((c) => c.label)
        .slice(-3),
    ).toEqual(['Repeat', 'Hold', 'Reverse']);
  });

  it('a keyframe that is not there, or a frame before 0, gives a message', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.removeKeyframe(circle.id, 'x', 10);
    expect(s.state().message?.text).toMatch(/no keyframe/i);
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    s.anim.moveKeyframe(circle.id, 'x', 72, -1);
    expect(s.state().message?.text).toMatch(/before frame 0/);
  });

  it('Reverse on every animated property of the selection lengthens nothing but the keyframes', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396, opacity: 50 });
    s.anim.reverse(circle.id, 'all');
    for (const p of ['x', 'opacity'] as const)
      expect(trackOf(s.objects()[0]!, p)!.keyframes.map((k) => k.frame)).toEqual([0, 72, 144]);
  });
});

describe('length and frame rate (AN8)', () => {
  it('the length is set in frames or seconds; the playhead stays inside it', () => {
    const s = setup();
    s.anim.setFrame(100);
    expect(s.anim.setLength('3 s')).toBeNull();
    expect(s.doc().stage.length).toBe(72);
    expect(s.state().frame).toBe(72);
    expect(s.anim.setLength('0')).toMatch(/at least 1 frame/);
    expect(s.anim.setLength('later')).toMatch(/frame number/);
  });

  it('a new frame rate keeps keyframes at the same times, or at the same frames, as chosen', () => {
    const s = setup();
    const circle = s.circle();
    s.anim.setFrame(72);
    s.anim.setProperties({ x: 396 });
    expect(s.anim.setFps(30, 'times')).toBeNull();
    expect(trackOf(s.objects()[0]!, 'x')!.keyframes.map((k) => k.frame)).toEqual([0, 90]);
    expect(s.state().frame).toBe(90);
    s.anim.undo();
    expect(s.anim.setFps(30, 'frames')).toBeNull();
    expect(trackOf(s.objects()[0]!, 'x')!.keyframes.map((k) => k.frame)).toEqual([0, 72]);
    void circle;
  });
});
