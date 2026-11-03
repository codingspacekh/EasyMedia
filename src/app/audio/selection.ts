// The selection (A5): a time range on some tracks (as Audacity), and the playhead.
import { docDuration, type Selection } from '../../core/audio/edit.ts';
import { toSamples } from '../../core/audio/pcm.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { Id } from '../../core/model/types.ts';
import type { AudioContext } from './context.ts';

export function selectionActions(ctx: AudioContext) {
  const { patch, doc, selection } = ctx;
  return {
    /** A time range; the tracks stay selected unless others are given. No clip is selected. */
    select(change: Partial<Selection>): void {
      const next = { ...selection(), ...change };
      patch({
        clip: null,
        selection: {
          ...next,
          start: Math.max(0, Math.min(next.start, next.end)),
          end: Math.max(0, next.start, next.end),
        },
      });
    },

    selectAll(): void {
      const d = doc();
      patch({
        selection: { start: 0, end: docDuration(d), tracks: d.tracks.map((t) => t.id) },
        clip: null,
      });
    },

    /** Click on a track: select it (with Shift: add or remove it). */
    selectTrack(id: Id, extend = false): void {
      const { tracks } = selection();
      const next = !extend
        ? [id]
        : tracks.includes(id)
          ? tracks.filter((t) => t !== id)
          : doc()
              .tracks.map((t) => t.id)
              .filter((t) => t === id || tracks.includes(t));
      patch({ selection: { ...selection(), tracks: next }, clip: null });
    },

    /** For the Selection start box: a start after the end moves the end too. */
    setSelectionStart(start: Seconds): string | null {
      const sel = selection();
      patch({ selection: { ...sel, start, end: Math.max(sel.end, start) }, clip: null });
      return null;
    },

    /** For the Selection end box. */
    setSelectionEnd(end: Seconds): string | null {
      const sel = selection();
      if (end < sel.start) return 'The selection end must be after the selection start.';
      patch({ selection: { ...sel, end }, clip: null });
      return null;
    },

    /** Length and number of samples (per channel) of the selection, for the selection bar. */
    selectionInfo(): { length: Seconds; samples: number } {
      const { start, end } = selection();
      return { length: end - start, samples: toSamples(end - start, doc().rate) };
    },

    setPosition: (time: Seconds) => patch({ position: Math.max(0, time) }),
  };
}
