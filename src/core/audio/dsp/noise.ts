// A13 Noise reduction in two steps, as Audacity. Step 1 measures the noise alone: how loud it is
// at each frequency (the noise profile). Step 2 looks at the sound in short overlapping windows;
// at each frequency, whatever is not clearly louder than the noise (by the sensitivity) in at least
// two of three windows in a row is turned down by the reduction. A kept frequency also lifts its
// neighbours (frequency smoothing) and is turned down gradually after the sound has passed, which
// avoids a "watery" sound.
import { EditError } from '../../model/errors.ts';
import type { Channels } from '../pcm.ts';
import { createRealFft } from './fft.ts';

export interface NoiseProfile {
  rate: number;
  /** Mean power of the noise in each frequency bin of a WINDOW-sample window. */
  power: Float64Array;
}

export interface NoiseSettings {
  /** How much quieter the noise is made (dB). */
  reductionDb: number;
  /** How far above the noise (dB) a sound must be to be kept. */
  sensitivity: number;
  /** Frequency bins on each side that are smoothed together. */
  smoothing: number;
  /** Give what would be removed instead of the cleaned sound. */
  residue?: boolean;
}

const WINDOW = 2048;
const HOP = WINDOW / 2; // windows overlap by half
const RELEASE_S = 0.05; // how long a frequency takes to be turned down again after a sound has passed
const BINS = WINDOW / 2 + 1;

const hann = Float64Array.from(
  { length: WINDOW },
  (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW),
);

/** Calls `each(start)` for every window position covering `n` samples (padded at both ends). */
function windows(n: number, each: (start: number) => void): void {
  for (let start = -WINDOW + HOP; start < n; start += HOP) each(start);
}

function frame(samples: Float32Array, start: number, into: Float64Array): Float64Array {
  if (start >= 0 && start + WINDOW <= samples.length) {
    for (let i = 0; i < WINDOW; i++) into[i] = samples[start + i]! * hann[i]!;
  } else {
    for (let i = 0; i < WINDOW; i++) into[i] = (samples[start + i] ?? 0) * hann[i]!;
  }
  return into;
}

/** Step 1: the noise profile of a part of the sound that has only background noise. */
export function noiseProfile(channels: Channels, rate: number): NoiseProfile {
  const n = channels[0]?.length ?? 0;
  if (n < WINDOW)
    throw new EditError(
      `Select a longer part with only background noise (at least ${(WINDOW / rate).toFixed(2)} s).`,
    );
  const fft = createRealFft(WINDOW);
  const buffer = new Float64Array(WINDOW);
  const power = new Float64Array(BINS);
  let frames = 0;
  for (const channel of channels) {
    // Only whole windows inside the selection, so the edges do not count as quiet.
    for (let start = 0; start + WINDOW <= n; start += HOP) {
      const { re, im } = fft.forward(frame(channel, start, buffer));
      for (let k = 0; k < BINS; k++) power[k]! += re[k]! ** 2 + im[k]! ** 2;
      frames++;
    }
  }
  for (let k = 0; k < BINS; k++) power[k]! /= frames;
  return { rate, power };
}

/** Step 2: the sound with the noise of `profile` reduced. The length stays the same. */
export function reduceNoise(
  channels: Channels,
  rate: number,
  profile: NoiseProfile,
  settings: NoiseSettings,
): Float32Array[] {
  if (profile.rate !== rate)
    throw new EditError(
      `The noise profile was taken at another sample rate (${profile.rate} Hz). Get a new noise profile from this sound.`,
    );
  const fft = createRealFft(WINDOW);
  const floor = 10 ** (-settings.reductionDb / 20);
  const threshold = profile.power.map((p) => p * 10 ** (settings.sensitivity / 10));
  // Per window, a turned-down frequency may fall back by at most this factor.
  const fall = floor ** (HOP / (RELEASE_S * rate));
  const buffer = new Float64Array(WINDOW);
  const width = Math.round(settings.smoothing);
  // Each frequency is kept (1) or turned down (floor). Smoothed over `count` neighbours of which
  // `down` are turned down, the gain is floor^(down / count): looked up, not worked out each time.
  const smoothed = Array.from({ length: 2 * width + 2 }, (_, count) =>
    Float64Array.from({ length: count + 1 }, (_, down) => floor ** (down / Math.max(count, 1))),
  );
  const down = new Uint8Array(BINS);
  const below = new Int32Array(BINS + 1); // below[k] = how many of bins 0 … k−1 are turned down

  return channels.map((input) => {
    const n = input.length;
    const out = new Float64Array(n);
    const weight = new Float64Array(n);
    const gain = new Float64Array(BINS).fill(1);
    // The last three windows: each is decided once the one after it is known.
    const ring = [0, 1, 2].map(() => ({
      start: 0,
      re: new Float64Array(BINS),
      im: new Float64Array(BINS),
      power: new Float64Array(BINS),
    }));
    type Frame = (typeof ring)[number];

    function decide(before: Frame | null, frame: Frame, after: Frame | null): void {
      for (let k = 0; k < BINS; k++) {
        // Sound if loud enough in at least two of the three windows (the second loudest).
        const a = before ? before.power[k]! : 0;
        const b = frame.power[k]!;
        const c = after ? after.power[k]! : 0;
        const second = Math.max(Math.min(a, b), Math.min(Math.max(a, b), c));
        down[k] = second > threshold[k]! ? 0 : 1;
        below[k + 1] = below[k]! + down[k]!;
      }
      for (let k = 0; k < BINS; k++) {
        // Smoothing spreads a kept frequency to its neighbours; it never turns a kept one down.
        const from = Math.max(0, k - width);
        const to = Math.min(BINS, k + width + 1);
        const smooth = down[k] ? smoothed[to - from]![below[to]! - below[from]!]! : 1;
        const g = Math.max(smooth, gain[k]! * fall);
        gain[k] = g;
        frame.re[k]! *= g;
        frame.im[k]! *= g;
      }
      const back = fft.inverse(frame.re, frame.im);
      const first = Math.max(0, -frame.start);
      const last = Math.min(WINDOW, n - frame.start);
      for (let i = first; i < last; i++) {
        out[frame.start + i]! += back[i]! * hann[i]!;
        weight[frame.start + i]! += hann[i]! * hann[i]!;
      }
    }

    let seen = 0;
    windows(n, (start) => {
      const slot = ring[seen % 3]!;
      const { re, im } = fft.forward(frame(input, start, buffer));
      slot.start = start;
      slot.re.set(re);
      slot.im.set(im);
      for (let k = 0; k < BINS; k++) slot.power[k] = re[k]! ** 2 + im[k]! ** 2;
      if (seen >= 1) decide(seen >= 2 ? ring[(seen - 2) % 3]! : null, ring[(seen - 1) % 3]!, slot);
      seen++;
    });
    if (seen >= 1) decide(seen >= 2 ? ring[(seen - 2) % 3]! : null, ring[(seen - 1) % 3]!, null);
    const result = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const cleaned = weight[i]! > 1e-9 ? out[i]! / weight[i]! : input[i]!;
      result[i] = settings.residue ? input[i]! - cleaned : cleaned;
    }
    return result;
  });
}
