import { trackSound, type AudioDoc } from '../../src/core/audio/pcm.ts';

// Exact sample-for-sample equality, compared as bytes: toEqual walks long sample arrays one
// value at a time, which takes seconds on a busy CI runner.
export const sameSamples = (a: Float32Array, b: Float32Array): boolean =>
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
    Buffer.from(b.buffer, b.byteOffset, b.byteLength),
  );

/**
 * Track `i` of an Audio mode document as one sound (its clips, silence in the gaps) and where
 * it starts: what the student hears, whatever clips it is made of.
 */
export const soundOf = (doc: AudioDoc, i: number): { offset: number; channels: Float32Array[] } =>
  trackSound(doc.tracks.at(i)!, doc.rate);
