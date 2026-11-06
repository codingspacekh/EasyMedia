// Tracks (A1, A2, A6, A15): importing sound as tracks, adding, removing, moving and aligning
// them, their settings, mute and solo, and mixing them down.
import { makeSoundEffect, soundEffect } from '../../core/audio/sound-effects.ts';
import {
  alignEndToEnd,
  alignStartTo,
  mixAndRender,
  moveTrackBy,
  stereoToMonoTracks,
} from '../../core/audio/edit.ts';
import { createTrack, silence, type AudioTrack } from '../../core/audio/pcm.ts';
import { EditError, MediaError } from '../../core/model/errors.ts';
import { newId } from '../../core/model/factory.ts';
import type { Id } from '../../core/model/types.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AudioContext } from './context.ts';
import { baseName } from './state.ts';

/** X8: the rate a sound effect is played at when heard in the Sound effects box. */
const HEAR_RATE = 48000;

export function trackActions(ctx: AudioContext) {
  const { services, store, patch, doc, selection, showError, showProblem, run, selectOnly } = ctx;
  const { engine, dialogs } = services;
  /** A sound effect is being heard (not Audio mode's own playing). */
  let hearing = false;
  return {
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

    /** X8: a built-in sound effect as a new track, starting at the cursor (the selection start). */
    addSoundEffect(effectId: string): void {
      const effect = soundEffect(effectId);
      if (!effect) {
        showProblem(`There is no sound effect called "${effectId}".`);
        return;
      }
      const id = newId();
      const channels = makeSoundEffect(effectId, doc().rate);
      const offset = selection().start;
      run(`Add sound effect ${effect.name}`, (tx) =>
        tx.addTrack(createTrack({ id, name: effect.name, channels, offset })),
      );
      selectOnly(id);
    },

    /** X8: plays a sound effect once, to hear it before adding it (stops anything playing). */
    hearSoundEffect(effectId: string): void {
      if (!soundEffect(effectId)) return;
      services.output.stop();
      if (store.get().playing) patch({ playing: false });
      const rate = HEAR_RATE;
      hearing = true;
      services.output.play(
        { sampleRate: rate, channels: makeSoundEffect(effectId, rate) },
        { loop: false, onEnded: () => (hearing = false) },
      );
    },

    /** X8: the Sound effects box closes: a sound still being heard stops. */
    stopHearing(): void {
      if (hearing) services.output.stop();
      hearing = false;
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
        showProblem('Select a track first: click on its waveform.');
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
  };
}
