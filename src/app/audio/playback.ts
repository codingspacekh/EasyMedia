// Playback and undo (A18): play the selection (looped if Loop is on) or from the playhead,
// pause, stop; undo and redo, which may first load a step kept on disk.
import { mixTracks } from '../../core/audio/edit.ts';
import { canRedoAudio, canUndoAudio } from '../../core/audio/history.ts';
import { toSamples } from '../../core/audio/pcm.ts';
import type { AudioContext } from './context.ts';
import { NOTHING } from './state.ts';

export function playbackActions(ctx: AudioContext) {
  const { services, store, patch, doc, selection, undoSteps } = ctx;
  const { audible, startPlaying, currentPosition, playedFrom } = ctx;
  const { output } = services;
  return {
    /** Undo / redo; a step kept on disk is loaded first (then the promise resolves). */
    undo: () => undoSteps.navigate('undo'),
    redo: () => undoSteps.navigate('redo'),

    /** Resolves when no disk work is waiting (for tests and before quitting). */
    settled: () => undoSteps.settled(),
    canUndo: () => canUndoAudio(store.get().history),
    canRedo: () => canRedoAudio(store.get().history),

    /** Plays the selection (looped if Loop is on), or from the playhead to the end. */
    play(): void {
      const tracks = audible();
      if (tracks.length === 0) {
        patch({ message: { kind: 'info', text: NOTHING } });
        return;
      }
      const sel = selection();
      // A selected clip plays from the playhead, as in Video mode; a selected range plays itself.
      const ranged = sel.end > sel.start && !store.get().clip;
      const from = ranged ? sel.start : store.get().position;
      const mix = mixTracks(doc(), tracks, { from }).channels;
      const n = ranged ? toSamples(sel.end - sel.start, doc().rate) : Infinity;
      const channels = mix.map((c) => (c.length > n ? c.subarray(0, n) : c));
      patch({ position: from });
      startPlaying(channels, from, ranged && store.get().loop);
    },

    pause(): void {
      const at = currentPosition();
      output.stop();
      patch({ playing: false, position: at });
    },

    /** Stops; the playhead goes back to where playing started. */
    stop(): void {
      output.stop();
      patch({ playing: false, position: playedFrom() });
    },

    toggleLoop: () => patch({ loop: !store.get().loop }),

    currentPosition,
  };
}
