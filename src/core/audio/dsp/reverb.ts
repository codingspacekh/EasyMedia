// A11 Reverb: the sound as if played in a room, by Freeverb (Jezar, public domain): 8 comb
// filters (echoes that feed back, each a little softer and duller) side by side, then 4 all-pass
// filters in a row that smear them into a smooth tail. Room size sets how long the echo paths
// are, reverberance how much of the sound comes back each time, damping how dull the tail gets.
import type { Channels } from '../pcm.ts';

export interface ReverbSettings {
  /** 0–1 */
  roomSize: number;
  /** 0–1: how long it rings */
  reverberance: number;
  /** 0–1: how quickly the high tones die away */
  damping: number;
  /** 0–1: how much of the output is reverb (the rest is the sound itself) */
  wet: number;
  /** Let the reverb ring on after the end (the sound gets longer). */
  tail?: boolean;
}

// Freeverb's delay lengths in samples at 44.1 kHz; the right side's are 23 samples longer.
const COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES = [556, 441, 341, 225];
const SPREAD = 23;
const INPUT_GAIN = 0.015;
const WET_GAIN = 3;
const MAX_TAIL_S = 10;

function scaled(lengths: number[], factor: number): number[] {
  return lengths.map((n) => Math.max(1, Math.round(n * factor)));
}

/** How long the reverb rings on after a sound stops (until 60 dB down), at most MAX_TAIL_S. */
export function ringSeconds(settings: ReverbSettings): number {
  const feedback = 0.7 + 0.28 * settings.reverberance;
  const longest = (Math.max(...COMBS) * (0.4 + 0.8 * settings.roomSize)) / 44100;
  return Math.min(MAX_TAIL_S, (Math.log(0.001) / Math.log(feedback)) * longest);
}

export function reverb(channels: Channels, rate: number, settings: ReverbSettings): Float32Array[] {
  const n = channels[0]?.length ?? 0;
  if (settings.wet === 0 && !settings.tail) return channels.map((c) => c.slice());
  const size = (rate / 44100) * (0.4 + 0.8 * settings.roomSize);
  const feedback = 0.7 + 0.28 * settings.reverberance;
  const damp = 0.4 * settings.damping;
  const tail = settings.tail ? Math.round(ringSeconds(settings) * rate) : 0;
  const length = n + tail;
  // Freeverb feeds the reverb the sum of the channels and gives each side its own tuning.
  const input = new Float32Array(length);
  const share = (2 / channels.length) * INPUT_GAIN;
  for (const c of channels) for (let i = 0; i < n; i++) input[i]! += c[i]! * share;

  return channels.map((dry, side) => {
    const combs = scaled(COMBS, size).map((d) => d + Math.round(side * SPREAD * size));
    const allpasses = scaled(ALLPASSES, size).map((d) => d + Math.round(side * SPREAD * size));
    const combBuffers = combs.map((d) => new Float32Array(d));
    const combIndex = new Int32Array(combs.length);
    const stores = new Float64Array(combs.length);
    const allBuffers = allpasses.map((d) => new Float32Array(d));
    const allIndex = new Int32Array(allpasses.length);
    const out = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const x = input[i]!;
      let sum = 0;
      for (let k = 0; k < combBuffers.length; k++) {
        const buffer = combBuffers[k]!;
        const j = combIndex[k]!;
        const y = buffer[j]!;
        stores[k] = y * (1 - damp) + stores[k]! * damp;
        buffer[j] = x + stores[k]! * feedback;
        combIndex[k] = j + 1 === buffer.length ? 0 : j + 1;
        sum += y;
      }
      for (let k = 0; k < allBuffers.length; k++) {
        const buffer = allBuffers[k]!;
        const j = allIndex[k]!;
        const y = buffer[j]!;
        buffer[j] = sum + y * 0.5;
        sum = y - sum;
        allIndex[k] = j + 1 === buffer.length ? 0 : j + 1;
      }
      out[i] = (i < n ? dry[i]! * (1 - settings.wet) : 0) + sum * WET_GAIN * settings.wet;
    }
    return out;
  });
}
