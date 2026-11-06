// Group opacity on a browser canvas: a see-through group's parts are drawn at full strength on a
// second canvas of the same size and transform, which is then put down at the group's opacity.
// jsdom has no OffscreenCanvas: a stand-in records what is done (the pixels: tests/e2e).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { withLayers } from '../../../src/adapters/canvas/layers.ts';
import type { StageCanvas } from '../../../src/core/animation/draw.ts';

function fakeContext(width: number, height: number, log: string[], name: string) {
  return {
    canvas: { width, height },
    globalAlpha: 1,
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }),
    setTransform: (...m: unknown[]) =>
      log.push(
        `${name}.setTransform(${m.map((v) => (typeof v === 'object' ? 'matrix' : v)).join(',')})`,
      ),
    reset: () => log.push(`${name}.reset`),
    save: () => log.push(`${name}.save`),
    restore: () => log.push(`${name}.restore`),
    drawImage(_image: unknown, x: number, y: number) {
      log.push(`${name}.drawImage(layer,${x},${y}) at ${this.globalAlpha}`);
    },
  };
}

describe('withLayers (a see-through group faded as one picture)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('draws the group on a layer of the canvas’s size and transform, then puts it down at the opacity', () => {
    const log: string[] = [];
    let made = 0;
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        private readonly ctx;
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
          made++;
          this.ctx = fakeContext(width, height, log, `layer${made}`);
        }
        getContext() {
          return this.ctx;
        }
      },
    );
    const ctx = withLayers(fakeContext(800, 600, log, 'stage') as never) as unknown as StageCanvas;
    let inner: StageCanvas | null = null;
    ctx.withLayer!(0.5, (layer) => {
      inner = layer;
      log.push('draw parts');
    });
    expect(log).toEqual([
      'layer1.reset',
      'layer1.setTransform(matrix)',
      'draw parts',
      'stage.save',
      'stage.setTransform(1,0,0,1,0,0)',
      'stage.drawImage(layer,0,0) at 0.5',
      'stage.restore',
    ]);
    // A group inside the group gets a layer of its own; the layers are kept for the next frame.
    expect(inner!.withLayer).toBeTypeOf('function');
    ctx.withLayer!(0.4, () => {});
    expect(made).toBe(1);
  });

  it('a canvas that changed size gets a layer of its new size', () => {
    const sizes: string[] = [];
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
          this.width = width;
          this.height = height;
        }
        getContext() {
          sizes.push(`${this.width}×${this.height}`);
          return fakeContext(this.width, this.height, [], 'layer');
        }
      },
    );
    const raw = fakeContext(800, 600, [], 'stage');
    const ctx = withLayers(raw as never) as unknown as StageCanvas;
    ctx.withLayer!(0.5, () => {});
    raw.canvas.width = 400;
    ctx.withLayer!(0.5, () => {});
    expect(sizes).toEqual(['800×600', '400×600']);
  });

  it('without OffscreenCanvas the canvas is left as it is (each part takes the opacity)', () => {
    vi.stubGlobal('OffscreenCanvas', undefined);
    const raw = fakeContext(10, 10, [], 'stage');
    expect('withLayer' in withLayers(raw as never)).toBe(false);
  });
});
