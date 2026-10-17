// MILESTONES §3.1: audio effects tested with synthetic signals whose answers are known.
import { describe, expect, it } from 'vitest';
import { delay, echo, echoTimes } from '../../../../src/core/audio/dsp/echo.ts';
import { changePitch, timeStretch } from '../../../../src/core/audio/dsp/pitch.ts';
import { reverb, type ReverbSettings } from '../../../../src/core/audio/dsp/reverb.ts';
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

describe('A9 change pitch (length stays the same)', () => {
  it('+12 semitones: a 2 s sine at 440 Hz stays 2 s and becomes 880 Hz (±2 %)', () => {
    const [out] = changePitch([sine(440, 2, 0.5)], RATE, 12);
    expect(out!.length).toBe(2 * RATE);
    expect(frequency(out!) / 880).toBeCloseTo(1, 1);
    expect(Math.abs(frequency(out!) / 880 - 1)).toBeLessThan(0.02);
  });

  it('keeps the loudness of a steady tone (no gaps or doubled parts)', () => {
    const [out] = changePitch([sine(440, 2, 0.5)], RATE, 12);
    const middle = out!.subarray(Math.round(0.2 * RATE), Math.round(1.8 * RATE));
    expect(rms(middle) / (0.5 / Math.SQRT2)).toBeGreaterThan(0.9);
    expect(rms(middle) / (0.5 / Math.SQRT2)).toBeLessThan(1.1);
  });

  it('C → F up (Book B Task 11k) is +5 semitones: 440 Hz → 587.3 Hz', () => {
    const [out] = changePitch([sine(440, 1, 0.5)], RATE, 5);
    expect(Math.abs(frequency(out!) / 587.33 - 1)).toBeLessThan(0.02);
  });

  it('lower by 5 % (Book A 11.20): 440 Hz → 418 Hz, same length', () => {
    const [out] = changePitch([sine(440, 1, 0.5)], RATE, 12 * Math.log2(0.95));
    expect(out!.length).toBe(RATE);
    expect(Math.abs(frequency(out!) / 418 - 1)).toBeLessThan(0.02);
  });

  it('0 semitones leaves the sound exactly as it was', () => {
    const input = sine(440, 0.5, 0.5);
    const [out] = changePitch([input], RATE, 0);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('keeps the two sides of a stereo sound in step', () => {
    const [l, r] = changePitch([sine(440, 1, 0.5), sine(440, 1, 0.5)], RATE, -3);
    expect(r).toEqual(l);
  });

  it('a selection shorter than one window still keeps its length', () => {
    const [out] = changePitch([sine(440, 0.01, 0.5)], RATE, 7);
    expect(out!.length).toBe(441);
  });

  it('an empty selection stays empty', () => {
    expect(changePitch([new Float32Array(0)], RATE, 5)).toEqual([new Float32Array(0)]);
    expect(changePitch([new Float32Array(1)], RATE, 24)[0]!.length).toBe(1);
  });

  it('refuses a change beyond two octaves', () => {
    expect(() => changePitch([sine(440, 0.1)], RATE, 25)).toThrow(/semitones/);
  });
});

describe('A9 time stretch (the first half of Change pitch)', () => {
  it('×1.5: a 1 s sine at 440 Hz becomes 1.5 s, still at 440 Hz', () => {
    const [out] = timeStretch([sine(440, 1, 0.5)], RATE, 1.5);
    expect(out!.length).toBe(Math.round(1.5 * RATE));
    expect(Math.abs(frequency(out!) / 440 - 1)).toBeLessThan(0.01);
  });

  it('×0.75 makes it shorter, still at 440 Hz', () => {
    const [out] = timeStretch([sine(440, 1, 0.5)], RATE, 0.75);
    expect(out!.length).toBe(Math.round(0.75 * RATE));
    expect(Math.abs(frequency(out!) / 440 - 1)).toBeLessThan(0.01);
  });
});

describe('A10 echo (each echo is the one before × the decay; the length stays the same)', () => {
  const impulse = (seconds: number, rate = 1000) => {
    const a = new Float32Array(seconds * rate);
    a[0] = 1;
    return a;
  };

  it('0.5 s / 0.8 on a single impulse: echoes at 0.5 s (0.8), 1.0 s (0.64), 1.5 s (0.512)', () => {
    const [out] = echo([impulse(2)], 1000, 0.5, 0.8);
    expect(out!.length).toBe(2000);
    expect([out![0], out![500], out![1000], out![1500]].map((v) => +v!.toFixed(4))).toEqual([
      1, 0.8, 0.64, 0.512,
    ]);
    expect(out!.filter((v) => v !== 0)).toHaveLength(4);
  });

  it('echoes every channel and leaves the input unchanged', () => {
    const left = impulse(1);
    const [l, r] = echo([left, impulse(1)], 1000, 0.25, 0.5);
    expect([l![250], r![250]]).toEqual([0.5, 0.5]);
    expect(left[250]).toBe(0);
  });

  it('a delay longer than the selection changes nothing', () => {
    const [out] = echo([impulse(1)], 1000, 2, 0.5);
    expect(out).toEqual(impulse(1));
  });
});

describe('A10 delay: regular, bouncing ball, reverse bouncing ball', () => {
  it('regular: equal gaps', () => {
    expect(echoTimes('regular', 0.5, 3)).toEqual([0.5, 1, 1.5]);
  });

  it('bouncing ball: the echoes come closer together', () => {
    expect(echoTimes('bouncing', 1, 4)).toEqual([1, 1.75, 2.25, 2.5]);
  });

  it('reverse bouncing ball: the echoes go further apart', () => {
    expect(echoTimes('reverse', 1, 4)).toEqual([0.25, 0.75, 1.5, 2.5]);
  });

  it('regular 0.5 s, 3 echoes, 6 dB per echo: each echo 6 dB quieter; the sound gets longer', () => {
    const input = new Float32Array(1000);
    input[0] = 1;
    const [out] = delay([input], 1000, { type: 'regular', delay: 0.5, echoes: 3, decayDb: 6 });
    expect(out!.length).toBe(2500);
    expect([out![500], out![1000], out![1500]].map((v) => +v!.toFixed(3))).toEqual([
      0.501, 0.251, 0.126,
    ]);
  });

  it('can keep the length: echoes after the end are left out', () => {
    const input = new Float32Array(1000);
    input[0] = 1;
    const [out] = delay([input], 1000, {
      type: 'regular',
      delay: 0.5,
      echoes: 3,
      decayDb: 6,
      keepLength: true,
    });
    expect(out!.length).toBe(1000);
    expect(+out![500]!.toFixed(3)).toBe(0.501);
  });

  it('delays every channel the same way', () => {
    const one = Float32Array.from([1, 0, 0, 0]);
    const out = delay([one, one], 4, { type: 'regular', delay: 0.25, echoes: 1, decayDb: 0 });
    expect(out).toEqual([Float32Array.from([1, 1, 0, 0, 0]), Float32Array.from([1, 1, 0, 0, 0])]);
  });
});

describe('A11 reverb (Freeverb)', () => {
  const vocal: ReverbSettings = { roomSize: 0.6, reverberance: 0.4, damping: 0.5, wet: 0.3 };
  const impulse = (seconds: number) => {
    const a = new Float32Array(Math.round(seconds * RATE));
    a[0] = 1;
    return a;
  };
  /** Energy of each 100 ms window. */
  const energies = (a: Float32Array) =>
    Array.from({ length: Math.floor(a.length / 4410) }, (_, w) =>
      a.subarray(w * 4410, (w + 1) * 4410).reduce((s, v) => s + v * v, 0),
    );

  it('an impulse: the output rings on and its energy dies away; with a tail it is longer', () => {
    const [out] = reverb([impulse(1)], RATE, { ...vocal, tail: true });
    expect(out!.length).toBeGreaterThan(RATE);
    const e = energies(out!);
    expect(e[1]!).toBeGreaterThan(0); // still ringing after the impulse
    for (let w = 2; w < e.length; w++) expect(e[w]!).toBeLessThan(e[w - 1]!);
    expect(e.at(-1)!).toBeLessThan(e[1]! * 1e-4); // the tail has died away by the end
  });

  it('without a tail the length stays the same', () => {
    expect(reverb([impulse(1)], RATE, vocal)[0]!.length).toBe(RATE);
  });

  it('more reverberance rings longer', () => {
    const at = (reverberance: number) =>
      energies(reverb([impulse(2)], RATE, { ...vocal, reverberance })[0]!)[10]!;
    expect(at(0.9)).toBeGreaterThan(at(0.4) * 10);
  });

  it('no wet sound leaves the sound exactly as it was', () => {
    const input = sine(440, 0.5, 0.5);
    expect(reverb([input], RATE, { ...vocal, wet: 0 })).toEqual([input]);
  });

  it('keeps mono mono and stereo stereo; the two sides of the reverb differ (width)', () => {
    expect(reverb([impulse(0.5)], RATE, vocal)).toHaveLength(1);
    const [l, r] = reverb([impulse(0.5), impulse(0.5)], RATE, vocal);
    expect(l!.length).toBe(r!.length);
    expect(l).not.toEqual(r);
  });

  it('works at other sample rates', () => {
    const [out] = reverb([new Float32Array(48000).fill(0.1)], 48000, { ...vocal, tail: true });
    expect(out!.length).toBeGreaterThan(48000);
    expect(out!.every(Number.isFinite)).toBe(true);
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
