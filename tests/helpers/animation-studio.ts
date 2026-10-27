// Animation mode driven as a student drives it, for the acceptance tests of M14 onwards: the
// use cases the clicks and typed numbers reach, frame-by-frame reading, save and reopen, export
// checked by the task checker (T6).
import { expect } from 'vitest';
import { findObject } from '../../src/core/animation/layers.ts';
import { objectAt } from '../../src/core/animation/tween.ts';
import type { AnimObject, Id, TextObject } from '../../src/core/animation/types.ts';
import type { ProbeInfo } from '../../src/core/ports.ts';
import { checkFile, type TaskSpec } from '../../src/core/teaching/task-check.ts';
import { testApp } from './test-app.ts';

export const colourOf = (o: AnimObject) =>
  o.fill.kind === 'solid' ? o.fill.colour.toLowerCase() : o.fill.kind;

export const picture = (width: number, height: number): ProbeInfo => ({
  kind: 'image',
  container: 'jpg',
  sizeBytes: 300_000,
  video: { codec: 'mjpeg', width, height },
});

/** Animation mode on its own, with the steps a student takes. */
export function studio(media: Record<string, ProbeInfo> = {}) {
  const t = testApp(media);
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const last = (): AnimObject =>
    doc()
      .layers.flatMap((l) => l.objects)
      .at(-1)!;
  /** The object as it is shown at a frame (top-level objects). */
  const at = (id: Id, frame: number) => objectAt(findObject(doc(), id)!.object, frame);
  /** Selects an object and types values with the playhead on `frame`. */
  const type = (id: Id, frame: number, values: Partial<AnimObject>) => {
    anim.select([id]);
    anim.setFrame(frame);
    expect(anim.setProperties(values)).toBeNull();
  };
  const stage = (change: Partial<ReturnType<typeof doc>['stage']>) =>
    expect(anim.setStage({ ...doc().stage, ...change })).toBeNull();
  /** Saves to `path`, starts a new animation, and opens the file again. */
  async function saveAndReopen(path: string) {
    t.dialogs.saveAnimation.mockResolvedValueOnce(path);
    await anim.saveAs();
    expect(anim.isDirty()).toBe(false);
    await anim.newAnimation();
    t.dialogs.openAnimation.mockResolvedValueOnce(path);
    await anim.open();
    expect(anim.store.get().path).toBe(path);
  }
  /** Exports and runs the result through the task checker. */
  async function exportAndCheck(format: 'mp4' | 'gif', output: string, spec: TaskSpec) {
    t.dialogs.exportAnimation.mockResolvedValueOnce(output);
    await anim.exportAnimation(format);
    const result = checkFile(spec, await t.engine.probe(output));
    expect(result.rows.filter((r) => !r.pass)).toEqual([]);
    expect(result.pass).toBe(true);
  }
  return { ...t, anim, doc, last, at, type, stage, saveAndReopen, exportAndCheck };
}

export type Studio = ReturnType<typeof studio>;

/** Workbook Task 1.1 (WB p.98): 600 × 400; all four changes run together over 3 s. */
export function task1(s: Studio) {
  s.stage({ width: 600, height: 400, background: '#ffffff', fps: 24, length: 72 });
  s.anim.addShape('star', { x: 128, y: 102, width: 135, height: 135 });
  const star = s.last().id;
  s.type(star, 0, {
    name: 'Star',
    fill: { kind: 'linear', from: '#ffffff', to: '#555555', angle: 135 },
  });
  s.anim.addShape('ellipse', { x: 0, y: 0, width: 204, height: 204 });
  const circle = s.last().id;
  s.type(circle, 0, {
    name: 'Circle',
    fill: { kind: 'linear', from: '#0000ff', to: '#ff0000', angle: 90 },
  });
  // The rectangle is in front of the star and the circle; the text in front of it.
  s.anim.addShape('rect', { x: 0, y: 0, width: 0, height: 0 });
  const rect = s.last().id;
  s.type(rect, 0, { name: 'Rectangle', fill: { kind: 'solid', colour: '#FF1CC8' } });
  s.anim.addText({ x: 193, y: 73 }, 'Task 1');
  const text = s.last().id;
  s.type(text, 0, { size: 0 } as Partial<TextObject>);
  // Frame 72 (3 s): every end value typed in the Properties panel.
  s.type(circle, 72, { x: 396, y: 196 });
  s.type(rect, 72, {
    width: 600,
    height: 400,
    fill: { kind: 'solid', colour: '#F0DB82' },
    opacity: 57,
  });
  s.type(text, 72, { size: 64 } as Partial<TextObject>);
  s.type(star, 72, { rotation: 360 });
  return { star, circle, rect, text };
}
