// Animation mode's use cases (M13): new / open / save animations in their own files (AN16),
// drawing shapes and text on the selected layer, exact properties, layers, groups, copies,
// undo, and exporting the stage as a picture. Every edit is one undo step.
import { describe, expect, it, vi } from 'vitest';
import { animationTitle } from '../../../src/app/animation.ts';
import { createAnimation, createRect } from '../../../src/core/animation/factory.ts';
import { serializeAnimation } from '../../../src/core/animation/serialize.ts';
import type { AnimObject, StarObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const objects = (): AnimObject[] => doc().layers.flatMap((l) => l.objects);
  const star = () => {
    anim.addShape('star', { x: 128, y: 102, width: 135, height: 135 });
    return objects().at(-1) as StarObject;
  };
  return { ...t, anim, doc, objects, star, state: () => anim.store.get() };
}

describe('a new animation', () => {
  it('starts untitled, clean, with the first layer selected and the Select tool', () => {
    const s = setup();
    expect(s.state()).toMatchObject({ path: null, selection: [], tool: 'select' });
    expect(s.state().layerId).toBe(s.doc().layers[0]!.id);
    expect(s.anim.isDirty()).toBe(false);
    expect(animationTitle(s.state())).toBe('Untitled animation');
  });
});

describe('drawing and editing (AN3, AN4, AN6)', () => {
  it('Task 1: a star drawn on the stage goes on the selected layer, selected, and the animation is unsaved', () => {
    const s = setup();
    const star = s.star();
    expect(star).toMatchObject({ kind: 'star', x: 128, y: 102, width: 135, height: 135 });
    expect(s.state().selection).toEqual([star.id]);
    expect(s.anim.isDirty()).toBe(true);
    expect(animationTitle(s.state())).toBe('Untitled animation •');
  });

  it('text is added where the student clicks, with the words given', () => {
    const s = setup();
    s.anim.addText({ x: 193, y: 73 }, 'Task 1');
    expect(s.objects().at(-1)).toMatchObject({ kind: 'text', text: 'Task 1', x: 193, y: 73 });
  });

  it('setProperties applies exact numbers to the selection and refuses bad ones with a message', () => {
    const s = setup();
    const star = s.star();
    expect(s.anim.setProperties({ x: 0, y: 0, opacity: 57 })).toBeNull();
    expect(s.objects()[0]).toMatchObject({ x: 0, y: 0, opacity: 57 });
    expect(s.anim.setProperties({ opacity: 120 })).toMatch(/0 and 100/);
    expect(s.objects()[0]).toMatchObject({ opacity: 57 });
    expect(s.anim.setProperties({ points: 7 } as Partial<StarObject>)).toBeNull();
    expect((s.objects()[0] as StarObject).points).toBe(7);
    void star;
  });

  it('moveSelection, nudge, resize and rotate change the selected objects', () => {
    const s = setup();
    const star = s.star();
    s.anim.moveSelection(2, -3);
    expect(s.objects()[0]).toMatchObject({ x: 130, y: 99 });
    s.anim.nudge(-1, 0);
    expect(s.objects()[0]).toMatchObject({ x: 129, y: 99 });
    s.anim.resizeSelected(star.id, 'se', { x: 129 + 100, y: 99 + 50 }, false);
    expect(s.objects()[0]).toMatchObject({ width: 100, height: 50 });
    s.anim.rotateSelected(star.id, 45);
    expect(s.objects()[0]!.rotation).toBe(45);
  });

  it('deleteSelection, cut / copy / paste, duplicate, group and ungroup', () => {
    const s = setup();
    s.star();
    s.anim.addShape('rect', { x: 0, y: 0, width: 300, height: 150 });
    s.anim.selectAll();
    expect(s.state().selection).toHaveLength(2);
    s.anim.group();
    expect(s.objects().map((o) => o.kind)).toEqual(['group']);
    s.anim.ungroup();
    expect(s.objects().map((o) => o.kind)).toEqual(['star', 'rect']);
    s.anim.select([s.objects()[0]!.id]);
    s.anim.duplicate();
    expect(s.objects().map((o) => o.name)).toEqual(['Star', 'Star 2', 'Rectangle']);
    expect(s.state().selection).toEqual([s.objects()[1]!.id]);
    s.anim.copy();
    s.anim.paste();
    expect(s.objects()).toHaveLength(4);
    s.anim.cut();
    expect(s.objects()).toHaveLength(3);
    s.anim.selectAll();
    s.anim.deleteSelection();
    expect(s.objects()).toEqual([]);
  });

  it('reorder brings the selection forward or back', () => {
    const s = setup();
    s.star();
    s.anim.addShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    s.anim.select([s.objects()[0]!.id]);
    s.anim.reorder('front');
    expect(s.objects().map((o) => o.kind)).toEqual(['rect', 'star']);
  });
});

describe('layers (AN7)', () => {
  it('a new layer is selected, so the next shape goes on it; hidden and locked layers refuse drawing', () => {
    const s = setup();
    s.anim.addLayer();
    expect(s.doc().layers.map((l) => l.name)).toEqual(['Layer 1', 'Layer 2']);
    expect(s.state().layerId).toBe(s.doc().layers[1]!.id);
    s.star();
    expect(s.doc().layers[1]!.objects).toHaveLength(1);
    s.anim.toggleLayer(s.state().layerId, 'locked');
    s.anim.addShape('rect', { x: 0, y: 0, width: 50, height: 50 });
    expect(s.state().message?.text).toMatch(/locked/);
    expect(s.doc().layers[1]!.objects).toHaveLength(1);
  });

  it('rename, move, remove (not the last), and the selected layer follows', () => {
    const s = setup();
    s.anim.addLayer();
    const [bottom, top] = s.doc().layers.map((l) => l.id) as [string, string];
    expect(s.anim.renameLayer(top, 'blue_oval')).toBeNull();
    expect(s.anim.renameLayer(top, ' ')).toMatch(/name/);
    s.anim.moveLayer(top, 0);
    expect(s.doc().layers.map((l) => l.id)).toEqual([top, bottom]);
    s.anim.removeLayer(top);
    expect(s.state().layerId).toBe(bottom);
    s.anim.removeLayer(bottom);
    expect(s.state().message?.text).toMatch(/at least one layer/);
  });

  it('selecting an object selects its layer; deleting the selection clears it', () => {
    const s = setup();
    const star = s.star();
    s.anim.addLayer();
    s.anim.select([star.id]);
    expect(s.state().layerId).toBe(s.doc().layers[0]!.id);
    s.anim.deleteSelection();
    expect(s.state().selection).toEqual([]);
  });
});

describe('stage, guides and view (AN1, AN2)', () => {
  it('setStage applies Task 3’s stage (1024 × 768, #CBCDF0) and refuses bad values', () => {
    const s = setup();
    const stage = s.doc().stage;
    expect(
      s.anim.setStage({ ...stage, width: 1024, height: 768, background: '#CBCDF0' }),
    ).toBeNull();
    expect(s.doc().stage).toMatchObject({ width: 1024, height: 768, background: '#CBCDF0' });
    expect(s.anim.setStage({ ...stage, width: 5 })).toMatch(/between 16 and 4096/);
  });

  it('guides are added, moved and removed; view settings change without an undo step', () => {
    const s = setup();
    s.anim.addGuide('x', 250);
    s.anim.addGuide('y', 100);
    s.anim.moveGuide('x', 0, 260);
    expect(s.doc().guides).toEqual({ x: [260], y: [100] });
    s.anim.removeGuide('y', 0);
    expect(s.doc().guides.y).toEqual([]);
    const steps = s.state().history.past.length;
    s.anim.setView({ rulers: true, grid: { show: true, size: 20, over: false } });
    expect(s.doc().view.rulers).toBe(true);
    expect(s.doc().view.grid.size).toBe(20);
    expect(s.state().history.past.length).toBe(steps);
    // Showing the rulers is not an edit: nothing to save.
    const fresh = setup();
    fresh.anim.setView({ rulers: true });
    expect(fresh.anim.isDirty()).toBe(false);
  });
});

describe('undo (P4)', () => {
  it('every edit is one undo step and undo restores the exact document', () => {
    const s = setup();
    const before = s.doc();
    s.star();
    s.anim.setProperties({ x: 1 });
    s.anim.undo();
    s.anim.undo();
    expect(s.doc()).toBe(before);
    s.anim.redo();
    expect(s.objects()).toHaveLength(1);
  });
});

describe('files (AN16)', () => {
  it('save asks for a file the first time, then writes to it; open reads it back', async () => {
    const s = setup();
    s.star();
    s.dialogs.saveAnimation.mockResolvedValueOnce('/a/Chapter07_Task1_1.mvea');
    await s.anim.save();
    expect(s.state().path).toBe('/a/Chapter07_Task1_1.mvea');
    expect(s.anim.isDirty()).toBe(false);
    expect(animationTitle(s.state())).toBe('Chapter07_Task1_1');
    s.anim.setProperties({ x: 5 });
    await s.anim.save();
    expect(s.dialogs.saveAnimation).toHaveBeenCalledTimes(1);
    expect(s.anim.isDirty()).toBe(false);
    const t2 = setup();
    t2.disk.set('/a/Chapter07_Task1_1.mvea', s.disk.get('/a/Chapter07_Task1_1.mvea')!);
    t2.dialogs.openAnimation.mockResolvedValueOnce('/a/Chapter07_Task1_1.mvea');
    await t2.anim.open();
    expect(t2.objects()[0]).toMatchObject({ kind: 'star', x: 5 });
    expect(t2.state().path).toBe('/a/Chapter07_Task1_1.mvea');
  });

  it('a file that is not an animation is refused with the plain message', async () => {
    const s = setup();
    s.disk.set('/a/bad.mvea', '{"hello":1}');
    s.dialogs.openAnimation.mockResolvedValueOnce('/a/bad.mvea');
    await s.anim.open();
    expect(s.state().message?.text).toMatch(/not an EasyMedia animation/);
  });

  it('new and open ask before discarding unsaved work; the window may not close with unsaved work', async () => {
    const s = setup();
    s.star();
    s.dialogs.confirm.mockResolvedValueOnce(false);
    await s.anim.newAnimation();
    expect(s.objects()).toHaveLength(1);
    s.dialogs.confirm.mockResolvedValueOnce(true);
    await s.anim.newAnimation();
    expect(s.objects()).toHaveLength(0);
    s.star();
    s.dialogs.unsavedChanges.mockResolvedValueOnce('cancel');
    expect(await s.app.confirmClose()).toBe(false);
    s.dialogs.unsavedChanges.mockResolvedValueOnce('save');
    s.dialogs.saveAnimation.mockResolvedValueOnce('/a/x.mvea');
    expect(await s.app.confirmClose()).toBe(true);
    expect(s.disk.has('/a/x.mvea')).toBe(true);
  });

  it('autosaves to the file when it has one, else to the recovery file, and offers it on start', async () => {
    vi.useFakeTimers();
    try {
      const s = setup();
      s.star();
      await vi.advanceTimersByTimeAsync(61_000);
      expect(s.disk.has('/cache/recovery.mvea')).toBe(true);
      const t2 = setup();
      t2.disk.set('/cache/recovery.mvea', s.disk.get('/cache/recovery.mvea')!);
      t2.dialogs.confirm.mockResolvedValueOnce(true);
      await t2.app.start();
      expect(t2.objects()).toHaveLength(1);
      expect(t2.anim.isDirty()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('exports the stage as a PNG to a file the student names', async () => {
    const s = setup();
    s.star();
    s.dialogs.exportAnimation.mockResolvedValueOnce('/a/Chapter07_Task1_1.png');
    await s.anim.exportPng();
    expect(s.bytes.get('/a/Chapter07_Task1_1.png')).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(s.state().message).toMatchObject({
      kind: 'info',
      text: expect.stringContaining('Chapter07_Task1_1.png'),
    });
  });

  it('a picture file becomes a picture object at its own size', async () => {
    const s = setup();
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/photo.jpg']);
    await s.anim.addPicture({ x: 10, y: 20 });
    expect(s.doc().pictures[0]).toMatchObject({ path: '/m/photo.jpg', width: 100, height: 100 });
    expect(s.objects()[0]).toMatchObject({
      kind: 'picture',
      x: 10,
      y: 20,
      width: 100,
      height: 100,
    });
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/clip.mp4']);
    await s.anim.addPicture({ x: 0, y: 0 });
    expect(s.state().message?.text).toMatch(/picture/i);
  });

  it('serialises the same way the file format does', () => {
    const s = setup();
    expect(s.anim.text()).toBe(serializeAnimation(s.doc()));
    expect(createRect({ x: 0, y: 0 }).kind).toBe('rect');
    expect(createAnimation({ name: 'x' }).name).toBe('x');
  });
});

describe('Split into letters (AN4)', () => {
  it('Task 2: the selected words become one object per letter, all selected, in one undo step', () => {
    const s = setup();
    s.anim.addText({ x: 0, y: 0 }, 'pop');
    s.anim.splitText();
    expect(s.objects().map((o) => o.name)).toEqual(['p', 'o', 'p 2']);
    expect(s.state().selection).toEqual(s.objects().map((o) => o.id));
    expect(s.state().history.past.at(-1)!.label).toBe('Split into letters');
    s.anim.undo();
    expect(s.objects().map((o) => o.name)).toEqual(['pop']);
  });

  it('a shape cannot be split', () => {
    const s = setup();
    s.star();
    s.anim.splitText();
    expect(s.state().message?.text).toMatch(/Only text/);
  });
});
