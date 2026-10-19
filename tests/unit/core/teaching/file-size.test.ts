import { describe, expect, it } from 'vitest';
import { audioFileSize, group, whatIf } from '../../../../src/core/teaching/file-size.ts';

const question5a = { sampleRate: 44100, bits: 16, channels: 1, seconds: 120 };

describe('T2 audio file-size calculator', () => {
  it('Book A Question 5a: 2 minutes at 44.1 kHz, 16-bit, mono = 84 672 000 bits = 10.58 MB', () => {
    const size = audioFileSize(question5a);
    expect(size.bitsPerSecond).toBe(705_600);
    expect(size.bits).toBe(84_672_000);
    expect(size.bytes).toBe(10_584_000);
    expect(size.mb).toBeCloseTo(10.584, 6);
  });

  it('Book A Question 5b: 32-bit doubles the size', () => {
    expect(audioFileSize({ ...question5a, bits: 32 }).bytes).toBe(2 * 10_584_000);
  });

  it('stereo doubles the size too', () => {
    expect(audioFileSize({ ...question5a, channels: 2 }).bits).toBe(2 * 84_672_000);
  });

  it('shows the working step by step, as screen 21: bits → bytes → MB', () => {
    expect(audioFileSize(question5a).steps).toEqual([
      { label: 'Bits each second', working: '44 100 × 16 × 1 = 705 600 bits' },
      { label: '× length', working: '705 600 × 120 = 84 672 000 bits' },
      { label: '÷ 8 → bytes', working: '84 672 000 ÷ 8 = 10 584 000 bytes' },
      { label: '÷ 1 000 000 → MB', working: '10 584 000 ÷ 1 000 000 = 10.58 MB' },
    ]);
  });

  it('a length with a fraction of a second keeps it in the working', () => {
    const size = audioFileSize({ ...question5a, seconds: 2.5 });
    expect(size.bits).toBe(1_764_000);
    expect(size.steps[1]!.working).toBe('705 600 × 2.5 = 1 764 000 bits');
  });

  it('"What if…": the resolution doubled and the sample rate halved', () => {
    expect(whatIf(question5a)).toEqual([
      { label: '16-bit (now)', mb: 10.584 },
      { label: '32-bit', mb: 21.168 },
      { label: '22 050 Hz', mb: 5.292 },
    ]);
  });

  it('"What if…" at 32-bit shows 16-bit instead (there is no 64-bit audio)', () => {
    expect(whatIf({ ...question5a, bits: 32 })[1]).toEqual({ label: '16-bit', mb: 10.584 });
  });

  it('groups digits in threes with a space, as the coursebooks', () => {
    expect(group(84672000)).toBe('84 672 000');
    expect(group(950)).toBe('950');
    expect(group(2.5)).toBe('2.5');
  });
});
