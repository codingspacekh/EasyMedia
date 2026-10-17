// Audio mode use cases (A1–A8, A15–A18): what every button and menu item in Audio mode does.
// The sound lives in memory as samples (core/audio); every edit is one undoable step (Memento,
// P5). Errors never escape: they become a message for the student.
import { createStore, type Store } from './store.ts';
import {
  alignEndToEnd,
  alignStartTo,
  applyToSelection,
  copyRange,
  deleteRange,
  docDuration,
  insertSilence,
  mixAndRender,
  mixTracks,
  moveTrackBy,
  paste,
  rangeIn,
  stereoToMonoTracks,
  trimToSelection,
  type AudioClip,
  type Selection,
} from '../core/audio/edit.ts';
import {
  canRedoAudio,
  canUndoAudio,
  createAudioHistory,
  editAudio,
  redoAudio,
  undoAudio,
  type AudioEdit,
  type AudioHistory,
} from '../core/audio/history.ts';
import {
  createTrack,
  emptyDoc,
  silence,
  sliceChannels,
  toSamples,
  trackLength,
  type AudioTrack,
  type Channels,
} from '../core/audio/pcm.ts';
import { noiseProfile, type NoiseProfile } from '../core/audio/dsp/noise.ts';
import { changeSpeed } from '../core/audio/dsp/speed.ts';
import { COUNT_IN_SECONDS } from '../core/audio/recording.ts';
import { audioEffectById, defaultParams, validateParams } from '../core/effects/registry.ts';
import type { EffectContext, Params } from '../core/effects/types.ts';
import { EditError, JobCancelledError, MediaError, MicrophoneError } from '../core/model/errors.ts';
import { newId } from '../core/model/factory.ts';
import type { Seconds } from '../core/model/time.ts';
import type { Id } from '../core/model/types.ts';
import type {
  Dialogs,
  MediaEngine,
  Microphone,
  MicrophoneInput,
  Recorder,
  UndoStore,
} from '../core/ports.ts';
import {
  changeRefs,
  hasLooseSamples,
  historyRefs,
  loadChange,
  replaceChange,
  stashChange,
} from '../core/audio/stored.ts';
import {
  AUDIO_FORMATS,
  estimateAudioSize,
  validateAudioExport,
  wavBytes,
  type AudioExportSettings,
} from '../core/render/audio-formats.ts';
import { fileNameOf } from '../core/project/relocate.ts';

/** Plays samples through the speakers (Web Audio in the app, a fake in tests). */
export interface AudioOutput {
  play(
    audio: { sampleRate: number; channels: Channels },
    options: { loop: boolean; onEnded: () => void },
  ): void;
  stop(): void;
  /** Seconds played since `play`. */
  elapsed(): number;
}

export type AudioExportState =
  | { state: 'idle' }
  | { state: 'running'; progress: number; output: string }
  | { state: 'done'; output: string }
  | { state: 'failed'; message: string };

/** A14: the recording panel (design screen 15). */
export interface RecordingState {
  /** opening the microphone; ready: listening for the level; count-in: 3, 2, 1; recording. */
  phase: 'opening' | 'ready' | 'count-in' | 'recording';
  microphones: readonly Microphone[];
  microphoneId: string | null;
  /** The open microphone's name. */
  label: string;
  /** The loudest sample just heard (0 to 1), held for a moment, for the level meter. */
  level: number;
  /** Seconds left in the count-in. */
  countdown: number;
  /** Seconds recorded so far. */
  elapsed: Seconds;
  /** Play the other tracks while recording (overdubbing). */
  overdub: boolean;
  countIn: boolean;
}

export interface AudioState {
  history: AudioHistory;
  selection: Selection;
  /** Audio position: where playing starts (the playhead). */
  position: Seconds;
  clipboard: AudioClip | null;
  playing: boolean;
  /** Loop the selection while playing (A18). */
  loop: boolean;
  /** Mute and solo only change what is heard; they are not edits. */
  muted: readonly Id[];
  solo: readonly Id[];
  /** What the app is busy with, e.g. "Opening music.mp3…". */
  busy: string | null;
  exporting: AudioExportState;
  message: { kind: 'error' | 'info'; text: string } | null;
  /** A14: the recording panel, while it is open. */
  recording: RecordingState | null;
  /** A13 step 1: the noise measured for Noise reduction (not an edit, so not undone). */
  noiseProfile: { start: Seconds; end: Seconds; profile: NoiseProfile } | null;
}

export interface AudioDeps {
  engine: MediaEngine;
  dialogs: Pick<Dialogs, 'openMedia' | 'exportAudio'>;
  output: AudioOutput;
  /** Keeps undo steps on disk (as Audacity). Without it they stay in memory. */
  undoStore?: UndoStore;
  /** A14: the microphone. Without it, recording is not offered. */
  recorder?: Recorder;
}

/** Undo steps with at least this many samples (all channels) go to disk: about 1 s of mono. */
export const DISK_MIN_SAMPLES = 44100;

/** The level meter falls back by this factor each second (20 dB). */
const LEVEL_FALL_PER_SECOND = 0.1;
const DEFAULT_MIC_RATE = 48000;

/** How much of the selection an effect's Preview plays (as Audacity). */
export const PREVIEW_SECONDS = 6;
const UNEXPECTED = 'Something went wrong. Please try again.';
const NOTHING = 'Import a sound first (Import audio, or Tracks ▸ Import audio as new track).';

const range = (s: Pick<Selection, 'start' | 'end'>) =>
  `${s.start.toFixed(2)} – ${s.end.toFixed(2)} s`;
const baseName = (path: string) => fileNameOf(path).replace(/\.[^.]+$/, '');

/** A silent output, for when no speakers are wired up. */
export const SILENT_OUTPUT: AudioOutput = { play: () => {}, stop: () => {}, elapsed: () => 0 };

export function createAudioApp({ engine, dialogs, output, undoStore, recorder }: AudioDeps) {
  const store: Store<AudioState> = createStore<AudioState>({
    history: createAudioHistory(emptyDoc()),
    selection: { start: 0, end: 0, tracks: [] },
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
  const selection = () => store.get().selection;

  const errorText = (error: unknown) =>
    error instanceof EditError || error instanceof MediaError || error instanceof MicrophoneError
      ? error.message
      : UNEXPECTED;
  const showError = (error: unknown) =>
    patch({ message: { kind: 'error', text: errorText(error) } });

  // ---- undo steps on disk (A18 + N4) ----
  // Disk work runs one job at a time: moving new steps to disk, deleting steps nobody can
  // reach any more, and loading a step back for undo / redo.
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

  function navigate(direction: 'undo' | 'redo'): Promise<void> {
    const apply = direction === 'undo' ? undoAudio : redoAudio;
    const stepOf = (h: AudioHistory) => (direction === 'undo' ? h.past.at(-1) : h.future[0]);
    if (!undoStore) {
      patch({ history: apply(store.get().history) });
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
          patch({
            message: {
              kind: 'error',
              text: 'This step could not be undone: its saved sound is missing.',
            },
          });
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
        message: null,
      }));
      if (history !== before) historyChanged();
      return null;
    } catch (error) {
      return errorText(error);
    }
  }

  /** Like tryEdit, but a refusal is shown in the status bar (toolbar buttons, menus). */
  function run(label: string, edit: (tx: AudioEdit) => void): void {
    const problem = tryEdit(label, edit);
    if (problem) patch({ message: { kind: 'error', text: problem } });
  }

  function selectOnly(id: Id): void {
    patch({ selection: { ...selection(), tracks: [id] } });
  }

  /** The tracks that are heard: the solo ones if any, else all that are not muted. */
  function audible(): AudioTrack[] {
    const { muted, solo } = store.get();
    const tracks = doc().tracks.filter((t) => trackLength(t) > 0);
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
      const r = rangeIn(t, rate, sel);
      return r ? sliceChannels(t.channels, r.from, r.to) : [];
    });
  }

  // Playback: where it started and how long it lasts, to follow the playhead.
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

  const playingNow = () => store.get().playing;

  function currentPosition(): Seconds {
    const s = store.get();
    if (!s.playing) return s.position;
    const t = output.elapsed();
    const into = played.loop && played.length > 0 ? t % played.length : Math.min(t, played.length);
    return played.from + into;
  }

  const stopListening = engine.onJobEvent((e) => {
    const ex = store.get().exporting;
    if (e.type === 'progress' && exportJob?.id === e.jobId && ex.state === 'running')
      patch({ exporting: { ...ex, progress: e.ratio } });
  });
  let exportJob: { id: string; cancel(): void } | null = null;

  /** The mix that is exported: everything heard, from 0 s to the end. */
  function exportMix(channels: number) {
    return mixTracks(doc(), audible(), { from: 0, channels });
  }

  // ---- recording (A14) ----
  let microphone: MicrophoneInput | null = null;
  let kept: Float32Array[] = [];
  let recordAt: Seconds = 0;
  let countdownTimer: ReturnType<typeof setTimeout> | null = null;
  const recording = () => store.get().recording;
  const patchRecording = (change: Partial<RecordingState>) =>
    store.update((s) => (s.recording ? { ...s, recording: { ...s.recording, ...change } } : s));

  function heard(block: Float32Array): void {
    // The meter holds a peak and falls back 20 dB a second, so pauses between words do not
    // make it look as if nothing is heard.
    const seconds = block.length / (microphone?.sampleRate ?? DEFAULT_MIC_RATE);
    let level = (recording()?.level ?? 0) * LEVEL_FALL_PER_SECOND ** seconds;
    for (let i = 0; i < block.length; i++) level = Math.max(level, Math.abs(block[i]!));
    if (recording()?.phase !== 'recording') return patchRecording({ level });
    kept.push(block.slice());
    const samples = kept.reduce((n, b) => n + b.length, 0);
    patchRecording({ level, elapsed: samples / (microphone?.sampleRate ?? 1) });
  }

  async function openMicrophone(id: string | null): Promise<boolean> {
    microphone?.close();
    microphone = null;
    try {
      microphone = await recorder!.open(id, heard);
      return true;
    } catch (error) {
      store.update((s) => ({ ...s, recording: null }));
      showError(error);
      return false;
    }
  }

  function stopCountdown(): void {
    if (countdownTimer) clearTimeout(countdownTimer);
    countdownTimer = null;
  }

  function beginKeeping(): void {
    kept = [];
    recordAt = store.get().position;
    patchRecording({ phase: 'recording', elapsed: 0, countdown: 0 });
    const others = audible();
    if (recording()?.overdub && others.length) {
      startPlaying(mixTracks(doc(), others, { from: recordAt }).channels, recordAt, false);
    }
  }

  function tick(): void {
    const left = (recording()?.countdown ?? 0) - 1;
    if (left <= 0) {
      countdownTimer = null;
      beginKeeping();
    } else {
      patchRecording({ countdown: left });
      countdownTimer = setTimeout(tick, 1000);
    }
  }

  function closeMicrophone(): void {
    stopCountdown();
    microphone?.close();
    microphone = null;
    kept = [];
    store.update((s) => ({ ...s, recording: null }));
  }

  /** Applies an effect to the selection; returns why it cannot, or null. */
  const effectContext = (): EffectContext => ({
    noiseProfile: store.get().noiseProfile?.profile ?? null,
  });

  function applyEffect(id: string, params: Params): string | null {
    const def = audioEffectById(id);
    if (!def) return 'This effect is not available in this version of EasyMedia.';
    const sel = selection();
    return tryEdit(`${def.label.replace('…', '')} ${range(sel)}`, (tx) => {
      validateParams(def, params);
      def.check?.(selectedSound(), params);
      applyToSelection(tx, sel, (channels, rate) =>
        def.process(channels, rate, params, effectContext()),
      );
    });
  }

  return {
    store,

    /** A1, A2: opens sound files (or the sound of video files), each as a new track. */
    async importAudio(): Promise<void> {
      const paths = await dialogs.openMedia();
      for (const path of paths) {
        const name = fileNameOf(path);
        patch({ busy: `Opening ${name}…` });
        try {
          const info = await engine.probe(path);
          if (!info.audio) throw new MediaError(`${name} has no sound to edit.`);
          const first = doc().tracks.length === 0;
          const decoded = await engine.decodeAudio(path, first ? undefined : doc().rate);
          const id = newId();
          run(`Import ${name}`, (tx) => {
            if (first && tx.doc.rate !== decoded.sampleRate) tx.setRate(decoded.sampleRate);
            tx.addTrack(
              createTrack({
                id,
                name: baseName(path),
                channels: decoded.channels,
                ...(decoded.bits ? { bits: decoded.bits } : {}),
              }),
            );
          });
          selectOnly(id);
        } catch (error) {
          showError(error);
        } finally {
          patch({ busy: null });
        }
      }
    },

    /** A2 Add new track: an empty mono or stereo track to paste or record into. */
    addTrack(channels: 1 | 2): void {
      const id = newId();
      const name = `Audio track ${doc().tracks.length + 1}`;
      run('Add new track', (tx) =>
        tx.addTrack(createTrack({ id, name, channels: silence(0, channels) })),
      );
      selectOnly(id);
    },

    removeTracks(): void {
      const ids = selection().tracks;
      run('Remove track', (tx) => {
        if (ids.length === 0) throw new EditError('Select a track first: click on its waveform.');
        for (const id of ids) tx.removeTrack(id);
      });
    },

    /** A2 Move track up (−1) or down (+1). */
    moveTrack(delta: -1 | 1): void {
      const [id] = selection().tracks;
      if (!id) {
        patch({ message: { kind: 'error', text: 'Select a track first: click on its waveform.' } });
        return;
      }
      run(delta < 0 ? 'Move track up' : 'Move track down', (tx) => moveTrackBy(tx, id, delta));
    },

    alignEndToEnd: () => run('Align end to end', (tx) => alignEndToEnd(tx, selection().tracks)),

    /** A2 Align start to the cursor (selection start) or to zero. */
    alignStart(to: 'cursor' | 'zero'): void {
      const time = to === 'zero' ? 0 : selection().start;
      run(`Align start to ${time.toFixed(2)} s`, (tx) =>
        alignStartTo(tx, selection().tracks, time),
      );
    },

    /** A2 time-shift tool: drag a track to start at another time. */
    timeShift(id: Id, offset: Seconds): void {
      const rate = doc().rate;
      run('Time shift', (tx) =>
        tx.setMeta(id, { offset: toSamples(Math.max(0, offset), rate) / rate }),
      );
    },

    setTrack(id: Id, change: Partial<Pick<AudioTrack, 'name' | 'gain' | 'pan'>>): void {
      run('Track settings', (tx) => tx.setMeta(id, change));
    },

    toggleMute(id: Id): void {
      const { muted } = store.get();
      patch({ muted: muted.includes(id) ? muted.filter((m) => m !== id) : [...muted, id] });
    },

    toggleSolo(id: Id): void {
      const { solo } = store.get();
      patch({ solo: solo.includes(id) ? solo.filter((m) => m !== id) : [...solo, id] });
    },

    /** A15 Mix stereo down to mono. */
    stereoToMono: () =>
      run('Mix stereo down to mono', (tx) => stereoToMonoTracks(tx, selection().tracks)),

    /** A6 Mix and render the selected tracks (to a new track: the originals stay). */
    mixAndRender(newTrack = false): void {
      const id = newId();
      const before = doc();
      run(newTrack ? 'Mix and render to new track' : 'Mix and render', (tx) =>
        mixAndRender(tx, selection().tracks, { id, name: 'Mix', newTrack }),
      );
      if (doc() !== before) selectOnly(id);
    },

    // ---- selection (A5) ----

    /** A time range; the tracks stay selected unless others are given. */
    select(change: Partial<Selection>): void {
      const next = { ...selection(), ...change };
      patch({
        selection: {
          ...next,
          start: Math.max(0, Math.min(next.start, next.end)),
          end: Math.max(0, next.start, next.end),
        },
      });
    },

    selectAll(): void {
      const d = doc();
      patch({ selection: { start: 0, end: docDuration(d), tracks: d.tracks.map((t) => t.id) } });
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
      patch({ selection: { ...selection(), tracks: next } });
    },

    /** For the Selection start box: a start after the end moves the end too. */
    setSelectionStart(start: Seconds): string | null {
      const sel = selection();
      patch({ selection: { ...sel, start, end: Math.max(sel.end, start) } });
      return null;
    },

    /** For the Selection end box. */
    setSelectionEnd(end: Seconds): string | null {
      const sel = selection();
      if (end < sel.start) return 'The selection end must be after the selection start.';
      patch({ selection: { ...sel, end } });
      return null;
    },

    /** Length and number of samples (per channel) of the selection, for the selection bar. */
    selectionInfo(): { length: Seconds; samples: number } {
      const { start, end } = selection();
      return { length: end - start, samples: toSamples(end - start, doc().rate) };
    },

    setPosition: (time: Seconds) => patch({ position: Math.max(0, time) }),

    // ---- editing (A5, A6) ----

    cut(): void {
      const sel = selection();
      try {
        const clip = copyRange(doc(), sel);
        run(`Cut ${range(sel)}`, (tx) => deleteRange(tx, sel));
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
        patch({
          message: { kind: 'error', text: 'Copy or Cut some sound first, then paste it.' },
        });
        return;
      }
      run(`Paste at ${selection().start.toFixed(2)} s`, (tx) => paste(tx, selection(), clipboard));
    },

    deleteSelection: () =>
      run(`Delete ${range(selection())}`, (tx) => deleteRange(tx, selection())),

    trimToSelection: () =>
      run(`Trim to ${range(selection())}`, (tx) => trimToSelection(tx, selection())),

    /** Returns why it cannot be done, or null (for the Insert silence dialog). */
    insertSilence: (length: Seconds): string | null =>
      tryEdit(`Insert ${length.toFixed(2)} s of silence`, (tx) =>
        insertSilence(tx, selection(), length),
      ),

    // ---- recording (A14, X4) ----

    /** Whether this app can record (it has a microphone port). */
    canRecord: recorder !== undefined,

    /** Opens the recording panel: the default microphone, for the level meter. */
    async openRecorder(): Promise<void> {
      if (!recorder || recording()) return;
      let microphones: Microphone[] = [];
      try {
        microphones = await recorder.microphones();
      } catch {
        // the list stays empty; opening the default microphone may still work
      }
      store.update((s) => ({
        ...s,
        message: null,
        recording: {
          phase: 'opening',
          microphones,
          microphoneId: microphones[0]?.id ?? null,
          label: '',
          level: 0,
          countdown: 0,
          elapsed: 0,
          overdub: true,
          countIn: true,
        },
      }));
      if (await openMicrophone(recording()?.microphoneId ?? null))
        patchRecording({ phase: 'ready', label: microphone!.label });
    },

    async chooseMicrophone(id: string): Promise<void> {
      if (recording()?.phase !== 'ready') return;
      patchRecording({ phase: 'opening', microphoneId: id, level: 0 });
      if (await openMicrophone(id)) patchRecording({ phase: 'ready', label: microphone!.label });
    },

    setRecordingOptions(change: Partial<Pick<RecordingState, 'overdub' | 'countIn'>>): void {
      patchRecording(change);
    },

    /** Starts recording at the playhead, after the count-in if it is on. */
    startRecording(): void {
      const r = recording();
      if (!r || r.phase !== 'ready' || !microphone) return;
      if (playingNow()) {
        output.stop();
        patch({ playing: false });
      }
      if (!r.countIn) return beginKeeping();
      patchRecording({ phase: 'count-in', countdown: COUNT_IN_SECONDS });
      countdownTimer = setTimeout(tick, 1000);
    },

    /** Stops: what was recorded becomes a new mono track at the playhead (one undo step). */
    stopRecording(): void {
      const r = recording();
      if (!r) return;
      if (r.phase === 'recording' && store.get().playing) {
        output.stop();
        patch({ playing: false });
      }
      const rate = microphone?.sampleRate ?? doc().rate;
      const length = kept.reduce((n, b) => n + b.length, 0);
      const samples = new Float32Array(length);
      let at = 0;
      for (const b of kept) {
        samples.set(b, at);
        at += b.length;
      }
      const wasRecording = r.phase === 'recording';
      closeMicrophone();
      if (!wasRecording || length === 0) return;
      const first = doc().tracks.length === 0;
      // A microphone at another rate is resampled to the project's (it plays at the same pitch).
      const channels =
        first || rate === doc().rate ? [samples] : changeSpeed([samples], rate / doc().rate);
      const id = newId();
      const taken = Math.max(
        0,
        ...doc().tracks.map((t) => Number(/^Recording (\d+)$/.exec(t.name)?.[1] ?? 0)),
      );
      run(`Record ${(length / rate).toFixed(2)} s`, (tx) => {
        if (first && tx.doc.rate !== rate) tx.setRate(rate);
        tx.addTrack({
          ...createTrack({ id, name: `Recording ${taken + 1}`, channels }),
          offset: recordAt,
        });
      });
      selectOnly(id);
    },

    /** Closes the panel without keeping anything. */
    closeRecorder(): void {
      if (recording()?.phase === 'recording' && store.get().playing) {
        output.stop();
        patch({ playing: false });
      }
      closeMicrophone();
    },

    // ---- effects (registry, P6 / P7) ----

    /** The settings a dialog opens with: the defaults, adjusted to the selected sound. */
    effectSettings(id: string): Params {
      const def = audioEffectById(id);
      if (!def) return {};
      const params = defaultParams(def);
      const sound = selectedSound();
      return def.suggest && sound.length ? def.suggest(sound, params) : params;
    },

    /** The selected sound in `count` blocks, each as its peak level in dB (silence: −60). */
    selectionLevels(count: number): number[] {
      const sound = selectedSound();
      const n = sound[0]?.length ?? 0;
      if (!n) return [];
      return Array.from({ length: count }, (_, b) => {
        const from = Math.floor((b * n) / count);
        const to = Math.max(from + 1, Math.floor(((b + 1) * n) / count));
        let most = 0;
        for (const c of sound)
          for (let i = from; i < Math.min(to, n); i++) most = Math.max(most, Math.abs(c[i]!));
        return Math.max(-60, 20 * Math.log10(most || 1e-6));
      });
    },

    /** The line under the settings: a warning or what will happen. */
    effectNote(id: string, params: Params): string | null {
      const def = audioEffectById(id);
      const sound = selectedSound();
      return def?.note && sound.length ? def.note(sound, doc().rate, params) : null;
    },

    applyEffect,

    /** A13 step 1: measures the selected background noise for Noise reduction. */
    getNoiseProfile(): string | null {
      const sel = selection();
      const sound = selectedSound();
      if (sel.end <= sel.start || !sound.length)
        return 'Select a part with only background noise first, then click Get noise profile.';
      try {
        const profile = noiseProfile(sound, doc().rate);
        patch({
          noiseProfile: { start: sel.start, end: sel.end, profile },
          message: {
            kind: 'info',
            text: `Noise profile taken from ${range(sel)}. Now select the sound to clean (Ctrl/Cmd + A for all) and open Noise reduction again.`,
          },
        });
        return null;
      } catch (error) {
        return errorText(error);
      }
    },

    /** For menu items without settings (Fade in, Fade out): a refusal goes to the status bar. */
    applyNow(id: string): void {
      const problem = applyEffect(id, {});
      if (problem) patch({ message: { kind: 'error', text: problem } });
    },

    /** A18 Preview: plays the effect on the start of the selection, without changing anything. */
    previewEffect(id: string, params: Params): string | null {
      const def = audioEffectById(id);
      if (!def) return 'This effect is not available in this version of EasyMedia.';
      const sel = selection();
      const short = { ...sel, end: Math.min(sel.end, sel.start + PREVIEW_SECONDS) };
      const track = doc().tracks.find(
        (t) => sel.tracks.includes(t.id) && rangeIn(t, doc().rate, short),
      );
      if (!track) return 'Select some sound first.';
      try {
        validateParams(def, params);
        const r = rangeIn(track, doc().rate, short)!;
        const processed = def.process(
          sliceChannels(track.channels, r.from, r.to),
          doc().rate,
          params,
          effectContext(),
        );
        startPlaying(processed, sel.start, false);
        return null;
      } catch (error) {
        return errorText(error);
      }
    },

    // ---- undo (A18) ----

    /** Undo / redo; a step kept on disk is loaded first (then the promise resolves). */
    undo: () => navigate('undo'),
    redo: () => navigate('redo'),

    /** Resolves when no disk work is waiting (for tests and before quitting). */
    async settled(): Promise<void> {
      let current: Promise<void>;
      do {
        current = work;
        await current;
      } while (current !== work);
    },
    canUndo: () => canUndoAudio(store.get().history),
    canRedo: () => canRedoAudio(store.get().history),

    // ---- playback (A18) ----

    /** Plays the selection (looped if Loop is on), or from the playhead to the end. */
    play(): void {
      const tracks = audible();
      if (tracks.length === 0) {
        patch({ message: { kind: 'info', text: NOTHING } });
        return;
      }
      const sel = selection();
      const ranged = sel.end > sel.start;
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
      patch({ playing: false, position: played.from });
    },

    toggleLoop: () => patch({ loop: !store.get().loop }),

    currentPosition,

    // ---- export (A16, A17) ----

    /** What the export dialog shows before exporting. */
    exportSummary(settings: AudioExportSettings) {
      const duration = audible().length ? docDuration({ ...doc(), tracks: audible() }) : 0;
      return {
        duration,
        ...estimateAudioSize(settings, duration),
        wavBytes: wavBytes(settings.sampleRate, 16, settings.channels, duration),
      };
    },

    async exportAudio(settings: AudioExportSettings): Promise<void> {
      if (audible().length === 0) {
        patch({ message: { kind: 'error', text: NOTHING } });
        return;
      }
      try {
        validateAudioExport(settings);
      } catch (error) {
        patch({ exporting: { state: 'failed', message: errorText(error) } });
        showError(error);
        return;
      }
      const output = await dialogs.exportAudio(doc().tracks[0]!.name, settings.format);
      if (!output) return;
      patch({ exporting: { state: 'running', progress: 0, output } });
      try {
        const mix = exportMix(settings.channels);
        const job = engine.encodeAudio(
          { sampleRate: doc().rate, channels: mix.channels },
          output,
          settings,
        );
        exportJob = job;
        await job.done;
        patch({
          exporting: { state: 'done', output },
          message: { kind: 'info', text: `Saved to ${output}` },
        });
      } catch (error) {
        if (error instanceof JobCancelledError) {
          patch({ exporting: { state: 'idle' } });
        } else {
          patch({ exporting: { state: 'failed', message: errorText(error) } });
          showError(error);
        }
      } finally {
        exportJob = null;
      }
    },

    cancelExport: () => exportJob?.cancel(),

    dismissMessage: () => patch({ message: null }),

    /** The file type of each format, for the dialog. */
    formats: AUDIO_FORMATS,

    dispose(): void {
      output.stop();
      closeMicrophone();
      stopListening();
    },
  };
}

export type AudioApp = ReturnType<typeof createAudioApp>;
