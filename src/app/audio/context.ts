// What every part of Audio mode shares: the store, running an edit as one undo step (a refusal
// becomes a message, or a reason for the dialog that asked), the undo steps on disk, questions
// about the selection and what is heard, and the speakers (where playing started, to follow the
// playhead). Each feature (tracks, clips, selection, session, recording, effects, playback,
// exporting) is a module taking this context.
import { findClip, soundIn, type Selection } from '../../core/audio/edit.ts';
import { createAudioHistory, editAudio, type AudioEdit } from '../../core/audio/history.ts';
import { clipEnd, emptyDoc, type AudioTrack, type Channels } from '../../core/audio/pcm.ts';
import { EditError, MediaError, MicrophoneError } from '../../core/model/errors.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { Id } from '../../core/model/types.ts';
import { createStore, type Store } from '../store.ts';
import type { AudioDeps, AudioState } from './state.ts';
import { unexpected } from '../problems.ts';
import { createUndoSteps } from './undo-steps.ts';

export function createAudioContext(services: AudioDeps) {
  const { output } = services;
  const store: Store<AudioState> = createStore<AudioState>({
    history: createAudioHistory(emptyDoc()),
    selection: { start: 0, end: 0, tracks: [] },
    clip: null,
    position: 0,
    clipboard: null,
    playing: false,
    loop: false,
    muted: [],
    solo: [],
    busy: null,
    exporting: { state: 'idle' },
    message: null,
    recording: null,
    noiseProfile: null,
  });
  const patch = (change: Partial<AudioState>) => store.update((s) => ({ ...s, ...change }));
  const doc = () => store.get().history.present;
  const selection = (): Selection => store.get().selection;

  const errorText = (error: unknown) =>
    error instanceof EditError || error instanceof MediaError || error instanceof MicrophoneError
      ? error.message
      : unexpected(error);
  const showError = (error: unknown) =>
    patch({ message: { kind: 'error', text: errorText(error) } });
  const showProblem = (text: string) => patch({ message: { kind: 'error', text } });

  const undoSteps = createUndoSteps(store, services.undoStore);

  // ---- running edits ----

  /** Runs an edit as one undoable step; returns why it was refused, or null. */
  function tryEdit(label: string, edit: (tx: AudioEdit) => void): string | null {
    try {
      const before = store.get().history;
      const history = editAudio(before, label, edit);
      const ids = new Set(history.present.tracks.map((t) => t.id));
      store.update((s) => ({
        ...s,
        history,
        selection: { ...s.selection, tracks: s.selection.tracks.filter((id) => ids.has(id)) },
        clip: s.clip && findClip(history.present, s.clip) ? s.clip : null,
        message: null,
      }));
      if (history !== before) undoSteps.historyChanged();
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  /** Like tryEdit, but a refusal is shown in the status bar (toolbar buttons, menus). */
  function run(label: string, edit: (tx: AudioEdit) => void): void {
    const problem = tryEdit(label, edit);
    if (problem) showProblem(problem);
  }

  // ---- the selection ----

  function selectOnly(id: Id): void {
    patch({ selection: { ...selection(), tracks: [id] }, clip: null });
  }

  /** Selects a clip: its track, and its time as the selection (for effects, Cut and Copy). */
  function selectClipOnly(id: Id): void {
    const found = findClip(doc(), id);
    if (!found) return;
    const { track, clip } = found;
    patch({
      clip: id,
      selection: { start: clip.offset, end: clipEnd(clip, doc().rate), tracks: [track.id] },
    });
  }

  /** The selected clip, with its track, if it is still there. */
  const selectedClip = () => {
    const id = store.get().clip;
    return id ? findClip(doc(), id) : null;
  };

  /** The tracks that are heard: the solo ones if any, else all that are not muted. */
  function audible(): AudioTrack[] {
    const { muted, solo } = store.get();
    const tracks = doc().tracks.filter((t) => t.clips.length > 0);
    return solo.length
      ? tracks.filter((t) => solo.includes(t.id))
      : tracks.filter((t) => !muted.includes(t.id));
  }

  /** The selected sound of every selected track (for effect suggestions, warnings, notes). */
  function selectedSound(): Channels {
    const sel = selection();
    const { rate } = doc();
    return doc().tracks.flatMap((t) => {
      if (!sel.tracks.includes(t.id)) return [];
      return soundIn(t, rate, sel) ?? [];
    });
  }

  // ---- the speakers ----
  // Where playing started and how long it lasts, to follow the playhead.
  let played = { from: 0, length: 0, loop: false };

  function startPlaying(channels: Channels, from: Seconds, loop: boolean): void {
    output.stop();
    played = { from, length: (channels[0]?.length ?? 0) / doc().rate, loop };
    output.play(
      { sampleRate: doc().rate, channels },
      {
        loop,
        onEnded: () => {
          if (store.get().playing) patch({ playing: false });
        },
      },
    );
    patch({ playing: true });
  }

  function currentPosition(): Seconds {
    const s = store.get();
    if (!s.playing) return s.position;
    const t = output.elapsed();
    const into = played.loop && played.length > 0 ? t % played.length : Math.min(t, played.length);
    return played.from + into;
  }

  return {
    services,
    store,
    patch,
    doc,
    selection,
    errorText,
    showError,
    showProblem,
    undoSteps,
    tryEdit,
    run,
    selectOnly,
    selectClipOnly,
    selectedClip,
    audible,
    selectedSound,
    startPlaying,
    currentPosition,
    /** Where the last playing started (Stop goes back there). */
    playedFrom: () => played.from,
  };
}

export type AudioContext = ReturnType<typeof createAudioContext>;
