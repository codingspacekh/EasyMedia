// Exporting (A16, A17): the mix of everything heard, from 0 s to the end, in the chosen format,
// with its size estimate beforehand and progress while FFmpeg encodes it.
import { docDuration, mixTracks } from '../../core/audio/edit.ts';
import { JobCancelledError } from '../../core/model/errors.ts';
import {
  AUDIO_FORMATS,
  estimateAudioSize,
  validateAudioExport,
  wavBytes,
  type AudioExportSettings,
} from '../../core/render/audio-formats.ts';
import type { AudioContext } from './context.ts';
import { NOTHING } from './state.ts';

export function exportActions(ctx: AudioContext) {
  const { services, store, patch, doc, errorText, showError, showProblem, audible } = ctx;
  const { engine, dialogs } = services;

  let exportJob: { id: string; cancel(): void } | null = null;
  const stopListening = engine.onJobEvent((e) => {
    const ex = store.get().exporting;
    if (e.type === 'progress' && exportJob?.id === e.jobId && ex.state === 'running')
      patch({ exporting: { ...ex, progress: e.ratio } });
  });

  /** The mix that is exported: everything heard, from 0 s to the end. */
  function exportMix(channels: number) {
    return mixTracks(doc(), audible(), { from: 0, channels });
  }

  return {
    /** Stops following FFmpeg's progress (on quitting). */
    stopListening,

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
        showProblem(NOTHING);
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

    /** The file type of each format, for the dialog. */
    formats: AUDIO_FORMATS,
  };
}
