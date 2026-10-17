// A8 Change speed: plays the sound faster or slower, like a record at another speed, so the
// pitch changes too (as Audacity's Change Speed). Done by resampling with a windowed-sinc filter;
// when speeding up, tones too high for the sample rate are filtered out first (no aliasing).
import type { Channels } from '../pcm.ts';

const ZERO_CROSSINGS = 8; // filter half-width, in zero crossings of the sinc
const PHASES = 512; // positions between two samples the filter is worked out for

/** Blackman-windowed sinc, zero beyond ±ZERO_CROSSINGS. */
function windowedSinc(x: number): number {
  const a = Math.abs(x);
  if (a >= ZERO_CROSSINGS) return 0;
  const sinc = a === 0 ? 1 : Math.sin(Math.PI * a) / (Math.PI * a);
  const w = (Math.PI * (a + ZERO_CROSSINGS)) / ZERO_CROSSINGS;
  return sinc * (0.42 - 0.5 * Math.cos(w) + 0.08 * Math.cos(2 * w));
}

/** `speed` 2 = twice as fast (half as long, an octave higher); 0.5 = half speed. */
export function changeSpeed(channels: Channels, speed: number): Float32Array[] {
  if (!(speed > 0) || !Number.isFinite(speed))
    throw new RangeError('The speed must be greater than 0.');
  const cutoff = Math.min(1, 1 / speed); // fraction of the original Nyquist frequency kept
  const reach = Math.ceil(ZERO_CROSSINGS / cutoff); // input samples each side of the position
  const taps = 2 * reach;
  // Polyphase table: the filter weights for each of PHASES positions between two samples.
  const weights = new Float32Array((PHASES + 1) * taps);
  for (let p = 0; p <= PHASES; p++) {
    const frac = p / PHASES;
    for (let t = 0; t < taps; t++) {
      const distance = frac - (t - reach + 1); // position − input sample
      weights[p * taps + t] = windowedSinc(distance * cutoff) * cutoff;
    }
  }
  return channels.map((input) => {
    const n = input.length;
    const out = new Float32Array(Math.round(n / speed));
    for (let j = 0; j < out.length; j++) {
      const x = j * speed;
      const base = Math.floor(x);
      const w = Math.round((x - base) * PHASES) * taps;
      const first = base - reach + 1;
      let sum = 0;
      if (first >= 0 && first + taps <= n) {
        for (let t = 0; t < taps; t++) sum += input[first + t]! * weights[w + t]!;
      } else {
        for (let t = 0; t < taps; t++) {
          const i = first + t;
          if (i >= 0 && i < n) sum += input[i]! * weights[w + t]!;
        }
      }
      out[j] = sum;
    }
    return out;
  });
}
