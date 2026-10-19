import { describe, expect, it } from 'vitest';
import {
  ENTRANCES,
  EXITS,
  motionExpressions,
  textMotion,
} from '../../../../src/core/text/motion.ts';
import type { TextEffects } from '../../../../src/core/model/types.ts';

const FRAME = { width: 1920, height: 1080 };

describe('textMotion: how a text layer looks at a moment (same rules as the export)', () => {
  it('is fully shown and in place with no effects', () => {
    expect(textMotion({}, 1, 4, FRAME)).toEqual({ opacity: 1, x: 0, y: 0, scale: 1 });
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

  it('rise: comes up a little from below while it fades in', () => {
    const half = textMotion({ entrance: 'rise' }, 0.5, 4, FRAME);
    expect(half.opacity).toBe(0.5);
    expect(half.y).toBeCloseTo(108 * 0.125); // 10 % of the height × (1 − ease-out)
    expect(textMotion({ entrance: 'rise' }, 1, 4, FRAME)).toMatchObject({ opacity: 1, y: 0 });
  });

  it('drop: falls from above and bounces as it lands', () => {
    expect(textMotion({ entrance: 'drop' }, 0, 4, FRAME).y).toBe(-540);
    const heights = Array.from(
      { length: 36 },
      (_, i) => textMotion({ entrance: 'drop' }, 0.3 + i * 0.02, 4, FRAME).y,
    );
    expect(heights.some((y, i) => i > 0 && y < heights[i - 1]!)).toBe(true); // it goes up again
    expect(textMotion({ entrance: 'drop' }, 1, 4, FRAME).y).toBe(0);
  });

  it('zoom grows from nothing; pop grows a little too big and settles', () => {
    expect(textMotion({ entrance: 'zoom' }, 0, 4, FRAME).scale).toBe(0.01);
    expect(textMotion({ entrance: 'zoom' }, 0.5, 4, FRAME).scale).toBe(0.875);
    const pop = [0.4, 0.6, 0.8].map((t) => textMotion({ entrance: 'pop' }, t, 4, FRAME).scale);
    expect(Math.max(...pop)).toBeGreaterThan(1.05);
    expect(textMotion({ entrance: 'pop' }, 1, 4, FRAME).scale).toBe(1);
  });

  it('exits happen in the last second: fly out, sink and fade, zoom away', () => {
    expect(textMotion({ exit: 'fly-left' }, 3.5, 4, FRAME).x).toBe(-960);
    expect(textMotion({ exit: 'fly-up' }, 3.75, 4, FRAME).y).toBe(-810);
    expect(textMotion({ exit: 'sink' }, 3.5, 4, FRAME)).toMatchObject({ opacity: 0.5 });
    expect(textMotion({ exit: 'zoom' }, 3.5, 4, FRAME).scale).toBe(0.875);
    expect(textMotion({ exit: 'zoom' }, 2.9, 4, FRAME).scale).toBe(1);
  });

  it('every entrance and exit has a name for the menu', () => {
    expect(ENTRANCES.map(([id]) => id)).toEqual([
      'none',
      'fly-left',
      'fly-right',
      'fly-up',
      'fly-down',
      'rise',
      'drop',
      'zoom',
      'pop',
    ]);
    expect(EXITS.map(([id]) => id)).toEqual([
      'none',
      'fly-left',
      'fly-right',
      'fly-up',
      'fly-down',
      'sink',
      'zoom',
    ]);
  });
});

/** Evaluates an FFmpeg expression at time `t` (only the functions the export uses). */
function ffmpegAt(expression: string, t: number, size = { iw: 1920, ih: 1080 }): number {
  const fns = {
    if: (c: number, a: number, b = 0) => (c ? a : b),
    lt: (a: number, b: number) => (a < b ? 1 : 0),
    gte: (a: number, b: number) => (a >= b ? 1 : 0),
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
  };
  const js = expression.replace(/\bif\(/g, 'iff(').replace(/'/g, '');
  const run = new Function(
    'iff',
    'lt',
    'gte',
    'min',
    'max',
    'pow',
    't',
    'iw',
    'ih',
    `return ${js};`,
  );
  return run(fns.if, fns.lt, fns.gte, fns.min, fns.max, fns.pow, t, size.iw, size.ih) as number;
}

describe('the export moves text exactly as the preview does', () => {
  const ANCHOR = { x: 400, y: 900 };
  const cases: TextEffects[] = [
    ...ENTRANCES.map(([entrance]) => ({ entrance })),
    ...EXITS.map(([exit]) => ({ exit })),
    { entrance: 'pop', exit: 'zoom' },
    { entrance: 'drop', exit: 'sink' },
  ];

  it.each(cases.map((c) => [JSON.stringify(c), c] as const))('%s', (_, effects) => {
    const start = 2;
    const duration = 3;
    const ex = motionExpressions(effects, start, duration, FRAME, ANCHOR);
    for (let local = 0; local <= duration; local += 0.05) {
      const t = start + local;
      const m = textMotion(effects, local, duration, FRAME);
      const scale = ex.scale ? ffmpegAt(ex.scale, t) : 1;
      expect(scale).toBeCloseTo(m.scale, 6);
      // Where the scaled full-frame image is laid: the anchor stays put, plus the move.
      expect(ffmpegAt(ex.x, t)).toBeCloseTo(ANCHOR.x * (1 - m.scale) + m.x, 4);
      expect(ffmpegAt(ex.y, t)).toBeCloseTo(ANCHOR.y * (1 - m.scale) + m.y, 4);
    }
  });

  it('nothing moves without an entrance or exit: no scaling at all', () => {
    expect(motionExpressions({}, 0, 4, FRAME, ANCHOR)).toEqual({
      x: '0',
      y: '0',
      scale: null,
      fadeIn: false,
      fadeOut: false,
    });
  });

  it('rise and sink fade the words with their move', () => {
    expect(
      motionExpressions({ entrance: 'rise', exit: 'sink' }, 0, 4, FRAME, ANCHOR),
    ).toMatchObject({ fadeIn: true, fadeOut: true });
  });
});
