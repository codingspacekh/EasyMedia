import { describe, expect, it } from 'vitest';
import { createCanvasTextRenderer } from '../../../src/adapters/canvas/text-renderer.ts';
import type { TextCanvas } from '../../../src/core/text/draw.ts';
import type { TextStyle } from '../../../src/core/model/types.ts';

const STYLE: TextStyle = {
  font: 'Noto Serif',
  size: 60,
  colour: '#ffffff',
  bold: true,
  italic: false,
  align: 'centre',
  position: 'centre',
};

function fakes() {
  const log: string[] = [];
  const ctx = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    measureText: (t: string) => ({ width: t.length * 10 }),
    fillRect: () => {},
    fillText: (t: string) => void log.push(`fill ${t}`),
    strokeText: () => {},
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } satisfies TextCanvas;
  const renderer = createCanvasTextRenderer({
    loadFont: async (font) => void log.push(`load ${font}`),
    makeCanvas: (width, height) => {
      log.push(`canvas ${width}x${height}`);
      return { ctx, toPng: async () => new Uint8Array([137, 80, 78, 71]) };
    },
  });
  return { renderer, log };
}

describe('canvas text renderer', () => {
  it('loads the bundled font first, then draws on a frame-sized canvas and returns a PNG', async () => {
    const { renderer, log } = fakes();
    const out = await renderer.draw('Hi', STYLE, { width: 1280, height: 720 }, 'frame');
    expect(log).toEqual(['load 700 40px "Noto Serif"', 'canvas 1280x720', 'fill Hi']);
    // "Hi" is 20 px wide (10 px a letter) and one 40-px line, in the middle of the frame.
    expect(out).toEqual({
      png: new Uint8Array([137, 80, 78, 71]),
      width: 1280,
      height: 720,
      anchor: { x: 640, y: 360 },
    });
  });

  it('says where the middle of the words is (zooms grow around it)', async () => {
    const { renderer } = fakes();
    const out = await renderer.draw(
      'Hello',
      { ...STYLE, position: 'top-left' },
      { width: 1920, height: 1080 },
      'frame',
    );
    expect(out.anchor!.x).toBeLessThan(400);
    expect(out.anchor!.y).toBeLessThan(200);
  });

  it('makes a block-sized canvas for scrolling credits', async () => {
    const { renderer, log } = fakes();
    const out = await renderer.draw('A\nB', STYLE, { width: 1920, height: 1080 }, 'block');
    expect(log).toContain('canvas 1920x204');
    expect(out.height).toBe(204);
  });
});
