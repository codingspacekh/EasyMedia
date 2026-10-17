// A9 Change pitch: higher or lower, the length stays the same (as Audacity's Change Pitch).
// Two steps, as SoundTouch does: change the speed (which moves the pitch and the length), and
// stretch the time back to the old length without changing the pitch (WSOLA: short overlapping
// windows, each moved a little so its waves line up with the one before). Whichever step makes
// the sound shorter goes first, so the second has less to do.
import type { Channels } from '../pcm.ts';
import { changeSpeed } from './speed.ts';

const WINDOW_S = 0.04; // length of each window
const SEEK_S = 0.012; // how far a window may move to line up with the one before
const MATCH_S = 0.01; // how much of the overlap is compared when lining up
const COARSE = 4; // the first search uses the sound with every 4 samples averaged into one
const MAX_SEMITONES = 24;

/** All channels added together (zero-padded at the end), with running totals of energy. */
interface Guide {
  samples: Float32Array;
  energy: Float64Array; // energy[i] = sum of samples[j]² for j < i
}

function guide(samples: Float32Array): Guide {
  const energy = new Float64Array(samples.length + 1);
  for (let i = 0; i < samples.length; i++) energy[i + 1] = energy[i]! + samples[i]! ** 2;
  return { samples, energy };
}

/** How well the sound at `candidate` lines up with the sound at `template` (normalised). */
function score(g: Guide, template: number, candidate: number, length: number): number {
  const s = g.samples;
  let sum = 0;
  for (let i = 0; i < length; i++) sum += s[template + i]! * s[candidate + i]!;
  const energy = g.energy[candidate + length]! - g.energy[candidate]!;
  return energy > 1e-12 ? sum / Math.sqrt(energy) : 0;
}

/** The position near `nominal` whose sound best continues the window before (at `template`). */
function bestPosition(
  fine: Guide,
  coarse: Guide,
  template: number,
  nominal: number,
  seek: number,
  match: number,
  last: number,
): number {
  const from = Math.max(0, nominal - seek);
  const to = Math.min(last, nominal + seek);
  if (to <= from) return Math.min(Math.max(nominal, 0), last);
  const t = Math.floor(template / COARSE);
  const length = Math.floor(match / COARSE);
  let best = from;
  let bestScore = -Infinity;
  for (let p = Math.ceil(from / COARSE); p * COARSE <= to; p++) {
    const sc = score(coarse, t, p, length);
    if (sc > bestScore) [best, bestScore] = [p * COARSE, sc];
  }
  const around = best;
  bestScore = -Infinity;
  for (let p = Math.max(from, around - COARSE); p <= Math.min(to, around + COARSE); p++) {
    const sc = score(fine, template, p, match);
    if (sc > bestScore) [best, bestScore] = [p, sc];
  }
  return best;
}

/** `stretch` 1.5 = half as long again, at the same pitch; 0.5 = half as long. */
export function timeStretch(channels: Channels, rate: number, stretch: number): Float32Array[] {
  if (!(stretch > 0) || !Number.isFinite(stretch))
    throw new RangeError('The stretch must be greater than 0.');
  const n = channels[0]?.length ?? 0;
  const outLength = Math.round(n * stretch);
  const size = 2 * Math.round((WINDOW_S * rate) / 2);
  const hop = size / 2; // windows overlap by half; a Hann window then adds up to 1
  const seek = Math.round(SEEK_S * rate);
  const match = Math.min(hop, Math.round(MATCH_S * rate));
  const last = Math.max(0, n - size);
  // The windows are placed by looking at all the channels together, so stereo stays in step.
  const padded = new Float32Array(n + size + hop + COARSE);
  for (const c of channels) for (let i = 0; i < n; i++) padded[i]! += c[i]!;
  const small = new Float32Array(Math.ceil(padded.length / COARSE));
  for (let i = 0; i < padded.length; i++) small[Math.floor(i / COARSE)]! += padded[i]! / COARSE;
  const fine = guide(padded);
  const coarse = guide(small);
  const window = Float32Array.from(
    { length: size },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size),
  );
  const first = window.map((w, i) => (i < hop ? 1 : w));
  const out = channels.map(() => new Float32Array(outLength));
  const weight = new Float32Array(outLength);
  let previous = 0;
  for (let k = 0; k * hop < outLength; k++) {
    const nominal = Math.round((k * hop) / stretch);
    const position =
      k === 0 ? 0 : bestPosition(fine, coarse, previous + hop, nominal, seek, match, last);
    const start = k * hop;
    const end = Math.min(size, outLength - start);
    const available = Math.min(end, n - position);
    // The first window starts at full level, so the sound does not fade in.
    const w = k === 0 ? first : window;
    for (let i = 0; i < end; i++) weight[start + i]! += w[i]!;
    for (let c = 0; c < channels.length; c++) {
      const from = channels[c]!;
      const to = out[c]!;
      for (let i = 0; i < available; i++) to[start + i]! += w[i]! * from[position + i]!;
    }
    previous = position;
  }
  for (const channel of out) {
    for (let i = 0; i < outLength; i++) if (weight[i]! > 1e-3) channel[i]! /= weight[i]!;
  }
  return out;
}

/** Moves the pitch by `semitones` (12 = an octave up); the length stays exactly the same. */
export function changePitch(channels: Channels, rate: number, semitones: number): Float32Array[] {
  if (!Number.isFinite(semitones) || Math.abs(semitones) > MAX_SEMITONES)
    throw new RangeError(`The pitch can change by at most ${MAX_SEMITONES} semitones.`);
  const n = channels[0]?.length ?? 0;
  if (semitones === 0 || n === 0) return channels.map((c) => c.slice());
  const ratio = 2 ** (semitones / 12);
  // Up: faster first (shorter), then stretch. Down: stretch first (shorter), then slower.
  // A few samples sped up can round to none; they are stretched first instead.
  const faster = ratio > 1 ? changeSpeed(channels, ratio) : null;
  const out = faster?.[0]?.length
    ? timeStretch(faster, rate, n / faster[0].length)
    : changeSpeed(timeStretch(channels, rate, ratio), ratio);
  return out.map((c) => {
    if (c.length === n) return c;
    const fitted = new Float32Array(n);
    fitted.set(c.subarray(0, n));
    return fitted;
  });
}
