// A13 needs the spectrum of short windows of sound: a real FFT, checked against a plain DFT.
import { describe, expect, it } from 'vitest';
import { createRealFft } from '../../../../src/core/audio/dsp/fft.ts';

function dft(x: Float64Array): { re: Float64Array; im: Float64Array } {
  const n = x.length;
  const re = new Float64Array(n / 2 + 1);
  const im = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    for (let t = 0; t < n; t++) {
      re[k]! += x[t]! * Math.cos((2 * Math.PI * k * t) / n);
      im[k]! -= x[t]! * Math.sin((2 * Math.PI * k * t) / n);
    }
  }
  return { re, im };
}

describe('real FFT', () => {
  const random = (n: number) =>
    Float64Array.from({ length: n }, (_, i) => Math.sin(i * 12.9898) * 0.7 + ((i * 7) % 5) / 10);

  it.each([8, 64, 2048])('matches the DFT of %i samples', (n) => {
    const x = random(n);
    const fft = createRealFft(n);
    const { re, im } = fft.forward(x);
    const expected = dft(x);
    for (let k = 0; k <= n / 2; k++) {
      expect(re[k]).toBeCloseTo(expected.re[k]!, 8);
      expect(im[k]).toBeCloseTo(expected.im[k]!, 8);
    }
  });

  it('a sine of 8 cycles in 64 samples lands in bin 8', () => {
    const x = Float64Array.from({ length: 64 }, (_, i) => Math.sin((2 * Math.PI * 8 * i) / 64));
    const { re, im } = createRealFft(64).forward(x);
    const power = Array.from(re, (r, k) => r * r + im[k]! ** 2);
    expect(power.indexOf(Math.max(...power))).toBe(8);
  });

  it('the inverse gives the samples back', () => {
    const x = random(2048);
    const fft = createRealFft(2048);
    const { re, im } = fft.forward(x);
    const back = fft.inverse(re, im);
    for (let i = 0; i < x.length; i++) expect(back[i]).toBeCloseTo(x[i]!, 10);
  });

  it('refuses a size that is not a power of two', () => {
    expect(() => createRealFft(100)).toThrow(/power of two/);
  });
});
