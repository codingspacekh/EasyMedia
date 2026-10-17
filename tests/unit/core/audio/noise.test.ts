// MILESTONES §3.1: noise reduction with a known answer — a sine in white noise, with a profile of
// the noise alone, comes out with a signal-to-noise ratio at least 10 dB better.
import { describe, expect, it } from 'vitest';
import {
  noiseProfile,
  reduceNoise,
  type NoiseSettings,
} from '../../../../src/core/audio/dsp/noise.ts';

const RATE = 44100;
/** Repeatable white noise (a simple LCG), level `amp`. */
function noise(seconds: number, amp: number, seed = 1): Float32Array {
  let x = seed;
  return Float32Array.from({ length: Math.round(seconds * RATE) }, () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return amp * (x / 2147483648 - 1);
  });
}
const sine = (seconds: number, amp = 0.5, freq = 440) =>
  Float32Array.from(
    { length: Math.round(seconds * RATE) },
    (_, i) => amp * Math.sin((2 * Math.PI * freq * i) / RATE),
  );
const power = (a: Float32Array) => a.reduce((s, v) => s + v * v, 0) / a.length;
const add = (a: Float32Array, b: Float32Array) => a.map((v, i) => v + b[i]!);
const minus = (a: Float32Array, b: Float32Array) => a.map((v, i) => v - b[i]!);
/** SNR (dB) of `noisy` against the clean signal, ignoring the first and last 0.2 s. */
function snr(clean: Float32Array, noisy: Float32Array): number {
  const inner = (a: Float32Array) =>
    a.subarray(Math.round(0.2 * RATE), a.length - Math.round(0.2 * RATE));
  return 10 * Math.log10(power(inner(clean)) / power(inner(minus(noisy, clean))));
}
const DEFAULTS: NoiseSettings = { reductionDb: 12, sensitivity: 6, smoothing: 3 };

describe('A13 noise reduction (two steps, as Audacity)', () => {
  const profile = noiseProfile([noise(2, 0.05, 7)], RATE); // step 1: noise only

  it('§3.1: sine + white noise with a noise-only profile → SNR at least 10 dB better', () => {
    const clean = sine(3);
    const noisy = add(clean, noise(3, 0.05, 99));
    const [out] = reduceNoise([noisy], RATE, profile, { ...DEFAULTS, reductionDb: 24 });
    expect(snr(clean, out!) - snr(clean, noisy)).toBeGreaterThanOrEqual(10);
  });

  it('with the default 12 dB, noise alone is made about 12 dB quieter', () => {
    const quiet = noise(2, 0.05, 5);
    const [out] = reduceNoise([quiet], RATE, profile, DEFAULTS);
    const drop = 10 * Math.log10(power(out!) / power(quiet));
    expect(drop).toBeLessThan(-10.5);
    expect(drop).toBeGreaterThan(-12.5);
  });

  it('keeps the sound itself: a loud sine passes at almost the same level', () => {
    const clean = sine(2);
    const [out] = reduceNoise([add(clean, noise(2, 0.05, 3))], RATE, profile, DEFAULTS);
    const inner = (a: Float32Array) => a.subarray(RATE / 2, RATE * 1.5);
    expect(10 * Math.log10(power(inner(out!)) / power(inner(clean)))).toBeGreaterThan(-1);
  });

  it('keeps the length; works on each channel', () => {
    const out = reduceNoise([noise(1.3, 0.05, 2), noise(1.3, 0.05, 3)], RATE, profile, DEFAULTS);
    expect(out.map((c) => c.length)).toEqual([Math.round(1.3 * RATE), Math.round(1.3 * RATE)]);
  });

  it('"hear only what is removed" gives the sound minus the cleaned sound', () => {
    const noisy = add(sine(1), noise(1, 0.05, 4));
    const [cleaned] = reduceNoise([noisy], RATE, profile, DEFAULTS);
    const [removed] = reduceNoise([noisy], RATE, profile, { ...DEFAULTS, residue: true });
    for (const i of [1000, 20000, 40000])
      expect(removed![i]).toBeCloseTo(noisy[i]! - cleaned![i]!, 5);
  });

  it('a reduction of 0 dB leaves the sound as it was', () => {
    const noisy = add(sine(1), noise(1, 0.05, 4));
    const [out] = reduceNoise([noisy], RATE, profile, { ...DEFAULTS, reductionDb: 0 });
    for (const i of [1000, 20000, 40000]) expect(out![i]).toBeCloseTo(noisy[i]!, 5);
  });

  it('refuses a profile that is too short to measure', () => {
    expect(() => noiseProfile([noise(0.01, 0.05)], RATE)).toThrow(/longer/);
  });

  it('refuses a profile taken at another sample rate', () => {
    expect(() => reduceNoise([noise(1, 0.05)], 48000, profile, DEFAULTS)).toThrow(/sample rate/);
  });
});
