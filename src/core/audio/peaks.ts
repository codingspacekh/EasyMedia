// A1 waveform view: what to draw in each pixel column, for any zoom and scroll position.
import type { Seconds } from '../model/time.ts';

/** At most this many samples are looked at per column (enough to find the peaks). */
const MAX_LOOKS = 4096;

/**
 * The lowest and highest sample under each of `width` pixel columns, starting at time `from`.
 * Columns where the track has no sound are NaN.
 */
export function waveColumns(
  channel: Float32Array,
  {
    rate,
    offset,
    from,
    pxPerSecond,
    width,
  }: { rate: number; offset: Seconds; from: Seconds; pxPerSecond: number; width: number },
): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(width).fill(NaN);
  const max = new Float32Array(width).fill(NaN);
  const n = channel.length;
  const perPx = rate / pxPerSecond;
  const start = (from - offset) * rate;
  for (let x = 0; x < width; x++) {
    const a = Math.floor(start + x * perPx);
    const b = Math.max(a + 1, Math.floor(start + (x + 1) * perPx));
    if (b <= 0 || a >= n) continue;
    const first = Math.max(0, a);
    const last = Math.min(n, b);
    const stride = Math.max(1, Math.ceil((last - first) / MAX_LOOKS));
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = first; i < last; i += stride) {
      const v = channel[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[x] = lo;
    max[x] = hi;
  }
  return { min, max };
}
