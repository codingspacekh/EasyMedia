// A14 Recording a voiceover: the advice under the input level meter (design screen 15).
export { microphoneMessage } from '../model/errors.ts';

/** Seconds counted down before recording starts (the "3-second count-in"). */
export const COUNT_IN_SECONDS = 3;
const QUIET = 10 ** (-30 / 20); // below −30 dB the voice is too quiet
const CLIPPING = 0.99; // at full level the sound clips

export interface LevelAdvice {
  kind: 'quiet' | 'good' | 'loud';
  text: string;
}

/** `peak`: the loudest sample just heard (0 to 1). */
export function levelAdvice(peak: number): LevelAdvice {
  if (peak <= 0)
    return { kind: 'quiet', text: 'Nothing heard — is the microphone plugged in and switched on?' };
  if (peak < QUIET)
    return { kind: 'quiet', text: 'Too quiet — speak up or move closer to the microphone' };
  if (peak >= CLIPPING)
    return { kind: 'loud', text: 'Too loud — clipping; move back from the microphone' };
  return { kind: 'good', text: 'Good level — not too quiet, no clipping' };
}
