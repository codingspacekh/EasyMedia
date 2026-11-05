// What every part of Animation mode shares: the store, running a command as one undo step
// (refused edits become a message, or a reason for the field that asked), the player (an edit
// pauses it), and small questions about the selection and the current layer. Each feature
// (files, exporting, pictures, drawing, timeline, document) is a module taking this context.
import type * as cmd from '../animation-commands.ts';
import { createHistory, execute } from '../history.ts';
import { createStore, type Store } from '../store.ts';
import { createAnimation } from '../../core/animation/factory.ts';
import { isShown } from '../../core/animation/frames.ts';
import type { AnimationDoc, Id, Layer } from '../../core/animation/types.ts';
import { EditError, MediaError, ProjectFileError } from '../../core/model/errors.ts';
import type { PageAssets, StageRenderer } from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AnimationDeps, AnimationState } from './state.ts';
import { unexpected } from '../problems.ts';

export { UNEXPECTED } from '../problems.ts';

const NO_RENDERER: StageRenderer = {
  renderPng: () => Promise.reject(new EditError('Exporting needs the OneEditor app.')),
  pixels: () => Promise.reject(new EditError('Tracing needs the OneEditor app.')),
  textTops: async () => ({}), // the SVG then keeps the font's own top edge
};
const NO_PAGE_ASSETS: PageAssets = {
  playerScript: () => Promise.reject(new EditError('Exporting needs the OneEditor app.')),
  pictureDataUrl: () => Promise.reject(new EditError('Exporting needs the OneEditor app.')),
  fontDataUrl: () => Promise.reject(new EditError('Exporting needs the OneEditor app.')),
  openTest: () => Promise.reject(new EditError('Testing needs the OneEditor app.')),
};

/** The playback clock ticks this often; the frame follows the time, so slow laptops drop frames. */
const TICK_MS = 10;

export function createAnimationContext(deps: AnimationDeps) {
  const services = {
    ...deps,
    renderer: deps.renderer ?? NO_RENDERER,
    pageAssets: deps.pageAssets ?? NO_PAGE_ASSETS,
    autosaveMs: deps.autosaveMs ?? 60_000,
  };
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
    onionSkin: false,
    exporting: null,
    busy: null,
    message: null,
  });
  const patch = (change: Partial<AnimationState>) => store.update((s) => ({ ...s, ...change }));
  const present = (): AnimationDoc => store.get().history.present;

  function showError(error: unknown): void {
    const known =
      error instanceof EditError ||
      error instanceof MediaError ||
      error instanceof ProjectFileError;
    patch({
      message: { kind: 'error', text: known ? (error as Error).message : unexpected(error) },
    });
  }

  // ---- the player (AN8) ----

  let player: ReturnType<typeof setInterval> | null = null;

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

  // ---- running commands ----

  /** Applies a command as one undo step; a refused edit becomes a message. True when applied. */
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
      return error instanceof EditError ? error.message : unexpected(error);
    }
  }

  // ---- questions the features ask ----

  return {
    services,
    store,
    patch,
    present,
    showError,
    play,
    pause,
    run,
    edit,
    /** The selected objects still there and on the stage at the playhead (AN14: in its drawing). */
    liveSelection: (): Id[] =>
      store.get().selection.filter((id) => isShown(present(), id, store.get().frame)),
    /** The layer new objects go on. */
    currentLayer: (): Layer | undefined =>
      present().layers.find((l) => l.id === store.get().layerId),
    /** A frame kept inside the animation (the end shows the last pose). */
    clampFrame: (frame: number): number =>
      Math.max(0, Math.min(present().stage.length, Math.round(frame))),
    /** The animation's name for files: its file's name, or the document's name if never saved. */
    fileBase: (): string => {
      const { path } = store.get();
      return path ? fileNameOf(path).replace(/\.mvea$/i, '') : present().name;
    },
  };
}

export type AnimationContext = ReturnType<typeof createAnimationContext>;
