import { describe, expect, it } from 'vitest';
import { validateSettings } from '../../../../src/core/model/settings.ts';
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
