// Undo steps on disk (A18 + N4), as Audacity: big steps are moved to the UndoStore and loaded
// back for undo / redo, so memory does not grow with the history. Disk work runs one job at a
// time: moving new steps to disk, deleting steps nobody can reach any more, and loading a step
// back. Without an UndoStore, steps stay in memory.
import { redoAudio, undoAudio, type AudioHistory } from '../../core/audio/history.ts';
import {
  changeRefs,
  hasLooseSamples,
  historyRefs,
  loadChange,
  replaceChange,
  stashChange,
} from '../../core/audio/stored.ts';
import type { UndoStore } from '../../core/ports.ts';
import type { Store } from '../store.ts';
import { DISK_MIN_SAMPLES, type AudioState } from './state.ts';

export function createUndoSteps(store: Store<AudioState>, undoStore: UndoStore | undefined) {
  let work: Promise<void> = Promise.resolve();
  const serial = (job: () => Promise<void>): Promise<void> =>
    (work = work.then(job).catch(() => {}));

  async function moveStepsToDisk(): Promise<void> {
    const { history } = store.get();
    for (const step of [...history.past, ...history.future]) {
      if (!hasLooseSamples(step, DISK_MIN_SAMPLES)) continue;
      try {
        const stored = await stashChange(step, (c) => undoStore!.save(c), DISK_MIN_SAMPLES);
        store.update((s) => ({ ...s, history: replaceChange(s.history, step, stored) }));
      } catch {
        // the disk cannot be written: the step simply stays in memory
      }
    }
    await undoStore!.keepOnly(historyRefs(store.get().history)).catch(() => {});
  }

  /** After every change of the history: big new steps go to disk, unreachable ones are deleted. */
  function historyChanged(): void {
    if (undoStore) void serial(moveStepsToDisk);
  }

  if (undoStore) void serial(() => undoStore.keepOnly([])); // what an earlier session left behind

  /** Undo or redo; a step kept on disk is loaded first (then the promise resolves). */
  function navigate(direction: 'undo' | 'redo'): Promise<void> {
    const apply = direction === 'undo' ? undoAudio : redoAudio;
    const stepOf = (h: AudioHistory) => (direction === 'undo' ? h.past.at(-1) : h.future[0]);
    if (!undoStore) {
      store.update((s) => ({ ...s, history: apply(s.history) }));
      return Promise.resolve();
    }
    return serial(async () => {
      const step = stepOf(store.get().history);
      if (!step) return;
      let ready = step;
      if (changeRefs(step).length) {
        try {
          ready = await loadChange(step, (key) => undoStore.load(key));
        } catch {
          store.update((s) => ({
            ...s,
            message: {
              kind: 'error',
              text: 'This step could not be undone: its saved sound is missing.',
            },
          }));
          return;
        }
      }
      store.update((s) => {
        // An edit made while the step was loading means this undo / redo no longer applies.
        if (stepOf(s.history) !== step) return s;
        return { ...s, history: apply(replaceChange(s.history, step, ready)) };
      });
      historyChanged();
    });
  }

  /** Resolves when no disk work is waiting (for tests and before quitting). */
  async function settled(): Promise<void> {
    let current: Promise<void>;
    do {
      current = work;
      await current;
    } while (current !== work);
  }

  return { historyChanged, navigate, settled };
}
