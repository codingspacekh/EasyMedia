// M13 / AN1, AN3, AN4, AN6, AN7: a new animation and new objects with the defaults students
// expect (P12). The workbook's numbers are the test data (Task 1: a 600 × 400 stage, a
// 135 × 135 star at (128, 102), a circle of radius 102 at (0, 0)).
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createLine,
  createPicture,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../../../../src/core/animation/factory.ts';

describe('createAnimation', () => {
  it('AN1 starts as a 1280 × 720 white stage at 24 fps lasting 5 s (120 frames)', () => {
    const doc = createAnimation({ name: 'Untitled' });
    expect(doc.schemaVersion).toBe(3);
    expect(doc.name).toBe('Untitled');
    expect(doc.stage).toEqual({
      width: 1280,
      height: 720,
      background: '#ffffff',
      fps: 24,
      length: 120,
    });
  });

  it('AN7 has one empty layer, no folders, no pictures', () => {
    const doc = createAnimation({ name: 'A' });
    expect(doc.layers).toHaveLength(1);
    expect(doc.layers[0]).toMatchObject({
      name: 'Layer 1',
      visible: true,
      locked: false,
      objects: [],
    });
    expect(doc.folders).toEqual([]);
    expect(doc.pictures).toEqual([]);
  });

  it('AN2 starts with rulers off, a hidden 10 px grid, no guides, and snapping to guides and objects', () => {
    const { view, guides } = createAnimation({ name: 'A' });
    expect(view.rulers).toBe(false);
    expect(view.grid).toEqual({ show: false, size: 10, over: false });
    expect(view.snap).toEqual({ grid: true, guides: true, objects: true, pixels: false });
    expect(guides).toEqual({ x: [], y: [] });
  });
});

describe('new objects (AN3, AN4, AN6)', () => {
  it('a rectangle is 100 × 100 where it is put, square-cornered, grey with a dark 2 px outline, opaque', () => {
    const r = createRect({ x: 10, y: 20 });
    expect(r).toMatchObject({
      kind: 'rect',
      name: 'Rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
      radius: 0,
      rotation: 0,
      opacity: 100,
      fill: { kind: 'solid', colour: '#9aa4b2' },
      stroke: { colour: '#1e222a', width: 2, dash: 'solid' },
    });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('every object gets its own id', () => {
    expect(createRect({ x: 0, y: 0 }).id).not.toBe(createRect({ x: 0, y: 0 }).id);
  });

  it('Task 1: a 135 × 135 star at (128, 102) with five points; a circle of radius 102 at (0, 0)', () => {
    const star = createStar({ x: 128, y: 102, width: 135, height: 135 });
    expect(star).toMatchObject({ kind: 'star', name: 'Star', points: 5, inner: 0.5, width: 135 });
    const circle = createEllipse({ x: 0, y: 0, width: 204, height: 204 });
    expect(circle).toMatchObject({ kind: 'ellipse', name: 'Ellipse', x: 0, y: 0, height: 204 });
  });

  it('a polygon has six sides by default', () => {
    expect(createPolygon({ x: 0, y: 0 })).toMatchObject({ kind: 'polygon', sides: 6 });
  });

  it('Task 5: a line from (0, 500) to (1240, 500) is an open path 1240 wide and 0 high with no fill', () => {
    const road = createLine({ x: 0, y: 500 }, { x: 1240, y: 500 });
    expect(road).toMatchObject({
      kind: 'path',
      name: 'Line',
      x: 0,
      y: 500,
      width: 1240,
      height: 0,
      closed: false,
      fill: { kind: 'none' },
    });
    expect(road.points).toEqual([
      { x: 0, y: 0 },
      { x: 1240, y: 0 },
    ]);
    // Drawn the other way, the box is the same and the points run the other way.
    const back = createLine({ x: 1240, y: 600 }, { x: 0, y: 500 });
    expect(back).toMatchObject({ x: 0, y: 500, width: 1240, height: 100 });
    expect(back.points).toEqual([
      { x: 1240, y: 100 },
      { x: 0, y: 0 },
    ]);
  });

  it('Task 1: text "Task 1" at (193, 73) in 64 px, with a bundled font, black, no outline', () => {
    const t = createText('Task 1', { x: 193, y: 73, size: 64 });
    expect(t).toMatchObject({
      kind: 'text',
      name: 'Task 1',
      text: 'Task 1',
      x: 193,
      y: 73,
      size: 64,
      font: 'Inter',
      bold: false,
      italic: false,
      align: 'left',
      fill: { kind: 'solid', colour: '#000000' },
    });
    expect(t.stroke).toBeUndefined();
    // Its box is a rough measure until the screen measures the words (the UI corrects it).
    expect(t.width).toBeGreaterThan(100);
    expect(t.height).toBeCloseTo(64 * 1.2, 5);
    expect(createText('', { x: 0, y: 0 }).name).toBe('Text');
  });

  it('a picture is placed at its own pixel size, named after its file', () => {
    const p = createPicture(
      { id: 'pic', path: 'Task5.jpg', width: 640, height: 360 },
      { x: 5, y: 6 },
    );
    expect(p).toMatchObject({
      kind: 'picture',
      name: 'Task5.jpg',
      pictureId: 'pic',
      x: 5,
      y: 6,
      width: 640,
      height: 360,
      fill: { kind: 'none' },
    });
  });

  it('AN13 a group encloses its children, whose positions become relative to the group', () => {
    const car = createRect({ x: 100, y: 500, width: 200, height: 80 });
    const wheel = createEllipse({ x: 120, y: 560, width: 40, height: 40 });
    const g = createGroup([car, wheel]);
    expect(g).toMatchObject({
      kind: 'group',
      name: 'Group',
      x: 100,
      y: 500,
      width: 200,
      height: 100,
    });
    expect(g.children.map((c) => [c.x, c.y])).toEqual([
      [0, 0],
      [20, 60],
    ]);
    expect(() => createGroup([])).toThrow(/at least one/i);
  });
});
