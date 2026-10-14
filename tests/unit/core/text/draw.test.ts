import { describe, expect, it } from 'vitest';
import { drawText, textImageSize, type TextCanvas } from '../../../../src/core/text/draw.ts';
import type { TextStyle } from '../../../../src/core/model/types.ts';

const FRAME = { width: 1920, height: 1080 };
const STYLE: TextStyle = {
  font: 'Inter',
  size: 60,
  colour: '#ffffff',
  bold: false,
  italic: false,
  align: 'centre',
  position: 'bottom',
};

/** Records what is drawn; every character is 10 px wide. */
function fakeCanvas() {
  const calls: string[] = [];
  const ctx: TextCanvas = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'miter',
    textBaseline: 'alphabetic',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    measureText: (t) => ({ width: t.length * 10 }),
    fillRect: (x, y, w, h) => void calls.push(`rect ${ctx.fillStyle} ${x},${y} ${w}x${h}`),
    fillText: (t, x, y) =>
      void calls.push(`fill ${t} ${x},${y} ${ctx.fillStyle} shadow=${ctx.shadowColor}`),
    strokeText: (t, x, y) =>
      void calls.push(`stroke ${t} ${x},${y} ${ctx.strokeStyle} w=${ctx.lineWidth}`),
  };
  return { ctx, calls };
}

describe('textImageSize', () => {
  it('is the whole frame, so the image is laid over at 0,0', () => {
    expect(textImageSize('Hello', STYLE, FRAME, 'frame', (t) => t.length * 10)).toEqual(FRAME);
  });

  it('for scrolling credits is the frame width by the height of the words plus padding', () => {
    // 3 lines × 60 × 1.2 = 216, plus 2 × padding (0.5 × 60)
    const size = textImageSize('A\nB\nC', STYLE, FRAME, 'block', (t) => t.length * 10);
    expect(size).toEqual({ width: 1920, height: 276 });
  });
});

describe('drawText', () => {
  it('fills each line at its laid-out place, top baseline', () => {
    const { ctx, calls } = fakeCanvas();
    drawText(ctx, 'Hi\nthere', STYLE, FRAME, 'frame');
    expect(ctx.textBaseline).toBe('top');
    expect(ctx.font).toBe('400 60px "Inter"');
    // block 50 wide × 144 high, bottom-centre: y = 1080 − 54 − 144 = 882
    expect(calls).toEqual([
      'fill Hi 950,882 #ffffff shadow=transparent',
      'fill there 935,954 #ffffff shadow=transparent',
    ]);
  });

  it('draws a dark box behind the words, then the words', () => {
    const { ctx, calls } = fakeCanvas();
    drawText(ctx, 'Hi', { ...STYLE, box: true }, FRAME, 'frame');
    // padding 0.25 × 60 = 15 around the 20 × 72 block at 950,954
    expect(calls[0]).toBe('rect rgba(0, 0, 0, 0.6) 935,939 50x102');
    expect(calls[1]).toMatch(/^fill Hi 950,954/);
  });

  it('outlines the words in black before filling them', () => {
    const { ctx, calls } = fakeCanvas();
    drawText(ctx, 'Hi', { ...STYLE, outline: true }, FRAME, 'frame');
    expect(calls).toEqual([
      'stroke Hi 950,954 #000000 w=6',
      'fill Hi 950,954 #ffffff shadow=transparent',
    ]);
    expect(ctx.lineJoin).toBe('round');
  });

  it('gives the filled words a drop shadow', () => {
    const { ctx, calls } = fakeCanvas();
    drawText(ctx, 'Hi', { ...STYLE, shadow: true }, FRAME, 'frame');
    expect(calls).toEqual(['fill Hi 950,954 #ffffff shadow=rgba(0, 0, 0, 0.8)']);
    expect([ctx.shadowOffsetX, ctx.shadowOffsetY, ctx.shadowBlur]).toEqual([3, 3, 6]);
  });

  it('scales sizes with the frame (a 720p frame draws two thirds as big)', () => {
    const { ctx } = fakeCanvas();
    drawText(ctx, 'Hi', STYLE, { width: 1280, height: 720 }, 'frame');
    expect(ctx.font).toBe('400 40px "Inter"');
  });

  it('draws credits from the top of a block image, keeping the horizontal place', () => {
    const { ctx, calls } = fakeCanvas();
    const size = drawText(ctx, 'A\nB', STYLE, FRAME, 'block');
    expect(size).toEqual({ width: 1920, height: 204 });
    expect(calls).toEqual([
      'fill A 955,30 #ffffff shadow=transparent',
      'fill B 955,102 #ffffff shadow=transparent',
    ]);
  });
});
