// Sounds in an animation (AN28): a sound file or a built-in sound effect (X8) added at the
// playhead, moved, trimmed, made louder or quieter, faded, muted and deleted (each one undo step),
// and heard while the animation plays: the sounds from the playhead are mixed (core/animation/
// sound.ts) and played on the app's speakers, stopped by any pause.
import * as cmd from '../animation-commands.ts';
import { mixSounds, soundsHeard, type SoundSamples } from '../../core/animation/sound.ts';
import { parseFrame } from '../../core/animation/time.ts';
import type { AnimSound, Id } from '../../core/animation/types.ts';
import { makeSoundEffect, soundEffect } from '../../core/audio/sound-effects.ts';
import { encodeWav } from '../../core/audio/wav.ts';
import { EditError } from '../../core/model/errors.ts';
import { newId } from '../../core/model/factory.ts';
import type { ProjectFiles } from '../../core/ports.ts';
import { fileNameOf } from '../../core/project/relocate.ts';
import type { AnimationContext } from './context.ts';

/** AN28: the rate the sounds are mixed and played at, and sound effects are saved at (X8). */
export const SOUND_RATE = 48000;

const TYPE_TIME = 'Type a frame number, or a time such as 3 s or 0:03.00.';

/** X8: a built-in sound effect saved as a WAV in the app's folder: its path and length. */
export async function saveSoundEffect(
  files: ProjectFiles,
  id: string,
): Promise<{ path: string; duration: number }> {
  const channels = makeSoundEffect(id, SOUND_RATE);
  const path = await files.saveSound(id, encodeWav(channels, SOUND_RATE));
  return { path, duration: channels[0]!.length / SOUND_RATE };
}

/** AN28: what the sound's bar changes; undefined takes an optional field off. */
export type SoundChange = {
  [K in 'volume' | 'offset' | 'length' | 'fadeIn' | 'fadeOut' | 'muted']?: AnimSound[K] | undefined;
};

export function soundActions(ctx: AnimationContext) {
  const { store, patch, present, showError, run, edit, services } = ctx;
  const { dialogs, engine, files, audioOutput } = services;

  /** A sound at the playhead, as long as its file. */
  const place = (fields: Pick<AnimSound, 'name' | 'path' | 'duration'> & { effect?: string }) => {
    const sound: AnimSound = {
      id: newId(),
      ...fields,
      start: Math.min(store.get().frame, Math.max(0, present().stage.length - 1)),
      volume: 100,
    };
    run(cmd.addSound(sound));
  };

  // ---- hearing the sounds while the animation plays ----

  /** Each sound's samples at SOUND_RATE, decoded once (a sound effect is made, not read). */
  const samples = new Map<string, Promise<SoundSamples | null>>();
  function samplesOf(sound: AnimSound): Promise<SoundSamples | null> {
    const key = sound.effect && soundEffect(sound.effect) ? `effect:${sound.effect}` : sound.path;
    let found = samples.get(key);
    if (!found) {
      found = key.startsWith('effect:')
        ? Promise.resolve({
            sampleRate: SOUND_RATE,
            channels: makeSoundEffect(sound.effect!, SOUND_RATE),
          })
        : engine.decodeAudio(sound.path, SOUND_RATE).catch(() => null);
      samples.set(key, found);
    }
    return found;
  }

  /** Each play is a turn: a mix still decoding when the animation is paused is not played. */
  let turn = 0;
  const speakers = audioOutput;
  if (speakers)
    ctx.setSoundtrack({
      async play(from: number, end: number) {
        const mine = ++turn;
        const doc = present();
        const heard = soundsHeard(doc);
        if (heard.length === 0) return;
        const loaded = new Map<Id, SoundSamples | null>();
        await Promise.all(heard.map(async (s) => loaded.set(s.id, await samplesOf(s))));
        if (mine !== turn || !store.get().playing) return;
        // Decoding may have taken a moment: the sound starts where the playhead is now.
        const at = Math.min(end, Math.max(from, store.get().frame));
        const channels = mixSounds(doc, (s) => loaded.get(s.id) ?? null, SOUND_RATE, at, end);
        speakers.play({ sampleRate: SOUND_RATE, channels }, { loop: false, onEnded: () => {} });
      },
      stop() {
        turn++;
        speakers.stop();
      },
    });

  return {
    /** AN28 *Add sound…*: a sound file (MP3, WAV, M4A, AAC, OGG or FLAC) at the playhead. */
    async addSound(): Promise<void> {
      const path = await dialogs.openSound();
      if (!path) return;
      try {
        const info = await engine.probe(path);
        if (info.kind !== 'audio' || !info.audio || !info.duration)
          throw new EditError('Choose a sound file, such as an MP3 or WAV.');
        place({ name: fileNameOf(path), path, duration: info.duration });
      } catch (error) {
        showError(error);
      }
    },

    /** AN28, X8 *Add a sound effect…*: a built-in sound at the playhead. */
    async addSoundEffect(effectId: string): Promise<void> {
      const effect = soundEffect(effectId);
      if (!effect) {
        patch({
          message: { kind: 'error', text: `There is no sound effect called "${effectId}".` },
        });
        return;
      }
      try {
        const { path, duration } = await saveSoundEffect(files, effectId);
        place({ name: effect.name, path, duration, effect: effectId });
      } catch (error) {
        showError(error);
      }
    },

    /**
     * AN28: the sound's volume, trim, fades or mute (a field set to undefined is taken off: no
     * trim, no fade, heard); returns why not (for the field).
     */
    setSound: (id: Id, change: SoundChange): string | null =>
      edit(
        cmd.changeSound(id, 'Change sound', (s) => {
          const next = { ...s, ...change } as AnimSound & SoundChange;
          for (const key of Object.keys(change) as (keyof SoundChange)[])
            if (next[key] === undefined) delete next[key];
          return next as AnimSound;
        }),
      ),

    /** AN28: the sound dragged on the timeline to start at `frame` (not before frame 0). */
    moveSound: (id: Id, frame: number): void =>
      void run(
        cmd.changeSound(id, 'Move sound', (s) => ({ ...s, start: Math.max(0, Math.round(frame)) })),
      ),

    /** AN28: the sound's start typed as a frame or a time (72, 3 s, 0:03.00); returns why not. */
    setSoundStart(id: Id, text: string): string | null {
      const frame = parseFrame(text, present().stage.fps);
      if (frame === null) return TYPE_TIME;
      return edit(cmd.changeSound(id, 'Move sound', (s) => ({ ...s, start: frame })));
    },

    removeSound: (id: Id): void => void run(cmd.removeSound(id)),
  };
}
