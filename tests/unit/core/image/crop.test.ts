import { describe, expect, it } from 'vitest';
import {
  coverRegion,
  moveRegion,
  planFromRegion,
  planResizeCrop,
  regionFromCorners,
  resizeKeepingRatio,
} from '../../../../src/core/image/crop.ts';
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

describe('V11 choosing the part to keep with the mouse (in original pixels)', () => {
  const photo = { width: 3764, height: 3092 };
  const project = { width: 1920, height: 1080 };

  it('the largest 16:9 part, kept at the bottom, is Book B Task 11a', () => {
    const region = coverRegion(photo, project, 'bottom');
    expect(region).toEqual({ x: 0, y: 974.75, width: 3764, height: 2117.25 });
    const plan = planFromRegion(photo, project, region);
    expect(plan.resize).toEqual({ width: 1920, height: 1577 });
    expect(plan.crop).toEqual({ x: 0, y: 497, width: 1920, height: 1080 });
    expect(plan.removed).toMatchObject({ top: 497, bottom: 0 });
    expect(plan.enlarged).toBe(false);
  });

  it('a smaller part zooms in: the picture is resized bigger, then cropped', () => {
    const plan = planFromRegion(photo, project, {
      x: 1000,
      y: 1000,
      width: 1882,
      height: 1058.625,
    });
    expect(plan.resize).toEqual({ width: 3840, height: 3154 });
    expect(plan.crop).toEqual({ x: 1020, y: 1020, width: 1920, height: 1080 });
    expect(plan.enlarged).toBe(true); // 3840 > 3764: may look blurry
  });

  it('moving keeps the part inside the picture', () => {
    const region = { x: 100, y: 100, width: 1000, height: 562.5 };
    expect(moveRegion(region, 50, -500, photo)).toEqual({ ...region, x: 150, y: 0 });
    expect(moveRegion(region, 9000, 9000, photo)).toEqual({
      ...region,
      x: 2764,
      y: 2529.5,
    });
  });

  it('drawing from one corner to another keeps the project shape', () => {
    // the wider of the two directions decides the size
    expect(regionFromCorners({ x: 0, y: 0 }, { x: 1000, y: 100 }, photo, project)).toEqual({
      x: 0,
      y: 0,
      width: 1000,
      height: 562.5,
    });
    // dragging up and to the left from the bottom-right corner
    expect(regionFromCorners({ x: 3764, y: 3092 }, { x: 3000, y: 3000 }, photo, project)).toEqual({
      x: 3000,
      y: 2662.25,
      width: 764,
      height: 429.75,
    });
  });

  it('a drawn part stays inside the picture and is never tiny', () => {
    const wide = regionFromCorners({ x: 100, y: 100 }, { x: 9000, y: 200 }, photo, project);
    expect(wide.x + wide.width).toBeLessThanOrEqual(3764);
    expect(wide.width).toBeCloseTo(3664, 5);
    const tiny = regionFromCorners({ x: 10, y: 10 }, { x: 12, y: 12 }, photo, project);
    expect(tiny.width).toBeCloseTo(3764 / 20, 5);
  });
});
