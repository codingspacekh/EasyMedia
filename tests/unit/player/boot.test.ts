// @vitest-environment jsdom
// AN15: the HTML web animation's page starts its player: it reads the animation from the page,
// waits for its pictures and fonts, then draws the frame for the time on every screen refresh
// with the same drawing as the app, looping.
import { describe, expect, it, vi } from 'vitest';
import {
  createAnimation,
  createPicture,
  createRect,
  createText,
} from '../../../src/core/animation/factory.ts';
import { webPage } from '../../../src/core/animation/html.ts';
import { addObject } from '../../../src/core/animation/layers.ts';
import { setPropertyAt } from '../../../src/core/animation/tween.ts';
import type { StageCanvas } from '../../../src/core/animation/draw.ts';
import type { AnimationDoc } from '../../../src/core/animation/types.ts';
import { boot, type BootDeps } from '../../../src/player/boot.ts';

/** A canvas context that records the rectangles filled (the stage's background and the box). */
function recorder() {
  const calls: string[] = [];
  const target: Record<string, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push(
          `${key}(${args.map((a) => (typeof a === 'number' ? Math.round(a) : '…')).join(',')})`,
        );
        return key.startsWith('create') ? { addColorStop() {} } : undefined;
      };
    },
    set(_t, key: string, value: unknown) {
      target[key] = value;
      return true;
    },
  }) as unknown as StageCanvas;
  return { ctx, calls };
}

/** Task 1's circle as a 100 × 100 box moving from x 0 to x 396 over 3 s at 24 fps. */
function moving(): AnimationDoc {
  let doc = createAnimation({ name: 'Task 1' });
  doc = { ...doc, stage: { ...doc.stage, width: 600, height: 400, fps: 24, length: 72 } };
  const box = setPropertyAt(createRect({ x: 0, y: 0, width: 100, height: 100 }), 'x', 72, 396);
  return addObject(doc, doc.layers[0]!.id, box);
}

function load(html: string) {
  document.open();
  document.write(html);
  document.close();
}

function deps(over: Partial<BootDeps> = {}) {
  const { ctx, calls } = recorder();
  const frames: ((t: number) => void)[] = [];
  const d: BootDeps = {
    document,
    now: () => 1000,
    requestFrame: (cb) => void frames.push(cb),
    context: () => ctx,
    loadImage: vi.fn(async (url: string) => ({ url })),
    loadFont: vi.fn(async () => {}),
    ...over,
  };
  /** Runs the next screen refresh at time t (ms). */
  const refresh = (t: number) => frames.shift()!(t);
  return { d, calls, refresh, frames };
}

const page = (doc: AnimationDoc, pictures: Record<string, string> = {}) =>
  webPage(doc, { player: '', pictures, fonts: [] });

describe('the web page’s player (AN15)', () => {
  it('draws frame 0 at once, then the frame for the time on each refresh, looping', async () => {
    load(page(moving()));
    const { d, calls, refresh } = deps();
    const started = await boot(d);
    expect(started).not.toBeNull();
    expect(calls).toContain('fillRect(0,0,600,400)');
    calls.length = 0;
    refresh(1000 + 1500); // 1.5 s: frame 36, x = 198: the box's left side at −50 from its centre
    expect(started!.player.state()).toEqual({ frame: 36, playing: true });
    expect(calls).toContain('translate(248,50)');
    calls.length = 0;
    refresh(1000 + 4000); // 4 s: looped round to frame 24, x = 132
    expect(started!.player.state().frame).toBe(24);
    expect(calls).toContain('translate(182,50)');
    calls.length = 0;
    refresh(1000 + 4010); // still frame 24: not drawn again
    expect(calls).toEqual([]);
  });

  it('waits for each picture and the text’s fonts before drawing', async () => {
    let doc = moving();
    const picture = { id: 'p1', path: 'Paris1.jpg', width: 80, height: 60 };
    doc = { ...doc, pictures: [picture] };
    doc = addObject(doc, doc.layers[0]!.id, createPicture(picture, { x: 10, y: 10 }));
    doc = addObject(doc, doc.layers[0]!.id, createText('Paris', { x: 10, y: 300 }));
    load(page(doc, { p1: 'data:image/jpeg;base64,AAAA' }));
    const { d, calls } = deps();
    await boot(d);
    expect(d.loadImage).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA');
    expect(d.loadFont).toHaveBeenCalledWith('400 48px "Inter"');
    expect(calls).toContain('drawImage(…,-40,-30,80,60)');
  });

  it('a picture that cannot be loaded is left out; the rest still plays', async () => {
    let doc = moving();
    const picture = { id: 'p1', path: 'Gone.jpg', width: 80, height: 60 };
    doc = { ...doc, pictures: [picture] };
    doc = addObject(doc, doc.layers[0]!.id, createPicture(picture, { x: 10, y: 10 }));
    load(page(doc, { p1: 'data:image/jpeg;base64,AAAA' }));
    const { d, calls } = deps({ loadImage: async () => Promise.reject(new Error('bad')) });
    expect(await boot(d)).not.toBeNull();
    expect(calls.some((c) => c.startsWith('drawImage'))).toBe(false);
  });

  it('does nothing on a page without an animation or a canvas', async () => {
    load('<!DOCTYPE html><html><body><p>Hello</p></body></html>');
    expect(await boot(deps().d)).toBeNull();
    load(page(moving()));
    expect(await boot(deps({ context: () => null }).d)).toBeNull();
  });
});
