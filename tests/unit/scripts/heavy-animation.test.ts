// The performance checks' animation (M17 step 2) is a valid animation file of the budget's size.
import { describe, expect, it } from 'vitest';
import { deserializeAnimation, serializeAnimation } from '../../../src/core/animation/serialize.ts';
import { stateAt } from '../../../src/core/animation/state.ts';
import { HEAVY, heavyAnimation } from '../../../scripts/lib/heavy-animation.ts';

describe('heavyAnimation (N1, N2 with an animation)', () => {
  it('is a 1024 × 768, 10 s, 30 fps animation of 100 moving objects on five layers that opens again', () => {
    const doc = deserializeAnimation(serializeAnimation(heavyAnimation()));
    expect(doc.stage).toMatchObject({ width: 1024, height: 768, fps: 30, length: 300 });
    expect(doc.layers).toHaveLength(HEAVY.layers);
    const objects = doc.layers.flatMap((l) => l.objects);
    expect(objects).toHaveLength(100);
    expect(new Set(objects.map((o) => o.kind))).toEqual(
      new Set(['rect', 'ellipse', 'star', 'polygon', 'text', 'path']),
    );
    // Every object is somewhere else at the last frame: each frame redraws all of them.
    const end = stateAt(doc, 299).layers.flatMap((l) => l.objects);
    objects.forEach((o, i) => expect([end[i]!.x, end[i]!.rotation]).not.toEqual([o.x, o.rotation]));
  });
});
