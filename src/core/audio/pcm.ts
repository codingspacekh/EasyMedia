// Audio mode data (ARCHITECTURE §5): tracks of decoded samples (PCM). A track holds clips, as
// the video timeline does: each clip can be moved, trimmed at its edges, split and joined.
// One Float32Array per channel, values −1…1. Sample arrays are never changed once made:
// every edit builds new arrays, so earlier states stay intact (see history.ts).
import type { Seconds } from '../model/time.ts';
import type { Id } from '../model/types.ts';

export type Channels = readonly Float32Array[];

/**
 * A piece of sound on a track. Only samples [in, out) of `source` are heard; trimming a clip
 * only moves `in` and `out`, so dragging an edge back out brings the sound back (as in Video
 * mode). The two halves of a split clip share one `source` (no copy).
 */
export interface AudioClip {
  id: Id;
  /** Where sample `in` plays, in seconds. */
  offset: Seconds;
  /** All the clip's samples, including the trimmed-away ends; one array per channel. */
  source: Channels;
  in: number;
  out: number;
}

export interface AudioTrack {
  id: Id;
  name: string;
  /** 1 = mono, 2 = stereo; every clip on the track has this many channels. */
  channelCount: number;
  /** In any order; clips on a track never overlap. */
  clips: readonly AudioClip[];
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

/** A clip that uses all of `channels`. */
export function createClip({
  id,
  channels,
  offset = 0,
}: {
  id: Id;
  channels: Channels;
  offset?: Seconds;
}): AudioClip {
  return { id, offset, source: channels, in: 0, out: channels[0]?.length ?? 0 };
}

/**
 * A track holding `channels` as one clip (called `<track id>.c`) starting at `offset`; with no
 * samples, an empty track with that many channels.
 */
export function createTrack({
  channels,
  offset = 0,
  ...track
}: Pick<AudioTrack, 'id' | 'name'> &
  Partial<Omit<AudioTrack, 'clips' | 'channelCount'>> & {
    channels: Channels;
    offset?: Seconds;
  }): AudioTrack {
  const clips = channels[0]!.length ? [createClip({ id: `${track.id}.c`, channels, offset })] : [];
  return { gain: 0, pan: 0, ...track, channelCount: channels.length, clips };
}

/** Samples heard from the clip (per channel). Views of the source: never change them. */
export const clipChannels = (clip: AudioClip): Float32Array[] =>
  clip.source.map((c) => c.subarray(clip.in, clip.out));

export const clipLength = (clip: AudioClip): number => clip.out - clip.in;

export const clipEnd = (clip: AudioClip, rate: number): Seconds =>
  clip.offset + clipLength(clip) / rate;

/** The clips in time order. */
export const clipsInOrder = (track: AudioTrack): AudioClip[] =>
  [...track.clips].sort((a, b) => a.offset - b.offset);

/** Where the track's first clip starts (0 when it has none). */
export const trackStart = (track: AudioTrack): Seconds =>
  track.clips.length ? Math.min(...track.clips.map((c) => c.offset)) : 0;

export const trackEnd = (track: AudioTrack, rate: number): Seconds =>
  track.clips.length ? Math.max(...track.clips.map((c) => clipEnd(c, rate))) : 0;

/** From the start of the first clip to the end of the last one. */
export const trackDuration = (track: AudioTrack, rate: number): Seconds =>
  trackEnd(track, rate) - trackStart(track);

/** Samples from the start of the first clip to the end of the last one, per channel. */
export const trackLength = (track: AudioTrack, rate: number): number =>
  track.clips.length
    ? toSamples(trackEnd(track, rate), rate) - toSamples(trackStart(track), rate)
    : 0;

/** The track as one sound: its clips where they play, silence in the gaps. */
export function trackSound(
  track: AudioTrack,
  rate: number,
): { offset: Seconds; channels: Float32Array[] } {
  const offset = trackStart(track);
  const first = toSamples(offset, rate);
  const out = silence(trackLength(track, rate), track.channelCount);
  for (const clip of track.clips) {
    const at = toSamples(clip.offset, rate) - first;
    clipChannels(clip).forEach((c, ch) => out[ch]!.set(c, at));
  }
  return { offset, channels: out };
}

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
