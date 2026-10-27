// Animation mode's use cases at the edges (M13): nothing selected, cancelled dialogs, files
// that fail, locked and hidden layers, folders, pictures, autosave and recovery.
import { describe, expect, it, vi } from 'vitest';
import { createAnimationApp } from '../../../src/app/animation.ts';
import * as cmd from '../../../src/app/animation-commands.ts';
import { createHistory, execute } from '../../../src/app/history.ts';
import { createAnimation, createRect } from '../../../src/core/animation/factory.ts';
import { serializeAnimation } from '../../../src/core/animation/serialize.ts';
import { EditError } from '../../../src/core/model/errors.ts';
import type { AnimObject } from '../../../src/core/animation/types.ts';
import { testApp } from '../../helpers/test-app.ts';

function setup() {
  const t = testApp();
  const anim = t.app.animation;
  const doc = () => anim.store.get().history.present;
  const objects = (): AnimObject[] => doc().layers.flatMap((l) => l.objects);
  const rect = (x = 0) => {
    anim.addShape('rect', { x, y: 0, width: 50, height: 50 });
    return objects().at(-1)!;
  };
  return { ...t, anim, doc, objects, rect, state: () => anim.store.get() };
}

describe('nothing selected: the selection tools do nothing', () => {
  it('move, nudge, delete, reorder, move to layer, group, ungroup, duplicate, cut, copy, paste', () => {
    const s = setup();
    s.rect();
    s.anim.select([]);
    const before = s.doc();
    s.anim.moveSelection(5, 5);
    s.anim.moveSelection(0, 0);
    s.anim.nudge(1, 0);
    s.anim.deleteSelection();
    s.anim.reorder('front');
    s.anim.moveSelectionToLayer(s.doc().layers[0]!.id);
    s.anim.group();
    s.anim.ungroup();
    s.anim.duplicate();
    s.anim.cut();
    s.anim.copy();
    s.anim.paste();
    expect(s.anim.setProperties({ x: 9 })).toBeNull();
    expect(s.doc()).toBe(before);
    expect(s.state().message).toBeNull();
  });

  it('a single object cannot be grouped; ungrouping a plain object changes nothing', () => {
    const s = setup();
    const r = s.rect();
    s.anim.select([r.id]);
    s.anim.group();
    s.anim.ungroup();
    expect(s.objects().map((o) => o.kind)).toEqual(['rect']);
    expect(s.state().selection).toEqual([r.id]);
  });

  it('a selection that no longer exists is dropped quietly; undo and redo keep it live', () => {
    const s = setup();
    const r = s.rect();
    s.anim.select([r.id, 'gone']);
    s.anim.moveSelection(1, 1);
    expect(s.objects()[0]!.x).toBe(1);
    s.anim.undo();
    s.anim.undo();
    expect(s.state().selection).toEqual([]);
    s.anim.redo();
    expect(s.state().selection).toEqual([]);
  });
});

describe('layers at the edges', () => {
  it('Select All on a locked or hidden layer selects nothing', () => {
    const s = setup();
    s.rect();
    s.anim.toggleLayer(s.state().layerId, 'locked');
    s.anim.selectAll();
    expect(s.state().selection).toEqual([]);
    s.anim.toggleLayer(s.state().layerId, 'locked');
    s.anim.toggleLayer(s.state().layerId, 'visible');
    s.anim.selectAll();
    expect(s.state().selection).toEqual([]);
  });

  it('hiding a layer drops its objects from the selection', () => {
    const s = setup();
    const r = s.rect();
    s.anim.select([r.id]);
    s.anim.toggleLayer(s.state().layerId, 'visible');
    expect(s.state().selection).toEqual([]);
  });

  it('deleting a layer that is not selected keeps the selected one; colour and folders', () => {
    const s = setup();
    const first = s.state().layerId;
    s.anim.addLayer();
    const second = s.state().layerId;
    s.anim.selectLayer(first);
    s.anim.removeLayer(second);
    expect(s.state().layerId).toBe(first);
    s.anim.setLayerColour(first, '#ff0000');
    expect(s.doc().layers[0]!.colour).toBe('#ff0000');
    s.anim.addFolder('stick_person');
    const folder = s.doc().folders[0]!;
    expect(s.anim.renameFolder(folder.id, 'person')).toBeNull();
    expect(s.anim.renameFolder(folder.id, ' ')).toMatch(/name/);
    s.anim.moveLayerToFolder(first, folder.id);
    expect(s.doc().layers[0]!.folderId).toBe(folder.id);
    s.anim.setFolderOpen(folder.id, false);
    expect(s.doc().folders[0]!.open).toBe(false);
    expect(s.anim.isDirty()).toBe(true);
    s.anim.removeFolder(folder.id);
    expect(s.doc().folders).toEqual([]);
    expect(s.doc().layers[0]!.folderId).toBeUndefined();
    s.anim.addFolder();
    expect(s.doc().folders[0]!.name).toBe('Folder');
  });

  it('moving the selection to another layer selects that layer', () => {
    const s = setup();
    const r = s.rect();
    const first = s.state().layerId;
    s.anim.addLayer();
    const second = s.state().layerId;
    s.anim.select([r.id]);
    expect(s.state().layerId).toBe(first);
    s.anim.moveSelectionToLayer(second);
    expect(s.state().layerId).toBe(second);
    expect(s.doc().layers[1]!.objects).toHaveLength(1);
  });

  it('two selected objects keep their order when brought forward', () => {
    const s = setup();
    const a = s.rect(0);
    const b = s.rect(10);
    s.rect(20);
    s.anim.select([a.id, b.id]);
    s.anim.reorder('forward');
    expect(s.objects().map((o) => o.x)).toEqual([20, 0, 10]);
    s.anim.reorder('back');
    expect(s.objects().map((o) => o.x)).toEqual([0, 10, 20]);
  });

  it('moving a guide that is gone is refused with a message', () => {
    const s = setup();
    s.anim.moveGuide('x', 3, 10);
    expect(s.state().message?.text).toMatch(/guide/);
    s.anim.dismissMessage();
    expect(s.state().message).toBeNull();
  });
});

describe('pictures (AN5)', () => {
  it('a cancelled dialog adds nothing; the same file twice is one picture', async () => {
    const s = setup();
    await s.anim.addPicture({ x: 0, y: 0 });
    expect(s.objects()).toEqual([]);
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/photo.jpg']);
    await s.anim.addPicture({ x: 0, y: 0 });
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/photo.jpg']);
    await s.anim.addPicture({ x: 50, y: 50 });
    expect(s.doc().pictures).toHaveLength(1);
    expect(s.objects()).toHaveLength(2);
  });

  it('a file that cannot be read says so', async () => {
    const s = setup();
    s.dialogs.openMedia.mockResolvedValueOnce(['/m/missing.jpg']);
    await s.anim.addPicture({ x: 0, y: 0 });
    expect(s.state().message?.kind).toBe('error');
  });
});

describe('files at the edges', () => {
  it('cancelled Save As, Open and Export change nothing', async () => {
    const s = setup();
    s.rect();
    await s.anim.saveAs();
    await s.anim.open();
    await s.anim.exportPng();
    expect(s.state().path).toBeNull();
    expect(s.objects()).toHaveLength(1);
    expect(s.bytes.size).toBe(0);
  });

  it('a write that fails becomes a plain message, not a crash', async () => {
    const t = testApp();
    const anim = createAnimationApp({
      dialogs: t.dialogs,
      files: {
        read: async () => Promise.reject(new Error('ENOENT')),
        write: async () => Promise.reject(new Error('EACCES')),
        remove: async () => {},
        copy: async () => {},
        saveImage: async () => '',
        writeBytes: async () => Promise.reject(new Error('disk full')),
      },
      paths: { proxies: '/c', recovery: '/c/recovery.mve', snapshots: '/c', learn: '/c' },
      engine: t.engine,
    });
    t.dialogs.saveAnimation.mockResolvedValueOnce('/a/x.mvea');
    await anim.save();
    expect(anim.store.get().message?.text).toMatch(/went wrong/);
    expect(anim.store.get().path).toBeNull();
    t.dialogs.exportAnimation.mockResolvedValueOnce('/a/x.png');
    await anim.exportPng();
    expect(anim.store.get().message?.text).toMatch(/needs the EasyMedia app/);
    anim.dispose();
  });

  it('a damaged recovery file is discarded on start; a declined one too', async () => {
    const s = setup();
    s.disk.set('/cache/recovery.mvea', 'not json');
    await s.app.start();
    expect(s.disk.has('/cache/recovery.mvea')).toBe(false);
    const t2 = setup();
    t2.disk.set('/cache/recovery.mvea', serializeAnimation(createAnimation({ name: 'lost' })));
    t2.dialogs.confirm.mockResolvedValueOnce(false);
    await t2.app.start();
    expect(t2.disk.has('/cache/recovery.mvea')).toBe(false);
    expect(t2.doc().name).toBe('Untitled');
  });

  it('autosave writes to the file once there is one, and skips when nothing changed', async () => {
    vi.useFakeTimers();
    try {
      const s = setup();
      await vi.advanceTimersByTimeAsync(61_000);
      expect(s.disk.has('/cache/recovery.mvea')).toBe(false);
      s.rect();
      s.dialogs.saveAnimation.mockResolvedValueOnce('/a/x.mvea');
      await s.anim.save();
      s.anim.setProperties({ x: 3 });
      await vi.advanceTimersByTimeAsync(61_000);
      expect(s.disk.get('/a/x.mvea')).toContain('"x": 3');
      expect(s.anim.isDirty()).toBe(false);
      // Unsaved again, never saved: the recovery file is written once per change.
      const t2 = setup();
      t2.rect();
      await vi.advanceTimersByTimeAsync(61_000);
      const written = t2.disk.get('/cache/recovery.mvea');
      await vi.advanceTimersByTimeAsync(61_000);
      expect(t2.disk.get('/cache/recovery.mvea')).toBe(written);
    } finally {
      vi.useRealTimers();
    }
  });

  it('opening with unsaved work asks first; declining keeps the work', async () => {
    const s = setup();
    s.rect();
    s.dialogs.confirm.mockResolvedValueOnce(false);
    await s.anim.open();
    expect(s.dialogs.openAnimation).not.toHaveBeenCalled();
    expect(s.objects()).toHaveLength(1);
  });

  it('the window title and close guard: clean work closes without asking', async () => {
    const s = setup();
    expect(await s.app.confirmClose()).toBe(true);
    s.rect();
    s.dialogs.unsavedChanges.mockResolvedValueOnce('discard');
    expect(await s.app.confirmClose()).toBe(true);
  });
});

describe('commands at the edges', () => {
  const doc = createAnimation({ name: 'A' });
  const layer = doc.layers[0]!.id;
  it('a refused edit from the panel is its message; an unexpected one is the plain one', () => {
    const s = setup();
    expect(
      s.anim.edit({
        label: 'x',
        apply: () => {
          throw new EditError('No.');
        },
      }),
    ).toBe('No.');
    expect(
      s.anim.edit({
        label: 'x',
        apply: () => {
          throw new Error('boom');
        },
      }),
    ).toMatch(/went wrong/);
  });

  it('setLayer labels its change; a picture already known is not added twice', () => {
    expect(cmd.setLayer('l', { visible: false }).label).toBe('Hide layer');
    expect(cmd.setLayer('l', { visible: true }).label).toBe('Show layer');
    expect(cmd.setLayer('l', { locked: true }).label).toBe('Lock layer');
    expect(cmd.setLayer('l', { locked: false }).label).toBe('Unlock layer');
    expect(cmd.setLayer('l', { colour: '#fff' }).label).toBe('Layer colour');
    const picture = { id: 'p', path: 'a.png', width: 1, height: 1 };
    const once = execute(
      createHistory(doc),
      cmd.addPicture(layer, picture, {
        ...createRect({ x: 0, y: 0 }),
        kind: 'picture',
        pictureId: 'p',
      } as AnimObject),
    ).present;
    const twice = execute(
      createHistory(once),
      cmd.addPicture(layer, picture, {
        ...createRect({ x: 0, y: 0 }),
        kind: 'picture',
        pictureId: 'p',
        id: 'q',
      } as AnimObject),
    ).present;
    expect(twice.pictures).toHaveLength(1);
  });

  it('reorder labels; ungrouping a non-group leaves the document as it is', () => {
    expect(cmd.reorderObjects(['a'], 'front').label).toBe('Bring to front');
    expect(cmd.reorderObjects(['a'], 'backmost').label).toBe('Send to back');
    const r = createRect({ x: 0, y: 0 });
    const withRect = execute(createHistory(doc), cmd.addObject(layer, r)).present;
    expect(cmd.ungroupObjects([r.id]).apply(withRect)).toBe(withRect);
  });
});
