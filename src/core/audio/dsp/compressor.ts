// A19 Dynamic range compression: loud parts are turned down so loud and quiet are closer together.
// An envelope follower tracks how loud the sound is (rising over the attack time, falling over
// the release time); above the threshold, every `ratio` dB louder comes out only 1 dB louder.
// Make-up gain then raises the whole result so its loudest part is at 0 dB (as Audacity).
// This is not file compression (MP3, FLAC): the file is no smaller.
import type { Channels } from '../pcm.ts';
import { peak } from './volume.ts';

export interface CompressorSettings {
  thresholdDb: number;
  /** 3 = every 3 dB above the threshold comes out as 1 dB. */
  ratio: number;
  /** Seconds to react to a louder sound. */
  attack: number;
  /** Seconds to let go after it. */
  release: number;
  /** Raise the result so its loudest part is at 0 dB. */
  makeUp: boolean;
}

/** The output level (dB) for a steady input level (dB): the input → output curve. */
export function compressedDb(
  inputDb: number,
  s: Pick<CompressorSettings, 'thresholdDb' | 'ratio'>,
) {
  return inputDb <= s.thresholdDb ? inputDb : s.thresholdDb + (inputDb - s.thresholdDb) / s.ratio;
}

export function compress(channels: Channels, rate: number, s: CompressorSettings): Float32Array[] {
  const n = channels[0]?.length ?? 0;
  const out = channels.map((c) => new Float32Array(c.length));
  const rise = Math.exp(-1 / (Math.max(s.attack, 1e-4) * rate));
  const fall = Math.exp(-1 / (Math.max(s.release, 1e-4) * rate));
  const threshold = 10 ** (s.thresholdDb / 20);
  const slope = 1 / s.ratio - 1; // dB of gain change per dB above the threshold
  let envelope = 0;
  for (let i = 0; i < n; i++) {
    // Both sides follow the louder one, so the stereo balance does not move.
    let level = 0;
    for (const c of channels) level = Math.max(level, Math.abs(c[i]!));
    const k = level > envelope ? rise : fall;
    envelope = k * envelope + (1 - k) * level;
    const gain = envelope > threshold ? (envelope / threshold) ** slope : 1;
    for (let c = 0; c < channels.length; c++) out[c]![i] = channels[c]![i]! * gain;
  }
  if (s.makeUp) {
    const p = peak(out);
    if (p > 0) for (const c of out) for (let i = 0; i < c.length; i++) c[i]! /= p;
  }
  return out;
}
