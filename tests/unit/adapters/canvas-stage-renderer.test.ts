// AN15: the stage drawn on an OffscreenCanvas and saved as a PNG, with the pictures and fonts
// it needs loaded first. The canvas and loaders are fakes here; the real ones run in the app.
import { describe, expect, it, vi } from 'vitest';
import { createCanvasStageRenderer } from '../../../src/adapters/canvas/stage-renderer.ts';
import type { StageCanvas } from '../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createGroup,
  createPicture,
  createText,
} from '../../../src/core/animation/factory.ts';
import { addObject } from '../../../src/core/animation/layers.ts';

function fakeCanvas(calls: string[]) {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get:
      (_t, key: string) =>
      (...args: unknown[]) => {
        calls.push(
          `${key}(${args.map((a) => (typeof a === 'object' && a ? 'image' : String(a))).join(',')})`,
        );
        return { addColorStop: () => {} };
      },
    set: () => true,
  }) as unknown as StageCanvas;
  return {
    sizes: [] as number[][],
    make(width: number, height: number) {
      this.sizes.push([width, height]);
      return {
        getContext: () => ctx,
        convertToBlob: async () =>
          new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }),
      };
    },
  };
}

function doc() {
  const picture = { id: 'p', path: '/m/Task5.jpg', width: 20, height: 10 };
  let d = { ...createAnimation({ name: 'A' }), pictures: [picture] };
  d = { ...d, stage: { ...d.stage, width: 600, height: 400 } };
  const layer = d.layers[0]!.id;
  d = addObject(d, layer, createPicture(picture, { x: 0, y: 0 }));
  d = addObject(d, layer, createGroup([createText('Hi', { x: 0, y: 0, size: 20 })]));
  return d;
}

describe('createCanvasStageRenderer', () => {
  it('draws the stage at its size with the loaded pictures and fonts, and returns PNG bytes', async () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(calls);
    const loadFonts = vi.fn(async () => {});
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage: async (path) => ({ path }),
      loadFonts,
    });
    const bytes = await renderer.renderPng(doc());
    expect([...bytes]).toEqual([137, 80, 78, 71]);
    expect(canvas.sizes).toEqual([[600, 400]]);
    expect(calls).toContain('fillRect(0,0,600,400)');
    expect(calls.some((c) => c.startsWith('drawImage(image'))).toBe(true);
    expect(loadFonts).toHaveBeenCalledWith(['400 20px "Inter"']);
  });

  it('a picture that cannot be loaded is drawn as a placeholder; no context is an error', async () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(calls);
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage: async () => null,
      loadFonts: async () => {},
    });
    await renderer.renderPng(doc());
    expect(calls.some((c) => c.startsWith('drawImage('))).toBe(false);
    expect(calls.some((c) => c.startsWith('strokeRect('))).toBe(true);
    const none = createCanvasStageRenderer({
      makeCanvas: () => ({ getContext: () => null, convertToBlob: async () => new Blob() }),
      loadImage: async () => null,
      loadFonts: async () => {},
    });
    await expect(none.renderPng(doc())).rejects.toThrow(/No canvas/);
  });

  it('the default loaders cope without fetch, bitmaps or document fonts', async () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(calls);
    const renderer = createCanvasStageRenderer({ makeCanvas: (w, h) => canvas.make(w, h) });
    // No fetch in this test environment: the picture is simply not drawn.
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('offline');
    }) as typeof fetch;
    try {
      await renderer.renderPng(doc());
    } finally {
      globalThis.fetch = original;
    }
    expect(calls.some((c) => c.startsWith('strokeRect('))).toBe(true);
  });
});
