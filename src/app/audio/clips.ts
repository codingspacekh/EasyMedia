// Editing the sound (A5, A6): clips as on the video timeline (select, move, trim, split, join,
// delete), and the selected time as in Audacity (cut, copy, paste, delete, trim to selection,
// insert silence).
import {
  copyRange,
  deleteClips,
  deleteRange,
  insertSilence,
  joinClip,
  moveClip,
  paste,
  splitAt,
  trimClip,
  trimToSelection,
} from '../../core/audio/edit.ts';
import { EditError } from '../../core/model/errors.ts';
import { newId } from '../../core/model/factory.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { Id } from '../../core/model/types.ts';
import type { AudioContext } from './context.ts';
import { range } from './state.ts';

export function clipActions(ctx: AudioContext) {
  const { store, patch, doc, selection, showError, showProblem, tryEdit, run } = ctx;
  const { selectClipOnly, selectedClip } = ctx;
  return {
    // ---- clips, as on the video timeline ----

    /** Click a clip: it is selected (with its track and its time, for effects and Copy). */
    selectClip(id: Id): void {
      selectClipOnly(id);
    },

    /** Drag a clip along its track (the time shift tool of Audacity). */
    moveClip(id: Id, offset: Seconds): void {
      run('Move clip', (tx) => moveClip(tx, id, offset));
      selectClipOnly(id);
    },

    /**
     * A20: the clip starts at a typed time (Audio mode's side panel). Returns why it cannot,
     * such as another clip already there; nothing moves then.
     */
    setClipStart(id: Id, offset: Seconds): string | null {
      const problem = tryEdit(`Clip starts at ${offset.toFixed(2)} s`, (tx) =>
        moveClip(tx, id, offset),
      );
      if (!problem) selectClipOnly(id);
      return problem;
    },

    /** Drag a clip's start or end edge. */
    trimClip(id: Id, side: 'start' | 'end', time: Seconds): void {
      run(side === 'start' ? 'Trim clip start' : 'Trim clip end', (tx) =>
        trimClip(tx, id, side, time),
      );
      selectClipOnly(id);
    },

    /**
     * Split: at both ends of a selected range, or else at the playhead, on the selected clip's
     * track, the selected tracks, or every track when none is selected.
     */
    split(): void {
      const sel = selection();
      const clip = selectedClip();
      const tracks = clip
        ? [clip.track.id]
        : sel.tracks.length
          ? sel.tracks
          : doc().tracks.map((t) => t.id);
      if (!clip && sel.end > sel.start) {
        run(`Split at ${range(sel)}`, (tx) => {
          let made = 0;
          for (const at of [sel.start, sel.end]) {
            try {
              made += splitAt(tx, tracks, at, newId).length;
            } catch {
              // no clip at this end of the selection
            }
          }
          if (!made) throw new EditError('Select part of a clip to split it.');
        });
        return;
      }
      const at = store.get().position;
      run(`Split at ${at.toFixed(2)} s`, (tx) => splitAt(tx, tracks, at, newId));
      if (clip) selectClipOnly(clip.clip.id);
    },

    /** Join the selected clip with the clip right after it. */
    join(): void {
      const clip = selectedClip();
      run('Join clips', (tx) => {
        if (!clip) throw new EditError('Click a clip first, then Join joins it with the next one.');
        joinClip(tx, clip.clip.id);
      });
      if (clip) selectClipOnly(clip.clip.id);
    },

    /** Delete the selected clip (the gap stays, as on the video timeline). */
    deleteClip(): void {
      const id = store.get().clip;
      run('Delete clip', (tx) => deleteClips(tx, id ? [id] : []));
    },

    // ---- the selected time (A5, A6) ----

    cut(): void {
      const sel = selection();
      const selected = store.get().clip;
      try {
        const clip = copyRange(doc(), sel);
        // A selected clip is cut out of its track; its gap stays, as with Delete.
        if (selected) run('Cut clip', (tx) => deleteClips(tx, [selected]));
        else run(`Cut ${range(sel)}`, (tx) => deleteRange(tx, sel));
        if (!store.get().message) patch({ clipboard: clip });
      } catch (error) {
        showError(error);
      }
    },

    copy(): void {
      try {
        patch({ clipboard: copyRange(doc(), selection()), message: null });
      } catch (error) {
        showError(error);
      }
    },

    paste(): void {
      const { clipboard } = store.get();
      if (!clipboard) {
        showProblem('Copy or Cut some sound first, then paste it.');
        return;
      }
      const sel = selection();
      // On a selected clip, the copy goes in at the playhead (as in Video mode).
      const at = store.get().clip
        ? { ...sel, start: store.get().position, end: store.get().position }
        : sel;
      run(`Paste at ${at.start.toFixed(2)} s`, (tx) => paste(tx, at, clipboard, newId));
    },

    /** Delete key: the selected clip, or else the selected time. */
    deleteSelection(): void {
      if (store.get().clip) {
        run('Delete clip', (tx) => deleteClips(tx, [store.get().clip!]));
        return;
      }
      run(`Delete ${range(selection())}`, (tx) => deleteRange(tx, selection()));
    },

    trimToSelection: () =>
      run(`Trim to ${range(selection())}`, (tx) => trimToSelection(tx, selection())),

    /** Returns why it cannot be done, or null (for the Insert silence dialog). */
    insertSilence: (length: Seconds): string | null =>
      tryEdit(`Insert ${length.toFixed(2)} s of silence`, (tx) =>
        insertSilence(tx, selection(), length, newId),
      ),
  };
}
