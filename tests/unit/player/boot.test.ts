// @vitest-environment jsdom
// AN15: the HTML web animation's page starts its player: it reads the animation from the page,
// waits for its pictures and fonts, then draws the frame for the time on every screen refresh
// with the same drawing as the app, looping.
import { describe, expect, it, vi } from 'vitest';
import {
  createAnimation,
  createButton,
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

  it('AN18: clicking Pause stops on the frame and Continue plays on (workbook Task 4)', async () => {
    let doc = moving();
    doc = addObject(doc, doc.layers[0]!.id, createButton('pause', { x: 10, y: 300 }));
    doc = addObject(doc, doc.layers[0]!.id, createButton('continue', { x: 10, y: 340 }));
    load(page(doc));
    let now = 1000;
    const { d, calls, refresh } = deps({ now: () => now });
    const started = (await boot(d))!;
    const canvas = document.getElementById('stage')!;
    // The page shows the 600 × 400 stage at half size, 20 px from the window's corner.
    canvas.getBoundingClientRect = () =>
      ({ left: 20, top: 20, width: 300, height: 200 }) as DOMRect;
    const click = (x: number, y: number) =>
      canvas.dispatchEvent(
        new MouseEvent('click', { clientX: 20 + x / 2, clientY: 20 + y / 2, bubbles: true }),
      );

    now = 1000 + 500; // frame 12
    click(50, 312);
    expect(started.player.state()).toEqual({ frame: 12, playing: false });
    calls.length = 0;
    refresh(1000 + 2000);
    expect(started.player.state().frame).toBe(12);

    now = 1000 + 2000;
    click(50, 352);
    expect(started.player.state().playing).toBe(true);
    refresh(1000 + 2500);
    expect(started.player.state().frame).toBe(24);

    click(300, 100); // not on a button: nothing changes
    expect(started.player.state().playing).toBe(true);
  });

  it('AN18: the pointer becomes a hand over a button', async () => {
    let doc = moving();
    doc = addObject(doc, doc.layers[0]!.id, createButton('pause', { x: 10, y: 300 }));
    load(page(doc));
    await boot(deps().d);
    const canvas = document.getElementById('stage')!;
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 400 }) as DOMRect;
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 50, clientY: 312 }));
    expect(canvas.style.cursor).toBe('pointer');
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 300, clientY: 100 }));
    expect(canvas.style.cursor).toBe('');
  });
});
