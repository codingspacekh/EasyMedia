// M17 step 2 (N1, N2, N4 with an animation): the animation the performance checks use — the
// budget's 1024 × 768 stage, 10 s at 30 fps, 100 objects of every drawn kind spread over five
// layers, each moving, turning and fading the whole time, so every frame redraws all of them.
import {
  createAnimation,
  createEllipse,
  createLayer,
  createPath,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../../src/core/animation/factory.ts';
import type { AnimationDoc, AnimObject, Track } from '../../src/core/animation/types.ts';

export const HEAVY = { width: 1024, height: 768, fps: 30, seconds: 10, objects: 100, layers: 5 };

const COLOURS = ['#e63946', '#f4a261', '#2a9d8f', '#264653', '#8338ec', '#ffbe0b'];

const track = (property: Track['property'], from: number, to: number, last: number): Track => ({
  property,
  keyframes: [
    { frame: 0, value: from, easing: 'ease-in-out', hold: false },
    { frame: last, value: to, easing: 'linear', hold: false },
  ],
});

function shape(i: number): AnimObject {
  const box = {
    x: (i * 97) % 900,
    y: (i * 61) % 660,
    width: 60 + (i % 5) * 12,
    height: 50 + (i % 4) * 14,
  };
  switch (i % 6) {
    case 0:
      return { ...createRect(box), radius: 8 };
    case 1:
      return createEllipse(box);
    case 2:
      return createStar(box);
    case 3:
      return createPolygon(box);
    case 4:
      return createText(`Word ${i}`, { x: box.x, y: box.y, size: 36 });
    default:
      return createPath(
        [
          { x: 0, y: 0 },
          { x: box.width, y: box.height / 2 },
          { x: 0, y: box.height },
        ].map((p) => ({ x: box.x + p.x, y: box.y + p.y })),
        true,
      );
  }
}

/** The heavy animation, built from the same factory as the app's tools. */
export function heavyAnimation(name = 'Heavy'): AnimationDoc {
  const doc = createAnimation({ name });
  const length = HEAVY.fps * HEAVY.seconds;
  const last = length - 1;
  const layers = Array.from({ length: HEAVY.layers }, (_, l) => createLayer(`Layer ${l + 1}`));
  for (let i = 0; i < HEAVY.objects; i++) {
    const o = shape(i);
    const moved: AnimObject = {
      ...o,
      name: `Object ${i + 1}`,
      fill:
        i % 3 === 0
          ? { kind: 'linear', from: COLOURS[i % 6]!, to: '#ffffff', angle: 45 }
          : { kind: 'solid', colour: COLOURS[i % 6]! },
      tracks: [
        track('x', o.x, (o.x + 400) % 960, last),
        track('y', o.y, (o.y + 250) % 700, last),
        track('rotation', 0, 360, last),
        track('opacity', 100, 40, last),
      ],
    };
    layers[i % HEAVY.layers]!.objects.push(moved);
  }
  return {
    ...doc,
    stage: {
      width: HEAVY.width,
      height: HEAVY.height,
      background: '#ffffff',
      fps: HEAVY.fps,
      length,
    },
    layers,
  };
}
