// A24 Remove silences (as Audacity's Truncate Silence): quiet parts that last long enough are
// shortened, so a recording with long pauses gets shorter. Each returns new arrays.
import type { Channels } from '../pcm.ts';

/** A quiet part: samples [start, end) of the sound. */
export interface QuietPart {
  start: number;
  end: number;
}

export interface SilenceSettings {
  /** Quieter than this (dB below the loudest possible sample) counts as silence. */
  thresholdDb: number;
  /** A quiet part must last at least this long (seconds) to be shortened. */
  minimum: number;
  /** Its new length (seconds); never more than `minimum`. */
  keep: number;
}

/** The two ends of a shortened quiet part are blended over at most this long, so nothing clicks. */
const BLEND = 0.01;

/** Parts at least `minimum` seconds long where every channel stays under the threshold. */
export function findQuietParts(
  channels: Channels,
  rate: number,
  { thresholdDb, minimum }: Pick<SilenceSettings, 'thresholdDb' | 'minimum'>,
): QuietPart[] {
  const limit = 10 ** (thresholdDb / 20);
  const n = channels[0]?.length ?? 0;
  const shortest = Math.max(1, Math.round(minimum * rate));
  const parts: QuietPart[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const quiet = i < n && channels.every((c) => Math.abs(c[i]!) < limit);
    if (quiet && start < 0) start = i;
    if (!quiet && start >= 0) {
      if (i - start >= shortest) parts.push({ start, end: i });
      start = -1;
    }
  }
  return parts;
}

/** How many samples each quiet part keeps. */
const kept = (part: QuietPart, keep: number) => Math.min(part.end - part.start, keep);

/** How many seconds shorter the sound gets, and how many quiet parts are shortened. */
export function silenceSaving(
  channels: Channels,
  rate: number,
  settings: SilenceSettings,
): { parts: number; seconds: number } {
  const keep = Math.round(settings.keep * rate);
  const parts = findQuietParts(channels, rate, settings);
  const removed = parts.reduce((sum, p) => sum + (p.end - p.start - kept(p, keep)), 0);
  return { parts: parts.length, seconds: removed / rate };
}

/**
 * Each quiet part becomes `keep` seconds long: its first and last halves are kept (the breath
 * after a sentence and before the next one), blended in the middle.
 */
export function removeSilences(
  channels: Channels,
  rate: number,
  settings: SilenceSettings,
): Float32Array[] {
  const keep = Math.round(settings.keep * rate);
  const parts = findQuietParts(channels, rate, settings);
  const blend = Math.round(BLEND * rate);
  return channels.map((c) => {
    const removed = parts.reduce((sum, p) => sum + (p.end - p.start - kept(p, keep)), 0);
    const out = new Float32Array(c.length - removed);
    let from = 0;
    let to = 0;
    for (const part of parts) {
      out.set(c.subarray(from, part.start), to);
      to += part.start - from;
      const k = kept(part, keep);
      const x = Math.min(k, blend);
      const middle = (k - x) / 2;
      for (let j = 0; j < k; j++) {
        const w = x === 0 ? (j < k / 2 ? 0 : 1) : Math.min(1, Math.max(0, (j - middle) / x));
        out[to + j] = c[part.start + j]! * (1 - w) + c[part.end - k + j]! * w;
      }
      to += k;
      from = part.end;
    }
    out.set(c.subarray(from), to);
    return out;
  });
}
