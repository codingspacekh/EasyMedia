// M14, AN8, AN9, AN11, AN14: the animation timeline's rows and labels (M17 refactor of
// Timeline.svelte): layers top first, their objects front first, and an opened (or selected)
// object's motion paths and animated properties under it.
import { describe, expect, it } from 'vitest';
import { createAnimation, createLayer, createRect } from '../../../src/core/animation/factory.ts';
import type { AnimObject, AnimationDoc, Track } from '../../../src/core/animation/types.ts';
import {
  frameLabels,
  labelStep,
  PROPERTY_LABEL,
  secondLabels,
  timelineRows,
} from '../../../src/ui/animation/timeline-rows.ts';

const key = (frame: number) => ({ frame, value: 0, easing: 'linear' as const, hold: false });
const track = (property: Track['property'], ...frames: number[]): Track => ({
  property,
  keyframes: frames.map(key),
});

function scene(): AnimationDoc {
  const doc = createAnimation({ name: 'Test' });
  const still: AnimObject = { ...createRect({ x: 0, y: 0 }), id: 'still', name: 'Still' };
  const moving: AnimObject = {
    ...createRect({ x: 0, y: 0 }),
    id: 'moving',
    name: 'Moving',
    // Opacity is listed after X in the Properties panel: the rows follow that order.
    tracks: [track('opacity', 0, 24), track('x', 0, 12, 48), track('y')],
  };
  const bottom = { ...doc.layers[0]!, name: 'Bottom', objects: [still, moving] };
  const top = createLayer('Top', { id: 'top' });
  return { ...doc, layers: [bottom, top] };
}

const none = { closedLayers: {}, openObjects: {}, selection: [] };
const brief = (rows: ReturnType<typeof timelineRows>) =>
  rows.map((r) =>
    r.kind === 'property'
      ? `  ${r.track.property}`
      : r.kind === 'motion'
        ? `  path ${r.n}`
        : `${r.kind} ${r.name}`,
  );

describe('timelineRows', () => {
  it('top layer first, its objects front first; a layer row shows all its keyframe frames once', () => {
    const rows = timelineRows(scene(), 0, none);
    expect(brief(rows)).toEqual(['layer Top', 'layer Bottom', 'object Moving', 'object Still']);
    const bottom = rows[1]!;
    expect(bottom.kind === 'layer' && [...bottom.frames].sort((a, b) => a - b)).toEqual([
      0, 12, 24, 48,
    ]);
    const moving = rows[2]!;
    expect(moving.kind === 'object' && moving.animated).toBe(true);
    const still = rows[3]!;
    expect(still.kind === 'object' && still.animated).toBe(false);
  });

  it('a selected object shows its animated properties (not empty tracks) in the Properties order', () => {
    const rows = timelineRows(scene(), 0, { ...none, selection: ['moving'] });
    expect(brief(rows)).toEqual([
      'layer Top',
      'layer Bottom',
      'object Moving',
      '  x',
      '  opacity',
      'object Still',
    ]);
  });

  it('an object opened by hand stays open, and one closed by hand stays closed when selected', () => {
    const opened = timelineRows(scene(), 0, { ...none, openObjects: { moving: true } });
    expect(brief(opened)).toContain('  x');
    const closed = timelineRows(scene(), 0, {
      ...none,
      openObjects: { moving: false },
      selection: ['moving'],
    });
    expect(brief(closed)).not.toContain('  x');
  });

  it('a closed layer hides its objects', () => {
    const doc = scene();
    const rows = timelineRows(doc, 0, { ...none, closedLayers: { [doc.layers[0]!.id]: true } });
    expect(brief(rows)).toEqual(['layer Top', 'layer Bottom']);
  });

  it('AN11: an opened object shows its motion paths before its properties', () => {
    const doc = scene();
    const path = {
      points: [],
      closed: false,
      from: 0,
      to: 24,
      orient: false,
      even: true,
      easing: 'linear' as const,
    };
    const withPath: AnimationDoc = {
      ...doc,
      layers: doc.layers.map((l) => ({
        ...l,
        objects: l.objects.map((o) => (o.id === 'still' ? { ...o, paths: [path] } : o)),
      })),
    };
    const rows = timelineRows(withPath, 0, { ...none, selection: ['still'] });
    expect(brief(rows).slice(-2)).toEqual(['object Still', '  path 1']);
    const still = rows.at(-2)!;
    expect(still.kind === 'object' && still.animated).toBe(true);
  });

  it('AN14: a frame-by-frame layer lists its drawings and only the objects of the drawing at the playhead', () => {
    const doc = createAnimation({ name: 'Flip book' });
    const a: AnimObject = { ...createRect({ x: 0, y: 0 }), id: 'a', name: 'A', drawing: 0 };
    const b: AnimObject = { ...createRect({ x: 0, y: 0 }), id: 'b', name: 'B', drawing: 10 };
    const layer = { ...doc.layers[0]!, name: 'Book', drawings: [0, 10], objects: [a, b] };
    const at = (frame: number) => timelineRows({ ...doc, layers: [layer] }, frame, none);
    expect(brief(at(3))).toEqual(['layer Book', 'object A']);
    expect(brief(at(12))).toEqual(['layer Book', 'object B']);
    const row = at(3)[0]!;
    expect(row.kind === 'layer' && row.drawings).toEqual([0, 10]);
  });
});

describe('labels', () => {
  it('frame numbers every 5 when frames are wide, every 10, 20… when narrow', () => {
    expect(labelStep(8)).toBe(5);
    expect(labelStep(4)).toBe(10);
    expect(labelStep(2)).toBe(20);
    expect(frameLabels(23, 5)).toEqual([0, 5, 10, 15, 20]);
  });

  it('seconds under the frames: 1 s, 2 s… within the length', () => {
    expect(secondLabels(120, 24)).toEqual([1, 2, 3, 4, 5]);
    expect(secondLabels(20, 24)).toEqual([]);
  });

  it('each property row is named as in the Properties panel', () => {
    expect(PROPERTY_LABEL.width).toBe('W');
    expect(PROPERTY_LABEL.fillColour).toBe('Fill colour');
  });
});
