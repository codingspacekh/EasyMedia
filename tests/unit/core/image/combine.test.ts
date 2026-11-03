// V18: a picture placed on another picture and saved as a new one (F/M/25 Q2: the cropped still
// of cells A1:E5 in the bottom-left corner of credits.png, as the credits' background).
import { describe, expect, it } from 'vitest';
import { combineFilter, planCombine } from '../../../../src/core/image/combine.ts';
import { EditError } from '../../../../src/core/model/errors.ts';

const credits = { width: 1440, height: 1080 };
const grid = { width: 1000, height: 500 };

describe('V18 placing a picture on a picture', () => {
  it('F/M/25 Q2: 25 % of the width, in the bottom-left corner', () => {
    const plan = planCombine(credits, grid, { anchor: 'bottom-left', widthPercent: 25, margin: 0 });
    expect(plan).toEqual({ top: { width: 360, height: 180 }, x: 0, y: 900 });
  });

  it('the nine places, with a margin from the edges', () => {
    const at = (anchor: Parameters<typeof planCombine>[2]['anchor']) =>
      planCombine(credits, grid, { anchor, widthPercent: 25, margin: 20 });
    expect(at('top-left')).toMatchObject({ x: 20, y: 20 });
    expect(at('top-right')).toMatchObject({ x: 1060, y: 20 });
    expect(at('centre')).toMatchObject({ x: 540, y: 450 });
    expect(at('bottom-right')).toMatchObject({ x: 1060, y: 880 });
    expect(at('bottom')).toMatchObject({ x: 540, y: 880 });
  });

  it('keeps the picture inside, and its own shape', () => {
    const plan = planCombine(
      credits,
      { width: 400, height: 900 },
      {
        anchor: 'bottom-right',
        widthPercent: 100,
        margin: 0,
      },
    );
    // As wide as the background would be taller than it: it is made to fit the height instead.
    expect(plan.top).toEqual({ width: 480, height: 1080 });
    expect(plan).toMatchObject({ x: 960, y: 0 });
  });

  it('explains a size or margin it cannot use', () => {
    const place = { anchor: 'centre' as const, margin: 0 };
    expect(() => planCombine(credits, grid, { ...place, widthPercent: 0 })).toThrow(EditError);
    expect(() => planCombine(credits, grid, { ...place, widthPercent: 101 })).toThrow(
      /between 1 and 100/,
    );
    expect(() =>
      planCombine(credits, grid, { anchor: 'centre', widthPercent: 50, margin: -1 }),
    ).toThrow(/margin/i);
    expect(() =>
      planCombine({ width: 0, height: 0 }, grid, { ...place, widthPercent: 50 }),
    ).toThrow(EditError);
  });

  it('turns the plan into an FFmpeg filter: the top picture scaled, then laid over', () => {
    expect(combineFilter({ top: { width: 360, height: 180 }, x: 0, y: 900 })).toBe(
      '[1:v]scale=360:180:flags=lanczos[top];[0:v][top]overlay=0:900:format=auto',
    );
    expect(() => combineFilter({ top: { width: 0, height: 180 }, x: 0, y: 0 })).toThrow(EditError);
  });
});
