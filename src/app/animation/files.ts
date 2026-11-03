// Animation files (AN16, P2, P3): new, open (each picture checked, so it can be shown), save,
// save as, autosave and crash recovery, and Package Project for an animation.
import { createHistory } from '../history.ts';
import { createAnimation } from '../../core/animation/factory.ts';
import {
  animationFromDisk,
  animationToDisk,
  deserializeAnimation,
  serializeAnimation,
} from '../../core/animation/serialize.ts';
import type { AnimationDoc, Picture } from '../../core/animation/types.ts';
import type { AppPaths } from '../../core/ports.ts';
import { dirOf, fileNameOf, uniqueFileName } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';
import { isAnimationDirty } from './state.ts';

const DISCARD = 'You have unsaved animation work. Discard it and';

const recoveryPathOf = (paths: AppPaths): string =>
  paths.animationRecovery ?? paths.recovery.replace(/\.mve$/i, '') + '.mvea';

export function fileActions(ctx: AnimationContext) {
  const { store, patch, present, showError, pause, services } = ctx;
  const { dialogs, files, paths, engine } = services;
  const recovery = recoveryPathOf(paths);

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

  /**
   * AN5: opens a document after checking each picture, which also lets the page show it (the main
   * process serves only files it has checked). Pictures that have gone are named; the rest opens.
   */
  async function loadChecked(doc: AnimationDoc, path: string | null, saved?: AnimationDoc) {
    const missing = (
      await Promise.all(
        doc.pictures.map((p) =>
          engine.probe(p.path).then(
            () => null,
            () => fileNameOf(p.path),
          ),
        ),
      )
    ).filter((name) => name !== null);
    load(doc, path, saved);
    if (missing.length > 0)
      patch({
        message: {
          kind: 'error',
          text: `${missing.length === 1 ? 'This picture' : 'These pictures'} could not be found, so ${
            missing.length === 1 ? 'it is' : 'they are'
          } not shown: ${missing.join(', ')}. Put ${missing.length === 1 ? 'it' : 'them'} back beside the animation file and open it again.`,
        },
      });
  }

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
    const path = await dialogs.saveAnimation(ctx.fileBase());
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
  }, services.autosaveMs);
  (timer as { unref?: () => void }).unref?.();

  return {
    isDirty: () => isAnimationDirty(store.get()),

    /** The animation as its file text (for tests and the HTML export). */
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
          await dialogs.confirm('OneEditor closed before your animation was saved. Restore it?')
        ) {
          await loadChecked(lost, null, createAnimation({ name: 'Untitled' }));
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
        await loadChecked(doc, path);
      } catch (error) {
        showError(error);
      }
    },

    save,
    saveAs,

    /** P2: copies the animation and its pictures into one folder, to hand in or move. */
    async packageAnimation(): Promise<void> {
      const dir = await dialogs.chooseFolder('Choose an empty folder for the packaged animation');
      if (!dir) return;
      const doc = present();
      const name = ctx.fileBase();
      try {
        const used = new Set<string>();
        const pictures: Picture[] = [];
        for (const picture of doc.pictures) {
          const file = `${dir}/pictures/${uniqueFileName(fileNameOf(picture.path), used)}`;
          await files.copy(picture.path, file);
          pictures.push({ ...picture, path: file });
        }
        await files.write(
          `${dir}/${name}.mvea`,
          serializeAnimation(animationToDisk({ ...doc, pictures }, dir)),
        );
        patch({
          message: {
            kind: 'info',
            text: `Packaged into ${dir}. Open ${name}.mvea there on any computer.`,
          },
        });
      } catch (error) {
        showError(error);
      }
    },

    /** Stops the autosave (the player is stopped by the app). */
    stopAutosave: () => clearInterval(timer),
  };
}
