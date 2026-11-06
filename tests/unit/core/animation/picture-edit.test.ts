// AN5 Crop… and Make a colour see-through… in Animation mode (9626/04 O/N/19: the pearl cut from
// a photo): the object shows the new picture, the part kept where it was on the stage.
import { describe, expect, it } from 'vitest';
import { createPicture } from '../../../../src/core/animation/factory.ts';
import { toStage } from '../../../../src/core/animation/geometry.ts';
import {
  checkPictureEditable,
  croppedPicture,
} from '../../../../src/core/animation/picture-edit.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { Picture, PictureObject } from '../../../../src/core/animation/types.ts';

const photo: Picture = { id: 'p1', path: '/m/pearl.jpg', width: 800, height: 600 };
const part: Picture = { id: 'p2', path: '/m/pearl1.jpg', width: 400, height: 300 };
/** The photo shown at half its size at (100, 100). */
const shown = (extra: Partial<PictureObject> = {}): PictureObject => ({
  ...createPicture(photo, { x: 100, y: 100 }),
  width: 400,
  height: 300,
  ...extra,
});

describe('AN5 Crop a picture in Animation mode', () => {
  it('the object shows the part kept, where it was and at the same scale', () => {
    const cropped = croppedPicture(
      shown(),
      photo,
      { x: 200, y: 100, width: 400, height: 300 },
      part,
    );
    expect(cropped).toMatchObject({ pictureId: 'p2', x: 200, y: 150, width: 200, height: 150 });
  });

  it('turned, flipped or skewed, the part stays where the stage showed it', () => {
    const o = shown({ rotation: 30, flipX: true, skewX: 10 });
    const region = { x: 200, y: 100, width: 400, height: 300 };
    const cropped = croppedPicture(o, photo, region, part);
    const before = toStage(o, { x: 100 + 100, y: 50 + 75 });
    const after = toStage(cropped, { x: 100, y: 75 });
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect([cropped.rotation, cropped.flipX, cropped.skewX]).toEqual([30, true, 10]);
  });

  it('its motion moves with it and its size keyframes shrink with it', () => {
    const o = shown({
      tracks: [
        {
          property: 'x',
          keyframes: [
            { frame: 0, value: 100, easing: 'linear', hold: false },
            { frame: 10, value: 300, easing: 'linear', hold: false },
          ],
        },
        {
          property: 'width',
          keyframes: [
            { frame: 0, value: 400, easing: 'linear', hold: false },
            { frame: 10, value: 800, easing: 'linear', hold: false },
          ],
        },
      ],
    });
    const cropped = croppedPicture(o, photo, { x: 200, y: 100, width: 400, height: 300 }, part);
    expect(cropped.tracks!.map((t) => t.keyframes.map((k) => k.value))).toEqual([
      [200, 400],
      [200, 400],
    ]);
  });

  it('a stop motion (a picture that changes on the timeline) and an SVG cannot be changed here', () => {
    const motion = shown({
      tracks: [
        {
          property: 'picture',
          keyframes: [{ frame: 0, value: 'p1', easing: 'linear', hold: true }],
        },
      ],
    });
    expect(() => checkPictureEditable(motion, photo, 'cropped')).toThrow(EditError);
    expect(() => checkPictureEditable(motion, photo, 'cropped')).toThrow(
      'This picture changes during the animation (stop motion), so it cannot be cropped here.',
    );
    expect(() =>
      checkPictureEditable(shown(), { ...photo, path: '/m/star.svg' }, 'made see-through'),
    ).toThrow('Only a PNG, JPG, GIF or BMP picture can be made see-through, not an SVG.');
    expect(() => checkPictureEditable(shown(), photo, 'cropped')).not.toThrow();
  });
});
