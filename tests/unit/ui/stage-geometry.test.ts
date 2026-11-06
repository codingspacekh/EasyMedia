// AN1–AN3, AN6: the stage's pure geometry (M17 refactor of Stage.svelte): what a drag shows
// before it is let go, what a click or a marquee picks, the rulers' ticks and the handles.
import { describe, expect, it } from 'vitest';
import { createAnimation, createLayer, createRect } from '../../../src/core/animation/factory.ts';
import { addObject, findObject } from '../../../src/core/animation/layers.ts';
import type { AnimationDoc } from '../../../src/core/animation/types.ts';
import {
  drawnShape,
  handlePoints,
  marqueeBox,
  objectCorners,
  objectsInBox,
  pickObject,
  previewDoc,
  roundStage,
  rulerStep,
  rulerTicks,
  simplifyStroke,
  sizeCanvas,
  unionBounds,
} from '../../../src/ui/animation/stage-geometry.ts';

/** Two rectangles on Layer 1 (`a` behind `b`, overlapping), and `c` over `b` on a locked layer. */
function scene() {
  let doc: AnimationDoc = createAnimation({ name: 'Test' });
  const layer = doc.layers[0]!.id;
  const a = { ...createRect({ x: 0, y: 0, width: 100, height: 100 }), id: 'a' };
  const b = { ...createRect({ x: 50, y: 50, width: 100, height: 100 }), id: 'b' };
  doc = addObject(doc, layer, a);
  doc = addObject(doc, layer, b);
  const c = { ...createRect({ x: 60, y: 60, width: 50, height: 50 }), id: 'c' };
  // layers[0] is drawn first (at the bottom): the locked layer goes on top.
  doc = { ...doc, layers: [...doc.layers, createLayer('Locked', { locked: true, objects: [c] })] };
  return { doc, layer };
}

describe('drawnShape (AN3: a shape dragged out)', () => {
  it('is the box between where the drag started and where it is now, whichever way', () => {
    const o = drawnShape({
      kind: 'draw',
      tool: 'rect',
      start: { x: 100, y: 80 },
      now: { x: 40, y: 20 },
      square: false,
    });
    expect(o).toMatchObject({ kind: 'rect', id: 'temp', x: 40, y: 20, width: 60, height: 60 });
  });

  it('with Shift is a square as big as the longer side', () => {
    const o = drawnShape({
      kind: 'draw',
      tool: 'ellipse',
      start: { x: 0, y: 0 },
      now: { x: 30, y: -10 },
      square: true,
    });
    expect(o).toMatchObject({ kind: 'ellipse', x: 0, y: -30, width: 30, height: 30 });
  });

  it('a line goes from the start to the pointer', () => {
    const o = drawnShape({
      kind: 'draw',
      tool: 'line',
      start: { x: 10, y: 10 },
      now: { x: 60, y: 30 },
      square: false,
    });
    expect(o).toMatchObject({ kind: 'path', closed: false, x: 10, y: 10, width: 50, height: 20 });
  });
});

describe('previewDoc (every drag shows its result live)', () => {
  it('no drag: the document as it is', () => {
    const { doc, layer } = scene();
    expect(previewDoc(doc, null, layer)).toBe(doc);
  });

  it('moving: the dragged objects are moved by the drag', () => {
    const { doc, layer } = scene();
    const shown = previewDoc(
      doc,
      {
        kind: 'move',
        start: { x: 0, y: 0 },
        ids: ['a'],
        union: { x: 0, y: 0, width: 100, height: 100 },
        dx: 5,
        dy: -3,
      },
      layer,
    );
    expect(findObject(shown, 'a')?.object).toMatchObject({ x: 5, y: -3 });
    expect(findObject(shown, 'b')?.object).toMatchObject({ x: 50, y: 50 });
  });

  it('drawing: the new shape is shown on the current layer, on top', () => {
    const { doc, layer } = scene();
    const shown = previewDoc(
      doc,
      { kind: 'draw', tool: 'rect', start: { x: 0, y: 0 }, now: { x: 10, y: 10 }, square: false },
      layer,
    );
    expect(shown.layers.find((l) => l.id === layer)!.objects.at(-1)!.id).toBe('temp');
  });

  it('a brush stroke shows once it has two points', () => {
    const { doc, layer } = scene();
    expect(previewDoc(doc, { kind: 'brush', points: [{ x: 0, y: 0 }] }, layer)).toBe(doc);
    const shown = previewDoc(
      doc,
      {
        kind: 'brush',
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
      },
      layer,
    );
    expect(findObject(shown, 'temp')?.object.kind).toBe('path');
  });

  it('rotating and resizing change the object; an object no longer there leaves the document', () => {
    const { doc, layer } = scene();
    const turned = previewDoc(
      doc,
      { kind: 'rotate', id: 'a', centre: { x: 50, y: 50 }, degrees: 30 },
      layer,
    );
    expect(findObject(turned, 'a')?.object.rotation).toBe(30);
    const wider = previewDoc(
      doc,
      { kind: 'resize', id: 'a', handle: 'e', now: { x: 200, y: 50 }, lock: false },
      layer,
    );
    expect(findObject(wider, 'a')?.object.width).toBe(200);
    expect(
      previewDoc(doc, { kind: 'rotate', id: 'gone', centre: { x: 0, y: 0 }, degrees: 9 }, layer),
    ).toBe(doc);
  });

  it('a guide or a marquee does not change the document', () => {
    const { doc, layer } = scene();
    expect(previewDoc(doc, { kind: 'guide', axis: 'x', index: null, value: 4 }, layer)).toBe(doc);
    expect(
      previewDoc(doc, { kind: 'marquee', start: { x: 0, y: 0 }, now: { x: 9, y: 9 } }, layer),
    ).toBe(doc);
  });
});

describe('picking (a click, a marquee)', () => {
  it('a click picks the front-most object under it, never one on a locked layer', () => {
    const { doc } = scene();
    expect(pickObject(doc, { x: 75, y: 75 })?.id).toBe('b'); // under the locked `c`
    expect(pickObject(doc, { x: 10, y: 10 })?.id).toBe('a');
    expect(pickObject(doc, { x: 500, y: 10 })).toBeNull();
  });

  it('a marquee selects every unlocked object it touches', () => {
    const { doc } = scene();
    expect(objectsInBox(doc, { x: 120, y: 120, width: 300, height: 300 })).toEqual(['b']);
    expect(objectsInBox(doc, { x: -10, y: -10, width: 400, height: 400 })).toEqual(['a', 'b']);
  });

  it('the marquee box is the same whichever way it is dragged', () => {
    expect(marqueeBox({ x: 50, y: 10 }, { x: 20, y: 40 })).toEqual({
      x: 20,
      y: 10,
      width: 30,
      height: 30,
    });
  });

  it('several objects move as their joint box', () => {
    const { doc } = scene();
    const objects = ['a', 'b'].map((id) => findObject(doc, id)!.object);
    expect(unionBounds(objects)).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });
});

describe('brush strokes and rounding', () => {
  it('a stroke keeps only points at least `min` apart, rounded to hundredths', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0 },
      { x: 2.004, y: 0 },
      { x: 2.5, y: 0 },
      { x: 5.333, y: 1 },
    ];
    expect(simplifyStroke(points, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5.33, y: 1 },
    ]);
    expect(roundStage(1.23456)).toBe(1.23);
  });
});

describe('rulers (AN2)', () => {
  it('numbers are at least 48 screen pixels apart', () => {
    expect(rulerStep(1)).toBe(50);
    expect(rulerStep(0.5)).toBe(100);
    expect(rulerStep(10)).toBe(5);
    expect(rulerStep(0.01)).toBe(1000);
  });

  it('ticks run from 0 to the stage length in steps', () => {
    expect(rulerTicks(220, 50)).toEqual([0, 50, 100, 150, 200]);
  });
});

describe('selection handles', () => {
  it('an object’s corners and its eight resize handles, on the stage', () => {
    const o = createRect({ x: 10, y: 20, width: 100, height: 50 });
    expect(objectCorners(o)).toEqual([
      { x: 10, y: 20 },
      { x: 110, y: 20 },
      { x: 110, y: 70 },
      { x: 10, y: 70 },
    ]);
    const handles = Object.fromEntries(handlePoints(o));
    expect(Object.keys(handles)).toEqual(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']);
    expect(handles['n']).toEqual({ x: 60, y: 20 });
    expect(handles['se']).toEqual({ x: 110, y: 70 });
  });
});

describe('sizeCanvas (N1)', () => {
  /** A canvas that counts how often its size is set: each set throws its pixels away. */
  function canvas() {
    return new (class {
      sets = 0;
      #w = 300;
      #h = 150;
      get width() {
        return this.#w;
      }
      set width(v: number) {
        this.sets++;
        this.#w = v;
      }
      get height() {
        return this.#h;
      }
      set height(v: number) {
        this.sets++;
        this.#h = v;
      }
    })();
  }

  it('N1 sizes the canvas for the stage, the zoom and the screen, at least 1 × 1', () => {
    const c = canvas();
    expect(sizeCanvas(c, { width: 1024, height: 768 }, 0.5, 2)).toBe(true);
    expect([c.width, c.height]).toEqual([1024, 768]);
    expect(sizeCanvas(c, { width: 10, height: 10 }, 0.01, 1)).toBe(true);
    expect([c.width, c.height]).toEqual([1, 1]);
  });

  it('N1 leaves the canvas alone when its size has not changed (a redraw per frame must not reallocate it)', () => {
    const c = canvas();
    sizeCanvas(c, { width: 1024, height: 768 }, 1, 2);
    const sets = c.sets;
    for (let frame = 0; frame < 30; frame++)
      expect(sizeCanvas(c, { width: 1024, height: 768 }, 1, 2)).toBe(false);
    expect(c.sets).toBe(sets);
  });
});
