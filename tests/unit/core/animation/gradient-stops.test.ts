// M17a, from the 2017–2021 animation benchmark: AN6 gradients with three or more colours and a
// radial gradient's centre (9626/04 M/J/20 the red–yellow–green meter scale, M/J/21 a dark–light–
// dark panel, M/J/18 the bloom). The first and last colours stay `from` and `to`, so files with two
// colours are as before and older versions still open them; the colours between are `stops`.
import { describe, expect, it } from 'vitest';
import { createAnimation, createRect, createText } from '../../../../src/core/animation/factory.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  addStop,
  colourStops,
  removeStop,
  radialCentre,
} from '../../../../src/core/animation/gradient.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import { samePaint } from '../../../../src/core/animation/same-colour.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import { editAt, keyableProperties } from '../../../../src/core/animation/tween.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { AnimationDoc, AnimObject, Paint } from '../../../../src/core/animation/types.ts';

const meter: Paint = {
  kind: 'linear',
  from: '#ff0000',
  to: '#00ff00',
  angle: 0,
  stops: [{ at: 50, colour: '#ffff00' }],
};

const box = (fill: Paint, extra: Partial<AnimObject> = {}): AnimObject =>
  ({ ...createRect({ x: 0, y: 0, width: 200, height: 100 }), fill, ...extra }) as AnimObject;

const stageWith = (...objects: AnimObject[]): AnimationDoc => {
  let doc = createAnimation({ name: 'Meter' });
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
};

function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      if (key === 'withLayer') return undefined;
      return (...args: unknown[]) => {
        calls.push(`${key}(${args.map((a) => String(a)).join(',')})`);
        if (key.startsWith('create'))
          return { addColorStop: (at: number, c: string) => calls.push(`stop ${at} ${c}`) };
        if (key === 'measureText') return { width: 10 * String(args[0]).length };
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

describe('AN6 gradient colours', () => {
  it('AN6 colourStops: from at 0, the colours between in order of where they are, to at 1', () => {
    expect(
      colourStops({
        ...meter,
        stops: [
          { at: 75, colour: '#0000ff' },
          { at: 25, colour: '#ffff00' },
        ],
      } as Extract<Paint, { kind: 'linear' }>),
    ).toEqual([
      { offset: 0, colour: '#ff0000' },
      { offset: 0.25, colour: '#ffff00' },
      { offset: 0.75, colour: '#0000ff' },
      { offset: 1, colour: '#00ff00' },
    ]);
  });

  it('AN6 Add a colour goes in the middle of the widest gap, mixed from its neighbours; remove takes it off', () => {
    const two: Paint = { kind: 'linear', from: '#000000', to: '#ffffff', angle: 0 };
    const three = addStop(two);
    expect(three).toMatchObject({ stops: [{ at: 50, colour: '#808080' }] });
    const four = addStop(three);
    // Kept in order along the gradient, as Properties lists them.
    expect((four as typeof meter).stops).toEqual([
      { at: 25, colour: '#404040' },
      { at: 50, colour: '#808080' },
    ]);
    expect(removeStop(four, 1)).toEqual({ ...two, stops: [{ at: 25, colour: '#404040' }] });
    // The last one taken off leaves a two-colour gradient, saved as before.
    expect(removeStop(three, 0)).toEqual(two);
  });

  it('AN6 the stage draws every colour of the gradient, two-colour gradients exactly as before', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(box(meter)));
    expect(calls.filter((c) => c.startsWith('stop'))).toEqual([
      'stop 0 #ff0000',
      'stop 0.5 #ffff00',
      'stop 1 #00ff00',
    ]);
    const plain = recorder();
    drawStage(plain.ctx, stageWith(box({ kind: 'radial', from: '#ffffff', to: '#000000' })));
    expect(plain.calls.filter((c) => c.startsWith('stop'))).toEqual([
      'stop 0 #ffffff',
      'stop 1 #000000',
    ]);
    expect(plain.calls).toContain('createRadialGradient(0,0,0,0,0,100)');
  });

  it('AN6 a radial gradient starts at its centre, in % of the box (the bloom off to one side)', () => {
    const bloom: Paint = { kind: 'radial', from: '#ffffff', to: '#ff00ff', cx: 25, cy: 75 };
    expect(radialCentre(bloom)).toEqual({ x: 25, y: 75 });
    expect(radialCentre({ kind: 'radial', from: '#ffffff', to: '#000000' })).toEqual({
      x: 50,
      y: 50,
    });
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(box(bloom)));
    // 200 × 100 box centred on (0, 0): 25 % across is x −50, 75 % down is y 25.
    expect(calls).toContain('createRadialGradient(-50,25,0,-50,25,100)');
  });

  it('AN6 the SVG has the same colours and the radial centre (cx, cy; the focus fx, fy is there too)', () => {
    const svg = stageSvg(
      stageWith(
        box(meter),
        box({ kind: 'radial', from: '#ffffff', to: '#ff00ff', cx: 25, cy: 75 }, { x: 300 }),
      ),
    );
    expect(svg).toContain(
      '<stop offset="0" stop-color="#ff0000"/><stop offset="0.5" stop-color="#ffff00"/><stop offset="1" stop-color="#00ff00"/>',
    );
    // Its focus is its centre: SVG's own fx, fy (left out, as they are cx, cy).
    expect(svg).toMatch(/<radialGradient [^>]*cx="350" cy="75" r="100">/);
  });

  it('AN6 a curved text’s gradient runs across the whole words, not across each letter (AN26)', () => {
    const t = {
      ...createText('ABC', { x: 0, y: 0, size: 20 }),
      curve: 50,
      fill: meter,
    } as AnimObject;
    const svg = stageSvg(stageWith(t), 0, {}, [], {}, (_f, s) => 10 * s.length);
    const ends = [...svg.matchAll(/<linearGradient [^>]*x1="([^"]+)" y1="([^"]+)" x2="([^"]+)"/g)];
    expect(ends).toHaveLength(3);
    for (const m of ends) {
      expect(Number(m[1])).toBeCloseTo(Number(ends[0]![1]), 2);
      expect(Number(m[2])).toBeCloseTo(Number(ends[0]![2]), 2);
      expect(Number(m[3])).toBeCloseTo(Number(ends[0]![3]), 2);
    }
  });

  it('AN6 a gradient on text is set in the text’s own space in the SVG, so it lies where the stage paints it', () => {
    // An SVG text is placed by its transform, and a gradient on it is read in the text's own
    // space: the gradient carries the way back from the stage (else it lands somewhere else).
    const t = {
      ...createText('AB', { x: 100, y: 50, size: 20 }),
      width: 40,
      height: 24,
      fill: meter,
    };
    const svg = stageSvg(stageWith(t as AnimObject));
    expect(svg).toContain('transform="matrix(1 0 0 1 120 62)"');
    expect(svg).toContain(
      '<linearGradient id="g1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 1 -120 -62)" x1="100" y1="62" x2="140" y2="62">',
    );
  });

  it('AN6 a colour between must be a colour, at 0–100 %; a centre is inside the box (0–100 %)', () => {
    expect(() => validateObject(box(meter))).not.toThrow();
    const bad = (fill: unknown) => () => validateObject(box(fill as Paint));
    expect(bad({ ...meter, stops: [{ at: 50, colour: 'yellow' }] })).toThrow(EditError);
    expect(bad({ ...meter, stops: [{ at: 120, colour: '#ffff00' }] })).toThrow(
      'Each colour of a gradient is placed from 0 to 100 %.',
    );
    expect(bad({ kind: 'radial', from: '#ffffff', to: '#000000', cx: -5 })).toThrow(
      'The centre of a radial gradient must be from 0 to 100 % of the box.',
    );
  });

  it('AN6 more colours and the centre are saved; a two-colour gradient is saved as before', () => {
    const bloom: Paint = { kind: 'radial', from: '#ffffff', to: '#ff00ff', cx: 30, cy: 40 };
    const doc = stageWith(box(meter), box(bloom));
    const again = deserializeAnimation(serializeAnimation(doc));
    expect(again.layers[0]!.objects.map((o) => o.fill)).toEqual([meter, bloom]);
    const two = serializeAnimation(
      stageWith(box({ kind: 'linear', from: '#000000', to: '#ffffff', angle: 90 })),
    );
    expect(two).not.toContain('"stops"');
    const damaged = serializeAnimation(doc).replace('"#ffff00"', '"yellow"');
    expect(() => deserializeAnimation(damaged)).toThrow();
  });

  it('AN6 Select same fill tells gradients apart by their colours between and their centre', () => {
    expect(samePaint(meter, { ...meter })).toBe(true);
    expect(samePaint(meter, { ...meter, stops: [{ at: 40, colour: '#ffff00' }] } as Paint)).toBe(
      false,
    );
    const a: Paint = { kind: 'radial', from: '#ffffff', to: '#000000' };
    expect(samePaint(a, { ...a, cx: 50, cy: 50 } as Paint)).toBe(true);
    expect(samePaint(a, { ...a, cx: 20 } as Paint)).toBe(false);
  });

  it('AN6 the fill colour keyframe is for one colour: a gradient changed on a later frame is changed throughout', () => {
    const o = box(meter);
    expect(keyableProperties(o)).not.toContain('fillColour');
    const next = editAt(o, 12, (now) => ({
      ...now,
      fill: { ...meter, stops: [{ at: 30, colour: '#ffff00' }] },
    }));
    expect(next.tracks ?? []).toEqual([]);
    expect(next.fill).toMatchObject({ stops: [{ at: 30, colour: '#ffff00' }] });
  });
});
