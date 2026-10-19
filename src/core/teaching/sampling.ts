// T4: the sampling visualiser (screen 21). An "analogue" wave is sampled a number of times and
// each sample is stored at a sample resolution (bits); what is stored holds its value until the
// next sample. Values run from 0 to 10 over 10 time units, as in Book A Figures 11.23 and 11.24.

export const WAVE_LENGTH = 10;
export const WAVE_TOP = 10;

/**
 * Book A Figure 11.23, one point every 0.5: it goes through the book's table at 1, 2, … 10
 * (6, 8.5, 2.5, 8, 3.5, 2, 4.5, 3, 8.5, 3.5); the points in between are read off the figure,
 * so that sampling twice as often catches the detail the book's 10 samples miss.
 */
export const BOOK_A_WAVE: readonly number[] = [
  0, 3.3, 6, 7.8, 8.5, 7, 2.5, 8.3, 8, 5.5, 3.5, 1.6, 2, 3.6, 4.5, 2.2, 3, 6.2, 8.5, 6, 3.5,
];

export interface Sample {
  time: number;
  /** The value stored, after rounding to the nearest level. */
  value: number;
}

/** The number of different values a sample can store: 2 to the power of the bits. */
export const levels = (bits: number): number => 2 ** bits;

/** The value rounded to the nearest of the levels, which are spread evenly from 0 to the top. */
export function quantise(value: number, bits: number): number {
  const step = WAVE_TOP / (levels(bits) - 1);
  return Math.min(WAVE_TOP, Math.max(0, Math.round(value / step) * step));
}

/**
 * The wave's height at time `t`: a smooth curve through the points (evenly spaced over the
 * length), which never overshoots between two points (monotone cubic, Fritsch–Carlson).
 */
export function waveAt(points: readonly number[], t: number): number {
  const n = points.length;
  const h = WAVE_LENGTH / (n - 1);
  const x = Math.min(WAVE_LENGTH, Math.max(0, t)) / h;
  const k = Math.min(n - 2, Math.floor(x));
  const s = x - k;
  const slope = (i: number) => {
    if (i <= 0) return points[1]! - points[0]!;
    if (i >= n - 1) return points[n - 1]! - points[n - 2]!;
    const left = points[i]! - points[i - 1]!;
    const right = points[i + 1]! - points[i]!;
    return left * right <= 0 ? 0 : (2 * left * right) / (left + right); // flat at a peak or dip
  };
  const [p0, p1, m0, m1] = [points[k]!, points[k + 1]!, slope(k), slope(k + 1)];
  const s2 = s * s;
  const s3 = s2 * s;
  return (
    (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1
  );
}

/** `count` samples at equal times up to the end of the wave (the first one after one interval). */
export function sampleWave(points: readonly number[], count: number, bits: number): Sample[] {
  return Array.from({ length: count }, (_, i) => {
    const time = Number((((i + 1) * WAVE_LENGTH) / count).toFixed(6));
    return { time, value: quantise(waveAt(points, time), bits) };
  });
}

/** What is stored at time `t`: the last sample taken (0 before the first one). */
export function storedAt(samples: readonly Sample[], t: number): number {
  let value = 0;
  for (const s of samples) {
    if (s.time > t + 1e-9) break;
    value = s.value;
  }
  return value;
}

/** How far what is stored is from the original wave, on average over its length. */
export function distance(points: readonly number[], samples: readonly Sample[]): number {
  const steps = 1000;
  let total = 0;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * WAVE_LENGTH;
    total += Math.abs(waveAt(points, t) - storedAt(samples, t));
  }
  return total / (steps + 1);
}
