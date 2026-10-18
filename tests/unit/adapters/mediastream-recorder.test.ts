// The MediaStream recorder with a fake microphone stream: fake devices, a fake track and a fake
// frame reader stand in for Chromium's getUserMedia and MediaStreamTrackProcessor.
import { describe, expect, it, vi } from 'vitest';
import {
  createMediaStreamRecorder,
  type AudioFrame,
} from '../../../src/adapters/webaudio/recorder.ts';
import type { MicrophoneProblem } from '../../../src/core/model/errors.ts';
import { recorderContract } from '../../contract/recorder.contract.ts';

const RATE = 44100;
const DEVICES = [
  { kind: 'audioinput', deviceId: 'built-in', label: 'Built-in Microphone' },
  { kind: 'videoinput', deviceId: 'cam', label: 'FaceTime HD Camera' },
  { kind: 'audioinput', deviceId: 'usb', label: 'Headset Microphone (USB)' },
  { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers' },
];
const BROWSER_ERROR: Record<MicrophoneProblem, string> = {
  denied: 'NotAllowedError',
  none: 'NotFoundError',
  busy: 'NotReadableError',
};

/** A frame of mono f32 samples, as AudioData gives them. */
const frame = (samples: Float32Array): AudioFrame => ({
  numberOfFrames: samples.length,
  copyTo: (into) => into.set(samples),
  close: () => {},
});

function fakeBrowser() {
  let controller: ReadableStreamDefaultController<AudioFrame> | null = null;
  let refusal: MicrophoneProblem | null = null;
  let access = true;
  const stopped = vi.fn();
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    if (refusal) throw new DOMException('refused', BROWSER_ERROR[refusal]);
    const audio = constraints.audio as MediaTrackConstraints;
    const id = (audio.deviceId as { exact: string } | undefined)?.exact ?? 'built-in';
    const label = DEVICES.find((d) => d.deviceId === id)!.label;
    const track = { label, getSettings: () => ({ sampleRate: RATE }), stop: stopped };
    return { getAudioTracks: () => [track] } as unknown as MediaStream;
  });
  const recorder = createMediaStreamRecorder({
    mediaDevices: {
      enumerateDevices: async () => DEVICES as MediaDeviceInfo[],
      getUserMedia,
    },
    frames: () =>
      new ReadableStream<AudioFrame>({
        start: (c) => {
          controller = c;
        },
      }),
    askAccess: async () => access,
    platform: 'mac',
  });
  return {
    recorder,
    getUserMedia,
    stopped,
    async speak(samples: Float32Array) {
      for (let i = 0; i < samples.length; i += 1000) {
        try {
          controller?.enqueue(frame(samples.slice(i, i + 1000)));
        } catch {
          // closed: the microphone hears nothing more
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    refuse(problem: MicrophoneProblem) {
      refusal = problem;
    },
    denyAccess() {
      access = false;
    },
  };
}

describe('MediaStream recorder (with a fake microphone stream)', () => {
  recorderContract(() => {
    const b = fakeBrowser();
    return {
      recorder: b.recorder,
      speak: (samples) => b.speak(samples),
      refuse: (problem) => b.refuse(problem),
      microphones: [
        { id: 'built-in', label: 'Built-in Microphone' },
        { id: 'usb', label: 'Headset Microphone (USB)' },
      ],
      rate: RATE,
    };
  });

  it('asks for the plain voice: no echo cancelling, noise suppression or automatic gain', async () => {
    const b = fakeBrowser();
    (await b.recorder.open(null, () => {})).close();
    expect(b.getUserMedia).toHaveBeenCalledWith({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it('X4: macOS permission denied gives the friendly message without opening the microphone', async () => {
    const b = fakeBrowser();
    b.denyAccess();
    await expect(b.recorder.open(null, () => {})).rejects.toThrow(
      /System Settings ▸ Privacy & Security ▸ Microphone/,
    );
    expect(b.getUserMedia).not.toHaveBeenCalled();
  });

  it('closing stops the microphone (its light goes off)', async () => {
    const b = fakeBrowser();
    (await b.recorder.open(null, () => {})).close();
    expect(b.stopped).toHaveBeenCalled();
  });

  it('microphones without a name yet (before permission) are numbered', async () => {
    const recorder = createMediaStreamRecorder({
      mediaDevices: {
        enumerateDevices: async () =>
          [{ kind: 'audioinput', deviceId: 'a', label: '' }] as MediaDeviceInfo[],
        getUserMedia: vi.fn(),
      },
      frames: vi.fn(),
      askAccess: async () => true,
      platform: 'windows',
    });
    expect(await recorder.microphones()).toEqual([{ id: 'a', label: 'Microphone 1' }]);
  });
});
