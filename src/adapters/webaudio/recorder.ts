// Recorder with the browser's MediaStream (A14, X4): getUserMedia opens the microphone and
// Chromium's MediaStreamTrackProcessor hands over its samples as frames. No AudioWorklet is
// needed (the page's security policy allows no scripts from blobs). The voice is asked for
// plain: no echo cancelling, noise suppression or automatic gain, so what the student hears
// back is what they said.
import { MicrophoneError, type MicrophoneProblem, type Platform } from '../../core/model/errors.ts';
import type { Recorder } from '../../core/ports.ts';

/** The part of WebCodecs' AudioData the recorder uses. */
export interface AudioFrame {
  readonly numberOfFrames: number;
  copyTo(destination: Float32Array, options: { planeIndex: number; format: 'f32-planar' }): void;
  close(): void;
}

export interface MediaStreamRecorderDeps {
  mediaDevices: Pick<MediaDevices, 'enumerateDevices' | 'getUserMedia'>;
  /** The sound of a microphone track as frames (MediaStreamTrackProcessor in Chromium). */
  frames(track: MediaStreamTrack): ReadableStream<AudioFrame>;
  /** X4: asks the system for permission first (macOS); false when it is refused. */
  askAccess(): Promise<boolean>;
  platform: Platform;
}

const DEFAULT_RATE = 48000;

/** Which X4 problem a getUserMedia error means. */
function problemOf(error: unknown): MicrophoneProblem | null {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'none';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return null;
}

export function createMediaStreamRecorder(deps: MediaStreamRecorderDeps): Recorder {
  const fail = (problem: MicrophoneProblem) => new MicrophoneError(problem, deps.platform);
  return {
    async microphones() {
      const devices = await deps.mediaDevices.enumerateDevices();
      return devices
        .filter((d) => d.kind === 'audioinput')
        .map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
    },

    async open(microphoneId, onBlock) {
      if (!(await deps.askAccess())) throw fail('denied');
      let stream: MediaStream;
      try {
        stream = await deps.mediaDevices.getUserMedia({
          audio: {
            ...(microphoneId ? { deviceId: { exact: microphoneId } } : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (error) {
        const problem = problemOf(error);
        throw problem ? fail(problem) : error;
      }
      const track = stream.getAudioTracks()[0];
      if (!track) throw fail('none');
      const reader = deps.frames(track).getReader();
      let open = true;
      void (async () => {
        while (open) {
          const { value, done } = await reader
            .read()
            .catch(() => ({ value: undefined, done: true }));
          if (done || !value) break;
          const samples = new Float32Array(value.numberOfFrames);
          value.copyTo(samples, { planeIndex: 0, format: 'f32-planar' });
          value.close();
          if (open) onBlock(samples);
        }
      })();
      return {
        sampleRate: track.getSettings().sampleRate ?? DEFAULT_RATE,
        label: track.label,
        close() {
          if (!open) return;
          open = false;
          void reader.cancel().catch(() => {});
          track.stop();
        },
      };
    },
  };
}
