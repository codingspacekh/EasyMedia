// A real FFT (fast Fourier transform): the frequencies in a window of samples, and back. A window
// of n real samples is packed into n/2 complex ones (even samples real, odd imaginary), which
// halves the work; the two halves are then separated. Results are written into buffers the
// FFT owns, so each call overwrites the one before.

export interface RealFft {
  readonly size: number;
  /** Bins 0 … size/2 of the spectrum of `samples` (length `size`). */
  forward(samples: Float64Array): { re: Float64Array; im: Float64Array };
  /** The samples whose spectrum (bins 0 … size/2) is `re`, `im`. */
  inverse(re: Float64Array, im: Float64Array): Float64Array;
}

export function createRealFft(size: number): RealFft {
  if (size < 4 || (size & (size - 1)) !== 0)
    throw new RangeError('The FFT size must be a power of two (4 or more).');
  const m = size / 2; // the complex FFT's size
  const bits = Math.log2(m);
  const reversed = new Uint32Array(m);
  for (let i = 0; i < m; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    reversed[i] = r;
  }
  const cos = Float64Array.from({ length: m / 2 }, (_, k) => Math.cos((2 * Math.PI * k) / m));
  const sin = Float64Array.from({ length: m / 2 }, (_, k) => Math.sin((2 * Math.PI * k) / m));
  // e^(−2πik/size), to separate the even and odd halves.
  const wr = Float64Array.from({ length: m + 1 }, (_, k) => Math.cos((2 * Math.PI * k) / size));
  const wi = Float64Array.from({ length: m + 1 }, (_, k) => -Math.sin((2 * Math.PI * k) / size));
  const zr = new Float64Array(m);
  const zi = new Float64Array(m);
  const outRe = new Float64Array(m + 1);
  const outIm = new Float64Array(m + 1);
  const samples = new Float64Array(size);

  /** In-place complex FFT of zr, zi; `sign` −1 forward, +1 inverse (not scaled). */
  function complexFft(sign: number): void {
    for (let i = 0; i < m; i++) {
      const j = reversed[i]!;
      if (j > i) {
        const r = zr[i]!;
        zr[i] = zr[j]!;
        zr[j] = r;
        const t = zi[i]!;
        zi[i] = zi[j]!;
        zi[j] = t;
      }
    }
    for (let length = 2; length <= m; length *= 2) {
      const half = length / 2;
      const step = m / length;
      for (let j = 0; j < half; j++) {
        const c = cos[j * step]!;
        const s = sign * sin[j * step]!;
        for (let a = j; a < m; a += length) {
          const b = a + half;
          const br = zr[b]!;
          const bi = zi[b]!;
          const tr = br * c - bi * s;
          const ti = br * s + bi * c;
          const ar = zr[a]!;
          const ai = zi[a]!;
          zr[b] = ar - tr;
          zi[b] = ai - ti;
          zr[a] = ar + tr;
          zi[a] = ai + ti;
        }
      }
    }
  }

  return {
    size,
    forward(x) {
      for (let i = 0; i < m; i++) {
        zr[i] = x[2 * i]!;
        zi[i] = x[2 * i + 1]!;
      }
      complexFft(-1);
      for (let k = 0; k <= m; k++) {
        const a = k % m;
        const b = (m - k) % m;
        // Even part (Z[k] + conj Z[m−k]) / 2, odd part (Z[k] − conj Z[m−k]) / 2i.
        const er = (zr[a]! + zr[b]!) / 2;
        const ei = (zi[a]! - zi[b]!) / 2;
        const or = (zi[a]! + zi[b]!) / 2;
        const oi = -(zr[a]! - zr[b]!) / 2;
        outRe[k] = er + wr[k]! * or - wi[k]! * oi;
        outIm[k] = ei + wr[k]! * oi + wi[k]! * or;
      }
      return { re: outRe, im: outIm };
    },
    inverse(re, im) {
      for (let k = 0; k < m; k++) {
        const b = m - k;
        const er = (re[k]! + re[b]!) / 2;
        const ei = (im[k]! - im[b]!) / 2;
        // Odd part = (X[k] − conj X[m−k]) / 2 × e^(+2πik/size)
        const dr = (re[k]! - re[b]!) / 2;
        const di = (im[k]! + im[b]!) / 2;
        const or = dr * wr[k]! + di * wi[k]!;
        const oi = di * wr[k]! - dr * wi[k]!;
        zr[k] = er - oi;
        zi[k] = ei + or;
      }
      complexFft(1);
      for (let i = 0; i < m; i++) {
        samples[2 * i] = zr[i]! / m;
        samples[2 * i + 1] = zi[i]! / m;
      }
      return samples;
    },
  };
}
