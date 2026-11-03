// Drawing and editing objects (AN3–AN7, AN10, AN11, AN13, AN18–AN20): the tools, exact
// properties, moving, resizing and turning, paths and morphs, arranging, grouping, the clipboard,
// the library and one-click effects. Each change is one undo step.
import * as cmd from '../animation-commands.ts';
import {
  createButton,
  createEllipse,
  createLine,
  createPath,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../../core/animation/factory.ts';
import { placeIn, objectsShown } from '../../core/animation/frames.ts';
import type { Handle, Point } from '../../core/animation/geometry.ts';
import { findObject, pictureIdsOf } from '../../core/animation/layers.ts';
import type { MeasureText } from '../../core/animation/letters.ts';
import { itemById, placeItem } from '../../core/animation/library/index.ts';
import { objectAt } from '../../core/animation/tween.ts';
import type {
  AnimObject,
  ButtonAction,
  Id,
  PathObject,
  Picture,
  TextObject,
} from '../../core/animation/types.ts';
import { EditError } from '../../core/model/errors.ts';
import type { AnimationContext } from './context.ts';
import type { ShapeKind, Tool } from './state.ts';

export function drawingActions(ctx: AnimationContext) {
  const { store, patch, present, showError, run, edit, pause, liveSelection, currentLayer } = ctx;
  /** AN5, AN6: what was copied, with the pictures it shows, to paste here or in another animation. */
  let clipboard: { objects: AnimObject[]; pictures: Picture[] } = { objects: [], pictures: [] };
  function clip(ids: readonly Id[]): typeof clipboard {
    const doc = present();
    const objects = ids.flatMap((id) => {
      const found = findObject(doc, id);
      return found ? [found.object] : [];
    });
    const used = new Set(pictureIdsOf(objects));
    return { objects, pictures: doc.pictures.filter((p) => used.has(p.id)) };
  }

  /** The selected object's layer, so the next shape goes beside it. */
  function followSelection(ids: Id[]): void {
    const first = ids[0] && findObject(present(), ids[0]);
    patch({ selection: ids, ...(first ? { layerId: first.layerId } : {}) });
  }

  function addToStage(object: AnimObject): void {
    const layer = currentLayer();
    const placed = layer ? placeIn(layer, object, store.get().frame) : object;
    if (run(cmd.addObject(store.get().layerId, placed))) {
      const added = present()
        .layers.find((l) => l.id === store.get().layerId)
        ?.objects.at(-1);
      patch({ selection: added ? [added.id] : [], tool: 'select' });
    }
  }

  return {
    // ---- selection and tools ----

    select: (ids: Id[]) => followSelection(ids),
    selectAll(): void {
      const layer = currentLayer();
      const ids =
        layer && !layer.locked && layer.visible
          ? objectsShown(layer, store.get().frame).map((o) => o.id)
          : [];
      patch({ selection: ids });
    },
    setTool: (tool: Tool) => patch({ tool }),
    setZoom: (zoom: number | 'fit') => patch({ zoom }),
    dismissMessage: () => patch({ message: null }),

    // ---- drawing ----

    /** A shape dragged out on the stage (AN3). */
    addShape(kind: ShapeKind, box: { x: number; y: number; width: number; height: number }): void {
      const make = {
        rect: createRect,
        ellipse: createEllipse,
        star: createStar,
        polygon: createPolygon,
      };
      addToStage(make[kind](box));
    },

    addLine(from: Point, to: Point): void {
      addToStage(createLine(from, to));
    },

    /** A pen (clicked points) or brush (dragged) path (AN3). */
    addPath(points: Point[], closed: boolean): void {
      try {
        addToStage(createPath(points, closed));
      } catch (error) {
        showError(error);
      }
    },

    /** AN4: words at the clicked point, in the default size. */
    addText(
      at: Point,
      text = 'Text',
      measure?: (t: TextObject) => { width: number; height: number },
    ): void {
      const made = createText(text, at);
      addToStage(measure ? { ...made, ...measure(made) } : made);
    },

    /** AN18: a button (Pause at first) at the clicked point. */
    addButton(at: Point): void {
      addToStage(createButton('pause', at));
    },

    /** AN18: what the selected buttons do (one undo step). */
    setButtonAction(action: ButtonAction): string | null {
      return edit(cmd.setButtonAction(store.get().selection, action));
    },

    /**
     * AN19: a library item on the stage: a picture in the middle of the current layer (selected),
     * a background on a layer of its own at the bottom. One undo step; null or why not.
     */
    addFromLibrary(itemId: string): string | null {
      const item = itemById(itemId);
      if (!item) return 'That picture is not in the library.';
      const object = placeItem(item, present().stage);
      if (item.category === 'backgrounds') {
        let layerId: Id | null = null;
        const error = edit(cmd.addBackground(object, (id) => (layerId = id)));
        if (error === null && layerId) patch({ layerId, selection: [object.id], tool: 'select' });
        return error;
      }
      const layer = currentLayer();
      const placed = layer ? placeIn(layer, object, store.get().frame) : object;
      const error = edit(cmd.addObject(store.get().layerId, placed));
      if (error === null) patch({ selection: [placed.id], tool: 'select' });
      return error;
    },

    /** AN20: an effect on the selected objects from the playhead, `seconds` long (one undo step). */
    applyEffect(effectId: string, seconds: number): string | null {
      const ids = liveSelection();
      if (ids.length === 0) return 'Select the objects to give the effect to.';
      const frames = Math.round(seconds * present().stage.fps);
      return edit(cmd.applyEffect(ids, effectId, store.get().frame, frames));
    },

    edit,

    /** AN6: exact numbers for every selected object; returns why not, for the field. */
    setProperties(patchValues: Partial<AnimObject>): string | null {
      const ids = liveSelection();
      if (ids.length === 0) return null;
      pause();
      return edit(cmd.setProperties(ids, patchValues, store.get().frame));
    },

    /** AN4: the selected text becomes one object per letter, all selected. */
    splitText(measure?: MeasureText): void {
      const [id] = liveSelection();
      if (!id) return;
      let letters: Id[] = [];
      if (run(cmd.splitText(id, measure, (ids) => (letters = ids)))) patch({ selection: letters });
    },

    moveSelection(dx: number, dy: number): void {
      const ids = liveSelection();
      if (ids.length && (dx !== 0 || dy !== 0))
        run(cmd.moveObjects(ids, dx, dy, store.get().frame));
    },

    /** Arrow keys: 1 px, or 10 px with Shift. */
    nudge(dx: number, dy: number): void {
      const ids = liveSelection();
      if (ids.length) run(cmd.moveObjects(ids, dx, dy, store.get().frame));
    },

    resizeSelected(id: Id, handle: Handle, pointer: Point, lockRatio: boolean): void {
      pause();
      run(cmd.resizeObject(id, handle, pointer, lockRatio, store.get().frame));
    },

    rotateSelected(id: Id, degrees: number): void {
      pause();
      run(cmd.rotateObject(id, degrees, store.get().frame));
    },

    /** An object as it is shown at the playhead (for the Properties panel and the handles). */
    objectAtPlayhead(id: Id): AnimObject | null {
      const found = findObject(present(), id);
      return found ? objectAt(found.object, store.get().frame) : null;
    },

    // ---- paths and morphs (AN10, AN11) ----

    /** AN3: a pen path's points and curves edited on the stage (pen.ts), one undo step. */
    editPath(id: Id, label: string, change: (path: PathObject) => PathObject): void {
      run(
        cmd.changeObject(id, label, (o) => {
          if (o.kind !== 'path') throw new EditError('Only a pen path has points to edit.');
          return change(o);
        }),
      );
    },

    /** AN11: the object follows another object's path (or outline); returns why not. */
    followPath: (id: Id, sourceId: Id): string | null => edit(cmd.followPath(id, sourceId)),
    /** The frames, Orient to path, even speed or easing of one of its paths (0 = the first). */
    setMotion: (id: Id, index: number, change: cmd.PathChange): string | null =>
      edit(cmd.setMotion(id, index, change)),
    removeMotion: (id: Id, index: number) => void run(cmd.removeMotion(id, index)),

    /** AN10: at the playhead the shape becomes the one picked (removed unless kept). */
    morphInto(
      id: Id,
      targetId: Id,
      { keepTarget = false }: { keepTarget?: boolean } = {},
    ): string | null {
      const refused = edit(cmd.morphInto(id, targetId, store.get().frame, keepTarget));
      if (!refused) patch({ selection: [id] });
      return refused;
    },

    deleteSelection(): void {
      const ids = liveSelection();
      if (ids.length && run(cmd.removeObjects(ids))) patch({ selection: [] });
    },

    reorder(how: 'forward' | 'back' | 'front' | 'backmost'): void {
      const ids = liveSelection();
      if (ids.length) run(cmd.reorderObjects(ids, how));
    },

    moveSelectionToLayer(layerId: Id): void {
      const ids = liveSelection();
      if (ids.length && run(cmd.moveObjectsToLayer(ids, layerId, store.get().frame)))
        patch({ layerId });
    },

    group(): void {
      const ids = liveSelection();
      let groupId: Id | null = null;
      if (ids.length >= 2 && run(cmd.groupObjects(ids, (id) => (groupId = id))) && groupId)
        patch({ selection: [groupId] });
    },

    ungroup(): void {
      const ids = liveSelection();
      if (!ids.length) return;
      const before = present();
      if (run(cmd.ungroupObjects(ids)) && present() !== before) patch({ selection: [] });
    },

    duplicate(): void {
      const ids = liveSelection();
      let copies: Id[] = [];
      if (ids.length && run(cmd.duplicateObjects(ids, (made) => (copies = made))))
        patch({ selection: copies });
    },

    copy(): void {
      clipboard = clip(liveSelection());
    },

    cut(): void {
      const ids = liveSelection();
      if (!ids.length) return;
      clipboard = clip(ids);
      if (run(cmd.removeObjects(ids))) patch({ selection: [] });
    },

    paste(): void {
      if (clipboard.objects.length === 0) return;
      let made: Id[] = [];
      const { layerId, frame } = store.get();
      if (run(cmd.pasteObjects(layerId, clipboard, (ids) => (made = ids), frame)))
        patch({ selection: made });
    },
  };
}
