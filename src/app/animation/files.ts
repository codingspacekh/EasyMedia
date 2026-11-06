// Animation files (AN16, P2, P3): new, open (each picture and sound checked, so it can be shown
// or heard: AN28), save, save as, autosave and crash recovery, and Package Project for an
// animation.
import { createHistory } from '../history.ts';
import { createAnimation } from '../../core/animation/factory.ts';
import {
  animationFromDisk,
  animationToDisk,
  deserializeAnimation,
  serializeAnimation,
} from '../../core/animation/serialize.ts';
import type { AnimSound, AnimationDoc, Picture } from '../../core/animation/types.ts';
import { soundEffect } from '../../core/audio/sound-effects.ts';
import type { AppPaths } from '../../core/ports.ts';
import { dirOf, fileNameOf, uniqueFileName } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';
import { saveSoundEffect } from './sounds.ts';
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

  /** The sentence naming the files that could not be found (pictures not shown, sounds not heard). */
  const notFound = (names: string[], what: 'picture' | 'sound', effect: string): string =>
    `${names.length === 1 ? `This ${what}` : `These ${what}s`} could not be found, so ${
      names.length === 1 ? 'it is' : 'they are'
    } not ${effect}: ${names.join(', ')}. Put ${names.length === 1 ? 'it' : 'them'} back beside the animation file and open it again.`;

  /**
   * AN28: each sound checked (which also lets the page play it); a built-in sound effect whose
   * file has gone (another computer) is made again (X8). The sounds not found are named.
   */
  async function checkSounds(doc: AnimationDoc): Promise<{ doc: AnimationDoc; missing: string[] }> {
    if (!doc.sounds) return { doc, missing: [] };
    const missing: string[] = [];
    const sounds = await Promise.all(
      doc.sounds.map(async (sound) => {
        try {
          await engine.probe(sound.path);
          return sound;
        } catch {
          if (sound.effect && soundEffect(sound.effect)) {
            const made = await saveSoundEffect(files, sound.effect).catch(() => null);
            if (made) return { ...sound, path: made.path };
          }
          missing.push(fileNameOf(sound.path));
          return sound;
        }
      }),
    );
    return { doc: { ...doc, sounds }, missing };
  }

  /**
   * AN5: opens a document after checking each picture, which also lets the page show it (the main
   * process serves only files it has checked). Pictures that have gone are named; the rest opens.
   * AN28: so are its sounds.
   */
  async function loadChecked(found: AnimationDoc, path: string | null, saved?: AnimationDoc) {
    const missing = (
      await Promise.all(
        found.pictures.map((p) =>
          engine.probe(p.path).then(
            () => null,
            () => fileNameOf(p.path),
          ),
        ),
      )
    ).filter((name) => name !== null);
    const checked = await checkSounds(found);
    // A sound effect made again here is where the animation now finds it: nothing to save.
    const doc = checked.doc;
    load(doc, path, saved ?? doc);
    const texts = [
      ...(missing.length ? [notFound(missing, 'picture', 'shown')] : []),
      ...(checked.missing.length ? [notFound(checked.missing, 'sound', 'heard')] : []),
    ];
    if (texts.length > 0) patch({ message: { kind: 'error', text: texts.join(' ') } });
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
        // AN28: the sound files too, sound effects included.
        const heard = new Set<string>();
        const sounds: AnimSound[] = [];
        for (const sound of doc.sounds ?? []) {
          const file = `${dir}/sounds/${uniqueFileName(fileNameOf(sound.path), heard)}`;
          await files.copy(sound.path, file);
          sounds.push({ ...sound, path: file });
        }
        const packed = { ...doc, pictures, ...(doc.sounds ? { sounds } : {}) };
        await files.write(`${dir}/${name}.mvea`, serializeAnimation(animationToDisk(packed, dir)));
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
