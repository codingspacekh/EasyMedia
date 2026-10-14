import { describe, expect, it } from 'vitest';
import { panZoomAt, PAN_ZOOM_PRESETS } from '../../../../src/core/effects/panzoom.ts';

const zoomIn = { from: { zoom: 1, x: 0.5, y: 0.5 }, to: { zoom: 2, x: 0.5, y: 0.5 } };

describe('V8 where the view is at a moment (same rules as the export)', () => {
  it('moves linearly between start and end, and holds before and after', () => {
    const pz = { ...zoomIn, start: 5, end: 7 };
    expect(panZoomAt(pz, 0, 8).zoom).toBe(1);
    expect(panZoomAt(pz, 6, 8).zoom).toBe(1.5);
    expect(panZoomAt(pz, 7.5, 8).zoom).toBe(2);
  });

  it('runs over the whole item by default', () => {
    expect(panZoomAt(zoomIn, 2, 8).zoom).toBe(1.25);
  });

  it('keeps the view inside the picture', () => {
    const corner = { from: { zoom: 2, x: 0, y: 1 }, to: { zoom: 2, x: 0, y: 1 } };
    expect(panZoomAt(corner, 1, 2)).toEqual({ zoom: 2, x: 0.25, y: 0.75 });
  });
});

describe('V8 presets (like Movie Maker)', () => {
  it('has zoom in / out at the centre, left, right, top and bottom, and pans', () => {
    expect(PAN_ZOOM_PRESETS.map((p) => p.id)).toEqual(
      expect.arrayContaining([
        'zoom-in',
        'zoom-in-left',
        'zoom-in-right',
        'zoom-in-top',
        'zoom-in-bottom',
        'zoom-out',
        'pan-left-right',
        'pan-right-left',
      ]),
    );
  });

  it('"zoom in right" ends on the right, so the left edge is removed (Book B Task 11h)', () => {
    const preset = PAN_ZOOM_PRESETS.find((p) => p.id === 'zoom-in-right')!;
    const end = panZoomAt({ from: preset.from, to: preset.to }, 1, 1);
    expect(end.zoom).toBeGreaterThan(1);
    expect(end.x - 0.5 / end.zoom).toBeGreaterThan(0.1); // the visible part starts well right of 0
  });

  it('zoom out is zoom in backwards', () => {
    const inn = PAN_ZOOM_PRESETS.find((p) => p.id === 'zoom-in')!;
    const out = PAN_ZOOM_PRESETS.find((p) => p.id === 'zoom-out')!;
    expect([out.from, out.to]).toEqual([inn.to, inn.from]);
  });
});
