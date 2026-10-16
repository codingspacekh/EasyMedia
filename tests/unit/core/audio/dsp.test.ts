// MILESTONES §3.1: audio effects tested with synthetic signals whose answers are known.
import { describe, expect, it } from 'vitest';
import { changeSpeed } from '../../../../src/core/audio/dsp/speed.ts';
import {
  amplify,
  dbToGain,
  fadeIn,
  fadeOut,
  gainToDb,
  maxGainDb,
  normalise,
  peak,
  removeDcOffset,
} from '../../../../src/core/audio/dsp/volume.ts';
import { mixDown, stereoToMono } from '../../../../src/core/audio/dsp/channels.ts';

const RATE = 44100;
const sine = (freq: number, seconds: number, amp = 1, offset = 0, rate = RATE) =>
  Float32Array.from(
    { length: Math.round(seconds * rate) },
    (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / rate) + offset,
  );
const mean = (a: Float32Array) => a.reduce((s, v) => s + v, 0) / a.length;
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

/** Frequency from rising zero crossings (interpolated), ignoring the first and last 10 %. */
function frequency(a: Float32Array, rate = RATE): number {
  const crossings: number[] = [];
  const from = Math.floor(a.length * 0.1);
  const to = Math.floor(a.length * 0.9);
  for (let i = from; i < to; i++) {
    if (a[i - 1]! < 0 && a[i]! >= 0) crossings.push(i - 1 + a[i - 1]! / (a[i - 1]! - a[i]!));
  }
  return ((crossings.length - 1) * rate) / (crossings.at(-1)! - crossings[0]!);
}

describe('A7 fade in / fade out', () => {
  const constant = new Float32Array(1000).fill(1);

  it('fade in of a constant 1.0: first sample 0, last ≈ 1, never falling', () => {
    const [out] = fadeIn([constant]);
    expect(out![0]).toBe(0);
    expect(out!.at(-1)).toBeCloseTo(1, 2);
    for (let i = 1; i < out!.length; i++) expect(out![i]).toBeGreaterThanOrEqual(out![i - 1]!);
  });

  it('fade out of a constant 1.0: first ≈ 1, last sample 0, never rising', () => {
    const [out] = fadeOut([constant]);
    expect(out![0]).toBeCloseTo(1, 2);
    expect(out!.at(-1)).toBe(0);
    for (let i = 1; i < out!.length; i++) expect(out![i]).toBeLessThanOrEqual(out![i - 1]!);
  });

  it('fades every channel and leaves the input unchanged', () => {
    const left = new Float32Array(10).fill(1);
    const [l, r] = fadeIn([left, new Float32Array(10).fill(-1)]);
    expect(l![5]).toBeCloseTo(0.5);
    expect(r![5]).toBeCloseTo(-0.5);
    expect(left[0]).toBe(1);
  });
});

describe('A4 amplify', () => {
  it('−6 dB on a sine with peak 1.0 → peak ≈ 0.501', () => {
    const [out] = amplify([sine(440, 0.1)], -6);
    expect(peak([out!])).toBeCloseTo(0.501, 3);
  });

  it('works out the largest gain without clipping: peak 0.5 → +6.02 dB', () => {
    expect(maxGainDb([sine(440, 0.1, 0.5)])).toBeCloseTo(6.02, 2);
    expect(maxGainDb([new Float32Array(10)])).toBe(0); // silence: nothing to work out
  });

  it('dB and gain convert both ways', () => {
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 2);
  });
});

describe('A3 normalise and remove DC offset', () => {
  it('sine with peak 0.25 normalised to −1 dB → peak 0.891 ± 0.001', () => {
    const [out] = normalise([sine(440, 0.5, 0.25)], { peakDb: -1, removeDc: false });
    expect(Math.abs(peak([out!]) - 0.891)).toBeLessThan(0.001);
  });

  it('removing the DC offset of a sine + 0.2 leaves a mean of ~0', () => {
    const [out] = removeDcOffset([sine(440, 1, 0.3, 0.2)]);
    expect(Math.abs(mean(out!))).toBeLessThan(1e-4);
    expect(peak([out!])).toBeCloseTo(0.3, 2);
  });

  it('normalise can remove the DC offset first, then set the peak', () => {
    const [out] = normalise([sine(440, 1, 0.3, 0.2)], { peakDb: -1, removeDc: true });
    expect(Math.abs(mean(out!))).toBeLessThan(1e-4);
    expect(Math.abs(peak([out!]) - 0.891)).toBeLessThan(0.001);
  });

  it('uses one gain for both channels, so the balance stays the same', () => {
    const [l, r] = normalise([sine(440, 0.5, 0.5), sine(440, 0.5, 0.25)], {
      peakDb: 0,
      removeDc: false,
    });
    expect(peak([l!])).toBeCloseTo(1, 3);
    expect(peak([r!])).toBeCloseTo(0.5, 3);
  });

  it('an empty selection stays empty', () => {
    expect(removeDcOffset([new Float32Array(0)])[0]!.length).toBe(0);
  });

  it('only removes the offset when there is no peak level (peakDb null)', () => {
    const [out] = normalise([sine(440, 1, 0.3, 0.2)], { peakDb: null, removeDc: true });
    expect(peak([out!])).toBeCloseTo(0.3, 2);
  });
});

describe('A8 change speed (pitch changes too, as in Audacity)', () => {
  it('×2: a 2 s sine at 440 Hz becomes 1 s at 880 Hz', () => {
    const [out] = changeSpeed([sine(440, 2, 0.5)], 2);
    expect(out!.length).toBe(RATE);
    expect(frequency(out!) / 880).toBeCloseTo(1, 2);
    expect(rms(out!)).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it('×0.5: a 2 s sine at 440 Hz becomes 4 s at 220 Hz', () => {
    const [out] = changeSpeed([sine(440, 2, 0.5)], 0.5);
    expect(out!.length).toBe(4 * RATE);
    expect(frequency(out!) / 220).toBeCloseTo(1, 2);
  });

  it('×1.4 (Book B Task 11k): 45 s becomes 32.14 s', () => {
    const [out] = changeSpeed([new Float32Array(45 * 100)], 1.4);
    expect(out!.length / 100).toBeCloseTo(32.14, 2);
  });

  it('speeding up removes tones that would go above what the rate can hold (no aliasing)', () => {
    const [out] = changeSpeed([sine(15000, 0.5, 0.5)], 2); // 30 kHz > 22.05 kHz
    expect(rms(out!)).toBeLessThan(0.02);
  });

  it('changes every channel the same way', () => {
    const out = changeSpeed([sine(440, 1), sine(440, 1)], 1.25);
    expect(out.map((c) => c.length)).toEqual([35280, 35280]);
  });

  it('refuses a speed of zero or less', () => {
    expect(() => changeSpeed([sine(440, 0.1)], 0)).toThrow(/greater than 0/);
  });
});

describe('A15 stereo → mono and mixing', () => {
  it('L = 1, R = 0 → mono 0.5', () => {
    const [mono] = stereoToMono([new Float32Array(4).fill(1), new Float32Array(4)]);
    expect([...mono!]).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it('a mono track is left as it is', () => {
    const only = new Float32Array([0.1, 0.2]);
    expect(stereoToMono([only])[0]).toBe(only);
  });

  it('mixDown adds parts at their positions and clips the sum to −1…1', () => {
    const out = mixDown(
      [
        { at: 0, channels: [new Float32Array([0.5, 0.5, 0.5])], gains: [1] },
        { at: 1, channels: [new Float32Array([0.75, 0.75, -2])], gains: [1] },
      ],
      1,
    );
    expect([...out[0]!]).toEqual([0.5, 1, 1, -1]);
  });

  it('mixDown averages a stereo part into a mono mix; nothing to mix gives silence', () => {
    const [mono] = mixDown(
      [{ at: 0, channels: [new Float32Array([1]), new Float32Array([0])], gains: [1] }],
      1,
    );
    expect([...mono!]).toEqual([0.5]);
    expect(mixDown([], 2).map((c) => c.length)).toEqual([0, 0]);
  });

  it('mixDown puts a mono part in both sides of a stereo mix, with each side’s gain', () => {
    const [l, r] = mixDown([{ at: 0, channels: [new Float32Array([0.5])], gains: [1, 0.5] }], 2);
    expect([l![0], r![0]]).toEqual([0.5, 0.25]);
  });
});
