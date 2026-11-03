// Audio mode use cases (A1–A8, A15–A18): what every button and menu item in Audio mode does.
// The sound lives in memory as samples (core/audio), in clips on tracks that are split, moved
// and trimmed as on the video timeline; every edit is one undoable step (Memento, P5). Errors
// never escape: they become a message for the student. Each area is a module in ./audio/
// sharing one context (the store, running edits as undo steps, the speakers); this file puts
// them together. A new feature is a new module, or one more action in the module of its area.
import { clipActions } from './audio/clips.ts';
import { createAudioContext } from './audio/context.ts';
import { effectActions } from './audio/effects.ts';
import { exportActions } from './audio/exporting.ts';
import { playbackActions } from './audio/playback.ts';
import { recordingActions } from './audio/recording.ts';
import { selectionActions } from './audio/selection.ts';
import { sessionActions } from './audio/session.ts';
import type { AudioDeps } from './audio/state.ts';
import { trackActions } from './audio/tracks.ts';

export {
  DISK_MIN_SAMPLES,
  PREVIEW_SECONDS,
  SILENT_OUTPUT,
  type AudioDeps,
  type AudioExportState,
  type AudioOutput,
  type AudioState,
  type RecordingState,
} from './audio/state.ts';

export function createAudioApp(deps: AudioDeps) {
  const ctx = createAudioContext(deps);
  const { closeMicrophone, ...recording } = recordingActions(ctx);
  const { stopListening, ...exporting } = exportActions(ctx);
  return {
    store: ctx.store,
    ...trackActions(ctx),
    ...clipActions(ctx),
    ...selectionActions(ctx),
    ...sessionActions(ctx, closeMicrophone),
    ...recording,
    ...effectActions(ctx),
    ...playbackActions(ctx),
    ...exporting,
    dismissMessage: () => ctx.patch({ message: null }),
    dispose(): void {
      deps.output.stop();
      closeMicrophone();
      stopListening();
    },
  };
}

export type AudioApp = ReturnType<typeof createAudioApp>;
