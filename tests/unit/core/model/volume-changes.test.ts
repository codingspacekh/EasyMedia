// V13 volume changes inside one sound: "lower the music to 30 % between 10 s and 15 s".
import { describe, expect, it } from 'vitest';
import { EditError } from '../../../../src/core/model/errors.ts';
import {
  VOLUME_RAMP,
  validateVolumeChanges,
  volumeAt,
  volumeChangesWithin,
  volumeExpression,
  volumePoints,
} from '../../../../src/core/model/volume-changes.ts';

/** Works out an FFmpeg expression of `t` the way FFmpeg would (only what volumeExpression uses). */
function evaluate(expression: string, t: number): number {
  const js = expression
    .replace(/if\(/g, 'iff(')
    .replace(/lt\(t,/g, 'lt(t,')
    .replace(/\bt\b/g, String(t));
  const iff = (c: number, a: number, b: number) => (c ? a : b);
  const lt = (a: number, b: number) => (a < b ? 1 : 0);
  return new Function('iff', 'lt', `return ${js};`)(iff, lt) as number;
}

describe('V13 volume changes: the level at any moment (timeline time)', () => {
  const lower = [{ from: 10, to: 15, volume: 0.3 }];

  it('is exactly the new volume between the two times, the own volume outside, 0.25 s glides between', () => {
    expect(VOLUME_RAMP).toBe(0.25);
    expect(volumePoints(1, lower)).toEqual([
      { t: 9.75, level: 1 },
      { t: 10, level: 0.3 },
      { t: 15, level: 0.3 },
      { t: 15.25, level: 1 },
    ]);
    expect(volumeAt(1, lower, 5)).toBe(1);
    expect(volumeAt(1, lower, 9.875)).toBeCloseTo(0.65, 9);
    expect(volumeAt(1, lower, 10)).toBeCloseTo(0.3, 9);
    expect(volumeAt(1, lower, 12.5)).toBeCloseTo(0.3, 9);
    expect(volumeAt(1, lower, 15.125)).toBeCloseTo(0.65, 9);
    expect(volumeAt(1, lower, 20)).toBe(1);
  });

  it('the volume replaces the sound’s own volume (80 % → 30 %); a typed glide is kept', () => {
    const typed = [{ from: 2, to: 3, volume: 0.3, ramp: 1 }];
    expect(volumeAt(0.8, typed, 0)).toBe(0.8);
    expect(volumeAt(0.8, typed, 1.5)).toBeCloseTo(0.55, 9);
    expect(volumeAt(0.8, typed, 2.5)).toBeCloseTo(0.3, 9);
    expect(volumeAt(0.8, [{ from: 2, to: 3, volume: 0.3, ramp: 0 }], 1.99)).toBe(0.8);
  });

  it('two changes close together glide straight from one volume to the other', () => {
    const two = [
      { from: 10, to: 15, volume: 0.3 },
      { from: 15.4, to: 20, volume: 0.6 },
    ];
    expect(volumeAt(1, two, 15)).toBeCloseTo(0.3, 9);
    expect(volumeAt(1, two, 15.2)).toBeCloseTo(0.45, 9);
    expect(volumeAt(1, two, 15.4)).toBeCloseTo(0.6, 9);
    // Touching: the glide is centred where they meet, so it does not click either.
    const touching = [
      { from: 10, to: 15, volume: 0.3 },
      { from: 15, to: 20, volume: 0.6 },
    ];
    expect(volumeAt(1, touching, 14.875)).toBeCloseTo(0.3, 9);
    expect(volumeAt(1, touching, 15)).toBeCloseTo(0.45, 9);
    expect(volumeAt(1, touching, 15.125)).toBeCloseTo(0.6, 9);
  });

  it('the FFmpeg expression gives the same level as the preview at every moment', () => {
    const changes = [
      { from: 10, to: 15, volume: 0.3 },
      { from: 15, to: 20, volume: 0.6, ramp: 0.5 },
      { from: 30, to: 31.5, volume: 1.5, ramp: 0 },
    ];
    const expression = volumeExpression(0.8, changes);
    expect(expression).not.toMatch(/,\s/);
    for (let t = 0; t < 40; t += 0.0625)
      expect(evaluate(expression, t)).toBeCloseTo(volumeAt(0.8, changes, t), 9);
  });
});

describe('V13 volume changes: what can be typed', () => {
  const refuses = (changes: Parameters<typeof validateVolumeChanges>[0], message: RegExp) => {
    expect(() => validateVolumeChanges(changes)).toThrow(EditError);
    expect(() => validateVolumeChanges(changes)).toThrow(message);
  };

  it('a change ends after it starts, at 0–200 %, with a glide of 0–5 s', () => {
    validateVolumeChanges([{ from: 10, to: 15, volume: 0.3, ramp: 0.5 }]);
    refuses([{ from: 15, to: 10, volume: 0.3 }], /ends after it starts/i);
    refuses([{ from: -1, to: 10, volume: 0.3 }], /cannot start before 0/i);
    refuses([{ from: 1, to: 2, volume: 2.5 }], /0 % and 200 %/);
    refuses([{ from: 1, to: 2, volume: 0.5, ramp: 6 }], /glide .* 0 and 5 s/i);
  });

  it('two changes may touch but not overlap', () => {
    validateVolumeChanges([
      { from: 10, to: 15, volume: 0.3 },
      { from: 15, to: 18, volume: 0.6 },
    ]);
    refuses(
      [
        { from: 10, to: 15, volume: 0.3 },
        { from: 12, to: 18, volume: 0.6 },
      ],
      /10\.00 – 15\.00 s and 12\.00 – 18\.00 s overlap/,
    );
  });

  it('a split keeps on each part the changes heard there', () => {
    const changes = [
      { from: 2, to: 4, volume: 0.3 },
      { from: 8, to: 9, volume: 0.5 },
    ];
    expect(volumeChangesWithin(changes, 0, 5)).toEqual([changes[0]]);
    expect(volumeChangesWithin(changes, 4.1, 10)).toEqual(changes); // the glide after 4 s
    expect(volumeChangesWithin(changes, 5, 10)).toEqual([changes[1]]);
  });
});
