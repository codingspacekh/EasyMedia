import { describe, expect, it } from 'vitest';
import {
  EFFECTS,
  defaultParams,
  effectById,
  filtersFor,
  TRANSITIONS,
  validateParams,
} from '../../../../src/core/effects/registry.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

describe('effect registry (P6) — every effect describes itself', () => {
  const all = [...EFFECTS, ...TRANSITIONS];

  it.each(all.map((e) => [e.id, e] as const))(
    '%s has a label, syllabus point and "why" (T5)',
    (_, e) => {
      expect(e.label.length).toBeGreaterThan(2);
      expect(e.syllabus).toMatch(/^11\.1 /);
      expect(e.why.length).toBeGreaterThan(40);
    },
  );

  it.each(all.map((e) => [e.id, e] as const))(
    '%s has parameters with sensible defaults',
    (_, e) => {
      for (const p of Object.values(e.params)) {
        expect(p.label.length).toBeGreaterThan(0);
        expect(p.min).toBeLessThan(p.max);
        expect(p.step).toBeGreaterThan(0);
        expect(p.default).toBeGreaterThanOrEqual(p.min);
        expect(p.default).toBeLessThanOrEqual(p.max);
      }
    },
  );

  it('ids are unique', () => {
    expect(new Set(all.map((e) => e.id)).size).toBe(all.length);
  });

  it('V15 has the syllabus filters', () => {
    expect(EFFECTS.map((e) => e.id)).toEqual(
      expect.arrayContaining([
        'video.colour',
        'video.blackwhite',
        'video.sepia',
        'video.cyan',
        'video.blur',
        'video.sharpen',
        'video.invert',
      ]),
    );
  });

  it('V9 has dissolves, fades through black/white, wipes, slides, push, circle and zoom', () => {
    expect(TRANSITIONS.map((t) => t.xfade)).toEqual(
      expect.arrayContaining([
        'fade',
        'fadeblack',
        'fadewhite',
        'wipeleft',
        'wipeup',
        'slideleft',
        'smoothleft',
        'circleopen',
        'zoomin',
      ]),
    );
  });
});

describe('filters for FFmpeg and the preview', () => {
  it('turns colour correction into eq, and leaves out what is unchanged', () => {
    expect(
      filtersFor([
        { effectId: 'video.colour', params: { brightness: 20, contrast: 0, saturation: -50 } },
      ]),
    ).toBe('eq=brightness=0.2:saturation=0.5');
  });

  it('chains several effects in order', () => {
    expect(
      filtersFor([
        { effectId: 'video.blackwhite', params: {} },
        { effectId: 'video.blur', params: { radius: 8 } },
      ]),
    ).toBe('hue=s=0,boxblur=8:1');
  });

  it('nothing at all when there are no effects', () => {
    expect(filtersFor([])).toBe('');
  });

  it('has a CSS preview for every filter', () => {
    for (const e of EFFECTS) expect(e.preview(defaultParams(e))).toMatch(/\w+\(/);
  });
});

describe('checking parameters', () => {
  it('fills in defaults', () => {
    expect(defaultParams(effectById('video.blur')!)).toEqual({ radius: 5 });
  });

  it('explains a value out of range', () => {
    expect(() => validateParams(effectById('video.blur')!, { radius: 99 })).toThrow(EditError);
    expect(() => validateParams(effectById('video.blur')!, { radius: 99 })).toThrow(
      /between 1 and 30/,
    );
  });

  it('refuses an unknown effect', () => {
    expect(effectById('video.nope')).toBeUndefined();
    expect(() => filtersFor([{ effectId: 'video.nope', params: {} }])).toThrow(EditError);
  });
});
