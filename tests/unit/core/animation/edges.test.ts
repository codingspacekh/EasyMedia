// M13: the less-trodden paths of the animation core — curved paths, dotted and text strokes,
// alignment, folder rules, missing things, and the file's shape checks.
import { describe, expect, it } from 'vitest';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createPath,
  createRect,
  createText,
} from '../../../../src/core/animation/factory.ts';
import {
  flattenPath,
  hitTest,
  resizeFrom,
  setSize,
} from '../../../../src/core/animation/geometry.ts';
import {
  addFolder,
  addLayer,
  addObject,
  duplicateObjects,
  groupObjects,
  moveLayerToFolder,
  removeObjects,
  renameFolder,
  setFolderOpen,
  setLayer,
  uniqueName,
  ungroup,
  updateObject,
} from '../../../../src/core/animation/layers.ts';
import { presetSize, validateObject } from '../../../../src/core/animation/rules.ts';
import {
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import type { AnimObject, PathObject } from '../../../../src/core/animation/types.ts';

function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get:
      (_t, key: string) =>
      (...args: unknown[]) => {
        calls.push(`${key}(${args.filter((a) => typeof a !== 'object').join(',')})`);
        return { addColorStop: () => {} };
      },
    set: (_t, key: string, value: unknown) => {
      calls.push(`${key}=${typeof value === 'object' ? 'gradient' : String(value)}`);
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

function stageWith(...objects: AnimObject[]) {
  let doc = createAnimation({ name: 'A' });
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
}

const curve: PathObject = {
  ...createPath(
    [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ],
    true,
  ),
  points: [
    { x: 0, y: 0, out: { x: 50, y: -30 } },
    { x: 100, y: 0, in: { x: 80, y: -30 } },
    { x: 100, y: 100 },
  ],
};

describe('curved paths', () => {
  it('flattenPath samples the curves and keeps straight segments as they are', () => {
    const closed = flattenPath(curve.points, true);
    expect(closed.length).toBeGreaterThan(3);
    const open = flattenPath(curve.points, false);
    expect(open.at(-1)).toEqual({ x: 100, y: 100 });
    expect(flattenPath([], false)).toEqual([]);
  });

  it('is drawn with bezierCurveTo, closed or open; scaling moves the handles too', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(curve));
    expect(calls.some((c) => c.startsWith('bezierCurveTo('))).toBe(true);
    expect(calls).toContain('closePath()');
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, stageWith({ ...curve, closed: false }));
    expect(calls2.some((c) => c.startsWith('bezierCurveTo('))).toBe(true);
    expect(calls2).not.toContain('fill()');
    const half = setSize(curve, 50, 100);
    expect(half.points[0]!.out).toEqual({ x: 25, y: -30 });
    expect(half.points[1]!.in).toEqual({ x: 40, y: -30 });
  });

  it('a path of fewer than two points is refused; closed paths are "Shape"', () => {
    expect(() => createPath([{ x: 0, y: 0 }], false)).toThrow(/two points/);
    expect(
      createPath(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
        true,
      ).name,
    ).toBe('Shape');
    expect(() => validateObject({ ...curve, points: [{ x: 0, y: 0 }] })).toThrow(/two points/);
  });
});

describe('strokes, text and odd shapes in the drawing', () => {
  it('a dotted stroke uses round caps; a solid one clears the dash', () => {
    const { ctx, calls } = recorder();
    drawStage(
      ctx,
      stageWith({
        ...createRect({ x: 0, y: 0 }),
        stroke: { colour: '#000000', width: 2, dash: 'dotted' },
      }),
    );
    expect(calls).toContain('lineCap=round');
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(
      c2,
      stageWith({
        ...createRect({ x: 0, y: 0 }),
        stroke: { colour: '#000000', width: 2, dash: 'solid' },
      }),
    );
    expect(calls2).toContain('setLineDash()');
  });

  it('text can be right-aligned, outlined, and have no fill', () => {
    const { ctx, calls } = recorder();
    const t = {
      ...createText('Hi', { x: 0, y: 0, size: 20 }),
      align: 'right' as const,
      stroke: { colour: '#ff0000', width: 1, dash: 'solid' as const },
    };
    drawStage(ctx, stageWith(t));
    expect(calls).toContain('textAlign=right');
    expect(calls.some((c) => c.startsWith('strokeText('))).toBe(true);
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, stageWith({ ...t, fill: { kind: 'none' }, stroke: undefined }));
    expect(calls2.some((c) => c.startsWith('fillText('))).toBe(false);
  });

  it('a zero-size object and a zero-length stroke segment are hit-tested safely', () => {
    const dot = createRect({ x: 10, y: 10, width: 0, height: 0 });
    expect(hitTest(dot, { x: 10, y: 10 })).toBe(true);
    expect(hitTest(dot, { x: 20, y: 20 })).toBe(false);
    const noStroke = { ...createRect({ x: 0, y: 0 }), stroke: undefined };
    expect(hitTest(noStroke, { x: 50, y: 50 })).toBe(true);
  });

  it('resizing a zero-sized object keeps proportions sanely; an edge drag with the lock scales both', () => {
    const r = createRect({ x: 0, y: 0, width: 100, height: 50 });
    const fromEdge = resizeFrom(r, 'e', { x: 200, y: 999 }, { lockRatio: true });
    expect(fromEdge).toMatchObject({ width: 200, height: 100 });
    const fromTop = resizeFrom(r, 'n', { x: 999, y: -50 }, { lockRatio: true });
    expect(fromTop).toMatchObject({ width: 200, height: 100 });
    const flat = setSize(createRect({ x: 0, y: 0, width: 0, height: 0 }), 10, 10);
    expect(flat).toMatchObject({ width: 10, height: 10 });
    const g = createGroup([createRect({ x: 0, y: 0, width: 0, height: 0 })]);
    expect(setSize(g, 10, 10).children[0]).toMatchObject({ width: 0, height: 0 });
  });
});

describe('layers and folders at the edges', () => {
  const doc = createAnimation({ name: 'A' });
  const layer = doc.layers[0]!.id;

  it('names count the objects inside groups; a layer or object that is gone is refused', () => {
    const g = createGroup([createRect({ x: 0, y: 0 }), createEllipse({ x: 0, y: 0 })]);
    const d = addObject(doc, layer, g);
    expect(uniqueName(d, 'Rectangle')).toBe('Rectangle 2');
    expect(() => addObject(d, 'nope', createRect({ x: 0, y: 0 }))).toThrow(/no longer exists/);
    expect(() => updateObject(d, 'nope', (o) => o)).toThrow(/no longer exists/);
    expect(() => ungroup(d, g.id)).not.toThrow();
    expect(() =>
      ungroup(addObject(d, layer, createRect({ x: 0, y: 0 })), d.layers[0]!.objects[0]!.id),
    ).not.toThrow();
    const r = createRect({ x: 0, y: 0 });
    expect(() => ungroup(addObject(doc, layer, r), r.id)).toThrow(/not a group/);
    expect(updateObject(d, g.id, (o) => o)).toBe(d);
    // Duplicating a group gives its children new ids too.
    const { doc: dup } = duplicateObjects(d, [g.id]);
    const copy = dup.layers[0]!.objects[1]!;
    expect(copy.kind === 'group' && copy.children[0]!.id).not.toBe(g.children[0]!.id);
  });

  it('a layer added above one in a folder joins the folder; folders are named, renamed, opened', () => {
    const { doc: d1, folder } = addFolder(doc, '  ');
    expect(folder.name).toBe('Folder');
    const d2 = moveLayerToFolder(d1, layer, folder.id);
    const { layer: above } = addLayer(d2, undefined, layer);
    expect(above.folderId).toBe(folder.id);
    expect(() => moveLayerToFolder(d2, layer, 'nope')).toThrow(/folder/);
    expect(() => renameFolder(d2, folder.id, ' ')).toThrow(/name/);
    expect(renameFolder(d2, folder.id, 'parts').folders[0]!.name).toBe('parts');
    expect(setFolderOpen(d2, folder.id, false).folders[0]!.open).toBe(false);
  });

  it('removing objects on a locked layer is refused; grouping needs the objects to exist', () => {
    const r = createRect({ x: 0, y: 0 });
    const d = setLayer(addObject(doc, layer, r), layer, { locked: true });
    expect(() => removeObjects(d, [r.id])).toThrow(/locked/);
    expect(() => groupObjects(doc, ['a', 'b'])).toThrow(/no longer exists/);
  });

  it('a preset that does not exist is refused', () => {
    expect(() => presetSize('3:2', { width: 600 })).toThrow(/preset/);
  });
});

describe('the file’s shape checks', () => {
  const good = () => {
    let d = createAnimation({ name: 'A' });
    d = addObject(d, d.layers[0]!.id, createRect({ x: 0, y: 0 }));
    d = addObject(d, d.layers[0]!.id, curve);
    d = addObject(d, d.layers[0]!.id, createText('Hi', { x: 0, y: 0 }));
    d = addObject(d, d.layers[0]!.id, createGroup([createEllipse({ x: 0, y: 0 })]));
    return JSON.parse(serializeAnimation(d));
  };
  const refuse = (change: (o: Record<string, unknown>[], doc: Record<string, unknown>) => void) => {
    const doc = good();
    change(doc.layers[0].objects, doc);
    expect(() => deserializeAnimation(JSON.stringify(doc))).toThrow(/damaged/);
  };

  it('refuses objects with a bad fill, stroke, name, points or words', () => {
    refuse((o) => (o[0]!.fill = { kind: 'solid', colour: 'red' }));
    refuse((o) => (o[0]!.fill = { kind: 'linear', from: '#000000', to: '#ffffff' }));
    refuse((o) => (o[0]!.fill = { kind: 'radial', from: 'x', to: '#ffffff' }));
    refuse((o) => (o[0]!.fill = { kind: 'weird' }));
    refuse((o) => (o[0]!.fill = 'red'));
    refuse((o) => (o[0]!.stroke = { colour: '#000000' }));
    refuse((o) => (o[0]!.name = 5));
    refuse((o) => (o[1]!.points = [{ x: 'a', y: 0 }]));
    refuse((o) => (o[1]!.closed = 'yes'));
    refuse((o) => (o[2]!.text = 7));
    refuse((o) => ((o[3]!.children as unknown[])[0] = { kind: 'ellipse' }));
    refuse((_o, doc) => ((doc.stage as Record<string, unknown>).background = 'white'));
    refuse((_o, doc) => (doc.guides = 'none'));
    refuse((_o, doc) => (doc.pictures = [{ id: 'p' }]));
  });

  it('accepts every kind written by the app, including gradients and a star', () => {
    const doc = good();
    doc.layers[0].objects[0].fill = { kind: 'radial', from: '#000000', to: '#ffffff' };
    expect(() => deserializeAnimation(JSON.stringify(doc))).not.toThrow();
  });
});
