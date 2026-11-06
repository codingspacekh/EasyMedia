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

describe('AN13 a group made 0 wide or high, then grown back (WB p.97: "Designs" grows from nothing)', () => {
  const words = (): GroupObject =>
    createGroup([
      { ...createText('De', { x: 100, y: 200, size: 72 }), width: 90, height: 86 },
      { ...createText('signs', { x: 190, y: 200, size: 72 }), width: 200, height: 86 },
    ]);

  it('keeps its parts as they are, so nothing is lost', () => {
    const g = words();
    const none = setSize(g, 0, 0);
    expect(none).toMatchObject({ width: 0, height: 0 });
    expect(none.children).toEqual(g.children);
  });

  it('grows back from its parts: half way is half the size, the end is as it was', () => {
    const g = words();
    const none = setSize(g, 0, 0);
    const half = setSize(none, g.width / 2, g.height / 2);
    expect(half.children[1]).toMatchObject({ x: 45, width: 100, size: 36 });
    const back = setSize(none, g.width, g.height);
    expect(back.children).toEqual(g.children);
  });
});
