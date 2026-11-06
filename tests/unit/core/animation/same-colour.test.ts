// AN5: after Trace bitmap a picture is many small shapes (1676 for the map of 9626/04 M/J/21);
// Select same fill / outline colour finds every part of one colour, so they can be recoloured,
// grouped or deleted together.
import { describe, expect, it } from 'vitest';
import {
  createEllipse,
  createGroup,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { sameColour } from '../../../../src/core/animation/same-colour.ts';
import type { AnimObject, Paint } from '../../../../src/core/animation/types.ts';

const solid = (colour: string): Paint => ({ kind: 'solid', colour });
const box = { x: 0, y: 0, width: 10, height: 10 };
const shape = (name: string, fill: Paint, outline?: string): AnimObject => {
  const rect: AnimObject = { ...createRect(box), id: name, name, fill };
  if (outline) return { ...rect, stroke: { colour: outline, width: 2, dash: 'solid' } };
  delete rect.stroke; // the factory gives every shape an outline
  return rect;
};

describe('select same colour (AN5)', () => {
  it('AN5 same fill: every object filled with the colour, whatever the case of its hex', () => {
    const sea = [
      shape('a', solid('#3A7DC9')),
      shape('b', solid('#d9c27a')),
      shape('c', solid('#3a7dc9')),
      { ...createText('Sea', { x: 0, y: 0 }), id: 't', fill: solid('#3A7DC9') },
      shape('d', { kind: 'none' }),
    ];
    expect(sameColour(sea, sea[0]!, 'fill').map((o) => o.id)).toEqual(['a', 'c', 't']);
    // No fill is a fill of its own: the outlines only.
    expect(sameColour(sea, sea[4]!, 'fill').map((o) => o.id)).toEqual(['d']);
  });

  it('AN5 a gradient matches only the same gradient; pictures and groups have no fill to match', () => {
    const sky: Paint = { kind: 'linear', from: '#87CEEB', to: '#FFFFFF', angle: 90 };
    const objects = [
      shape('a', sky),
      shape('b', { ...sky, angle: 0 }),
      shape('c', { ...sky, from: '#87ceeb' }),
      shape('d', { kind: 'radial', from: '#87CEEB', to: '#FFFFFF' }),
      { ...createGroup([shape('in', sky)]), id: 'g', fill: sky },
    ];
    expect(sameColour(objects, objects[0]!, 'fill').map((o) => o.id)).toEqual(['a', 'c']);
  });

  it('AN5 same outline: the outline colour, whatever the fill, width or dash', () => {
    const objects = [
      shape('a', solid('#ff0000'), '#000000'),
      {
        ...shape('b', solid('#00ff00'), '#000000'),
        stroke: { colour: '#000000', width: 6, dash: 'dashed' as const },
      },
      shape('c', solid('#ff0000'), '#333333'),
      shape('d', solid('#ff0000')),
      {
        ...createEllipse(box),
        id: 'e',
        stroke: { colour: '#000000', width: 0, dash: 'solid' as const },
      },
    ];
    expect(sameColour(objects, objects[0]!, 'outline').map((o) => o.id)).toEqual(['a', 'b']);
    // No outline: nothing to match.
    expect(sameColour(objects, objects[3]!, 'outline')).toEqual([]);
  });
});
