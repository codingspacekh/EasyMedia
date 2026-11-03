// M16b / N16: the editors' panels can be resized and shown or hidden; sizes stay within limits,
// are saved in the preferences (beside welcomeSeen, not over it) and come back after a restart;
// Reset layout restores them.
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAYOUT,
  PANELS,
  isShown,
  panelsOf,
  parseLayout,
  resized,
  sizeOf,
  toggled,
  type PanelId,
  type PanelSpec,
} from '../../../src/app/layout.ts';
import { testApp } from '../../helpers/test-app.ts';

describe('the layout (N16)', () => {
  it('every panel has an edge, a default size and limits around it', () => {
    for (const [id, p] of Object.entries(PANELS) as [string, PanelSpec][]) {
      expect(p.min, id).toBeLessThanOrEqual(p.size);
      expect(p.size, id).toBeLessThanOrEqual(p.max);
      expect(['left', 'right', 'bottom']).toContain(p.edge);
      expect(p.label.length, id).toBeGreaterThan(2);
    }
    expect(panelsOf('Animation').map((p) => p.id)).toEqual([
      'animation.layers',
      'animation.properties',
      'animation.timeline',
    ]);
    expect(panelsOf('Video').map((p) => p.edge)).toEqual(['left', 'right', 'bottom']);
    expect(panelsOf('Audio').map((p) => p.edge)).toEqual(['right']);
  });

  it('a panel starts at its default size and shown', () => {
    expect(sizeOf(DEFAULT_LAYOUT, 'video.bin')).toBe(PANELS['video.bin'].size);
    expect(isShown(DEFAULT_LAYOUT, 'video.bin')).toBe(true);
  });

  it('a resize stays within the limits, in whole pixels', () => {
    const id: PanelId = 'animation.layers';
    const { min, max } = PANELS[id];
    expect(sizeOf(resized(DEFAULT_LAYOUT, id, 300.6), id)).toBe(301);
    expect(sizeOf(resized(DEFAULT_LAYOUT, id, 10), id)).toBe(min);
    expect(sizeOf(resized(DEFAULT_LAYOUT, id, 5000), id)).toBe(max);
  });

  it('hiding and showing keeps the size', () => {
    const id: PanelId = 'video.inspector';
    const wide = resized(DEFAULT_LAYOUT, id, 400);
    const hidden = toggled(wide, id);
    expect(isShown(hidden, id)).toBe(false);
    const back = toggled(hidden, id);
    expect(isShown(back, id)).toBe(true);
    expect(sizeOf(back, id)).toBe(400);
  });

  it('reads saved layouts, ignoring unknown panels and bad values', () => {
    expect(
      parseLayout({
        sizes: { 'video.bin': 300, 'nope.panel': 10, 'video.inspector': 'wide' },
        hidden: ['animation.layers', 'nope.panel', 3],
      }),
    ).toEqual({ sizes: { 'video.bin': 300 }, hidden: ['animation.layers'] });
    expect(parseLayout('rubbish')).toEqual(DEFAULT_LAYOUT);
    expect(parseLayout({ sizes: { 'video.bin': 9999 } }).sizes['video.bin']).toBe(
      PANELS['video.bin'].max,
    );
  });
});

describe('the layout in the app (N16)', () => {
  const PREFS = '/prefs/preferences.json';

  function setup(saved?: unknown) {
    const t = testApp({}, { preferences: PREFS });
    if (saved !== undefined) t.disk.set(PREFS, JSON.stringify(saved));
    return t;
  }

  it('comes back after a restart, and the Welcome stays seen', async () => {
    const t = setup({ welcomeSeen: true, layout: { sizes: { 'video.bin': 320 }, hidden: [] } });
    await t.app.start();
    expect(sizeOf(t.app.layout.store.get(), 'video.bin')).toBe(320);
    await t.app.layout.resize('video.timeline', 200);
    await t.app.layout.toggle('video.inspector');
    const saved = JSON.parse(t.disk.get(PREFS)!);
    expect(saved).toEqual({
      welcomeSeen: true,
      layout: { sizes: { 'video.bin': 320, 'video.timeline': 200 }, hidden: ['video.inspector'] },
    });
  });

  it('closing the Welcome keeps the layout', async () => {
    const t = setup({ layout: { sizes: { 'video.bin': 320 }, hidden: [] } });
    await t.app.start();
    await t.app.closeWelcome();
    expect(JSON.parse(t.disk.get(PREFS)!)).toEqual({
      layout: { sizes: { 'video.bin': 320 }, hidden: [] },
      welcomeSeen: true,
    });
  });

  it('Reset layout restores every panel', async () => {
    const t = setup({ layout: { sizes: { 'video.bin': 320 }, hidden: ['animation.layers'] } });
    await t.app.start();
    await t.app.layout.reset();
    expect(t.app.layout.store.get()).toEqual(DEFAULT_LAYOUT);
    expect(JSON.parse(t.disk.get(PREFS)!).layout).toEqual(DEFAULT_LAYOUT);
  });

  it('a damaged preferences file gives the default layout', async () => {
    const t = setup();
    t.disk.set(PREFS, '{not json');
    await t.app.start();
    expect(t.app.layout.store.get()).toEqual(DEFAULT_LAYOUT);
  });
});
