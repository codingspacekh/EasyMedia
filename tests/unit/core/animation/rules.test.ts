// M13 / AN1, AN2: the stage's size, colour, frame rate and length; aspect-ratio presets; the
// rules every object must keep (validated by the commands before an edit is applied).
import { describe, expect, it } from 'vitest';
import {
  aspectOf,
  FPS_CHOICES,
  presetSize,
  STAGE_PRESETS,
  validateObject,
  validateStage,
} from '../../../../src/core/animation/rules.ts';
import { framesFor, secondsFor } from '../../../../src/core/animation/time.ts';
import { createAnimation, createRect, createText } from '../../../../src/core/animation/factory.ts';

describe('aspect ratio (AN1, AN2)', () => {
  it.each([
    [600, 400, '3:2'],
    [1024, 768, '4:3'],
    [1280, 800, '16:10'],
    [1920, 1080, '16:9'],
    [1880, 800, '2.35:1'],
    [1240, 800, '31:20'],
    [500, 500, '1:1'],
  ])('%i × %i is %s', (w, h, expected) => {
    expect(aspectOf(w, h)).toBe(expected);
  });

  it('offers the coursebook’s common ratios as presets (Table 19.1)', () => {
    expect(STAGE_PRESETS.map((p) => p.ratio)).toEqual(['4:3', '16:9', '16:10', '2.35:1']);
    for (const p of STAGE_PRESETS) expect(aspectOf(p.width, p.height)).toBe(p.ratio);
  });

  it('a preset sized by one side gives the other, rounded to whole even pixels', () => {
    expect(presetSize('2.35:1', { height: 800 })).toEqual({ width: 1880, height: 800 });
    expect(presetSize('16:9', { width: 600 })).toEqual({ width: 600, height: 338 });
    expect(presetSize('4:3', { width: 1024 })).toEqual({ width: 1024, height: 768 });
    expect(presetSize('16:10', { height: 400 })).toEqual({ width: 640, height: 400 });
  });
});

describe('validateStage (AN1)', () => {
  const stage = createAnimation({ name: 'A' }).stage;
  it('accepts the workbook’s stages', () => {
    for (const [width, height] of [
      [600, 400],
      [1024, 768],
      [1240, 800],
      [800, 600],
    ])
      expect(() => validateStage({ ...stage, width: width!, height: height! })).not.toThrow();
  });
  it('refuses a stage smaller than 16 px or larger than 4096 px', () => {
    expect(() => validateStage({ ...stage, width: 15 })).toThrow(/between 16 and 4096/);
    expect(() => validateStage({ ...stage, height: 5000 })).toThrow(/between 16 and 4096/);
    expect(() => validateStage({ ...stage, width: 600.5 })).toThrow(/whole number/);
  });
  it('refuses a frame rate outside 1–60 or a length under one frame', () => {
    expect(FPS_CHOICES).toEqual([10, 12, 15, 24, 25, 30, 60]);
    expect(() => validateStage({ ...stage, fps: 0 })).toThrow(/between 1 and 60/);
    expect(() => validateStage({ ...stage, fps: 24.5 })).toThrow(/whole number/);
    expect(() => validateStage({ ...stage, length: 0 })).toThrow(/at least 1 frame/);
    expect(() => validateStage({ ...stage, length: 36_001 })).toThrow(/at most 36 000/);
  });
  it('refuses a background that is not a colour', () => {
    expect(() => validateStage({ ...stage, background: 'grey' })).toThrow(/colour such as #F4C8EE/);
    expect(() => validateStage({ ...stage, background: '#F4C8EE' })).not.toThrow();
  });
});

describe('validateObject (AN6)', () => {
  it('keeps opacity within 0–100 %, sizes at 0 or more, strokes at 0 or more', () => {
    const r = createRect({ x: 0, y: 0 });
    expect(() => validateObject({ ...r, opacity: 101 })).toThrow(/0 and 100/);
    expect(() => validateObject({ ...r, opacity: 57 })).not.toThrow();
    expect(() => validateObject({ ...r, width: -1 })).toThrow(/0 or more/);
    expect(() => validateObject({ ...r, stroke: { ...r.stroke!, width: -2 } })).toThrow(
      /0 or more/,
    );
    expect(() => validateObject({ ...r, radius: -1 })).toThrow(/0 or more/);
  });
  it('needs colours as hex and a font that is bundled', () => {
    const r = createRect({ x: 0, y: 0 });
    expect(() => validateObject({ ...r, fill: { kind: 'solid', colour: 'red' } })).toThrow(
      /colour such as/,
    );
    expect(() =>
      validateObject({ ...r, fill: { kind: 'linear', from: '#ff0000', to: '#0000ff', angle: 90 } }),
    ).not.toThrow();
    const t = createText('Hi', { x: 0, y: 0 });
    expect(() => validateObject({ ...t, font: 'Comic Sans' })).toThrow(/bundled font/);
    expect(() => validateObject({ ...t, size: 0 })).toThrow(/at least 1/);
  });
  it('a star needs 3 or more points and an inner radius between 0 and 1; a polygon 3 or more sides', () => {
    const r = createRect({ x: 0, y: 0 });
    expect(() => validateObject({ ...r, kind: 'star', points: 2, inner: 0.5 })).toThrow(
      /3 or more/,
    );
    expect(() => validateObject({ ...r, kind: 'star', points: 5, inner: 1.5 })).toThrow(/0 and 1/);
    expect(() => validateObject({ ...r, kind: 'polygon', sides: 2 })).toThrow(/3 or more/);
  });
});

describe('frames and seconds (AN8)', () => {
  it('3 s at 24 fps is 72 frames and back; 2.5 s at 30 fps is 75; a part frame rounds', () => {
    expect(framesFor(3, 24)).toBe(72);
    expect(secondsFor(72, 24)).toBe(3);
    expect(framesFor(2.5, 30)).toBe(75);
    expect(framesFor(1.33, 24)).toBe(32);
  });
});
