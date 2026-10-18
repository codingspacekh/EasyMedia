import { describe, expect, it } from 'vitest';
import {
  BOOK_A_WAVE,
  WAVE_LENGTH,
  WAVE_TOP,
  distance,
  levels,
  quantise,
  sampleWave,
  storedAt,
  waveAt,
} from '../../../../src/core/teaching/sampling.ts';

const oneDecimal = (v: number) => Math.round(v * 10) / 10;

describe('T4 sampling visualiser', () => {
  it('quantising to 3 bits gives exactly 8 levels', () => {
    expect(levels(3)).toBe(8);
    const values = new Set<number>();
    for (let v = 0; v <= WAVE_TOP; v += 0.01) values.add(quantise(v, 3));
    expect(values.size).toBe(8);
  });

  it('1 bit gives 2 levels: the bottom and the top', () => {
    expect([quantise(2, 1), quantise(8, 1)]).toEqual([0, WAVE_TOP]);
  });

  it('16-bit has 65 536 levels (Book B 11.2.20)', () => {
    expect(levels(16)).toBe(65_536);
  });

  it('the wave goes through each of its points and stays between 0 and the top', () => {
    BOOK_A_WAVE.forEach((v, i) => expect(waveAt(BOOK_A_WAVE, i / 2)).toBeCloseTo(v, 9));
    for (let t = 0; t <= WAVE_LENGTH; t += 0.01) {
      const v = waveAt(BOOK_A_WAVE, t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(WAVE_TOP);
    }
  });

  it("Book A Figure 11.23 sampled 10 times gives the book's table (Activity 11.28)", () => {
    const samples = sampleWave(BOOK_A_WAVE, 10, 8);
    expect(samples.map((s) => s.time)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(samples.map((s) => oneDecimal(s.value))).toEqual([
      6, 8.5, 2.5, 8, 3.5, 2, 4.5, 3, 8.5, 3.5,
    ]);
  });

  it('Activity 11.28: twice as many samples are closer to the original', () => {
    const ten = distance(BOOK_A_WAVE, sampleWave(BOOK_A_WAVE, 10, 8));
    const twenty = distance(BOOK_A_WAVE, sampleWave(BOOK_A_WAVE, 20, 8));
    expect(twenty).toBeLessThan(ten * 0.75);
  });

  it('a higher resolution is closer to the original too', () => {
    const coarse = distance(BOOK_A_WAVE, sampleWave(BOOK_A_WAVE, 40, 2));
    const fine = distance(BOOK_A_WAVE, sampleWave(BOOK_A_WAVE, 40, 8));
    expect(fine).toBeLessThan(coarse);
  });

  it('what is stored holds each sample until the next one; nothing before the first', () => {
    const samples = sampleWave(BOOK_A_WAVE, 10, 8);
    expect(storedAt(samples, 0.5)).toBe(0);
    expect(storedAt(samples, 1)).toBe(samples[0]!.value);
    expect(storedAt(samples, 1.9)).toBe(samples[0]!.value);
    expect(storedAt(samples, 2)).toBe(samples[1]!.value);
    expect(storedAt(samples, WAVE_LENGTH)).toBe(samples[9]!.value);
  });

  it('a wave the student draws is sampled the same way', () => {
    const flat = Array.from({ length: BOOK_A_WAVE.length }, () => 5);
    expect(sampleWave(flat, 4, 8).map((s) => oneDecimal(s.value))).toEqual([5, 5, 5, 5]);
  });
});
