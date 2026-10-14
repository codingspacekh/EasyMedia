import { describe, expect, it } from 'vitest';
import { atempoChain, fitFilter, num } from '../../../../src/core/render/filters.ts';
import type { ProjectSettings } from '../../../../src/core/model/types.ts';

const hd: ProjectSettings = {
  aspect: '16:9',
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
  fit: 'letterbox',
};

describe('V1 fitting a clip of another shape into the frame', () => {
  it('letterbox: scale down to fit, then add bars in the background colour', () => {
    expect(fitFilter(hd)).toBe(
      'scale=1920:1080:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=#000000,setsar=1,fps=30,format=yuv420p',
    );
  });

  it('crop to fill: scale up to cover, then cut off the overflow', () => {
    expect(fitFilter({ ...hd, fit: 'crop' })).toBe(
      'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,fps=30,format=yuv420p',
    );
  });

  it('stretch: force the frame size', () => {
    expect(fitFilter({ ...hd, fit: 'stretch' })).toBe(
      'scale=1920:1080,setsar=1,fps=30,format=yuv420p',
    );
  });

  it('an M1 project without a fit setting uses letterbox', () => {
    const m1: ProjectSettings = { ...hd };
    delete m1.fit;
    expect(fitFilter(m1)).toBe(fitFilter(hd));
  });
});

describe('V14 atempo chain (each step must be between 0.5× and 2×)', () => {
  it.each([
    [1, []],
    [1.5, [1.5]],
    [2, [2]],
    [4, [2, 2]],
    [3, [2, 1.5]],
    [0.5, [0.5]],
    [0.25, [0.5, 0.5]],
    [0.3, [0.5, 0.6]],
  ])('%f× → %j', (speed, chain) => {
    const steps = atempoChain(speed);
    expect(steps.map((s) => Number(s.toFixed(6)))).toEqual(chain);
    expect(steps.reduce((a, b) => a * b, 1)).toBeCloseTo(speed, 9);
  });
});

describe('num: numbers for FFmpeg arguments', () => {
  it.each([
    [8, '8'],
    [6.3, '6.3'],
    [6.3 / 1.5, '4.2'],
    [1 / 3, '0.333333'],
    [0, '0'],
  ])('%f → %s', (n, text) => {
    expect(num(n)).toBe(text);
  });
});
