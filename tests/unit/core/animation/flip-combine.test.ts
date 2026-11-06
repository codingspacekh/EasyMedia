// M17a, from the 2022–2026 animation benchmark: AN23 Flip horizontal / vertical (O/N/22: the
// plane flies back facing left), AN24 Combine shapes (union, cut out, intersect; O/N/25: the
// bitten apple), holes in a shape, and text that scales with its group (O/N/22: OPEN DAY on the
// smaller VPlanePlus).
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createPath,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { hitTest, setSize, toLocal, toStage } from '../../../../src/core/animation/geometry.ts';
import { addObject, groupObjects, ungroup } from '../../../../src/core/animation/layers.ts';
import {
  combineObjects,
  combineShapes,
  flipObject,
} from '../../../../src/core/animation/combine.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type {
  AnimationDoc,
  AnimObject,
  PathObject,
  TextObject,
} from '../../../../src/core/animation/types.ts';

const red = { kind: 'solid' as const, colour: '#ff0000' };
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<AnimObject> = {},
) => ({ ...createRect({ x, y, width, height }), fill: red, ...extra }) as AnimObject;

/** The area of a combined shape: its outline less its holes (straight sides). */
function area(p: PathObject): number {
  const ring = (pts: { x: number; y: number }[]) =>
    Math.abs(
      pts.reduce(
        (s, a, i) => s + a.x * pts[(i + 1) % pts.length]!.y - pts[(i + 1) % pts.length]!.x * a.y,
        0,
      ),
    ) / 2;
  return ring(p.points) - (p.holes ?? []).reduce((s, h) => s + ring(h), 0);
}

function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      if (key === 'withLayer') return undefined;
      return (...args: unknown[]) => {
        calls.push(
          `${key}(${args.map((a) => (typeof a === 'number' ? String(Math.round(a * 1000) / 1000) : String(a))).join(',')})`,
        );
        if (key === 'createLinearGradient' || key === 'createRadialGradient')
          return { addColorStop() {} };
        if (key === 'measureText') return { width: 10 };
        return undefined;
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

function stageWith(...objects: AnimObject[]): AnimationDoc {
  let doc = createAnimation({ name: 'A' });
  doc = { ...doc, stage: { ...doc.stage, width: 400, height: 300, background: '#ffffff' } };
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
}

describe('AN23 Flip horizontal and vertical', () => {
  it('mirrors in its own box: a point near the left edge is drawn near the right', () => {
    const r = flipObject(rect(0, 0, 100, 50), 'horizontal');
    expect(r.flipX).toBe(true);
    expect(toStage(r, { x: 10, y: 0 })).toEqual({ x: 90, y: 0 });
    expect(toLocal(r, { x: 90, y: 0 })).toEqual({ x: 10, y: 0 });
    const v = flipObject(rect(0, 0, 100, 50), 'vertical');
    expect(toStage(v, { x: 0, y: 10 })).toEqual({ x: 0, y: 40 });
  });

  it('a turned object mirrors across the stage: its turn and turn keyframes change sign', () => {
    const turned = {
      ...rect(0, 0, 100, 50, { rotation: 30 }),
      tracks: [
        {
          property: 'rotation' as const,
          keyframes: [
            { frame: 0, value: 30, easing: 'linear' as const, hold: false },
            { frame: 10, value: 90, easing: 'linear' as const, hold: false },
          ],
        },
      ],
    };
    const f = flipObject(turned, 'horizontal');
    expect(f.rotation).toBe(-30);
    expect(f.tracks![0]!.keyframes.map((k) => k.value)).toEqual([-30, -90]);
    // Flipped twice it is as it was.
    expect(flipObject(f, 'horizontal')).toEqual(turned);
  });

  it('is drawn mirrored in the preview and every export (a scale after the turn)', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(flipObject(rect(10, 10, 100, 50), 'horizontal')));
    const at = calls.indexOf('translate(60,35)');
    expect(calls[at + 1]).toBe('scale(-1,1)');
    // In the SVG a flipped triangle is the mirrored triangle.
    const tri = (pts: [number, number][]) => ({
      ...createPath(
        pts.map(([x, y]) => ({ x: x + 10, y: y + 10 })),
        true,
      ),
      fill: red,
    });
    const d = (doc: AnimationDoc) => /<path d="([^"]+)"/.exec(stageSvg(doc))![1];
    expect(
      d(
        stageWith(
          flipObject(
            tri([
              [0, 0],
              [100, 0],
              [0, 50],
            ]),
            'horizontal',
          ),
        ),
      ),
    ).toBe(
      d(
        stageWith(
          tri([
            [100, 0],
            [0, 0],
            [100, 50],
          ]),
        ),
      ),
    );
  });

  it('is kept when saved and opened again', () => {
    const doc = stageWith(flipObject(rect(10, 10, 100, 50), 'horizontal'));
    expect(deserializeAnimation(serializeAnimation(doc)).layers[0]!.objects[0]!.flipX).toBe(true);
  });

  it('ungrouping a flipped group leaves its parts mirrored where the group showed them', () => {
    let doc = stageWith(rect(0, 0, 50, 50), rect(150, 0, 50, 100));
    const ids = doc.layers[0]!.objects.map((o) => o.id);
    const grouped = groupObjects(doc, ids);
    doc = grouped.doc;
    const flipped = flipObject(grouped.group, 'horizontal');
    doc = { ...doc, layers: [{ ...doc.layers[0]!, objects: [flipped] }] };
    const parts = ungroup(doc, flipped.id).layers[0]!.objects;
    // The left square is now on the right, the tall one on the left; both mirrored.
    expect(parts.map((p) => [p.x, p.y, p.flipX])).toEqual([
      [150, 0, true],
      [0, 0, true],
    ]);
  });
});

describe('text scales with its group (O/N/22: OPEN DAY on the smaller plane)', () => {
  it('the font size scales as the group does (the smaller way when it is stretched)', () => {
    const words: TextObject = {
      ...createText('OPEN DAY', { x: 10, y: 10, size: 40 }),
      tracks: [
        {
          property: 'size',
          keyframes: [
            { frame: 0, value: 40, easing: 'linear', hold: false },
            { frame: 10, value: 80, easing: 'linear', hold: false },
          ],
        },
      ],
    };
    const group = createGroup([rect(0, 0, 200, 100), words]);
    const half = setSize(group, 100, 50);
    const text = half.children[1] as TextObject;
    expect(text.size).toBe(20);
    expect(text.tracks![0]!.keyframes.map((k) => k.value)).toEqual([20, 40]);
    expect((setSize(group, 100, 100).children[1] as TextObject).size).toBe(20);
  });
});

describe('AN24 Combine shapes', () => {
  const a = rect(0, 0, 100, 100, { name: 'Back' });
  const b = {
    ...createRect({ x: 50, y: 50, width: 100, height: 100 }),
    fill: { kind: 'solid' as const, colour: '#00ff00' },
  };

  it('Union: one shape covering both, in the back shape’s colours', () => {
    const [u, ...rest] = combineShapes([a, b], 'union');
    expect(rest).toEqual([]);
    expect([u!.x, u!.y, u!.width, u!.height]).toEqual([0, 0, 150, 150]);
    expect(area(u!)).toBeCloseTo(17500, 3);
    expect(u!.fill).toEqual(red);
    expect(u!.name).toBe('Back');
  });

  it('Cut out: the shapes in front cut their outline out of the back one (a bite)', () => {
    const [c] = combineShapes([a, b], 'cutOut');
    expect(area(c!)).toBeCloseTo(7500, 3);
    expect(c!.holes ?? []).toEqual([]);
    expect(hitTest(c!, { x: 75, y: 75 })).toBe(false);
    expect(hitTest(c!, { x: 25, y: 25 })).toBe(true);
  });

  it('Cut out inside: a hole, drawn even-odd and in the SVG; a click in the hole misses', () => {
    const [ring] = combineShapes([a, rect(25, 25, 50, 50)], 'cutOut');
    expect(ring!.holes).toHaveLength(1);
    expect(area(ring!)).toBeCloseTo(7500, 3);
    expect(hitTest(ring!, { x: 50, y: 50 })).toBe(false);
    expect(hitTest(ring!, { x: 10, y: 10 })).toBe(true);
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(ring!));
    expect(calls.filter((c) => c.startsWith('moveTo(')).length).toBeGreaterThanOrEqual(2);
    expect(calls).toContain('fill(evenodd)');
    expect(stageSvg(stageWith(ring!))).toContain('fill-rule="evenodd"');
    expect(
      deserializeAnimation(serializeAnimation(stageWith(ring!))).layers[0]!.objects[0],
    ).toMatchObject({ holes: ring!.holes });
  });

  it('Intersect: only where they overlap', () => {
    const [i] = combineShapes([a, b], 'intersect');
    expect([i!.x, i!.y, i!.width, i!.height]).toEqual([50, 50, 50, 50]);
    expect(area(i!)).toBeCloseTo(2500, 3);
  });

  it('curved and turned shapes are combined by their outlines', () => {
    const disc = createEllipse({ x: 0, y: 0, width: 100, height: 100 });
    const [u] = combineShapes([disc, { ...rect(0, 0, 100, 20), rotation: 90 }], 'union');
    expect(area(u!)).toBeGreaterThan(Math.PI * 2500 * 0.98);
    const pen = createPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 },
      ],
      true,
    );
    expect(combineShapes([pen, rect(0, 0, 100, 40)], 'intersect')).toHaveLength(1);
  });

  it('shapes that do not touch stay separate shapes after a union; nothing left is explained', () => {
    expect(combineShapes([a, rect(300, 0, 20, 20)], 'union')).toHaveLength(2);
    expect(() => combineShapes([a, rect(300, 0, 20, 20)], 'intersect')).toThrow(/do not overlap/);
    expect(() => combineShapes([a], 'union')).toThrow(EditError);
    expect(() => combineShapes([a, createText('Hi', { x: 0, y: 0 })], 'union')).toThrow(
      /Only shapes/,
    );
  });

  it('in the document: the selection is replaced where the back shape was', () => {
    const doc = stageWith(rect(300, 0, 10, 10, { name: 'Other' }), a, b);
    const [, back, front] = doc.layers[0]!.objects;
    const { doc: next, ids } = combineObjects(doc, [front!.id, back!.id], 'union');
    expect(next.layers[0]!.objects.map((o) => o.name)).toEqual(['Other', 'Back']);
    expect(ids).toEqual([next.layers[0]!.objects[1]!.id]);
  });
});

describe('holes are checked like the outline', () => {
  it('a hole needs real points', () => {
    const p = {
      ...createPath(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 5, y: 9 },
        ],
        true,
      ),
      holes: [[{ x: 1, y: Number.NaN }]],
    };
    expect(() => validateObject(p)).toThrow(EditError);
  });
});
