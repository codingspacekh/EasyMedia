// AN18: buttons that control the animation (workbook Task 4: Pause and Continue). A button is an
// object like any other — placed, sized, faded, tweened — drawn as it looks in every export; a
// click finds the button on top at that point, and the player does what it says.
import { describe, expect, it } from 'vitest';
import { buttonAt, BUTTON_ACTIONS } from '../../../../src/core/animation/buttons.ts';
import { drawStage, type StageCanvas } from '../../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createButton,
  createGroup,
  createRect,
} from '../../../../src/core/animation/factory.ts';
import { fontsNeeded } from '../../../../src/core/animation/html.ts';
import { addObject, setLayer } from '../../../../src/core/animation/layers.ts';
import { createPlayer } from '../../../../src/core/animation/player.ts';
import {
  ANIMATION_SCHEMA,
  deserializeAnimation,
  serializeAnimation,
} from '../../../../src/core/animation/serialize.ts';
import { setPropertyAt } from '../../../../src/core/animation/tween.ts';
import { morphInto } from '../../../../src/core/animation/tween.ts';
import type { AnimationDoc, AnimObject } from '../../../../src/core/animation/types.ts';

function stage(...objects: AnimObject[]): AnimationDoc {
  let doc = createAnimation({ name: 'Task 4' });
  doc = { ...doc, stage: { ...doc.stage, width: 1024, height: 768, length: 144 } };
  for (const o of objects) doc = addObject(doc, doc.layers[0]!.id, o);
  return doc;
}

const pause = () => createButton('pause', { x: 10, y: 10 });
const resume = () => createButton('continue', { x: 10, y: 40 });

function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push(
          `${key}(${args.map((a) => (typeof a === 'number' ? Math.round(a * 10) / 10 : String(a))).join(',')})`,
        );
        return { addColorStop() {} };
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      calls.push(`${key}=${String(value)}`);
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

describe('a button (AN18)', () => {
  it('is made with its action as its label, small and grey as in the workbook', () => {
    expect(pause()).toMatchObject({
      kind: 'button',
      name: 'Pause',
      label: 'Pause',
      action: 'pause',
      x: 10,
      y: 10,
      width: 90,
      height: 24,
      fill: { kind: 'solid', colour: '#efefef' },
      stroke: { colour: '#767676', width: 1, dash: 'solid' },
    });
    expect(resume().label).toBe('Continue');
    expect(createButton('restart', { x: 0, y: 0 }).label).toBe('Restart');
    expect(createButton('goto', { x: 0, y: 0 })).toMatchObject({ label: 'Go to frame', frame: 0 });
    expect(BUTTON_ACTIONS.map((a) => a.id)).toEqual(['pause', 'continue', 'restart', 'goto']);
  });

  it('is drawn as a rounded box with its label in the middle, in every export', () => {
    const { ctx, calls } = recorder();
    drawStage(ctx, stage(pause()));
    const at = (prefix: string) => calls.findIndex((c) => c.startsWith(prefix));
    expect(calls).toContain('translate(55,22)');
    expect(calls).toContain('fillStyle=#efefef');
    expect(at('fill()')).toBeLessThan(at('stroke()'));
    expect(calls).toContain('font=600 13px "Inter"');
    expect(calls).toContain('textAlign=center');
    expect(calls).toContain('textBaseline=middle');
    expect(calls).toContain('fillStyle=#000000');
    expect(calls).toContain('fillText(Pause,0,0)');
    expect(at('stroke()')).toBeLessThan(at('fillText('));
  });

  it('can be tweened like any object, but not morphed', () => {
    const faded = setPropertyAt(pause(), 'opacity', 24, 0);
    expect(faded.tracks).toHaveLength(1);
    expect(() => morphInto(pause(), createRect({ x: 0, y: 0 }), 24)).toThrow(/Only shapes/);
  });

  it('is saved and opened again; files now say version 4 and version 3 files still open', () => {
    const doc = stage(pause(), createButton('goto', { x: 0, y: 0 }));
    expect(ANIMATION_SCHEMA).toBe(4);
    expect(deserializeAnimation(serializeAnimation(doc))).toEqual(doc);
    const v3 = serializeAnimation(stage()).replace('"schemaVersion": 4', '"schemaVersion": 3');
    expect(deserializeAnimation(v3).schemaVersion).toBe(4);
    const broken = serializeAnimation(doc).replace('"action": "pause"', '"action": "explode"');
    expect(() => deserializeAnimation(broken)).toThrow(/not an EasyMedia animation/);
  });

  it('the web page carries the font of its label', () => {
    expect(fontsNeeded(stage(pause())).map((f) => f.file)).toEqual(['Inter.ttf']);
  });
});

describe('which button a click is on (AN18)', () => {
  it('the button under the point, and nothing beside it', () => {
    const doc = stage(pause(), resume());
    expect(buttonAt(doc, 0, { x: 50, y: 20 })?.action).toBe('pause');
    expect(buttonAt(doc, 0, { x: 50, y: 50 })?.action).toBe('continue');
    expect(buttonAt(doc, 0, { x: 50, y: 36 })).toBeNull();
    expect(buttonAt(doc, 0, { x: 500, y: 500 })).toBeNull();
  });

  it('where the button is at that frame', () => {
    const moving = setPropertyAt(pause(), 'x', 72, 500);
    const doc = stage(moving);
    expect(buttonAt(doc, 0, { x: 50, y: 20 })).not.toBeNull();
    expect(buttonAt(doc, 72, { x: 50, y: 20 })).toBeNull();
    expect(buttonAt(doc, 72, { x: 540, y: 20 })).not.toBeNull();
  });

  it('not one covered by a picture or shape in front of it, nor one on a hidden layer', () => {
    const cover = createRect({ x: 0, y: 0, width: 200, height: 30 });
    expect(buttonAt(stage(pause(), cover), 0, { x: 50, y: 20 })).toBeNull();
    expect(buttonAt(stage(cover, pause()), 0, { x: 50, y: 20 })).not.toBeNull();
    const doc = stage(pause());
    const hidden = setLayer(doc, doc.layers[0]!.id, { visible: false });
    expect(buttonAt(hidden, 0, { x: 50, y: 20 })).toBeNull();
  });

  it('a faded-out button cannot be clicked', () => {
    const doc = stage({ ...pause(), opacity: 0 });
    expect(buttonAt(doc, 0, { x: 50, y: 20 })).toBeNull();
  });

  it('inside a group that has been moved and turned', () => {
    const group = createGroup([pause(), resume()]);
    const doc = stage({ ...group, x: group.x + 100, y: group.y + 200 });
    expect(buttonAt(doc, 0, { x: 150, y: 220 })?.action).toBe('pause');
    expect(buttonAt(doc, 0, { x: 50, y: 20 })).toBeNull();
  });
});

describe('the player does what the button says (AN18)', () => {
  const at = (frame: number) => 1000 + (frame * 1000) / 24;
  const doc = stage();

  it('Pause stops on the frame; Continue goes on from it (workbook Task 4)', () => {
    const p = createPlayer(doc, 1000);
    p.press({ action: 'pause' }, at(30));
    expect(p.frameAt(at(90))).toBe(30);
    p.press({ action: 'continue' }, at(90));
    expect(p.frameAt(at(100))).toBe(40);
  });

  it('Restart plays from the start; Go to frame jumps to its frame', () => {
    const p = createPlayer(doc, 1000);
    p.press({ action: 'restart' }, at(50));
    expect(p.frameAt(at(50))).toBe(0);
    p.press({ action: 'goto', frame: 100 }, at(60));
    expect(p.frameAt(at(60))).toBe(100);
    p.press({ action: 'goto' }, at(70));
    expect(p.frameAt(at(70))).toBe(0);
  });
});
