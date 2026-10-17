// Channels and mixing (A6, A15).
import type { Channels } from '../pcm.ts';

/** A15: mixes left and right into one channel (their average). A mono sound is returned as it is. */
export function stereoToMono(channels: Channels): Channels {
  if (channels.length < 2) return channels;
  const [l, r] = channels as [Float32Array, Float32Array];
  return [l.map((v, i) => (v + r[i]!) / 2)];
}

export interface MixPart {
  /** First sample of the part in the mix. */
  at: number;
  channels: Channels;
  /** Gain for each output channel (e.g. after pan): one number per channel of the mix. */
  gains: readonly number[];
}

/**
 * A6 Mix and render: adds the parts at their positions into `count` channels and clips the
 * sum to −1…1, as a real file would. A mono part goes into every channel; a stereo part into a
 * mono mix is averaged.
 */
export function mixDown(parts: readonly MixPart[], count: number, length?: number): Float32Array[] {
  const total = length ?? Math.max(0, ...parts.map((p) => p.at + p.channels[0]!.length));
  const out = Array.from({ length: count }, () => new Float32Array(total));
  for (const part of parts) {
    const n = part.channels[0]!.length;
    for (let ch = 0; ch < count; ch++) {
      const g = part.gains[ch] ?? 1;
      const target = out[ch]!;
      const a = part.channels.length === count ? part.channels[ch]! : part.channels[0]!;
      const b = part.channels.length > count ? part.channels[1] : undefined;
      const scale = b ? g / 2 : g;
      for (let i = Math.max(0, -part.at); i < n && part.at + i < total; i++)
        target[part.at + i]! += (a[i]! + (b ? b[i]! : 0)) * scale;
    }
  }
  for (const c of out) for (let i = 0; i < c.length; i++) c[i] = Math.max(-1, Math.min(1, c[i]!));
  return out;
}
