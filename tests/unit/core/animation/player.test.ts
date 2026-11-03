// AN15, AN18: the HTML web animation's player — the frame at a time on the page's clock, looping
// at the end, paused and continued, restarted and sent to a frame (the buttons' actions).
import { describe, expect, it } from 'vitest';
import { createAnimation } from '../../../../src/core/animation/factory.ts';
import { createPlayer } from '../../../../src/core/animation/player.ts';

/** 600 × 400, 24 fps, 3 s: frames 0–71 (workbook Task 1). */
const task1 = () => {
  const doc = createAnimation({ name: 'Task 1' });
  return { ...doc, stage: { ...doc.stage, width: 600, height: 400, fps: 24, length: 72 } };
};

/** The page's clock in ms at a frame of a 24 fps animation started at 1000 ms. */
const at = (frame: number) => 1000 + (frame * 1000) / 24;

describe('the HTML player (AN15)', () => {
  it('plays from frame 0 at the stage frame rate: 1.5 s in is frame 36', () => {
    const p = createPlayer(task1(), 1000);
    expect(p.frameAt(1000)).toBe(0);
    expect(p.frameAt(at(36))).toBe(36);
    expect(p.frameAt(at(36) + 20)).toBe(36);
    expect(p.state()).toEqual({ frame: 36, playing: true });
  });

  it('loops: after frame 71 comes frame 0 again', () => {
    const p = createPlayer(task1(), 1000);
    expect(p.frameAt(at(71))).toBe(71);
    expect(p.frameAt(at(72))).toBe(0);
    expect(p.frameAt(at(72 + 36))).toBe(36);
  });

  it('pause keeps the frame; continue goes on from it, not from where the clock is', () => {
    const p = createPlayer(task1(), 1000);
    p.pause(at(10));
    expect(p.frameAt(at(50))).toBe(10);
    expect(p.state()).toEqual({ frame: 10, playing: false });
    p.resume(at(50));
    expect(p.frameAt(at(50))).toBe(10);
    expect(p.frameAt(at(55))).toBe(15);
    expect(p.state().playing).toBe(true);
  });

  it('pausing twice or continuing while playing changes nothing', () => {
    const p = createPlayer(task1(), 1000);
    p.pause(at(10));
    p.pause(at(20));
    expect(p.frameAt(at(30))).toBe(10);
    p.resume(at(30));
    p.resume(at(40));
    expect(p.frameAt(at(40))).toBe(20);
  });

  it('restart plays from frame 0; go to frame jumps there and keeps playing or paused', () => {
    const p = createPlayer(task1(), 1000);
    p.restart(at(40));
    expect(p.frameAt(at(40))).toBe(0);
    p.goTo(60, at(50));
    expect(p.frameAt(at(52))).toBe(62);
    p.pause(at(52));
    p.goTo(5, at(60));
    expect(p.frameAt(at(70))).toBe(5);
    p.goTo(500, at(70));
    expect(p.frameAt(at(70))).toBe(71);
    p.goTo(-3, at(70));
    expect(p.frameAt(at(70))).toBe(0);
  });

  it('a clock running backwards (a changed computer clock) still gives a frame in range', () => {
    const p = createPlayer(task1(), 1000);
    expect(p.frameAt(0)).toBe(0);
  });
});
