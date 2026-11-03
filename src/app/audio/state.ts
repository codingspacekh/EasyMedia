// Audio mode's state and the services it is given (the ports), with the few constants and
// helpers more than one of its modules uses.
import type { CopiedSound, Selection } from '../../core/audio/edit.ts';
import type { AudioHistory } from '../../core/audio/history.ts';
import type { NoiseProfile } from '../../core/audio/dsp/noise.ts';
import type { Channels } from '../../core/audio/pcm.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { Id } from '../../core/model/types.ts';
import type { Dialogs, MediaEngine, Microphone, Recorder, UndoStore } from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';

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
  /** The clip clicked last (as on the video timeline): Split, Join and Delete work on it. */
  clip: Id | null;
  /** Audio position: where playing starts (the playhead). */
  position: Seconds;
  clipboard: CopiedSound | null;
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

/** How much of the selection an effect's Preview plays (as Audacity). */
export const PREVIEW_SECONDS = 6;

export const UNEXPECTED = 'Something went wrong. Please try again.';
export const NOTHING =
  'Import a sound first (Import audio, or Tracks ▸ Import audio as new track).';

/** A selection's time range as shown in undo step names and messages. */
export const range = (s: Pick<Selection, 'start' | 'end'>) =>
  `${s.start.toFixed(2)} – ${s.end.toFixed(2)} s`;

/** A file's name without its folder and extension (for track names). */
export const baseName = (path: string) => fileNameOf(path).replace(/\.[^.]+$/, '');

/** A silent output, for when no speakers are wired up. */
export const SILENT_OUTPUT: AudioOutput = { play: () => {}, stop: () => {}, elapsed: () => 0 };
