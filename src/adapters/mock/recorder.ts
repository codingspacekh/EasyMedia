// A fake microphone for tests: it "hears" whatever the test says and can refuse to open (X4).
import { MicrophoneError, type MicrophoneProblem, type Platform } from '../../core/model/errors.ts';
import type { Microphone, Recorder } from '../../core/ports.ts';

const BLOCK = 1024;

export interface MockRecorder extends Recorder {
  /** The open microphone hears these samples, delivered in blocks. */
  speak(samples: Float32Array): void;
  /** From now on, opening fails for this reason (null: it works again). */
  refuse(problem: MicrophoneProblem | null): void;
  readonly isOpen: boolean;
}

export function createMockRecorder({
  microphones = [
    { id: 'built-in', label: 'Built-in Microphone' },
    { id: 'usb', label: 'Headset Microphone (USB)' },
  ],
  rate = 48000,
  platform = 'mac',
}: { microphones?: Microphone[]; rate?: number; platform?: Platform } = {}): MockRecorder {
  let listener: ((samples: Float32Array) => void) | null = null;
  let refusal: MicrophoneProblem | null = null;
  return {
    microphones: async () => microphones.map((m) => ({ ...m })),
    async open(id, onBlock) {
      if (refusal) throw new MicrophoneError(refusal, platform);
      const microphone = microphones.find((m) => m.id === id) ?? microphones[0];
      if (!microphone) throw new MicrophoneError('none', platform);
      listener = onBlock;
      return {
        sampleRate: rate,
        label: microphone.label,
        close: () => {
          if (listener === onBlock) listener = null;
        },
      };
    },
    speak(samples) {
      for (let i = 0; i < samples.length; i += BLOCK) listener?.(samples.slice(i, i + BLOCK));
    },
    refuse(problem) {
      refusal = problem;
    },
    get isOpen() {
      return listener !== null;
    },
  };
}
