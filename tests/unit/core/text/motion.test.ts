import { describe, expect, it } from 'vitest';
import { textMotion } from '../../../../src/core/text/motion.ts';

const FRAME = { width: 1920, height: 1080 };

describe('textMotion: how a text layer looks at a moment (same rules as the export)', () => {
  it('is fully shown and in place with no effects', () => {
    expect(textMotion({}, 1, 4, FRAME)).toEqual({ opacity: 1, x: 0, y: 0 });
  });

  it('fades in and out linearly', () => {
    const fx = { fadeIn: 0.5, fadeOut: 1 };
    expect(textMotion(fx, 0, 4, FRAME).opacity).toBe(0);
    expect(textMotion(fx, 0.25, 4, FRAME).opacity).toBe(0.5);
    expect(textMotion(fx, 2, 4, FRAME).opacity).toBe(1);
    expect(textMotion(fx, 3.75, 4, FRAME).opacity).toBe(0.25);
  });

  it('flies in from each side during the first second', () => {
    expect(textMotion({ entrance: 'fly-left' }, 0.25, 4, FRAME)).toMatchObject({ x: -1440, y: 0 });
    expect(textMotion({ entrance: 'fly-right' }, 0.5, 4, FRAME)).toMatchObject({ x: 960, y: 0 });
    expect(textMotion({ entrance: 'fly-up' }, 0.5, 4, FRAME)).toMatchObject({ x: 0, y: 540 });
    expect(textMotion({ entrance: 'fly-down' }, 0.75, 4, FRAME)).toMatchObject({ x: 0, y: -270 });
    expect(textMotion({ entrance: 'fly-left' }, 1, 4, FRAME)).toMatchObject({ x: 0, y: 0 });
  });

  it('scrolls a credits block from below the frame to above it', () => {
    const block = { creditsHeight: 200 };
    expect(textMotion({}, 0, 4, FRAME, block).y).toBe(1080);
    expect(textMotion({}, 2, 4, FRAME, block).y).toBe(440);
    expect(textMotion({}, 4, 4, FRAME, block).y).toBe(-200);
  });
});
