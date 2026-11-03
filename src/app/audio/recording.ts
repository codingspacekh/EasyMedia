// Recording (A14, X4): the recording panel with its level meter, the count-in, overdubbing (the
// other tracks play while recording), and the take becoming a new track at the playhead.
import { mixTracks } from '../../core/audio/edit.ts';
import { changeSpeed } from '../../core/audio/dsp/speed.ts';
import { createTrack, toSamples } from '../../core/audio/pcm.ts';
import { COUNT_IN_SECONDS } from '../../core/audio/recording.ts';
import { newId } from '../../core/model/factory.ts';
import type { Seconds } from '../../core/model/time.ts';
import type { Microphone, MicrophoneInput } from '../../core/ports.ts';
import type { AudioContext } from './context.ts';
import type { RecordingState } from './state.ts';

/** The level meter falls back by this factor each second (20 dB). */
const LEVEL_FALL_PER_SECOND = 0.1;
const DEFAULT_MIC_RATE = 48000;

export function recordingActions(ctx: AudioContext) {
  const { services, store, patch, doc, showError, run, selectOnly, audible, startPlaying } = ctx;
  const { recorder, output } = services;

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

  /** Closes the microphone and the panel (also when a project is opened, and on quitting). */
  function closeMicrophone(): void {
    stopCountdown();
    microphone?.close();
    microphone = null;
    kept = [];
    store.update((s) => ({ ...s, recording: null }));
  }

  return {
    closeMicrophone,

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
      if (store.get().playing) {
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
        tx.addTrack(
          createTrack({
            id,
            name: `Recording ${taken + 1}`,
            channels,
            offset: toSamples(recordAt, tx.doc.rate) / tx.doc.rate,
          }),
        );
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
  };
}
