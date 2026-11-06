import { describe, expect, it } from 'vitest';
import {
  ENTRANCES,
  EXITS,
  motionExpressions,
  motionWindow,
  revealEdge,
  textMotion,
} from '../../../../src/core/text/motion.ts';
import type { TextEffects } from '../../../../src/core/model/types.ts';

const FRAME = { width: 1920, height: 1080 };

describe('textMotion: how a text layer looks at a moment (same rules as the export)', () => {
  it('is fully shown and in place with no effects', () => {
    expect(textMotion({}, 1, 4, FRAME)).toEqual({
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotate: 0,
      reveal: 1,
    });
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
      'slam',
      'type-on',
      'spin',
      'whip',
    ]);
    expect(EXITS.map(([id]) => id)).toEqual([
      'none',
      'fly-left',
      'fly-right',
      'fly-up',
      'fly-down',
      'sink',
      'zoom',
      'pop',
      'spin',
      'whip',
    ]);
  });

  it('V7 title presets: slam comes down from 3× size, fading in, then shakes as it lands', () => {
    const at = (t: number) => textMotion({ entrance: 'slam' }, t, 4, FRAME);
    expect(at(0)).toMatchObject({ scale: 3, opacity: 0 });
    expect(at(0.25)).toMatchObject({ scale: 2.5, opacity: 0.5 });
    expect(at(0.5)).toMatchObject({ scale: 1, opacity: 1, x: 0 });
    const shake = [0.55, 0.6, 0.65, 0.7, 0.75].map((t) => at(t).x);
    expect(Math.max(...shake)).toBeGreaterThan(5);
    expect(Math.min(...shake)).toBeLessThan(-5);
    expect(Math.max(...shake.map(Math.abs))).toBeLessThanOrEqual(0.02 * 1080);
    expect(at(1)).toMatchObject({ scale: 1, opacity: 1, x: 0, y: 0 });
  });

  it('V7 title presets: type on shows the words from the left, a little more each moment', () => {
    expect(textMotion({ entrance: 'type-on' }, 0, 4, FRAME).reveal).toBe(0);
    expect(textMotion({ entrance: 'type-on' }, 0.5, 4, FRAME).reveal).toBe(0.5);
    expect(textMotion({ entrance: 'type-on' }, 1, 4, FRAME).reveal).toBe(1);
    // The edge runs from just before the words to just after them; at the end nothing is hidden.
    const words = { x: 500, y: 400, width: 600, height: 100 };
    const margin = 0.02 * 1920;
    expect(revealEdge(0, words, FRAME, null)).toBeCloseTo(500 - margin);
    expect(revealEdge(0.5, words, FRAME, null)).toBeCloseTo(800);
    expect(revealEdge(1, words, FRAME, null)).toBe(1920);
  });

  it('V7 title presets: spin turns once while it grows; whip shoots in from the right and overshoots', () => {
    expect(textMotion({ entrance: 'spin' }, 0, 4, FRAME)).toMatchObject({
      rotate: -2 * Math.PI,
      scale: 0.01,
    });
    expect(textMotion({ entrance: 'spin' }, 1, 4, FRAME)).toMatchObject({ rotate: 0, scale: 1 });
    expect(textMotion({ entrance: 'whip' }, 0, 4, FRAME).x).toBeCloseTo(1920, 6);
    const whip = [0.3, 0.4, 0.5].map((t) => textMotion({ entrance: 'whip' }, t, 4, FRAME).x);
    expect(Math.min(...whip)).toBeLessThan(-20); // past its place, then back
    expect(textMotion({ entrance: 'whip' }, 0.6, 4, FRAME).x).toBe(0);
  });

  it('V7 title presets: exits pop (grow, then shrink to nothing), spin away and whip off', () => {
    const pop = [3.1, 3.2, 3.3].map((t) => textMotion({ exit: 'pop' }, t, 4, FRAME).scale);
    expect(Math.max(...pop)).toBeGreaterThan(1.05);
    expect(textMotion({ exit: 'pop' }, 4, 4, FRAME).scale).toBe(0.01);
    expect(textMotion({ exit: 'spin' }, 4, 4, FRAME)).toMatchObject({
      rotate: 2 * Math.PI,
      scale: 0.01,
    });
    expect(textMotion({ exit: 'spin' }, 2.9, 4, FRAME)).toMatchObject({ rotate: 0, scale: 1 });
    expect(textMotion({ exit: 'whip' }, 3.6, 4, FRAME).x).toBe(-1920);
    expect(textMotion({ exit: 'whip' }, 3, 4, FRAME).x).toBe(0);
  });

  it('V7 title presets: only spinning words are cut out of the frame first (a smaller picture to turn)', () => {
    const words = { x: 500, y: 400, width: 600, height: 100 };
    expect(motionWindow({ entrance: 'slam' }, words, FRAME)).toBeNull();
    expect(motionWindow({ entrance: 'spin' }, words, FRAME)).toEqual({
      x: 500 - 130,
      y: 400 - 130,
      width: 600 + 260,
      height: 100 + 260,
    });
    // Never outside the frame.
    const corner = { x: 10, y: 1000, width: 300, height: 70 };
    expect(motionWindow({ exit: 'spin' }, corner, FRAME)).toEqual({
      x: 0,
      y: 870,
      width: 440,
      height: 210,
    });
  });
});

/** Evaluates an FFmpeg expression at time `t` (only the functions the export uses). */
function ffmpegAt(expression: string, t: number): number {
  const fns: Record<string, (...a: number[]) => number> = {
    iff: (c: number, a: number, b = 0) => (c ? a : b),
    lt: (a: number, b: number) => (a < b ? 1 : 0),
    gte: (a: number, b: number) => (a >= b ? 1 : 0),
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    sin: Math.sin,
    cos: Math.cos,
  };
  const js = expression.replace(/\bif\(/g, 'iff(').replace(/'/g, '');
  const run = new Function(...Object.keys(fns), 't', 'PI', `return ${js};`);
  return run(...Object.values(fns), t, Math.PI) as number;
}

describe('the export moves text exactly as the preview does', () => {
  const ANCHOR = { x: 400, y: 900 };
  const WORDS = { x: 150, y: 850, width: 500, height: 100 };
  const cases: TextEffects[] = [
    ...ENTRANCES.map(([entrance]) => ({ entrance })),
    ...EXITS.map(([exit]) => ({ exit })),
    { entrance: 'pop', exit: 'zoom' },
    { entrance: 'drop', exit: 'sink' },
    { entrance: 'type-on', exit: 'spin' },
    { entrance: 'slam', exit: 'pop' },
    { entrance: 'spin', exit: 'whip' },
  ];

  /**
   * Where FFmpeg puts point `p` of the frame image: cut to the window (or, typing on, the part
   * left of the edge), turned about the cut picture's middle into a D × D picture, scaled from
   * its corner, laid at the overlay's x and y.
   */
  function exported(
    ex: ReturnType<typeof motionExpressions>,
    p: { x: number; y: number },
    t: number,
  ) {
    const win = ex.window ?? { x: 0, y: 0, ...FRAME };
    const cx = ex.edge ? ffmpegAt(ex.edge, t) - win.width : win.x;
    let q = { x: p.x - cx, y: p.y - win.y };
    if (ex.angle) {
      const a = ffmpegAt(ex.angle, t);
      const d = { x: q.x - win.width / 2, y: q.y - win.height / 2 };
      q = {
        x: d.x * Math.cos(a) - d.y * Math.sin(a) + ex.size! / 2,
        y: d.x * Math.sin(a) + d.y * Math.cos(a) + ex.size! / 2,
      };
    }
    const s = ex.scale ? ffmpegAt(ex.scale, t) : 1;
    return { x: ffmpegAt(ex.x, t) + s * q.x, y: ffmpegAt(ex.y, t) + s * q.y };
  }

  /** The preview: moved, then scaled and turned about the middle of the words. */
  function previewed(m: ReturnType<typeof textMotion>, p: { x: number; y: number }) {
    const d = { x: p.x - ANCHOR.x, y: p.y - ANCHOR.y };
    const c = Math.cos(m.rotate);
    const s = Math.sin(m.rotate);
    return {
      x: ANCHOR.x + m.x + m.scale * (d.x * c - d.y * s),
      y: ANCHOR.y + m.y + m.scale * (d.x * s + d.y * c),
    };
  }

  it.each(cases.map((c) => [JSON.stringify(c), c] as const))('%s', (_, effects) => {
    const start = 2;
    const duration = 3;
    const ex = motionExpressions(effects, start, duration, FRAME, ANCHOR, WORDS);
    const window = motionWindow(effects, WORDS, FRAME);
    expect(ex.window).toEqual(window);
    for (let local = 0; local <= duration; local += 0.05) {
      const t = start + local;
      const m = textMotion(effects, local, duration, FRAME);
      const scale = ex.scale ? ffmpegAt(ex.scale, t) : 1;
      expect(scale).toBeCloseTo(m.scale, 6);
      expect(ex.angle ? ffmpegAt(ex.angle, t) : 0).toBeCloseTo(m.rotate, 6);
      for (const p of [ANCHOR, { x: WORDS.x, y: WORDS.y }, { x: 640, y: 940 }]) {
        const a = exported(ex, p, t);
        const b = previewed(m, p);
        expect(a.x).toBeCloseTo(b.x, 4);
        expect(a.y).toBeCloseTo(b.y, 4);
      }
      // Typing on: the export's edge is the preview's; afterwards the whole picture shows.
      const edge = ex.edge ? ffmpegAt(ex.edge, t) : null;
      if (m.reveal < 1) expect(edge).toBeCloseTo(revealEdge(m.reveal, WORDS, FRAME, window), 6);
      else if (edge !== null) expect(edge).toBe((window?.x ?? 0) + (window?.width ?? FRAME.width));
    }
  });

  it('nothing moves without an entrance or exit: no scaling at all', () => {
    expect(motionExpressions({}, 0, 4, FRAME, ANCHOR)).toEqual({
      x: '0',
      y: '0',
      scale: null,
      angle: null,
      size: null,
      window: null,
      edge: null,
      fadeIn: 0,
      fadeOut: 0,
    });
  });

  it('rise and sink fade the words with their move over a second; slam fades in over half', () => {
    expect(
      motionExpressions({ entrance: 'rise', exit: 'sink' }, 0, 4, FRAME, ANCHOR),
    ).toMatchObject({ fadeIn: 1, fadeOut: 1 });
    expect(motionExpressions({ entrance: 'slam' }, 0, 4, FRAME, ANCHOR)).toMatchObject({
      fadeIn: 0.5,
      fadeOut: 0,
    });
  });

  it('V7 title presets: a spinning picture is turned into a square that fits its diagonal', () => {
    const ex = motionExpressions({ entrance: 'spin' }, 0, 4, FRAME, ANCHOR, WORDS);
    const w = ex.window!;
    expect(ex.size).toBe(Math.ceil(Math.hypot(w.width, w.height)));
  });
});
