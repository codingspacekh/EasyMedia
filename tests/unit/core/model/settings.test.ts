import { describe, expect, it } from 'vitest';
import { sizeFromClip, validateSettings } from '../../../../src/core/model/settings.ts';
import type { ProjectSettings } from '../../../../src/core/model/types.ts';

const base: ProjectSettings = {
  aspect: '16:9',
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
};

describe('V1 project settings', () => {
  it.each([
    { aspect: '16:9', width: 1920, height: 1080 },
    { aspect: '16:9', width: 1280, height: 720 },
    { aspect: '4:3', width: 960, height: 720 },
    { aspect: '4:3', width: 640, height: 480 },
    { aspect: 'custom', width: 1080, height: 1080 },
  ] as const)('accepts $aspect at $width × $height', (s) => {
    expect(() => validateSettings({ ...base, ...s })).not.toThrow();
  });

  it("accepts the papers' 854 × 480 as 16:9 (480 × 16 ÷ 9 = 853.3, the nearest even width)", () => {
    expect(() => validateSettings({ ...base, width: 854, height: 480 })).not.toThrow();
    expect(() => validateSettings({ ...base, width: 852, height: 480 })).toThrow(/not 16:9/);
  });

  it('rejects a resolution that does not match the aspect ratio', () => {
    expect(() => validateSettings({ ...base, aspect: '16:9', width: 1440, height: 1080 })).toThrow(
      /1440 × 1080 is not 16:9/,
    );
  });

  it.each([
    [{ width: 1921 }, /even number/],
    [{ width: 8, height: 8, aspect: 'custom' as const }, /between 16 and 7680/],
    [{ fps: 29 as 30 }, /24, 25 or 30/],
    [{ fit: 'zoom' as 'crop' }, /black bars, crop to fill or stretch/i],
  ])('rejects %j', (change, message) => {
    expect(() => validateSettings({ ...base, ...change })).toThrow(message);
  });
});

describe('V1 "Use this clip’s size": the project takes its shape from a clip', () => {
  it.each([
    [1920, 1080, '16:9', 1920, 1080],
    [1280, 720, '16:9', 1280, 720],
    [854, 480, '16:9', 854, 480],
    [640, 480, '4:3', 640, 480],
    [1440, 1080, '4:3', 1440, 1080],
    [1080, 1920, 'custom', 1080, 1920],
    [1080, 1080, 'custom', 1080, 1080],
  ] as const)('V1: %i × %i gives %s at %i × %i', (width, height, aspect, w, h) => {
    expect(sizeFromClip({ width, height })).toEqual({ aspect, width: w, height: h });
  });

  it('V1: an odd size is made even (FFmpeg needs even numbers)', () => {
    expect(sizeFromClip({ width: 853, height: 479 })).toEqual({
      aspect: '16:9',
      width: 854,
      height: 480,
    });
    expect(sizeFromClip({ width: 1279, height: 721 })).toEqual({
      aspect: 'custom',
      width: 1280,
      height: 722,
    });
  });

  it('V1: a clip larger than 7680 pixels is made smaller, keeping its shape', () => {
    expect(sizeFromClip({ width: 10240, height: 4320 })).toEqual({
      aspect: 'custom',
      width: 7680,
      height: 3240,
    });
  });

  it('V1: the size it gives is always one the project accepts', () => {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 853, height: 479 },
      { width: 8, height: 8 },
      { width: 10240, height: 4320 },
    ]) {
      expect(() => validateSettings({ ...base, ...sizeFromClip(size) })).not.toThrow();
    }
  });
});
