// M13 / AN1, AN3, AN4, AN6, AN7: one drawing of the stage for the preview and every export.
// A recording canvas stands in for the real one (jsdom has none; the real drawing is checked
// end to end).
import { describe, expect, it } from 'vitest';
import {
  createAnimation,
  createEllipse,
  createGroup,
  createLine,
  createPicture,
  createRect,
  createStar,
  createText,
} from '../../../../src/core/animation/factory.ts';
import { rotated } from '../../../../src/core/animation/geometry.ts';
import { addObject, setLayer } from '../../../../src/core/animation/layers.ts';
import { drawStage, fontOf, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import type { AnimationDoc, AnimObject } from '../../../../src/core/animation/types.ts';

/** Records every call and every property set, in order. */
function recorder() {
  const calls: string[] = [];
  const gradient = (kind: string) => ({
    kind,
    addColorStop: (at: number, colour: string) => calls.push(`stop ${at} ${colour}`),
  });
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        const shown = args.map((a) =>
          typeof a === 'number'
            ? String(Math.round(a * 1000) / 1000)
            : typeof a === 'string'
              ? a
              : '…',
        );
        calls.push(`${key}(${shown.join(',')})`);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return gradient(key);
        if (key === 'measureText') return { width: 10 * String(args[0]).length };
        return undefined;
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      calls.push(
        `${key}=${typeof value === 'object' ? (value as { kind: string }).kind : String(value)}`,
      );
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

function stageWith(...objects: AnimObject[]): AnimationDoc {
  let doc = createAnimation({ name: 'A' });
  doc = { ...doc, stage: { ...doc.stage, width: 600, height: 400, background: '#808080' } };
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
}

describe('drawStage', () => {
  it('paints the stage colour first, then each object in drawing order', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(createRect({ x: 10, y: 10 }), createEllipse({ x: 0, y: 0 })));
    expect(calls.slice(0, 2)).toEqual(['fillStyle=#808080', 'fillRect(0,0,600,400)']);
    const ellipseAt = calls.findIndex((c) => c.startsWith('ellipse('));
    const rectAt = calls.findIndex((c) => c.startsWith('moveTo(') || c.startsWith('rect('));
    expect(rectAt).toBeGreaterThan(1);
    expect(ellipseAt).toBeGreaterThan(rectAt);
  });

  it('a hidden layer draws nothing', () => {
    const { ctx, calls } = recorder();
    const doc = stageWith(createRect({ x: 10, y: 10 }));
    drawStage(ctx, setLayer(doc, doc.layers[0]!.id, { visible: false }));
    expect(calls).toEqual(['fillStyle=#808080', 'fillRect(0,0,600,400)']);
  });

  it('Task 1: the circle of radius 102 at (0, 0) is an ellipse about (102, 102); it is turned about its centre', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(rotated(createEllipse({ x: 0, y: 0, width: 204, height: 204 }), 45)));
    expect(calls).toContain('translate(102,102)');
    expect(calls).toContain(`rotate(${Math.round((Math.PI / 4) * 1000) / 1000})`);
    expect(calls).toContain('ellipse(0,0,102,102,0,0,6.283)');
    const order = [
      'save()',
      'translate(102,102)',
      'rotate(0.785)',
      'ellipse(0,0,102,102,0,0,6.283)',
      'fill()',
      'stroke()',
      'restore()',
    ];
    const found = order.map((c) => calls.indexOf(c));
    expect(found.every((i) => i >= 0)).toBe(true);
    expect([...found].sort((a, b) => a - b)).toEqual(found);
  });

  it('opacity 57 % becomes globalAlpha 0.57; a gradient fill asks for a gradient with both colours', () => {
    const { ctx, calls } = recorder();
    const r = {
      ...createRect({ x: 0, y: 0, width: 300, height: 150 }),
      opacity: 57,
      fill: { kind: 'linear' as const, from: '#FF1CC8', to: '#F0DB82', angle: 0 },
    };
    drawStage(ctx, stageWith(r));
    expect(calls).toContain('globalAlpha=0.57');
    expect(calls).toContain('createLinearGradient(-150,0,150,0)');
    expect(calls).toContain('stop 0 #FF1CC8');
    expect(calls).toContain('stop 1 #F0DB82');
    expect(calls).toContain('fillStyle=createLinearGradient');
    // A vertical gradient runs top to bottom.
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, stageWith({ ...r, fill: { ...r.fill, angle: 90 } }));
    expect(calls2).toContain('createLinearGradient(0,-75,0,75)');
    const { ctx: c3, calls: calls3 } = recorder();
    drawStage(c3, stageWith({ ...r, fill: { kind: 'radial', from: '#ffffff', to: '#000000' } }));
    expect(calls3).toContain('createRadialGradient(0,0,0,0,0,150)');
  });

  it('a stroke sets the colour, width and dash; no stroke means no stroke call; no fill no fill call', () => {
    const { ctx, calls } = recorder();
    const road = {
      ...createLine({ x: 0, y: 500 }, { x: 1240, y: 500 }),
      stroke: { colour: '#000000', width: 19, dash: 'dashed' as const },
    };
    drawStage(ctx, stageWith(road));
    expect(calls).toContain('strokeStyle=#000000');
    expect(calls).toContain('lineWidth=19');
    expect(calls).toContain('setLineDash(…)');
    expect(calls).toContain('stroke()');
    expect(calls).not.toContain('fill()');
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, stageWith({ ...createRect({ x: 0, y: 0 }), stroke: undefined }));
    expect(calls2).toContain('fill()');
    expect(calls2).not.toContain('stroke()');
  });

  it('Task 1: a star has ten corners; a rounded rectangle uses curves', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stageWith(createStar({ x: 128, y: 102, width: 135, height: 135 })));
    expect(calls.filter((c) => c.startsWith('lineTo(')).length).toBe(9);
    expect(calls).toContain('closePath()');
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, stageWith({ ...createRect({ x: 0, y: 0 }), radius: 20 }));
    expect(calls2.some((c) => c.startsWith('arc('))).toBe(true);
  });

  it('AN4 text sets the bundled font at its size, draws each line, aligned as asked', () => {
    const { ctx, calls } = recorder();
    const t = {
      ...createText('Task 1\nTwo', { x: 193, y: 73, size: 64 }),
      bold: true,
      align: 'centre' as const,
    };
    drawStage(ctx, stageWith(t));
    expect(fontOf(t)).toBe('700 64px "Inter"');
    expect(calls).toContain('font=700 64px "Inter"');
    expect(calls).toContain('textAlign=center');
    expect(calls).toContain('textBaseline=top');
    expect(calls.filter((c) => c.startsWith('fillText(')).length).toBe(2);
    // Drawn about the box's centre: the first line starts at the top (−height / 2 = −76.8), the
    // second one line height (1.2 × size) lower.
    const lines = calls.filter((c) => c.startsWith('fillText('));
    expect(lines[0]).toBe('fillText(Task 1,0,-76.8)');
    expect(lines[1]).toBe('fillText(Two,0,0)');
    expect(fontOf({ ...t, italic: true, bold: false })).toBe('italic 400 64px "Inter"');
  });

  it('AN5 a picture draws its image when it is loaded, or a placeholder box when it is not', () => {
    const picture = { id: 'p', path: 'Task5.jpg', width: 640, height: 360 };
    const doc = { ...stageWith(createPicture(picture, { x: 5, y: 6 })), pictures: [picture] };
    const { ctx, calls } = recorder();
    drawStage(ctx, doc, { image: () => ({ loaded: true }) });
    expect(calls).toContain('drawImage(…,-320,-180,640,360)');
    const { ctx: c2, calls: calls2 } = recorder();
    drawStage(c2, doc, { image: () => null });
    expect(calls2.some((c) => c.startsWith('drawImage('))).toBe(false);
    expect(calls2).toContain('strokeRect(-320,-180,640,360)');
  });

  it('AN13 a group draws its children inside its own box and turn', () => {
    const { ctx, calls } = recorder();
    const g = rotated(
      createGroup([
        createRect({ x: 100, y: 500, width: 200, height: 80 }),
        createEllipse({ x: 120, y: 560, width: 40, height: 40 }),
      ]),
      90,
    );
    drawStage(ctx, stageWith(g));
    // The group: translate to its centre (200, 550) and turn; then the wheel at (20, 60) in it.
    expect(calls).toContain('translate(200,550)');
    expect(calls).toContain('rotate(1.571)');
    expect(calls).toContain('translate(40,80)'); // the wheel's centre inside the group's box
    expect(calls).toContain('ellipse(0,0,20,20,0,0,6.283)');
  });
});
