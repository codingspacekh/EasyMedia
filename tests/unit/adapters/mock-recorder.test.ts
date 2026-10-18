import { describe } from 'vitest';
import { createMockRecorder } from '../../../src/adapters/mock/recorder.ts';
import { recorderContract } from '../../contract/recorder.contract.ts';

describe('mock recorder', () => {
  recorderContract(() => {
    const recorder = createMockRecorder({ rate: 48000 });
    return {
      recorder,
      speak: async (samples) => recorder.speak(samples),
      refuse: (problem) => recorder.refuse(problem),
      microphones: [
        { id: 'built-in', label: 'Built-in Microphone' },
        { id: 'usb', label: 'Headset Microphone (USB)' },
      ],
      rate: 48000,
    };
  });
});
