// M17a, from the 2017–2021 animation benchmark: AN25 Skew (9626/04 M/J/21: the shield "turned
// sideways"). A horizontal skew leans the object as italic letters lean (its top to the right), a
// vertical one drops its right side; drawn in the one stage drawing (preview, PNG, GIF, MP4 and
// the web page), the SVG, hit-testing and the handles alike, and tweened like a turn.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createPath,
  createRect,
} from '../../../../src/core/animation/factory.ts';
import {
  boundsOf,
  hitTest,
  resizeFrom,
  toLocal,
  toStage,
} from '../../../../src/core/animation/geometry.ts';
import { addObject, groupObjects, ungroup } from '../../../../src/core/animation/layers.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import {
  editAt,
  keyableProperties,
  objectAt,
  setPropertyAt,
} from '../../../../src/core/animation/tween.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { flipObject } from '../../../../src/core/animation/combine.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { AnimationDoc, AnimObject } from '../../../../src/core/animation/types.ts';

const red = { kind: 'solid' as const, colour: '#ff0000' };
const rect = (
  x: number,
  y: number,
  width: number,
  height: number,
  extra: Partial<AnimObject> = {},
) => ({ ...createRect({ x, y, width, height }), fill: red, ...extra }) as AnimObject;

const close = (p: { x: number; y: number }, x: number, y: number) => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

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
        return undefined;
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      if (key === 'lineWidth') calls.push(`lineWidth=${String(value)}`);
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

describe('AN25 Skew horizontal and vertical', () => {
  it('a horizontal skew leans the top to the right; a vertical one drops the right side', () => {
    const h = rect(0, 0, 100, 100, { skewX: 45 });
    // The top edge moves right by half the height, the bottom left; the centre stays.
    close(toStage(h, { x: 0, y: 0 }), 50, 0);
    close(toStage(h, { x: 0, y: 100 }), -50, 100);
    close(toStage(h, { x: 50, y: 50 }), 50, 50);
    const v = rect(0, 0, 100, 100, { skewY: 45 });
    close(toStage(v, { x: 100, y: 0 }), 100, 50);
    close(toStage(v, { x: 0, y: 0 }), 0, -50);
    // toLocal undoes it, turned and flipped too.
    const all = rect(10, 20, 100, 60, { skewX: 20, skewY: -15, rotation: 30, flipX: true });
    close(toLocal(all, toStage(all, { x: 12, y: 47 })), 12, 47);
  });

  it('hit-testing and the bounds follow the slanted outline', () => {
    const h = rect(0, 0, 100, 100, { skewX: 45 });
    expect(hitTest(h, { x: 140, y: 5 })).toBe(true);
    expect(hitTest(h, { x: 5, y: 5 })).toBe(false);
    const b = boundsOf(h);
    expect(b.x).toBeCloseTo(-50);
    expect(b.width).toBeCloseTo(200);
    expect(b.height).toBeCloseTo(100);
  });

  it('is drawn skewed after the turn and flip, with an even outline (the preview and every export)', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(rect(0, 0, 100, 100, { skewX: 45, stroke: undefined })));
    const at = calls.indexOf('translate(50,50)');
    expect(calls[at + 1]).toBe('transform(1,0,-1,1,0,0)');
    // An outline is drawn with the skew taken off again, so its lines stay as wide as set.
    const outlined = recorder();
    drawStage(
      outlined.ctx,
      stageWith(
        rect(0, 0, 100, 100, { skewX: 45, stroke: { colour: '#000000', width: 4, dash: 'solid' } }),
      ),
    );
    const fill = outlined.calls.indexOf('fill()');
    const stroke = outlined.calls.indexOf('stroke()');
    expect(outlined.calls.slice(fill, stroke)).toContain('transform(1,0,1,1,0,0)');
  });

  it('the SVG has the skewed outline, an even outline width and a skewed ellipse as curves', () => {
    const tri = (pts: [number, number][], extra: Partial<AnimObject> = {}) =>
      ({
        ...createPath(
          pts.map(([x, y]) => ({ x: x + 100, y: y + 100 })),
          true,
        ),
        fill: red,
        ...extra,
      }) as AnimObject;
    const d = (doc: AnimationDoc) => /<path d="([^"]+)"/.exec(stageSvg(doc))![1];
    // Skewed 45° sideways, a 100 × 100 triangle's top corners move right 50 and the bottom left 50.
    expect(
      d(
        stageWith(
          tri(
            [
              [0, 0],
              [100, 0],
              [0, 100],
            ],
            { skewX: 45 },
          ),
        ),
      ),
    ).toBe(
      d(
        stageWith(
          tri([
            [50, 0],
            [150, 0],
            [-50, 100],
          ]),
        ),
      ),
    );
    const outlined = stageSvg(
      stageWith(
        rect(0, 0, 100, 100, { skewX: 30, stroke: { colour: '#000000', width: 4, dash: 'solid' } }),
      ),
    );
    expect(outlined).toContain('stroke-width="4"');
    // An ellipse skewed is not an SVG arc (an arc cannot lean): it is curves through the right points.
    const oval = stageSvg(
      stageWith({ ...createEllipse({ x: 0, y: 0, width: 100, height: 100 }), skewX: 45 }),
    );
    const path = /<path d="([^"]+)"/.exec(oval)![1]!;
    expect(path).not.toContain('A');
    expect(path).toContain('C');
    // It starts at the right-hand point of the circle (50 down from its top, which does not move).
    expect(path.startsWith('M100 50')).toBe(true);
  });

  it('a gradient leans with the shape in the SVG', () => {
    const svg = stageSvg(
      stageWith(
        rect(0, 0, 100, 100, {
          skewX: 30,
          fill: { kind: 'linear', from: '#ff0000', to: '#0000ff', angle: 0 },
        }),
      ),
    );
    expect(svg).toContain('gradientTransform="matrix(');
  });

  it('is tweened like a turn: a skew typed on a later frame is a keyframe', () => {
    const r = rect(0, 0, 100, 100);
    const keyed = editAt(r, 10, (now) => ({ ...now, skewX: 30 }));
    expect(keyed.skewX).toBeUndefined();
    expect(keyed.tracks).toEqual([
      {
        property: 'skewX',
        keyframes: [
          { frame: 0, value: 0, easing: 'linear', hold: false },
          { frame: 10, value: 30, easing: 'linear', hold: false },
        ],
      },
    ]);
    expect(objectAt(keyed, 5).skewX).toBe(15);
    // On frame 0 of a still object it is a plain change.
    expect(editAt(r, 0, (now) => ({ ...now, skewY: -20 })).skewY).toBe(-20);
    expect(objectAt(setPropertyAt(r, 'skewY', 4, 8), 2).skewY).toBe(4);
    // Insert keyframe ▸ All fixes the skew only of an object that is skewed.
    expect(keyableProperties(r)).not.toContain('skewX');
    expect(keyableProperties(rect(0, 0, 1, 1, { skewY: 5 }))).toEqual(
      expect.arrayContaining(['skewX', 'skewY']),
    );
  });

  it('is kept when saved and opened again; an older file opens unchanged (no skew)', () => {
    const doc = stageWith(rect(10, 10, 100, 50, { skewX: 20, skewY: -10 }));
    const back = deserializeAnimation(serializeAnimation(doc)).layers[0]!.objects[0]!;
    expect([back.skewX, back.skewY]).toEqual([20, -10]);
    const plain = deserializeAnimation(serializeAnimation(stageWith(rect(0, 0, 10, 10))));
    expect('skewX' in plain.layers[0]!.objects[0]!).toBe(false);
    const damaged = serializeAnimation(doc).replace('"skewX": 20', '"skewX": "a lot"');
    expect(() => deserializeAnimation(damaged)).toThrow();
  });

  it('is between −80° and 80° (more is a line)', () => {
    expect(() => validateObject(rect(0, 0, 10, 10, { skewX: 80, skewY: -80 }))).not.toThrow();
    expect(() => validateObject(rect(0, 0, 10, 10, { skewX: 81 }))).toThrow(EditError);
    expect(() => validateObject(rect(0, 0, 10, 10, { skewY: Number.NaN }))).toThrow(
      'A skew must be between −80° and 80°.',
    );
  });

  it('resizing a skewed (and flipped) object keeps the opposite corner where it is', () => {
    for (const extra of [{ skewX: 30 }, { skewY: -20, rotation: 40 }, { flipX: true }]) {
      const r = rect(100, 100, 100, 50, extra);
      const corner = toStage(r, { x: 0, y: 0 });
      const sized = resizeFrom(r, 'se', toStage(r, { x: 150, y: 80 }), { lockRatio: false });
      expect(sized.width).toBeCloseTo(150);
      expect(sized.height).toBeCloseTo(80);
      close(toStage(sized, { x: 0, y: 0 }), corner.x, corner.y);
    }
  });

  it('a flip mirrors the skewed object in its box (its skew is kept)', () => {
    const r = rect(0, 0, 100, 100, { skewX: 45 });
    const f = flipObject(r, 'horizontal');
    expect(f.skewX).toBe(45);
    // The top edge, which leaned right (50 to 150), now leans left (−50 to 50).
    close(toStage(f, { x: 100, y: 0 }), -50, 0);
    close(toStage(f, { x: 0, y: 0 }), 50, 0);
  });

  it('ungrouping a skewed group leaves its parts where the group showed them, skewed', () => {
    let doc = stageWith(rect(0, 0, 50, 50), rect(150, 0, 50, 100));
    const grouped = groupObjects(
      doc,
      doc.layers[0]!.objects.map((o) => o.id),
    );
    const skewed = { ...grouped.group, skewX: 45 };
    doc = { ...grouped.doc, layers: [{ ...grouped.doc.layers[0]!, objects: [skewed] }] };
    const parts = ungroup(doc, skewed.id).layers[0]!.objects;
    for (const [i, part] of parts.entries()) {
      const child = skewed.children[i]!;
      const shown = toStage(skewed, {
        x: child.x + child.width / 2,
        y: child.y + child.height / 2,
      });
      close({ x: part.x + part.width / 2, y: part.y + part.height / 2 }, shown.x, shown.y);
      expect(part.skewX).toBeCloseTo(45);
    }
  });

  it('a group skewed draws its parts skewed (they are drawn in its box)', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith({ ...createGroup([rect(0, 0, 10, 10)]), skewY: 45 } as AnimObject));
    expect(calls).toContain('transform(1,1,0,1,0,0)');
  });

  it('a skewed shape keeps its skew while it morphs (AN10)', () => {
    const r = rect(0, 0, 100, 100, { skewX: 20 });
    const shaped = setPropertyAt(r, 'shape', 10, {
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.5, y: 1 },
      ],
      closed: true,
    });
    expect(objectAt(shaped, 5).skewX).toBe(20);
  });
});
