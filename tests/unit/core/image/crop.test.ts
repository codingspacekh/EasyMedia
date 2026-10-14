import { describe, expect, it } from 'vitest';
import { planResizeCrop, resizeKeepingRatio } from '../../../../src/core/image/crop.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

describe('V11 resize with constrained proportions', () => {
  it('Book B Task 11a: 3764 × 3092 at width 1920 is 1577 high', () => {
    expect(resizeKeepingRatio({ width: 3764, height: 3092 }, { width: 1920 })).toEqual({
      width: 1920,
      height: 1577,
    });
  });

  it('can be given the height instead', () => {
    expect(resizeKeepingRatio({ width: 3764, height: 3092 }, { height: 1080 })).toEqual({
      width: 1315,
      height: 1080,
    });
  });
});

describe('V11 crop to the project size with a 9-point anchor', () => {
  const photo = { width: 3764, height: 3092 };
  const project = { width: 1920, height: 1080 };

  it('Book B Task 11a: keep the bottom → removes 497 px from the top', () => {
    const plan = planResizeCrop(photo, project, 'bottom');
    expect(plan.resize).toEqual({ width: 1920, height: 1577 });
    expect(plan.crop).toEqual({ x: 0, y: 497, width: 1920, height: 1080 });
    expect(plan.removed).toEqual({ top: 497, bottom: 0, left: 0, right: 0 });
  });

  it('keeping the centre removes from both sides; the top keeps the top', () => {
    expect(planResizeCrop(photo, project, 'centre').crop).toEqual({
      x: 0,
      y: 248,
      width: 1920,
      height: 1080,
    });
    expect(planResizeCrop(photo, project, 'top').crop.y).toBe(0);
  });

  it('a wide picture in a 4:3 project is cut at the sides (Activity 11a)', () => {
    const plan = planResizeCrop(
      { width: 1920, height: 1080 },
      { width: 960, height: 720 },
      'right',
    );
    expect(plan.resize).toEqual({ width: 1280, height: 720 });
    expect(plan.crop).toEqual({ x: 320, y: 0, width: 960, height: 720 });
    expect(plan.removed).toEqual({ top: 0, bottom: 0, left: 320, right: 0 });
  });

  it('turns the plan into an FFmpeg filter', () => {
    expect(planResizeCrop(photo, project, 'bottom').filter).toBe(
      'scale=1920:1577:flags=lanczos,crop=1920:1080:0:497',
    );
  });

  it('refuses a picture with no size', () => {
    expect(() => planResizeCrop({ width: 0, height: 10 }, project, 'centre')).toThrow(EditError);
  });
});
