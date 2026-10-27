// Animation mode's use cases (M13, AN1–AN7, AN16): its own document, history, file and
// selection. The UI only calls these and shows the store; errors become a message.
import * as cmd from './animation-commands.ts';
import { createHistory, execute, redo, undo, type History } from './history.ts';
import { createStore, type Store } from './store.ts';
import {
  createAnimation,
  createEllipse,
  createLine,
  createPath,
  createPicture,
  createPolygon,
  createRect,
  createStar,
  createText,
} from '../core/animation/factory.ts';
import type { Handle, Point } from '../core/animation/geometry.ts';
import { findObject, setFolderOpen as setFolderOpenIn } from '../core/animation/layers.ts';
import {
  animationFromDisk,
  animationToDisk,
  deserializeAnimation,
  serializeAnimation,
} from '../core/animation/serialize.ts';
import { parseFrame } from '../core/animation/time.ts';
import { objectAt } from '../core/animation/tween.ts';
import type {
  AnimObject,
  AnimationDoc,
  Easing,
  Id,
  TweenProperty,
  Picture,
  Stage,
  TextObject,
  ViewSettings,
} from '../core/animation/types.ts';
import {
  EditError,
  JobCancelledError,
  MediaError,
  ProjectFileError,
} from '../core/model/errors.ts';
import {
  estimateAnimationSize,
  evenSize,
  exportedFrames,
  frameFile,
  sequenceName,
  type AnimationFormat,
} from '../core/animation/export.ts';
import { newId } from '../core/model/factory.ts';
import type {
  AppPaths,
  Dialogs,
  JobHandle,
  MediaEngine,
  ProjectFiles,
  StageRenderer,
} from '../core/ports.ts';
import { dirOf, fileNameOf } from '../core/project/relocate.ts';

export type Tool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'star'
  | 'polygon'
  | 'line'
  | 'pen'
  | 'brush'
  | 'text'
  | 'picture';

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
  /** AN8: the playhead, 0 to the stage's length (the end shows the last pose). */
  frame: number;
  playing: boolean;
  /** AN8: loop the whole animation, or the frames from `from` to `to` (both shown). */
  loop: Loop;
  /** AN15: an export of the frames under way (N12: progress and Cancel). */
  exporting: AnimationExporting | null;
  /** What Animation mode is doing, e.g. "Exporting…". */
  busy: string | null;
  message: { kind: 'error' | 'info'; text: string } | null;
}

export interface AnimationExporting {
  format: AnimationFormat;
  /** Drawing the frames, then FFmpeg making the file (MP4 and GIF only). */
  phase: 'drawing' | 'encoding';
  /** 0–1 within the phase. */
  progress: number;
  output: string;
}

export interface Loop {
  on: boolean;
  from?: number;
  to?: number;
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

/**
 * Unsaved work: anything but the view settings (rulers, grid, snapping, open folders), which are
 * saved with the animation but are not edits. The document is immutable, so the other parts are
 * the same objects until an edit replaces them.
 */
export const isAnimationDirty = (s: AnimationState): boolean => {
  const a = s.history.present;
  const b = s.saved;
  if (a === b) return false;
  return (
    a.name !== b.name ||
    a.stage !== b.stage ||
    a.layers !== b.layers ||
    a.folders !== b.folders ||
    a.pictures !== b.pictures ||
    a.guides !== b.guides
  );
};

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
    frame: 0,
    playing: false,
    loop: { on: false },
    exporting: null,
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

  // ---- playback (AN8): the frame follows the clock, so a slow laptop drops frames, not time ----

  let player: ReturnType<typeof setInterval> | null = null;
  const TICK_MS = 10;

  function pause(): void {
    if (player) clearInterval(player);
    player = null;
    if (store.get().playing) patch({ playing: false });
  }

  /** The frames playback runs over: [first, last]; `wraps` when it loops. */
  function playRange(): { first: number; last: number; wraps: boolean } {
    const { loop } = store.get();
    const { length } = present().stage;
    if (loop.on && loop.from !== undefined && loop.to !== undefined)
      return { first: loop.from, last: loop.to, wraps: true };
    // Looping the whole animation does not show the end frame and frame 0 one after the other.
    return loop.on
      ? { first: 0, last: length - 1, wraps: true }
      : { first: 0, last: length, wraps: false };
  }

  function play(): void {
    pause();
    const { first, last, wraps } = playRange();
    let from = store.get().frame;
    if (from < first || from >= last) from = first;
    patch({ playing: true, frame: from });
    const started = Date.now();
    const fps = present().stage.fps;
    player = setInterval(() => {
      const n = Math.floor(((Date.now() - started) * fps) / 1000);
      let frame = from + n;
      if (wraps) frame = first + ((frame - first) % (last - first + 1));
      else if (frame >= last) {
        patch({ frame: last });
        pause();
        return;
      }
      if (frame !== store.get().frame) patch({ frame });
    }, TICK_MS);
    (player as { unref?: () => void }).unref?.();
  }

  const clampFrame = (frame: number): number =>
    Math.max(0, Math.min(present().stage.length, Math.round(frame)));

  const TYPE_TIME = 'Type a frame number, or a time such as 3 s or 0:03.00.';

  /** Applies a command; a refused edit becomes a message. True when it was applied. */
  function run(command: cmd.AnimCommand): boolean {
    pause();
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
    pause();
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
    pause();
    patch({
      frame: 0,
      loop: { on: false },
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

  // ---- export (AN15) ----

  let cancelExporting: (() => void) | null = null;

  /** A new folder of its own for one export's frames, in the app's frames folder. */
  function framesFolder(): string {
    const base = paths.animationFrames ?? `${paths.proxies}/animation-frames`;
    const sep = base.includes('\\') && !base.includes('/') ? '\\' : '/';
    return `${base}${sep}export-${newId()}${sep}`;
  }

  /**
   * AN15: every frame drawn by the same drawing as the preview, then made into the chosen file:
   * MP4 or GIF by FFmpeg from frames in the app's folder (removed afterwards), a PNG sequence
   * beside the chosen name, or the frame at the playhead as one PNG. `chosen` skips the save box
   * (Send to Video mode). Returns the file made, or null (closed, cancelled or failed).
   */
  async function exportAnimation(format: AnimationFormat, chosen?: string): Promise<string | null> {
    if (store.get().exporting || store.get().busy) return null;
    pause();
    const doc = present();
    const { path, frame } = store.get();
    const name = path ? fileNameOf(path).replace(/\.mvea$/i, '') : doc.name;
    const output = chosen ?? (await dialogs.exportAnimation(name, format));
    if (!output) return null;
    if (format === 'png') {
      patch({ busy: 'Exporting…' });
      try {
        await files.writeBytes(output, await renderer.renderPng(doc, frame));
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.` } });
        return output;
      } catch (error) {
        showError(error);
        return null;
      } finally {
        patch({ busy: null });
      }
    }

    let cancelled = false;
    let job: JobHandle | null = null;
    cancelExporting = () => {
      cancelled = true;
      job?.cancel();
    };
    const show = (phase: AnimationExporting['phase'], progress: number) =>
      patch({ exporting: { format, phase, progress, output } });
    const stopIfCancelled = () => {
      if (cancelled) throw new JobCancelledError();
    };
    const { count } = exportedFrames(doc);
    const folder = format === 'png-sequence' ? null : framesFolder();
    const written: string[] = [];
    let made: string | null = null;
    try {
      show('drawing', 0);
      for (let i = 0; i < count; i++) {
        stopIfCancelled();
        const png = await renderer.renderPng(doc, i);
        stopIfCancelled();
        const file = folder ? `${folder}${frameFile(i)}` : sequenceName(output, i);
        await files.writeBytes(file, png);
        written.push(file);
        show('drawing', (i + 1) / count);
      }
      if (folder && format !== 'png-sequence') {
        show('encoding', 0);
        stopIfCancelled();
        const { width, height, fps } = doc.stage;
        const started = engine.encodeFrames(folder.slice(0, -1), output, {
          format,
          fps,
          frames: count,
          width,
          height,
        });
        job = started;
        const stop = engine.onJobEvent((e) => {
          if (e.jobId === started.id && e.type === 'progress') show('encoding', e.ratio);
        });
        try {
          await started.done;
        } finally {
          stop();
        }
        written.length = 0; // FFmpeg's job removes the frames
        const even = evenSize(width, height);
        const note =
          format === 'mp4' && even.padded
            ? ` MP4 needs even sizes, so it is ${even.width} × ${even.height} (one pixel added).`
            : '';
        patch({ message: { kind: 'info', text: `Saved ${fileNameOf(output)}.${note}` } });
        made = output;
      } else {
        written.length = 0;
        const first = fileNameOf(sequenceName(output, 0));
        const last = fileNameOf(sequenceName(output, count - 1));
        patch({
          message: {
            kind: 'info',
            text: count === 1 ? `Saved ${first}.` : `Saved ${count} pictures, ${first} to ${last}.`,
          },
        });
        made = output;
      }
    } catch (error) {
      if (error instanceof JobCancelledError)
        patch({ message: { kind: 'info', text: 'Export cancelled.' } });
      else showError(error);
    } finally {
      await Promise.all(written.map((f) => files.remove(f).catch(() => {})));
      cancelExporting = null;
      patch({ exporting: null });
    }
    return made;
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

    /** AN15: the frame at the playhead as a PNG (M13's Export). */
    exportPng: async (): Promise<void> => void (await exportAnimation('png')),

    exportAnimation,

    /** N12: stops an export while it draws the frames or while FFmpeg makes the file. */
    cancelExport(): void {
      cancelExporting?.();
    },

    /** T7: what the export dialog shows before exporting. */
    exportSummary(format: AnimationFormat) {
      const doc = present();
      const { count, seconds } = exportedFrames(doc);
      const { width, height } = doc.stage;
      return {
        frames: format === 'png' ? 1 : count,
        seconds,
        bytes: estimateAnimationSize(doc, format),
        size: format === 'mp4' ? evenSize(width, height) : { width, height, padded: false },
      };
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
      pause();
      return edit(cmd.setProperties(ids, patchValues, store.get().frame));
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

    // ---- the playhead and playback (AN8) ----

    setFrame(frame: number): void {
      patch({ frame: clampFrame(frame) });
    },
    step(by: number): void {
      pause();
      patch({ frame: clampFrame(store.get().frame + by) });
    },
    /** A frame, seconds or a clock time typed in the playhead box; returns why not. */
    goTo(text: string): string | null {
      const frame = parseFrame(text, present().stage.fps);
      if (frame === null) return TYPE_TIME;
      patch({ frame: clampFrame(frame) });
      return null;
    },
    play,
    pause,
    togglePlay(): void {
      if (store.get().playing) pause();
      else play();
    },
    stop(): void {
      pause();
      patch({ frame: 0 });
    },
    setLoop(loop: Loop): string | null {
      if (loop.from !== undefined && loop.to !== undefined) {
        if (loop.from > loop.to) return 'The loop must start before it ends.';
        if (loop.from < 0 || loop.to > present().stage.length)
          return 'The loop must be inside the animation.';
      }
      const playing = store.get().playing;
      patch({ loop });
      if (playing) play();
      return null;
    },

    /** An object as it is shown at the playhead (for the Properties panel and the handles). */
    objectAtPlayhead(id: Id): AnimObject | null {
      const found = findObject(present(), id);
      return found ? objectAt(found.object, store.get().frame) : null;
    },

    // ---- keyframes (AN9, AN13) ----

    insertKeyframe: (id: Id, property: cmd.PropertyChoice) =>
      void run(cmd.insertKeyframe(id, property, store.get().frame)),
    removeKeyframe: (id: Id, property: TweenProperty, frame: number) =>
      void run(cmd.removeKeyframe(id, property, frame)),
    moveKeyframe: (id: Id, property: TweenProperty, frame: number, to: number) =>
      void run(cmd.moveKeyframe(id, property, frame, to)),
    copyKeyframe: (id: Id, property: TweenProperty, frame: number, to: number) =>
      void run(cmd.copyKeyframe(id, property, frame, to)),
    setEasing: (id: Id, property: TweenProperty, frame: number, easing: Easing) =>
      void run(cmd.setEasing(id, property, frame, easing)),
    setHold: (id: Id, property: TweenProperty, frame: number, hold: boolean) =>
      void run(cmd.setHold(id, property, frame, hold)),
    setRepeat: (id: Id, property: TweenProperty, repeat: 'end' | number | undefined) =>
      void run(cmd.setRepeat(id, property, repeat)),
    reverse: (id: Id, property: cmd.PropertyChoice) => void run(cmd.reverse(id, property)),

    /** AN8: the length, typed as frames or a time; the playhead stays inside it. */
    setLength(text: string): string | null {
      const length = parseFrame(text, present().stage.fps);
      if (length === null) return TYPE_TIME;
      const refused = edit(cmd.setLength(length));
      if (!refused) patch({ frame: clampFrame(store.get().frame) });
      return refused;
    },

    /** AN8: a new frame rate; with 'times' the playhead keeps its time too. */
    setFps(fps: number, keep: 'times' | 'frames'): string | null {
      const before = present().stage.fps;
      const refused = edit(cmd.setFps(fps, keep));
      if (!refused && keep === 'times')
        patch({ frame: clampFrame((store.get().frame * fps) / before) });
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

    /** Opens or closes a folder in the Layers panel: kept with the animation, not an undo step. */
    setFolderOpen(id: Id, open: boolean): void {
      store.update((s) => ({
        ...s,
        history: { ...s.history, present: setFolderOpenIn(s.history.present, id, open) },
      }));
    },

    dispose(): void {
      pause();
      clearInterval(timer);
    },
  };
}

export type AnimationApp = ReturnType<typeof createAnimationApp>;
