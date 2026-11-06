// M17a, from the 2017–2021 animation benchmark: AN26 Curve, text along an arch (9626/04 M/J/17
// HUNGRY logo, O/N/17 Rock ICT, M/J/18 "TTS is 10!", March 2021). Each letter is placed on a
// circular arc and turned to follow it; the box is the bent words' bounds. Drawn by the one stage
// drawing (preview, PNG, GIF, MP4, the web page) and the SVG alike; measured by a function given
// to the core, so these tests are exact.
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createText,
  LINE_HEIGHT,
} from '../../../../src/core/animation/factory.ts';
import { curvedText, MAX_CURVE } from '../../../../src/core/animation/curve.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import { splitIntoLetters } from '../../../../src/core/animation/letters.ts';
import { addObject } from '../../../../src/core/animation/layers.ts';
import { validateObject } from '../../../../src/core/animation/rules.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { stageSvg } from '../../../../src/core/animation/svg-export.ts';
import { withProperty } from '../../../../src/core/animation/tween.ts';
import { EditError } from '../../../../src/core/model/errors.ts';
import type { AnimationDoc, AnimObject, TextObject } from '../../../../src/core/animation/types.ts';

/** Every letter 10 px wide (at size 20), so the arcs can be worked out by hand. */
const tenEach = (s: string) => 10 * [...s].length;

const text = (words: string, extra: Partial<TextObject> = {}): TextObject => ({
  ...createText(words, { x: 100, y: 50, size: 20 }),
  ...extra,
});

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('AN26 curvedText: letters along an arc', () => {
  it('AN26 curve 0 is straight: the letters sit side by side, unturned, in one row', () => {
    const layout = curvedText(text('ABCD'), tenEach);
    expect(layout.letters.map((l) => l.char)).toEqual(['A', 'B', 'C', 'D']);
    expect(layout.letters.map((l) => l.x)).toEqual([5, 15, 25, 35]);
    expect(layout.letters.every((l) => l.y === 12 && l.angle === 0)).toBe(true);
    expect(layout).toMatchObject({ width: 40, height: 20 * LINE_HEIGHT });
  });

  it('AN26 a positive curve arches up like a rainbow: the middle is highest, the ends turn outwards', () => {
    const layout = curvedText(text('ABCDE', { curve: 40 }), tenEach);
    const [a, , c, , e] = layout.letters;
    expect(c!.y).toBeLessThan(a!.y);
    expect(a!.y).toBeCloseTo(e!.y, 9);
    expect(c!.angle).toBeCloseTo(0, 9);
    expect(a!.angle).toBeLessThan(0); // the left end leans left
    expect(e!.angle).toBeCloseTo(-a!.angle, 9);
  });

  it('AN26 a negative curve bends down like a smile: the ends are highest and lean inwards', () => {
    const layout = curvedText(text('ABCDE', { curve: -40 }), tenEach);
    const [a, , c, , e] = layout.letters;
    expect(c!.y).toBeGreaterThan(a!.y);
    expect(a!.angle).toBeGreaterThan(0);
    expect(e!.angle).toBeCloseTo(-a!.angle, 9);
  });

  it('AN26 at 100 the line closes into a full circle, at 50 a half circle (the middle of the letters on the circle)', () => {
    // Letters 10 px wide on a 100 px line: the first and last letters' middles are 90 px apart.
    const words = 'ABCDEFGHIJ';
    const full = curvedText(text(words, { curve: MAX_CURVE }), tenEach).letters;
    expect(full.at(-1)!.angle - full[0]!.angle).toBeCloseTo(360 * 0.9, 6);
    const half = curvedText(text(words, { curve: 50 }), tenEach).letters;
    expect(half.at(-1)!.angle - half[0]!.angle).toBeCloseTo(180 * 0.9, 6);
    // Every letter's middle is the same distance from the circle's centre: the radius.
    const r = 100 / Math.PI; // a half turn of 100 px
    const top = half[4]!; // E and F straddle the top
    const centre = { x: top.x - r * Math.sin((top.angle * Math.PI) / 180), y: 0 };
    centre.y = top.y + r * Math.cos((top.angle * Math.PI) / 180);
    for (const l of half) expect(Math.hypot(l.x - centre.x, l.y - centre.y)).toBeCloseTo(r, 6);
  });

  it('AN26 the box is the bent words’ bounds: every letter fits inside and touches its edges', () => {
    const layout = curvedText(text('HUNGRY', { curve: 60 }), tenEach);
    const lineHeight = 20 * LINE_HEIGHT;
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const l of layout.letters) {
      const a = (l.angle * Math.PI) / 180;
      for (const [dx, dy] of [
        [-5, -lineHeight / 2],
        [5, -lineHeight / 2],
        [5, lineHeight / 2],
        [-5, lineHeight / 2],
      ] as const) {
        const x = l.x + dx * Math.cos(a) - dy * Math.sin(a);
        const y = l.y + dx * Math.sin(a) + dy * Math.cos(a);
        [left, top, right, bottom] = [
          Math.min(left, x),
          Math.min(top, y),
          Math.max(right, x),
          Math.max(bottom, y),
        ];
      }
    }
    expect(left).toBeCloseTo(0, 9);
    expect(top).toBeCloseTo(0, 9);
    expect(right).toBeCloseTo(layout.width, 9);
    expect(bottom).toBeCloseTo(layout.height, 9);
    // Bent, it is narrower and taller than straight (60 px by 24 px).
    expect(layout.width).toBeLessThan(60);
    expect(layout.height).toBeGreaterThan(24);
  });

  it('AN26 more lines: each on its own arc round the same centre, the lower one inside, placed as aligned', () => {
    const layout = curvedText(text('ABCDEF\nXY', { curve: 30, align: 'centre' }), tenEach);
    const row1 = layout.letters.slice(0, 6);
    const row2 = layout.letters.slice(6);
    // The centre lies on the line through any letter, along its turn: find it from two letters.
    const r1 = 60 / ((30 / 100) * 2 * Math.PI) + 12; // the middle of the block is the reference
    const a = (row1[0]!.angle * Math.PI) / 180;
    const centre = { x: row1[0]!.x - r1 * Math.sin(a), y: row1[0]!.y + r1 * Math.cos(a) };
    for (const l of row1) expect(Math.hypot(l.x - centre.x, l.y - centre.y)).toBeCloseTo(r1, 6);
    for (const l of row2)
      expect(Math.hypot(l.x - centre.x, l.y - centre.y)).toBeCloseTo(r1 - 24, 6);
    // Centred: the short line is round the top of its arc.
    expect(row2[0]!.angle).toBeCloseTo(-row2[1]!.angle, 9);
  });

  it('AN26 left-aligned lines start at the same turn of the arc', () => {
    const layout = curvedText(text('ABCDEF\nXY', { curve: 30, align: 'left' }), tenEach);
    expect(layout.letters[6]!.angle).toBeCloseTo(layout.letters[0]!.angle, 9);
  });

  it('AN26 spaces keep their room; a curve beyond ±100 is drawn as ±100', () => {
    expect(curvedText(text('A B', { curve: 20 }), tenEach).letters).toHaveLength(3);
    const most = curvedText(text('ABCD', { curve: 100 }), tenEach);
    expect(curvedText(text('ABCD', { curve: 250 }), tenEach)).toEqual(most);
  });

  it('AN26 bigger letters make the same shape, scaled (resizing keeps the curve)', () => {
    const small = curvedText(text('HUNGRY', { curve: 45 }), tenEach);
    const big = curvedText(text('HUNGRY', { curve: 45, size: 40 }), (s) => 2 * tenEach(s));
    expect(big.width).toBeCloseTo(2 * small.width, 9);
    expect(big.height).toBeCloseTo(2 * small.height, 9);
  });
});

/** Records every call, in order, with numbers to 3 decimals. */
function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      if (key === 'withLayer') return undefined;
      return (...args: unknown[]) => {
        const shown = args.map((a) =>
          typeof a === 'number' ? String(Math.round(a * 1000) / 1000) : String(a),
        );
        calls.push(`${key}(${shown.join(',')})`);
        if (key === 'measureText') return { width: tenEach(String(args[0])) };
        if (key.startsWith('create')) return { addColorStop: () => undefined };
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

const stageWith = (...objects: AnimObject[]): AnimationDoc => {
  let doc = createAnimation({ name: 'Logo' });
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
};

describe('AN26 drawing curved text', () => {
  it('AN26 the stage draws each letter on its own, moved to its place and turned (spaces are not drawn)', () => {
    const t = text('AB C', { curve: 50, stroke: { colour: '#000000', width: 1, dash: 'solid' } });
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(t));
    const layout = curvedText(t, tenEach);
    expect(calls.filter((c) => c.startsWith('fillText(')).map((c) => c.split(',')[0])).toEqual([
      'fillText(A',
      'fillText(B',
      'fillText(C',
    ]);
    expect(calls.filter((c) => c.startsWith('strokeText('))).toHaveLength(3);
    // Each letter is drawn from the top of its line, half a line above its middle.
    expect(calls).toContain(`fillText(A,0,${-(20 * LINE_HEIGHT) / 2})`);
    // The first letter is turned as the layout says.
    const turned = calls.filter((c) => c.startsWith('rotate('));
    expect(turned[0]).toBe(
      `rotate(${Math.round(((layout.letters[0]!.angle * Math.PI) / 180) * 1000) / 1000})`,
    );
  });

  it('AN26 the SVG puts each letter where the stage draws it, measured in the font as the stage measures', () => {
    const t = { ...text('HUNGRY', { curve: 60 }), x: 0, y: 0 };
    const layout = curvedText(t, tenEach);
    const doc = stageWith({ ...t, width: layout.width, height: layout.height });
    const svg = stageSvg(doc, 0, {}, [], {}, (_font, s) => tenEach(s));
    const letters = [...svg.matchAll(/<text[^>]*transform="matrix\(([^)]+)\)"[^>]*>(.)<\/text>/g)];
    expect(letters.map((m) => m[2])).toEqual(['H', 'U', 'N', 'G', 'R', 'Y']);
    letters.forEach((m, i) => {
      const [a, b, , , e, f] = m[1]!.split(' ').map(Number);
      const l = layout.letters[i]!;
      expect(e).toBeCloseTo(l.x, 2);
      expect(f).toBeCloseTo(l.y, 2);
      expect(deg(Math.atan2(b!, a!))).toBeCloseTo(l.angle, 1);
    });
  });
});

describe('AN26 the curve as a property', () => {
  it('AN26 a curve is from −100 to 100; outside it is explained', () => {
    expect(() => validateObject(text('Rock ICT', { curve: -100 }))).not.toThrow();
    expect(() => validateObject(text('Rock ICT', { curve: 101 }))).toThrow(EditError);
    expect(() => validateObject(text('Rock ICT', { curve: 101 }))).toThrow(
      'The curve must be between −100 and 100.',
    );
    expect(() => validateObject(text('Rock ICT', { curve: Number.NaN }))).toThrow(EditError);
  });

  it('AN26 a curve is saved and opened again; a file without one is straight text', () => {
    const doc = stageWith(text('TTS is 10!', { curve: 35 }));
    const again = deserializeAnimation(serializeAnimation(doc));
    expect((again.layers[0]!.objects[0] as TextObject).curve).toBe(35);
    const plain = deserializeAnimation(serializeAnimation(stageWith(text('Plain'))));
    expect(serializeAnimation(plain)).not.toContain('"curve"');
    const damaged = serializeAnimation(doc).replace('"curve": 35', '"curve": "35"');
    expect(() => deserializeAnimation(damaged)).toThrow();
  });

  it('AN26 a font size keyframe scales a curved text’s box as a whole (its shape stays)', () => {
    const t = text('HUNGRY', { curve: 45, width: 50, height: 30 });
    expect(withProperty(t, 'size', 40)).toMatchObject({ width: 100, height: 60 });
  });

  it('AN26 Split into letters on a curve: each letter where it was drawn, turned along the arch, straight itself', () => {
    const t = text('HUN', { curve: 50, x: 0, y: 0 });
    const layout = curvedText(t, tenEach);
    const curved = { ...t, width: layout.width, height: layout.height };
    const measure = (o: TextObject) => ({
      width: tenEach(o.text),
      height: 20 * LINE_HEIGHT,
    });
    const letters = splitIntoLetters(curved, measure);
    expect(letters.map((l) => l.text)).toEqual(['H', 'U', 'N']);
    letters.forEach((l, i) => {
      const placed = layout.letters[i]!;
      expect(l.curve).toBeUndefined();
      expect(l.rotation).toBeCloseTo((placed.angle + 360) % 360, 6);
      expect(l.x + l.width / 2).toBeCloseTo(placed.x, 6);
      expect(l.y + l.height / 2).toBeCloseTo(placed.y, 6);
    });
  });
});
