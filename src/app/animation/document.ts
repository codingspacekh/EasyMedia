// The document as a whole (AN1, AN2, AN7, AN12): undo and redo, the stage, guides and view
// settings, layers and folders.
import * as cmd from '../animation-commands.ts';
import { undo, redo } from '../history.ts';
import { findObject, setFolderOpen as setFolderOpenIn } from '../../core/animation/layers.ts';
import type { Id, Stage, ViewSettings } from '../../core/animation/types.ts';
import type { AnimationContext } from './context.ts';

export function documentActions(ctx: AnimationContext) {
  const { store, patch, present, run, edit, liveSelection } = ctx;
  return {
    undo(): void {
      patch({ history: undo(store.get().history) });
      patch({ selection: liveSelection() });
    },
    redo(): void {
      patch({ history: redo(store.get().history) });
      patch({ selection: liveSelection() });
    },

    // ---- stage, guides, view ----

    setStage: (stage: Stage): string | null => edit(cmd.setStage(stage)),

    addGuide: (axis: cmd.GuideAxis, value: number) => void run(cmd.addGuide(axis, value)),
    moveGuide: (axis: cmd.GuideAxis, index: number, value: number) =>
      void run(cmd.moveGuide(axis, index, value)),
    removeGuide: (axis: cmd.GuideAxis, index: number) => void run(cmd.removeGuide(axis, index)),

    /** AN2: rulers, grid and snapping — kept with the animation, but not an undo step. */
    setView(change: Partial<ViewSettings>): void {
      store.update((s) => ({
        ...s,
        history: {
          ...s.history,
          present: { ...s.history.present, view: { ...s.history.present.view, ...change } },
        },
      }));
    },

    // ---- layers ----

    selectLayer: (layerId: Id) => patch({ layerId }),

    addLayer(): void {
      let made: Id | null = null;
      if (run(cmd.addLayer((layer) => (made = layer.id), store.get().layerId)) && made)
        patch({ layerId: made, selection: [] });
    },

    renameLayer: (id: Id, name: string): string | null => edit(cmd.renameLayer(id, name)),

    removeLayer(id: Id): void {
      if (!run(cmd.removeLayer(id))) return;
      const s = store.get();
      const layerId = s.layerId === id ? present().layers[0]!.id : s.layerId;
      patch({ layerId, selection: liveSelection() });
    },

    moveLayer: (id: Id, index: number) => void run(cmd.moveLayer(id, index)),

    /** AN7, AN12: show / hide, lock / unlock, or make a mask of a layer. */
    toggleLayer(id: Id, what: 'visible' | 'locked' | 'mask'): void {
      const layer = present().layers.find((l) => l.id === id);
      if (layer && run(cmd.setLayer(id, { [what]: !layer[what] })))
        patch({
          selection: liveSelection().filter((o) => findObject(present(), o)?.layerId !== id),
        });
    },

    setLayerColour: (id: Id, colour: string) => void run(cmd.setLayer(id, { colour })),

    addFolder(name = 'Folder'): void {
      run(cmd.addFolder(name, () => {}));
    },
    renameFolder: (id: Id, name: string): string | null => edit(cmd.renameFolder(id, name)),
    removeFolder: (id: Id) => void run(cmd.removeFolder(id)),
    moveLayerToFolder: (layerId: Id, folderId: Id | null) =>
      void run(cmd.moveLayerToFolder(layerId, folderId)),

    /** Opens or closes a folder in the Layers panel: kept with the animation, not an undo step. */
    setFolderOpen(id: Id, open: boolean): void {
      store.update((s) => ({
        ...s,
        history: { ...s.history, present: setFolderOpenIn(s.history.present, id, open) },
      }));
    },
  };
}
