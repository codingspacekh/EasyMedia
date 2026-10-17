// Shared behaviour every Recorder must have (MILESTONES M10: recorder adapter contract test with
// a fake microphone stream). Run against the mock and the MediaStream adapter, so the mock the
// app tests use cannot drift from the real one.
import { expect, it } from 'vitest';
import { MicrophoneError, type MicrophoneProblem } from '../../src/core/model/errors.ts';
import type { Recorder } from '../../src/core/ports.ts';

export interface RecorderSetup {
  recorder: Recorder;
  /** The fake microphone "hears" these samples (it may deliver them in several blocks). */
  speak(samples: Float32Array): Promise<void>;
  /** From now on, opening fails for this reason. */
  refuse(problem: MicrophoneProblem): void;
  /** The fake microphones, the first being the default; they all run at `rate`. */
  microphones: { id: string; label: string }[];
  rate: number;
}

const ramp = (n: number) => Float32Array.from({ length: n }, (_, i) => i / n);

export function recorderContract(setup: () => RecorderSetup): void {
  it('lists the microphones with their names', async () => {
    const s = setup();
    expect(await s.recorder.microphones()).toEqual(s.microphones);
  });

  it('opens the default microphone and delivers what it hears, in order, at its rate', async () => {
    const s = setup();
    const blocks: Float32Array[] = [];
    const input = await s.recorder.open(null, (b) => blocks.push(b.slice()));
    expect(input.sampleRate).toBe(s.rate);
    expect(input.label).toBe(s.microphones[0]!.label);
    await s.speak(ramp(3000));
    const heard = Float32Array.from(blocks.flatMap((b) => [...b]));
    expect(heard).toEqual(ramp(3000));
    input.close();
  });

  it('opens the microphone the student chose', async () => {
    const s = setup();
    const input = await s.recorder.open(s.microphones[1]!.id, () => {});
    expect(input.label).toBe(s.microphones[1]!.label);
    input.close();
  });

  it('delivers nothing after it is closed', async () => {
    const s = setup();
    const blocks: Float32Array[] = [];
    const input = await s.recorder.open(null, (b) => blocks.push(b));
    input.close();
    await s.speak(ramp(1000));
    expect(blocks).toEqual([]);
  });

  it.each(['denied', 'none', 'busy'] as const)(
    'when the microphone cannot be used (%s) it says why',
    async (problem) => {
      const s = setup();
      s.refuse(problem);
      const opening = s.recorder.open(null, () => {});
      await expect(opening).rejects.toBeInstanceOf(MicrophoneError);
      await expect(opening).rejects.toMatchObject({ problem });
    },
  );
}
