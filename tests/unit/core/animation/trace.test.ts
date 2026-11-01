// M16 / AN5: Trace bitmap — a picture's pixels quantised to n colours, each colour's regions traced
// to outlines, simplified (detail) and smoothed into Bézier paths; the largest region first, so the
// regions inside others are drawn over them.
import { describe, expect, it } from 'vitest';
import { quantise, traceBitmap, type Pixels } from '../../../../src/core/animation/trace.ts';

type RGBA = [number, number, number, number];
const WHITE: RGBA = [255, 255, 255, 255];
const RED: RGBA = [230, 20, 30, 255];
const BLUE: RGBA = [20, 40, 220, 255];

function picture(width: number, height: number, at: (x: number, y: number) => RGBA): Pixels {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(at(x, y), (y * width + x) * 4);
  return { width, height, data };
}

/** A red circle of radius 30 at (50, 40) on white, 100 × 80. */
const circle = picture(100, 80, (x, y) =>
  (x + 0.5 - 50) ** 2 + (y + 0.5 - 40) ** 2 <= 30 ** 2 ? RED : WHITE,
);

function bounds(points: { x: number; y: number }[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys),
  };
}

describe('quantise (AN5)', () => {
  it('AN5 finds the picture’s main colours and gives every pixel the nearest', () => {
    const { palette, index } = quantise(circle, 2);
    expect(palette).toHaveLength(2);
    expect(palette).toContain('#e6141e');
    expect(palette).toContain('#ffffff');
    expect(palette[index[40 * 100 + 50]!]).toBe('#e6141e');
    expect(palette[index[0]!]).toBe('#ffffff');
  });

  it('AN5 never makes more colours than the picture has', () => {
    expect(quantise(circle, 8).palette).toHaveLength(2);
  });

  it('AN5 a photo with thousands of colours is still reduced to the number asked for', () => {
    const photo = picture(80, 80, (x, y) => [x * 3, y * 3, (x + y) & 255, 255]);
    const { palette, index } = quantise(photo, 4);
    expect(palette).toHaveLength(4);
    expect(new Set(index).size).toBe(4);
  });

  it('AN5 see-through pixels belong to no colour', () => {
    const clear = picture(4, 4, (x) => (x < 2 ? [0, 0, 0, 0] : RED));
    const { palette, index } = quantise(clear, 4);
    expect(palette).toEqual(['#e6141e']);
    expect(index[0]).toBe(255);
    expect(index[3]).toBe(0);
  });
});

describe('traceBitmap (AN5)', () => {
  it('AN5 a red circle on white traces to two regions; the red one has the circle’s bounds within 2 px', () => {
    const regions = traceBitmap(circle, { colours: 2, detail: 70, smoothing: 50 });
    expect(regions.map((r) => r.colour)).toEqual(['#ffffff', '#e6141e']);
    expect(bounds(regions[0]!.points)).toEqual({ left: 0, top: 0, right: 100, bottom: 80 });
    const red = bounds(regions[1]!.points);
    expect(Math.abs(red.top - 10)).toBeLessThanOrEqual(2);
    expect(Math.abs(red.bottom - 70)).toBeLessThanOrEqual(2);
    expect(Math.abs(red.left - 20)).toBeLessThanOrEqual(2);
    expect(Math.abs(red.right - 80)).toBeLessThanOrEqual(2);
  });

  it('AN5 fewer colours merge regions', () => {
    // Red and a dark red side by side, a blue square in the middle.
    const three = picture(60, 40, (x, y) =>
      x >= 25 && x < 35 && y >= 15 && y < 25 ? BLUE : x < 30 ? RED : [200, 10, 20, 255],
    );
    expect(traceBitmap(three, { colours: 3, detail: 80, smoothing: 0 })).toHaveLength(3);
    const two = traceBitmap(three, { colours: 2, detail: 80, smoothing: 0 });
    expect(two).toHaveLength(2);
    expect(two[0]!.colour).not.toBe(two[1]!.colour);
  });

  it('AN5 more detail keeps more points; less detail loses some', () => {
    const count = (detail: number) =>
      traceBitmap(circle, { colours: 2, detail, smoothing: 0 })[1]!.points.length;
    expect(count(100)).toBeGreaterThan(count(50));
    expect(count(50)).toBeGreaterThan(count(0));
    expect(count(0)).toBeGreaterThanOrEqual(3);
  });

  it('AN5 smoothing gives the points curve handles; none keeps corners', () => {
    const sharp = traceBitmap(circle, { colours: 2, detail: 60, smoothing: 0 })[1]!;
    expect(sharp.points.every((p) => !p.in && !p.out)).toBe(true);
    const smooth = traceBitmap(circle, { colours: 2, detail: 60, smoothing: 100 })[1]!;
    expect(smooth.points.every((p) => p.in && p.out)).toBe(true);
  });

  it('AN5 a square traces to its four corners exactly', () => {
    const square = picture(20, 20, (x, y) => (x >= 5 && x < 15 && y >= 5 && y < 15 ? BLUE : WHITE));
    const [, blue] = traceBitmap(square, { colours: 2, detail: 50, smoothing: 0 });
    expect(blue!.points).toHaveLength(4);
    expect(bounds(blue!.points)).toEqual({ left: 5, top: 5, right: 15, bottom: 15 });
    expect(blue!.area).toBe(100);
  });

  it('AN5 specks smaller than the detail allows are left out; at full detail they are kept', () => {
    const specks = picture(50, 50, (x, y) => (x === 10 && y === 10 ? RED : WHITE));
    expect(traceBitmap(specks, { colours: 2, detail: 0, smoothing: 0 })).toHaveLength(1);
    expect(traceBitmap(specks, { colours: 2, detail: 100, smoothing: 0 })).toHaveLength(2);
  });

  it('AN5 two separate areas of the same colour are two regions', () => {
    const two = picture(40, 20, (x) => (x < 10 || x >= 30 ? RED : WHITE));
    const red = traceBitmap(two, { colours: 2, detail: 50, smoothing: 0 }).filter(
      (r) => r.colour === '#e6141e',
    );
    expect(red).toHaveLength(2);
  });
});
