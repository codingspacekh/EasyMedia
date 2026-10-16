// Audio mode data (ARCHITECTURE §5): tracks of decoded samples (PCM), Audacity style.
// One Float32Array per channel, values −1…1. Sample arrays are never changed once made:
// every edit builds new arrays, so earlier states stay intact (see history.ts).
import type { Seconds } from '../model/time.ts';
import type { Id } from '../model/types.ts';

export type Channels = readonly Float32Array[];

export interface AudioTrack {
  id: Id;
  name: string;
  /** Where the track's first sample plays, in seconds (time-shift, align). */
  offset: Seconds;
  /** 1 = mono, 2 = stereo (never none); all channels have the same length. */
  channels: Channels;
  /** Volume of the track in the mix, in dB (0 = as recorded). */
  gain: number;
  /** −1 = left only, 0 = centre, 1 = right only. */
  pan: number;
  /** Sample resolution of the file it came from (T1, size maths), e.g. 16. */
  bits?: number;
}

/** Everything in Audio mode. All tracks share one sample rate (the project rate). */
export interface AudioDoc {
  rate: number;
  tracks: readonly AudioTrack[];
}

export const DEFAULT_RATE = 44100;

export function emptyDoc(rate = DEFAULT_RATE): AudioDoc {
  return { rate, tracks: [] };
}

export function createTrack(
  track: Pick<AudioTrack, 'id' | 'name' | 'channels'> & Partial<AudioTrack>,
): AudioTrack {
  return { offset: 0, gain: 0, pan: 0, ...track };
}

export const trackLength = (track: AudioTrack): number => track.channels[0]!.length;

export const trackDuration = (track: AudioTrack, rate: number): Seconds =>
  trackLength(track) / rate;

export const trackEnd = (track: AudioTrack, rate: number): Seconds =>
  track.offset + trackDuration(track, rate);

/** Seconds → whole samples. */
export const toSamples = (seconds: Seconds, rate: number): number => Math.round(seconds * rate);

export function silence(length: number, channels: number): Float32Array[] {
  return Array.from({ length: channels }, () => new Float32Array(length));
}

/** A copy of samples [from, to) of every channel. */
export function sliceChannels(channels: Channels, from: number, to: number): Float32Array[] {
  return channels.map((c) => c.slice(from, to));
}

/** Channels joined one after another (same channel count). */
export function concatChannels(...parts: Channels[]): Float32Array[] {
  const count = parts[0]!.length;
  return Array.from({ length: count }, (_, ch) => {
    const out = new Float32Array(parts.reduce((n, p) => n + p[ch]!.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p[ch]!, at);
      at += p[ch]!.length;
    }
    return out;
  });
}

/** Channels → one array with the samples side by side (L R L R…), as FFmpeg reads and writes. */
export function interleave(channels: Channels): Float32Array {
  const count = channels.length;
  const length = channels[0]!.length;
  const out = new Float32Array(length * count);
  for (let ch = 0; ch < count; ch++) {
    const c = channels[ch]!;
    for (let i = 0; i < length; i++) out[i * count + ch] = c[i]!;
  }
  return out;
}

/** The opposite of interleave. */
export function deinterleave(data: Float32Array, count: number): Float32Array[] {
  const length = Math.floor(data.length / count);
  return Array.from({ length: count }, (_, ch) => {
    const c = new Float32Array(length);
    for (let i = 0; i < length; i++) c[i] = data[i * count + ch]!;
    return c;
  });
}

/** The same sound with `count` channels: mono is copied to both sides, stereo is averaged. */
export function matchChannels(channels: Channels, count: number): Float32Array[] {
  if (channels.length === count) return [...channels];
  if (count === 1) {
    const [l, r] = channels as [Float32Array, Float32Array];
    return [l.map((v, i) => (v + r[i]!) / 2)];
  }
  return Array.from({ length: count }, () => channels[0]!.slice());
}
