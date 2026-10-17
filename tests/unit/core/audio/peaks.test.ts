import { describe, expect, it } from 'vitest';
import { waveColumns } from '../../../../src/core/audio/peaks.ts';

const RATE = 100;
const view = (from: number, pxPerSecond: number, width: number, offset = 0) => ({
  rate: RATE,
  offset,
  from,
  pxPerSecond,
  width,
});

describe('A1 waveform drawing: lowest and highest sample under each pixel', () => {
  it('one column per pixel, covering its slice of time', () => {
    const channel = Float32Array.from({ length: 400 }, (_, i) => (i < 200 ? 0.5 : -0.25));
    const { min, max } = waveColumns(channel, view(0, 1, 4)); // 1 px = 1 s = 100 samples
    expect([...max]).toEqual([0.5, 0.5, -0.25, -0.25]);
    expect([...min]).toEqual([0.5, 0.5, -0.25, -0.25]);
  });

  it('finds the peaks inside a column', () => {
    const channel = new Float32Array(100);
    channel[37] = 0.9;
    channel[61] = -0.7;
    const { min, max } = waveColumns(channel, view(0, 1, 1));
    expect([min[0], max[0]]).toEqual([Math.fround(-0.7), Math.fround(0.9)]);
  });

  it('columns before the track starts or after it ends have no sound (NaN)', () => {
    const channel = new Float32Array(100).fill(0.1);
    const { max } = waveColumns(channel, view(0, 1, 4, 2)); // starts at 2 s, lasts 1 s
    expect(max.map((v) => (Number.isNaN(v) ? 9 : 1))).toEqual(new Float32Array([9, 9, 1, 9]));
  });

  it('zoomed in past one sample per pixel, each column shows the sample there', () => {
    const channel = Float32Array.from({ length: 10 }, (_, i) => i / 10);
    const { max } = waveColumns(channel, view(0.05, 1000, 3)); // 10 px per sample
    expect([...max].map((v) => Math.round(v * 10) / 10)).toEqual([0.5, 0.5, 0.5]);
  });

  it('starts drawing at the scrolled-to time', () => {
    const channel = Float32Array.from({ length: 300 }, (_, i) => Math.floor(i / 100));
    const { max } = waveColumns(channel, view(1, 1, 2));
    expect([...max]).toEqual([1, 2]);
  });
});
