// M17a, from the 2017–2021 animation benchmark: AN13 a group made smaller keeps its look — the
// outlines of its parts get thinner with it (9626/04 M/J/20: the meter redrawn smaller), by the
// smaller of the two scales when it is stretched, as its text does.
import { describe, expect, it } from 'vitest';
import {
  createGroup,
  createLine,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { setSize } from '../../../../src/core/animation/geometry.ts';
import type { AnimObject, GroupObject } from '../../../../src/core/animation/types.ts';

const outlined = (width: number, extra: Partial<AnimObject> = {}): AnimObject =>
  ({
    ...createRect({ x: 0, y: 0, width: 100, height: 100 }),
    stroke: { colour: '#000000', width, dash: 'solid' },
    ...extra,
  }) as AnimObject;

describe('AN13 outline widths scale with a resized group', () => {
  it('a group made half the size has outlines half as wide, keyframes too', () => {
    const needle: AnimObject = {
      ...createLine({ x: 50, y: 50 }, { x: 150, y: 50 }),
      stroke: { colour: '#ff0000', width: 4, dash: 'solid' },
      tracks: [
        {
          property: 'strokeWidth',
          keyframes: [
            { frame: 0, value: 4, easing: 'linear', hold: false },
            { frame: 10, value: 8, easing: 'linear', hold: false },
          ],
        },
      ],
    };
    const meter = createGroup([outlined(6), needle]);
    const small = setSize(meter, meter.width / 2, meter.height / 2);
    const [dial, hand] = small.children;
    expect(dial!.stroke!.width).toBe(3);
    expect(hand!.stroke!.width).toBe(2);
    expect(hand!.tracks![0]!.keyframes.map((k) => k.value)).toEqual([2, 4]);
    // Twice the size: twice as wide.
    expect(setSize(meter, meter.width * 2, meter.height * 2).children[0]!.stroke!.width).toBe(12);
  });

  it('stretched one way, by the smaller of the two scales; letters’ outlines and groups inside too', () => {
    const words = {
      ...createText('kPa', { x: 0, y: 0, size: 40 }),
      stroke: { colour: '#000000', width: 2, dash: 'solid' as const },
    };
    const inner = createGroup([outlined(8)]);
    const group = createGroup([outlined(6), words, inner]);
    const stretched = setSize(group, group.width / 2, group.height);
    expect(stretched.children[0]!.stroke!.width).toBe(3);
    expect(stretched.children[1]!.stroke!.width).toBe(1);
    expect((stretched.children[2] as GroupObject).children[0]!.stroke!.width).toBe(4);
  });

  it('a shape resized on its own keeps its outline width', () => {
    expect(setSize(outlined(6), 50, 50).stroke!.width).toBe(6);
    // A group's part without an outline gets none.
    const plain = createGroup([{ ...outlined(1), stroke: undefined } as AnimObject]);
    expect(setSize(plain, 10, 10).children[0]!.stroke).toBeUndefined();
  });
});
