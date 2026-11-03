// AN17: the frame-rate demonstration — the same motion at 5, 12 and 24 fps: the ball moves evenly
// but is drawn again only at each new frame, so 5 fps jumps in big steps and 24 fps glides.
import { describe, expect, it } from 'vitest';
import {
  DEMO_RATES,
  DEMO_SECONDS,
  demoFrames,
  demoPosition,
} from '../../../../src/core/teaching/animation.ts';

describe('the frame-rate demonstration (AN17)', () => {
  it('shows 5, 12 and 24 fps side by side, each crossing in the same 2 seconds', () => {
    expect(DEMO_RATES).toEqual([5, 12, 24]);
    expect(DEMO_SECONDS).toBe(2);
    expect(DEMO_RATES.map(demoFrames)).toEqual([10, 24, 48]);
  });

  it('holds each frame until the next: at 5 fps the ball stays put for a fifth of a second', () => {
    expect(demoPosition(5, 0)).toBe(0);
    expect(demoPosition(5, 0.19)).toBe(0);
    expect(demoPosition(5, 0.2)).toBeCloseTo(0.1);
    expect(demoPosition(24, 0.19)).toBeCloseTo(4 / 48);
  });

  it('all rates are at the same place at the start of each frame they share, and loop', () => {
    expect(demoPosition(5, 1)).toBeCloseTo(0.5);
    expect(demoPosition(12, 1)).toBeCloseTo(0.5);
    expect(demoPosition(24, 1)).toBeCloseTo(0.5);
    expect(demoPosition(24, 2)).toBe(0);
    expect(demoPosition(24, 2.5)).toBeCloseTo(demoPosition(24, 0.5));
    expect(demoPosition(24, -0.5)).toBeCloseTo(demoPosition(24, 1.5));
  });

  it('the distinct places in one crossing are the frames: fewer at a low rate', () => {
    const places = (fps: number) =>
      new Set(Array.from({ length: 2000 }, (_, i) => demoPosition(fps, i / 1000))).size;
    expect(places(5)).toBe(10);
    expect(places(12)).toBe(24);
    expect(places(24)).toBe(48);
  });
});
