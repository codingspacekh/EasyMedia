// Animation mode's use cases (M13, AN1–AN7, AN16): its own document, history, file and
// selection. The UI only calls these and shows the store; errors become a message.
import * as cmd from './animation-commands.ts';
import { createHistory, execute, redo, undo, type History } from './history.ts';
import { createStore, type Store } from './store.ts';
import {
  createAnimation,
  createEllipse,
  createLine,
  createPicture,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../core/animation/factory.ts';
import type { Handle, Point } from '../core/animation/geometry.ts';
import { findObject } from '../core/animation/layers.ts';
import {
  animationFromDisk,
  animationToDisk,
  deserializeAnimation,
  serializeAnimation,
} from '../core/animation/serialize.ts';
import type {
  AnimObject,
  AnimationDoc,
  Id,
  Picture,
  Stage,
  ViewSettings,
} from '../core/animation/types.ts';
import { EditError, MediaError, ProjectFileError } from '../core/model/errors.ts';
import { newId } from '../core/model/factory.ts';
import type { AppPaths, Dialogs, MediaEngine, ProjectFiles, StageRenderer } from '../core/ports.ts';
import { dirOf, fileNameOf } from '../core/project/relocate.ts';

export type Tool =
  'select' | 'rect' | 'ellipse' | 'star' | 'polygon' | 'line' | 'pen' | 'text' | 'picture';

export type ShapeKind = 'rect' | 'ellipse' | 'star' | 'polygon';

export interface AnimationState {
  history: History<AnimationDoc>;
  /** The .mvea file, or null for an animation that was never saved. */
  path: string | null;
  /** The document as last saved or opened: anything else is unsaved work. */
  saved: AnimationDoc;
  /** Selected objects (top-level ones). */
  selection: Id[];
  /** The layer new objects go on. */
  layerId: Id;
  tool: Tool;
  /** 1 = 100 %; 'fit' fills the window. */
  zoom: number | 'fit';
  /** What Animation mode is doing, e.g. "Exporting…". */
  busy: string | null;
  message: { kind: 'error' | 'info'; text: string } | null;
}

export interface AnimationDeps {
  dialogs: Dialogs;
  files: ProjectFiles;
  paths: AppPaths;
  engine: MediaEngine;
  renderer?: StageRenderer;
  autosaveMs?: number;
}

const DISCARD = 'You have unsaved animation work. Discard it and';
const UNEXPECTED = 'Something went wrong. Please try again.';
const NO_RENDERER: StageRenderer = {
  renderPng: () => Promise.reject(new EditError('Exporting needs the EasyMedia app.')),
};

export const isAnimationDirty = (s: AnimationState): boolean => s.history.present !== s.saved;

/** For the window title: "Chapter07_Task1_1 •" or "Untitled animation". */
export const animationTitle = (s: AnimationState): string =>
  `${s.path ? fileNameOf(s.path).replace(/\.mvea$/i, '') : 'Untitled animation'}${
    isAnimationDirty(s) ? ' •' : ''
  }`;

const recoveryPathOf = (paths: AppPaths): string =>
  paths.animationRecovery ?? paths.recovery.replace(/\.mve$/i, '') + '.mvea';

export function createAnimationApp({
  dialogs,
  files,
  paths,
  engine,
  renderer = NO_RENDERER,
  autosaveMs = 60_000,
}: AnimationDeps) {
  const fresh = createAnimation({ name: 'Untitled' });
  const store: Store<AnimationState> = createStore<AnimationState>({
    history: createHistory(fresh),
    path: null,
    saved: fresh,
    selection: [],
    layerId: fresh.layers[0]!.id,
    tool: 'select',
    zoom: 'fit',
    busy: null,
    message: null,
  });
  const patch = (change: Partial<AnimationState>) => store.update((s) => ({ ...s, ...change }));
  const present = () => store.get().history.present;
  let clipboard: AnimObject[] = [];

  function showError(error: unknown): void {
    const known =
      error instanceof EditError ||
      error instanceof MediaError ||
      error instanceof ProjectFileError;
    patch({ message: { kind: 'error', text: known ? (error as Error).message : UNEXPECTED } });
  }

  /** Applies a command; a refused edit becomes a message. True when it was applied. */
  function run(command: cmd.AnimCommand): boolean {
    try {
      store.update((s) => ({ ...s, history: execute(s.history, command) }));
      return true;
    } catch (error) {
      showError(error);
      return false;
    }
  }

  /** For panel fields: applies the edit, or returns why it is not allowed (shown by the field). */
  function edit(command: cmd.AnimCommand): string | null {
    try {
      store.update((s) => ({ ...s, history: execute(s.history, command) }));
      return null;
    } catch (error) {
      return error instanceof EditError ? error.message : UNEXPECTED;
    }
  }

  /** The selection without objects that no longer exist. */
  const liveSelection = (): Id[] =>
    store.get().selection.filter((id) => findObject(present(), id) !== null);

  function load(doc: AnimationDoc, path: string | null, saved: AnimationDoc = doc): void {
    patch({
      history: createHistory(doc),
      path,
      saved,
      selection: [],
      layerId: doc.layers[0]!.id,
      tool: 'select',
      busy: null,
      message: null,
    });
  }

  const recovery = recoveryPathOf(paths);

  async function writeTo(path: string): Promise<void> {
    const doc = present();
    try {
      await files.write(path, serializeAnimation(animationToDisk(doc, dirOf(path))));
      patch({ path, saved: doc });
      await files.remove(recovery).catch(() => {});
    } catch (error) {
      showError(error);
    }
  }

  async function save(): Promise<void> {
    const { path } = store.get();
    if (path) await writeTo(path);
    else await saveAs();
  }

  async function saveAs(): Promise<void> {
    const current = store.get().path;
    const name = current ? fileNameOf(current).replace(/\.mvea$/i, '') : present().name;
    const path = await dialogs.saveAnimation(name);
    if (path) await writeTo(path);
  }

  // P3: autosave every minute when there are changes.
  let lastRecovery: AnimationDoc | null = null;
  const timer = setInterval(() => {
    const s = store.get();
    if (!isAnimationDirty(s)) return;
    if (s.path) {
      void writeTo(s.path);
      return;
    }
    if (lastRecovery === s.history.present) return;
    lastRecovery = s.history.present;
    void files.write(recovery, serializeAnimation(s.history.present)).catch(() => {});
  }, autosaveMs);
  (timer as { unref?: () => void }).unref?.();

  /** The selected object's layer, so the next shape goes beside it. */
  function followSelection(ids: Id[]): void {
    const first = ids[0] && findObject(present(), ids[0]);
    patch({ selection: ids, ...(first ? { layerId: first.layerId } : {}) });
  }

  function addToStage(object: AnimObject): void {
    if (run(cmd.addObject(store.get().layerId, object))) {
      const added = present()
        .layers.find((l) => l.id === store.get().layerId)
        ?.objects.at(-1);
      patch({ selection: added ? [added.id] : [], tool: 'select' });
    }
  }

  return {
    store,

    isDirty: () => isAnimationDirty(store.get()),

    /** The animation as its file text (for tests and the HTML export later). */
    text: () => serializeAnimation(present()),

    /** On start-up: offers to restore animation work that was never saved (P3). */
    async start(): Promise<void> {
      let text: string;
      try {
        text = await files.read(recovery);
      } catch {
        return;
      }
      try {
        const lost = animationFromDisk(deserializeAnimation(text), dirOf(recovery));
        if (
          await dialogs.confirm('EasyMedia closed before your animation was saved. Restore it?')
        ) {
          load(lost, null, createAnimation({ name: 'Untitled' }));
          return;
        }
      } catch {
        // a damaged recovery file is simply discarded
      }
      await files.remove(recovery).catch(() => {});
    },

    async newAnimation(): Promise<void> {
      if (
        isAnimationDirty(store.get()) &&
        !(await dialogs.confirm(`${DISCARD} start a new animation?`))
      )
        return;
      load(createAnimation({ name: 'Untitled' }), null);
    },

    async open(): Promise<void> {
      if (
        isAnimationDirty(store.get()) &&
        !(await dialogs.confirm(`${DISCARD} open another animation?`))
      )
        return;
      const path = await dialogs.openAnimation();
      if (!path) return;
      try {
        const doc = animationFromDisk(deserializeAnimation(await files.read(path)), dirOf(path));
        load(doc, path);
      } catch (error) {
        showError(error);
      }
    },

    save,
    saveAs,

    /** AN15 (M13): the stage as a PNG, to a file the student names. */
    async exportPng(): Promise<void> {
      const { path } = store.get();
      const name = path ? fileNameOf(path).replace(/\.mvea$/i, '') : present().name;
      const output = await dialogs.exportAnimation(name, 'png');
      if (!output) return;
      patch({ busy: 'Exporting…' });
      try {
        await files.writeBytes(output, await renderer.renderPng(present()));
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.` } });
      } catch (error) {
        showError(error);
      } finally {
        patch({ busy: null });
      }
    },

    // ---- selection and tools ----

    select: (ids: Id[]) => followSelection(ids),
    selectAll(): void {
      const layer = present().layers.find((l) => l.id === store.get().layerId);
      const ids = layer && !layer.locked && layer.visible ? layer.objects.map((o) => o.id) : [];
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

    /** AN4: words at the clicked point, in the default size. */
    addText(at: Point, text = 'Text'): void {
      addToStage(createText(text, at));
    },

    /** AN5: a picture file chosen by the student, placed at its own size. */
    async addPicture(at: Point): Promise<void> {
      const [path] = await dialogs.openMedia();
      if (!path) return;
      try {
        const info = await engine.probe(path);
        if (info.kind !== 'image' || !info.video)
          throw new EditError('Choose a picture file, such as a PNG or JPG.');
        const known = present().pictures.find((p) => p.path === path);
        const picture: Picture = known ?? {
          id: newId(),
          path,
          width: info.video.width,
          height: info.video.height,
        };
        const object = createPicture(picture, at);
        if (run(cmd.addPicture(store.get().layerId, picture, object)))
          patch({ selection: [object.id], tool: 'select' });
      } catch (error) {
        showError(error);
      }
    },

    // ---- editing the selection ----

    edit,

    /** AN6: exact numbers for every selected object; returns why not, for the field. */
    setProperties(patchValues: Partial<AnimObject>): string | null {
      const ids = liveSelection();
      if (ids.length === 0) return null;
      return edit(cmd.setProperties(ids, patchValues));
    },

    moveSelection(dx: number, dy: number): void {
      const ids = liveSelection();
      if (ids.length && (dx !== 0 || dy !== 0)) run(cmd.moveObjects(ids, dx, dy));
    },

    /** Arrow keys: 1 px, or 10 px with Shift. */
    nudge(dx: number, dy: number): void {
      const ids = liveSelection();
      if (ids.length) run(cmd.moveObjects(ids, dx, dy));
    },

    resizeSelected(id: Id, handle: Handle, pointer: Point, lockRatio: boolean): void {
      run(cmd.resizeObject(id, handle, pointer, lockRatio));
    },

    rotateSelected(id: Id, degrees: number): void {
      run(cmd.rotateObject(id, degrees));
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
      if (ids.length && run(cmd.moveObjectsToLayer(ids, layerId))) patch({ layerId });
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
      const ids = liveSelection();
      clipboard = ids.flatMap((id) => {
        const found = findObject(present(), id);
        return found ? [found.object] : [];
      });
    },

    cut(): void {
      const ids = liveSelection();
      if (!ids.length) return;
      clipboard = ids.flatMap((id) => {
        const found = findObject(present(), id);
        return found ? [found.object] : [];
      });
      if (run(cmd.removeObjects(ids))) patch({ selection: [] });
    },

    paste(): void {
      if (clipboard.length === 0) return;
      let made: Id[] = [];
      if (run(cmd.pasteObjects(store.get().layerId, clipboard, (ids) => (made = ids))))
        patch({ selection: made });
    },

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

    toggleLayer(id: Id, what: 'visible' | 'locked'): void {
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

    dispose(): void {
      clearInterval(timer);
    },
  };
}

export type AnimationApp = ReturnType<typeof createAnimationApp>;
