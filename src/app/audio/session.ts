// Saving with the project (P1, P3, P7 for Audio mode): each track's sound written as an exact
// 32-bit WAV, only when it changed; opening a saved session (a lost file loses only its track's
// clips); whether there is unsaved work; a new project.
import { createAudioHistory } from '../../core/audio/history.ts';
import {
  emptyDoc,
  type AudioClip,
  type AudioDoc,
  type AudioTrack,
  type Channels,
} from '../../core/audio/pcm.ts';
import type { AudioModeSession, SavedAudioTrack } from '../../core/model/types.ts';
import { defaultAudioExport } from '../../core/render/audio-formats.ts';
import type { AudioContext } from './context.ts';
import type { AudioState } from './state.ts';

/** `closeMicrophone`: opening other work closes the recording panel. */
export function sessionActions(ctx: AudioContext, closeMicrophone: () => void) {
  const { services, store, doc, undoSteps } = ctx;
  const { engine } = services;

  /** The session as last saved or opened: anything else is unsaved work. */
  let savedDoc: AudioDoc = doc();
  /**
   * The samples each file holds (samples never change in place). Undo can bring back samples
   * whose file has since been written with others, so a file is trusted only if it still
   * holds the very same samples.
   */
  let written = new Map<string, WeakRef<Channels>>();

  /** Starts Audio mode over with `fresh` (opening a project, or a new one). */
  function replaceDoc(fresh: AudioDoc, message: AudioState['message'] = null): void {
    closeMicrophone();
    store.update((s) => ({
      ...s,
      history: createAudioHistory(fresh),
      selection: { start: 0, end: 0, tracks: [] },
      clip: null,
      position: 0,
      noiseProfile: null,
      message,
    }));
    savedDoc = doc();
    undoSteps.historyChanged();
  }

  return {
    /** Edits made since the session was last saved or opened. */
    isDirty: (): boolean => doc() !== savedDoc,

    /**
     * Writes each track's sound to `folder` as an exact 32-bit WAV (only tracks that changed)
     * and gives what the project file keeps; null when Audio mode has nothing in it.
     */
    async saveSession(
      folder: string,
      { copy = false }: { copy?: boolean } = {},
    ): Promise<AudioModeSession | null> {
      const current = doc();
      if (current.tracks.length === 0) {
        if (!copy) savedDoc = current;
        return null;
      }
      const tracks: SavedAudioTrack[] = [];
      const names = new Map<Channels, string>();
      for (const track of current.tracks) {
        const clips = [];
        for (const clip of track.clips) {
          // One file per set of samples, named after the first clip using them (the halves of
          // a split clip share it).
          const file = names.get(clip.source) ?? `${folder}/clip-${clip.id}.wav`;
          names.set(clip.source, file);
          if (written.get(file)?.deref() !== clip.source) {
            await engine.encodeAudio({ sampleRate: current.rate, channels: clip.source }, file, {
              ...defaultAudioExport({ rate: current.rate, channels: track.channelCount }),
              format: 'wav',
              bitDepth: 32,
              sampleRate: current.rate,
              channels: track.channelCount >= 2 ? 2 : 1,
            }).done;
            written.set(file, new WeakRef(clip.source));
          }
          clips.push({ id: clip.id, file, offset: clip.offset, in: clip.in, out: clip.out });
        }
        tracks.push({
          id: track.id,
          name: track.name,
          channels: track.channelCount,
          clips,
          gain: track.gain,
          pan: track.pan,
          ...(track.bits ? { bits: track.bits } : {}),
        });
      }
      // A copy (crash recovery, Package project) is not a save: the edits stay unsaved.
      if (!copy) savedDoc = current;
      return { rate: current.rate, tracks };
    },

    /**
     * Opens the Audio mode work saved in a project (or none), as it was saved. `unsaved`: it was
     * restored after a crash, so it still needs saving.
     */
    async openSession(
      session: AudioModeSession | null,
      { unsaved = false }: { unsaved?: boolean } = {},
    ): Promise<void> {
      written = new Map();
      if (!session) return replaceDoc(emptyDoc());
      const tracks: AudioTrack[] = [];
      const lost: string[] = [];
      const opened = new Map<string, Channels>();
      for (const saved of session.tracks) {
        const clips: AudioClip[] = [];
        let channelCount = saved.channels;
        for (const c of saved.clips) {
          try {
            let source = opened.get(c.file);
            if (!source) {
              source = (await engine.decodeAudio(c.file)).channels;
              opened.set(c.file, source);
              written.set(c.file, new WeakRef(source));
            }
            channelCount ??= source.length;
            const length = source[0]?.length ?? 0;
            const out = Math.min(length, c.out ?? length);
            const from = Math.min(c.in ?? 0, out);
            if (out > from) clips.push({ id: c.id, offset: c.offset, source, in: from, out });
          } catch {
            if (!lost.includes(saved.name)) lost.push(saved.name);
          }
        }
        // A track whose sound is all lost is left out (its other clips stay if one is lost).
        if (saved.clips.length && !clips.length) continue;
        tracks.push({
          id: saved.id,
          name: saved.name,
          channelCount: channelCount ?? 1,
          clips,
          gain: saved.gain,
          pan: saved.pan,
          ...(saved.bits ? { bits: saved.bits } : {}),
        });
      }
      replaceDoc(
        { rate: session.rate, tracks },
        lost.length
          ? {
              kind: 'error',
              text: `The sound of the track "${lost.join('", "')}" could not be found. It may have been moved or deleted from the project's audio folder.`,
            }
          : null,
      );
      if (unsaved) savedDoc = emptyDoc(session.rate);
    },

    /** A new project: Audio mode starts empty. */
    reset(): void {
      written = new Map();
      replaceDoc(emptyDoc());
    },
  };
}
