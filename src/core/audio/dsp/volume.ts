// Volume effects on samples (A3, A4, A7). Each returns new arrays; the input is never changed.
import type { Channels } from '../pcm.ts';

/** A new channel with `f` applied to every sample (a plain loop: much faster than .map). */
function each(c: Float32Array, f: (v: number, i: number) => number): Float32Array {
  const out = new Float32Array(c.length);
  for (let i = 0; i < c.length; i++) out[i] = f(c[i]!, i);
  return out;
}

export const dbToGain = (db: number): number => 10 ** (db / 20);
export const gainToDb = (gain: number): number => 20 * Math.log10(gain);

/** The loudest sample (absolute value) in any channel. */
export function peak(channels: Channels): number {
  let max = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]!));
  return max;
}

/** A7: gain rises in a straight line from 0 (silent) at the first sample. */
export function fadeIn(channels: Channels): Float32Array[] {
  return channels.map((c) => each(c, (v, i) => (v * i) / c.length));
}

/** A7: gain falls in a straight line to 0 (silent) at the last sample. */
export function fadeOut(channels: Channels): Float32Array[] {
  return channels.map((c) => each(c, (v, i) => (v * (c.length - 1 - i)) / c.length));
}

/** A4: louder or quieter by `db` decibels. Samples may go past ±1 (clipping) — the caller decides. */
export function amplify(channels: Channels, db: number): Float32Array[] {
  const g = dbToGain(db);
  return channels.map((c) => each(c, (v) => v * g));
}

/** A4: the gain that makes the loudest sample exactly 1.0 (0 dB); 0 for silence. */
export function maxGainDb(channels: Channels): number {
  const p = peak(channels);
  return p === 0 ? 0 : -gainToDb(p);
}

/** A3: moves each channel so it is centred on 0 (subtracts its average). */
export function removeDcOffset(channels: Channels): Float32Array[] {
  return channels.map((c) => {
    let sum = 0;
    for (let i = 0; i < c.length; i++) sum += c[i]!;
    const mean = c.length ? sum / c.length : 0;
    return each(c, (v) => v - mean);
  });
}

/**
 * A3: optionally removes the DC offset, then (unless `peakDb` is null) sets one gain for all
 * channels so the loudest sample reaches `peakDb` (e.g. −1 dB). Silence stays silent.
 */
export function normalise(
  channels: Channels,
  { peakDb, removeDc }: { peakDb: number | null; removeDc: boolean },
): Float32Array[] {
  const centred = removeDc ? removeDcOffset(channels) : channels.map((c) => c.slice());
  const p = peak(centred);
  if (peakDb === null || p === 0) return centred;
  const g = dbToGain(peakDb) / p;
  return centred.map((c) => each(c, (v) => v * g));
}
