// A10 Echo and Delay: copies of the sound played again later, each quieter than the one before.
// Echo (as Audacity's Echo): each echo is the sound so far, delayed and multiplied by the decay,
// so it goes on until the selection ends. Delay (as Audacity's Delay): a set number of echoes,
// each so many dB quieter, at equal gaps or at gaps that shrink or grow (bouncing ball).
import type { Channels } from '../pcm.ts';
import { dbToGain } from './volume.ts';

export type DelayType = 'regular' | 'bouncing' | 'reverse';

export interface DelaySettings {
  type: DelayType;
  /** Seconds: the gap between echoes (regular), or the longest gap (bouncing ball). */
  delay: number;
  echoes: number;
  /** How much quieter each echo is than the one before. */
  decayDb: number;
  /** Leave out echoes after the end instead of making the sound longer. */
  keepLength?: boolean;
}

/** `delay` seconds, `decay` 0–1: each echo is the one before × decay. */
export function echo(
  channels: Channels,
  rate: number,
  delay: number,
  decay: number,
): Float32Array[] {
  const gap = Math.round(delay * rate);
  return channels.map((input) => {
    const out = input.slice();
    if (gap < 1) return out;
    for (let i = gap; i < out.length; i++) out[i]! += decay * out[i - gap]!;
    return out;
  });
}

/** When each echo starts, in seconds after the sound. */
export function echoTimes(type: DelayType, delay: number, echoes: number): number[] {
  const times: number[] = [];
  let at = 0;
  for (let k = 1; k <= echoes; k++) {
    const share =
      type === 'regular' ? 1 : type === 'bouncing' ? (echoes - k + 1) / echoes : k / echoes;
    at += delay * share;
    times.push(Math.round(at * 1e9) / 1e9);
  }
  return times;
}

export function delay(channels: Channels, rate: number, settings: DelaySettings): Float32Array[] {
  const starts = echoTimes(settings.type, settings.delay, settings.echoes).map((t) =>
    Math.round(t * rate),
  );
  const n = channels[0]?.length ?? 0;
  const length = settings.keepLength ? n : n + (starts.at(-1) ?? 0);
  return channels.map((input) => {
    const out = new Float32Array(length);
    out.set(input.subarray(0, length));
    starts.forEach((start, k) => {
      const gain = dbToGain(-settings.decayDb * (k + 1));
      const count = Math.min(n, length - start);
      for (let i = 0; i < count; i++) out[start + i]! += gain * input[i]!;
    });
    return out;
  });
}
