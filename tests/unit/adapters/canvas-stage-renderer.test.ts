// AN15: the stage drawn on an OffscreenCanvas and saved as a PNG, with the pictures and fonts
// it needs loaded first. The canvas and loaders are fakes here; the real ones run in the app.
import { describe, expect, it, vi } from 'vitest';
import {
  createCanvasStageRenderer,
  loadPicture,
} from '../../../src/adapters/canvas/stage-renderer.ts';
import { toMediaUrl } from '../../../src/core/media-url.ts';
import { MediaError } from '../../../src/core/model/errors.ts';
import type { StageCanvas } from '../../../src/core/animation/draw.ts';
import {
  createAnimation,
  createGroup,
  createPicture,
  createRect,
  createText,
} from '../../../src/core/animation/factory.ts';
import { setPropertyAt } from '../../../src/core/animation/tween.ts';
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
    options: [] as unknown[],
    make(width: number, height: number) {
      this.sizes.push([width, height]);
      const options = this.options;
      return {
        getContext: (_kind: '2d', o?: unknown) => (options.push(o), ctx),
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

  it('M14 draws any frame, loading the pictures once for all the frames of an export', async () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(calls);
    const loadImage = vi.fn(async (path: string) => ({ path }));
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage,
      loadFonts: async () => {},
    });
    let d = doc();
    const layer = d.layers[0]!;
    const moving = setPropertyAt(createRect({ x: 0, y: 0, width: 100, height: 100 }), 'x', 72, 396);
    d = addObject(d, layer.id, moving);
    await renderer.renderPng(d, 0);
    expect(calls).toContain('translate(50,50)');
    calls.length = 0;
    await renderer.renderPng(d, 36);
    expect(calls).toContain('translate(248,50)');
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('N2 frames drawn at once load the pictures once', async () => {
    const canvas = fakeCanvas([]);
    const loadImage = vi.fn(async (path: string) => ({ path }));
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage,
      loadFonts: async () => {},
    });
    const d = doc();
    await Promise.all([0, 1, 2, 3].map((frame) => renderer.renderPng(d, frame)));
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('N4 draws in ordinary memory, not on the graphics card, whose caches fill up over an export', async () => {
    const canvas = fakeCanvas([]);
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage: async () => null,
      loadFonts: async () => {},
    });
    await renderer.renderPng(doc(), 0);
    expect(canvas.options).toEqual([{ willReadFrequently: true }]);
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

describe('loading pictures (AN5)', () => {
  const blob = (type: string) => new Blob(['x'], { type });
  const deps = (type: string, ok = true) => ({
    fetch: vi.fn(async () => ({ ok, blob: async () => blob(type) })),
    createImageBitmap: vi.fn(async () => {
      if (type === 'image/svg+xml') throw new Error('The source image could not be decoded.');
      return 'bitmap';
    }),
    loadElement: vi.fn(async (b: Blob) => `element ${b.type}`),
  });

  it('AN5 a PNG or JPG is decoded to a bitmap', async () => {
    const d = deps('image/png');
    expect(await loadPicture('/m/photo.png', d)).toBe('bitmap');
    expect(d.loadElement).not.toHaveBeenCalled();
  });

  it('AN5 an SVG (which a bitmap cannot be made from) is loaded as an image element', async () => {
    const d = deps('image/svg+xml');
    expect(await loadPicture('/m/star.svg', d)).toBe('element image/svg+xml');
    expect(d.fetch).toHaveBeenCalledWith(toMediaUrl('/m/star.svg'));
  });

  it('AN5 a file that cannot be served or drawn is null (the picture is left out)', async () => {
    expect(await loadPicture('/m/gone.png', deps('image/png', false))).toBeNull();
    const d = deps('image/svg+xml');
    d.loadElement.mockRejectedValueOnce(new Error('broken'));
    expect(await loadPicture('/m/bad.svg', d)).toBeNull();
  });
});

describe('reading a picture’s pixels for Trace bitmap (AN5)', () => {
  it('AN5 draws the picture scaled down to fit the longest side and reads its pixels', async () => {
    const calls: string[] = [];
    const canvas = fakeCanvas(calls);
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage: async () => ({ width: 400, height: 200 }),
    });
    expect(await renderer.pixels('/m/Paris1.jpg', 100)).toMatchObject({ width: 100, height: 50 });
    expect(canvas.sizes).toEqual([[100, 50]]);
    expect(calls).toEqual(['drawImage(image,0,0,100,50)', 'getImageData(0,0,100,50)']);
  });

  it('AN5 a small picture is read at its own size; one that cannot be loaded says so', async () => {
    const canvas = fakeCanvas([]);
    const renderer = createCanvasStageRenderer({
      makeCanvas: (w, h) => canvas.make(w, h),
      loadImage: async (path) => (path.endsWith('gone.png') ? null : { width: 30, height: 20 }),
    });
    expect(await renderer.pixels('/m/small.png', 100)).toMatchObject({ width: 30, height: 20 });
    await expect(renderer.pixels('/m/gone.png', 100)).rejects.toThrow(MediaError);
  });
});
