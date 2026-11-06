import { describe, expect, it } from 'vitest';
import { turnFilter, turnLabel, turnStyle, turnedSize } from '../../../../src/core/effects/turn.ts';
import type { ClipTurn } from '../../../../src/core/model/types.ts';

type Point = [number, number];

/** Where FFmpeg's filters move a corner of the picture (x right, y down, −1 to 1). */
function throughFfmpeg(filter: string, p: Point): Point {
  return filter
    .split(',')
    .filter(Boolean)
    .reduce<Point>(([x, y], f) => {
      if (f === 'transpose=clock') return [-y, x];
      if (f === 'transpose=cclock') return [y, -x];
      if (f === 'hflip') return [-x, y];
      if (f === 'vflip') return [x, -y];
      throw new Error(`unknown filter ${f}`);
    }, p);
}

/** Where a CSS transform moves the same corner (the last function is applied first). */
function throughCss(transform: string, p: Point): Point {
  const parts = [...transform.matchAll(/(\w+)\(([^)]*)\)/g)].reverse();
  return parts.reduce<Point>(([x, y], [, name, args]) => {
    const n = args!.split(',').map((a) => parseFloat(a));
    if (name === 'scale') return [x * n[0]!, y * (n[1] ?? n[0]!)];
    if (name === 'rotate') {
      const a = (n[0]! * Math.PI) / 180;
      const [c, s] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
      return [c * x - s * y, s * x + c * y];
    }
    throw new Error(`unknown transform ${name}`);
  }, p);
}

const FRAME = { width: 1920, height: 1080 };
const ALL: ClipTurn[] = [undefined, 90, 180, 270].flatMap((turn) =>
  [false, true].flatMap((flipH) =>
    [false, true].map((flipV) => ({
      ...(turn ? { turn: turn as 90 | 180 | 270 } : {}),
      ...(flipH ? { flipH } : {}),
      ...(flipV ? { flipV } : {}),
    })),
  ),
);

describe('V19 turning and flipping a clip', () => {
  it('V19: a clip that is not turned or flipped has no filter and no CSS', () => {
    expect(turnFilter({})).toBe('');
    expect(turnStyle({}, FRAME)).toBeNull();
  });

  it('V19: the export turns with FFmpeg transpose, hflip and vflip', () => {
    expect(turnFilter({ turn: 90 })).toBe('transpose=clock');
    expect(turnFilter({ turn: 270 })).toBe('transpose=cclock');
    expect(turnFilter({ turn: 180 })).toBe('hflip,vflip');
    expect(turnFilter({ flipH: true })).toBe('hflip');
    expect(turnFilter({ flipV: true })).toBe('vflip');
    // Turned 180° and flipped across is the same as flipped upside down.
    expect(turnFilter({ turn: 180, flipH: true })).toBe('vflip');
  });

  it.each(ALL.map((t) => [JSON.stringify(t), t] as const))(
    'V19: the preview turns %s exactly as the export does',
    (_, t) => {
      const css = turnStyle(t, FRAME)?.transform ?? '';
      for (const corner of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as Point[]) {
        const want = throughFfmpeg(turnFilter(t), corner).map((v) => v + 0);
        expect(throughCss(css, corner).map((v) => v + 0)).toEqual(want);
      }
    },
  );

  it('V19: a quarter turn swaps the width and height used to fit the picture', () => {
    expect(turnedSize({ width: 1920, height: 1080 }, { turn: 90 })).toEqual({
      width: 1080,
      height: 1920,
    });
    expect(turnedSize({ width: 1920, height: 1080 }, { turn: 180, flipH: true })).toEqual({
      width: 1920,
      height: 1080,
    });
    // In the preview, the turned picture's box is the frame turned a quarter.
    expect(turnStyle({ turn: 270 }, FRAME)).toMatchObject({ width: '56.25%', height: '177.778%' });
    expect(turnStyle({ flipV: true }, FRAME)).toMatchObject({ width: '100%', height: '100%' });
  });

  it('V19: says how a clip is turned, in words', () => {
    expect(turnLabel({})).toBe('Not turned or flipped');
    expect(turnLabel({ turn: 90 })).toBe('Turned 90° clockwise');
    expect(turnLabel({ turn: 270, flipH: true })).toBe(
      'Turned 90° anticlockwise · flipped horizontally',
    );
    expect(turnLabel({ turn: 180, flipH: true, flipV: true })).toBe(
      'Turned 180° · flipped horizontally and vertically',
    );
  });
});
